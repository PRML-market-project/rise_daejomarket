from flask import Flask, request, jsonify, send_file
import torch
from transformers import WhisperForConditionalGeneration, WhisperProcessor
import torchaudio
import os
import json
import base64
from openai import OpenAI
import io
import wave
import threading
import traceback
from flask_cors import CORS
import logging
from jamo import hangul_to_jamo
import Levenshtein
import langdetect
import re
from dotenv import load_dotenv
from pathlib import Path
import time
from functools import wraps
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen
from tts_text_normalizer import normalize_korean_tts_text


# ==========================================
# ✅ 공용 타이밍 유틸 (추가)
# ==========================================
def now_ms() -> float:
    return time.perf_counter() * 1000

class Timer:
    def __init__(self):
        self.t0 = now_ms()
        self.marks = {}
    def mark(self, name: str):
        self.marks[name] = now_ms()
    def result(self):
        # t0 기준 상대 ms로 변환
        out = {}
        prev = self.t0
        for k, t in self.marks.items():
            out[f"{k}_since_start_ms"] = round(t - self.t0, 2)
            out[f"{k}_delta_ms"] = round(t - prev, 2)
            prev = t
        out["total_ms"] = round(now_ms() - self.t0, 2)
        return out


# ==========================================
# 1. 초기 설정 및 환경 변수
# ==========================================
DATA_DIR = Path(__file__).resolve().parent.parent / ".venv" / "data"
MAP_FILE = DATA_DIR / "map_simple_list.json"
FRONTEND_MAP_FILE = (
    Path(__file__).resolve().parents[2]
    / "frontend"
    / "ml-test-main"
    / "src"
    / "data"
    / "market-shops.ts"
)

BASE_DIR = Path(__file__).resolve().parent.parent / ".venv" / "data"
BASE_DIR.mkdir(parents=True, exist_ok=True)
# CHAT_HISTORY_DIR = './chat_history/'  # 대화 내역 저장 경로 불필요

print("📂 DATA BASE_DIR =", BASE_DIR)

load_dotenv()

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# 로그 설정
logging.basicConfig(filename="gpt_api_logs.log", level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# 로컬 llama.cpp 서버 설정 (로컬 우선, OpenAI는 폴백)
LOCAL_LLM_BASE_URL = os.getenv(
    "LOCAL_LLM_BASE_URL",
    "http://127.0.0.1:8010/v1",
)
LOCAL_LLM_MODEL = os.getenv("LOCAL_LLM_MODEL", "local-gemma")
LOCAL_LLM_TIMEOUT = float(os.getenv("LOCAL_LLM_TIMEOUT", "300"))
local_client = OpenAI(
    base_url=LOCAL_LLM_BASE_URL,
    api_key="local",
    timeout=LOCAL_LLM_TIMEOUT,
    max_retries=0,
)

LOCAL_TTS_BASE_URL = os.getenv(
    "LOCAL_TTS_BASE_URL",
    "http://127.0.0.1:8020",
).rstrip("/")
LOCAL_TTS_MODEL = os.getenv(
    "LOCAL_TTS_MODEL",
    "qwen3-tts-0.6b-base-q8",
)
LOCAL_TTS_TIMEOUT = float(os.getenv("LOCAL_TTS_TIMEOUT", "300"))
LOCAL_TTS_VOICE = os.getenv("LOCAL_TTS_VOICE", "friendly_female")
LOCAL_TTS_SEED = int(os.getenv("LOCAL_TTS_SEED", "4"))
LOCAL_TTS_VOICE_REFERENCE = (
    Path(__file__).resolve().parent.parent
    / "qwen-tts-server"
    / "voices"
    / "friendly-female-reference.wav"
)
_local_tts_voice_lock = threading.Lock()

# OpenAI 클라이언트는 로컬 모델 실패 시에만 사용
api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=api_key) if api_key else None
print("OPENAI fallback enabled:", bool(client))

# Whisper 모델 로딩
try:
    model = WhisperForConditionalGeneration.from_pretrained("openai/whisper-tiny").to(device)
    processor = WhisperProcessor.from_pretrained("openai/whisper-tiny")
    print("🔥 Whisper 모델 로딩 완료")
except Exception as e:
    print(f"❌ Whisper 모델 로딩 실패: {e}")

# 🔥 Flask 앱 초기화
app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": ["https://prmlfrontend.vercel.app", "http://localhost:5173"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "ngrok-skip-browser-warning", "cf-create-tunnel"]
    }
})


# ==========================================
# 2. 유틸리티 함수
# ==========================================

def local_chat_completion(messages, temperature=0.0, max_tokens=1024, json_mode=False):
    """
    기존 OpenAI messages 구조를 그대로 받아 로컬 llama.cpp 서버로 처리한다.
    Gemma 계열의 system role 제약을 피하기 위해 system 지침은 첫 user 메시지에 합친다.
    """
    system_parts = [
        message["content"] for message in messages if message.get("role") == "system"
    ]
    conversation = [
        dict(message) for message in messages if message.get("role") != "system"
    ]

    if system_parts:
        system_text = "\n\n".join(system_parts)
        if conversation and conversation[0].get("role") == "user":
            conversation[0]["content"] = (
                f"{system_text}\n\n[사용자 입력]\n{conversation[0]['content']}"
            )
        else:
            conversation.insert(0, {"role": "user", "content": system_text})

    kwargs = {
        "model": LOCAL_LLM_MODEL,
        "messages": conversation,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "extra_body": {
            "chat_template_kwargs": {
                "enable_thinking": False,
            },
        },
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    response = local_client.chat.completions.create(**kwargs)

    content = response.choices[0].message.content
    if not isinstance(content, str) or not content.strip():
        raise RuntimeError("로컬 LLM이 빈 응답을 반환했습니다.")
    return content.strip()


def openai_chat_completion(messages, model, temperature=None, max_tokens=None, json_mode=False):
    if client is None:
        raise RuntimeError("OPENAI_API_KEY가 없어 OpenAI 폴백을 사용할 수 없습니다.")

    kwargs = {
        "model": model,
        "messages": messages,
    }
    if temperature is not None:
        kwargs["temperature"] = temperature
    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    response = client.chat.completions.create(**kwargs)
    return response.choices[0].message.content.strip()


def detect_language(text):
    try:
        return langdetect.detect(text)
    except:
        return "unknown"


def load_menu_db(admin_id):
    path = BASE_DIR / f"{admin_id}.json"
    if not os.path.exists(path):
        raise FileNotFoundError(f"{path} 파일이 존재하지 않습니다.")

    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    phrases = set()
    for category in data.get("categories", []):
        phrases.add(category["categoryName"])
        for menu in category.get("menus", []):
            phrases.add(menu["menuName"])

    return list(phrases)


def load_map_simple_list():
    if MAP_FILE.is_file():
        with open(MAP_FILE, "r", encoding="utf-8") as f:
            map_data = json.load(f)
    elif FRONTEND_MAP_FILE.is_file():
        source = FRONTEND_MAP_FILE.read_text(encoding="utf-8")
        matches = re.findall(
            r'\{\s*id:\s*"([^"]+)".*?name:\s*"([^"]+)"',
            source,
        )
        map_data = [{"id": shop_id, "name": name} for shop_id, name in matches]
        if not map_data:
            raise ValueError(
                f"프런트 지도 데이터에서 점포를 찾지 못했습니다: {FRONTEND_MAP_FILE}"
            )
    else:
        raise FileNotFoundError(
            "길찾기 지도 데이터가 없습니다. "
            f"확인 경로: {MAP_FILE}, {FRONTEND_MAP_FILE}"
        )

    return ", ".join(f"{item['id']}:{item['name']}" for item in map_data)


def jamo_distance(a, b):
    a_jamo = ''.join(hangul_to_jamo(a))
    b_jamo = ''.join(hangul_to_jamo(b))
    return Levenshtein.distance(a_jamo, b_jamo)


def clean_text(phrase):
    조사 = ['을', '를', '이', '가', '은', '는', '과', '와', '랑', '도', '에', '에서']
    phrase = phrase.replace(' ', '')
    for j in 조사:
        if phrase.endswith(j):
            phrase = phrase[:-len(j)]
    return phrase


def generate_ngrams(tokens, max_len=2):
    ngrams = []
    for i in range(len(tokens)):
        for j in range(i + 1, min(i + max_len + 1, len(tokens) + 1)):
            phrase = ' '.join(tokens[i:j])
            ngrams.append((i, j, phrase))
    return ngrams


def replace_phrases(text, admin_id, threshold=2):
    try:
        menus = load_menu_db(admin_id)
        menus += ["주문해줘", "추가해줘", "담아줘", "주문내역"]
    except Exception as e:
        print(f"menu DB 로딩 중 오류 (replace_phrases): {e}")
        return text

    tokens = text.split()
    ngrams = generate_ngrams(tokens)
    replacements = []

    for start, end, phrase in ngrams:
        cleaned = clean_text(phrase)
        best_match = None
        best_score = float('inf')
        for menu in menus:
            dist = jamo_distance(cleaned, menu)
            if dist < best_score:
                best_score = dist
                best_match = menu
        if best_score <= threshold:
            replacements.append((start, end, best_match))

    filtered = []
    used = set()
    for start, end, match in sorted(replacements, key=lambda x: -(x[1] - x[0])):
        if not any(i in used for i in range(start, end)):
            filtered.append((start, end, match))
            used.update(range(start, end))

    for start, end, match in reversed(filtered):
        tokens[start:end] = [match]

    return ' '.join(tokens)


def transform_categories(language, cat_list):
    result = []
    for cat in cat_list:
        transformed_menus = []
        for menu in cat.get('menus', []):
            price = int(menu['menuPrice']) if isinstance(menu['menuPrice'], float) else menu['menuPrice']
            count = menu.get('menuCount', '1개')

            if language == 'ko':
                # [id, name, price, count]
                transformed_menus.append([menu['menuId'], menu['menuName'], price, count])
            elif language == 'en':
                transformed_menus.append([menu['menuId'], menu['menuNameEn'], price, count])
            elif language == 'vi':
                transformed_menus.append([
                    menu['menuId'],
                    menu.get('menuNameVi') or menu.get('menuNameEn') or menu['menuName'],
                    price,
                    count
                ])
            else:
                transformed_menus.append([
                    menu['menuId'],
                    menu['menuName'],
                    menu.get('menuNameEn'),
                    menu.get('menuNameVi'),
                    price,
                    count
                ])

        # categoryType 추출 (없을 경우 빈 문자열)
        category_type = cat.get('categoryType', '')

        result.append({
            "categoryId": cat['categoryId'],
            "categoryName": cat['categoryName'],
            "categoryNameEn": cat['categoryNameEn'],
            "categoryNameVi": cat.get('categoryNameVi') or cat.get('categoryNameEn') or cat['categoryName'],
            "categoryType": category_type,  # ★ 추가됨
            "menus": transformed_menus
        })
    return result

# ==========================================
# 3. 핵심 로직: 인텐트 분류 및 처리
# ==========================================

# [변경] chat_history 인자 제거 및 관련 로직 삭제
def detect_intent(text):
    """
    로컬 LLM을 우선 사용하여 사용자 의도를 1, 2, 3, 4 중 하나로 분류
    """
    prompt = """
다음 문장의 의도를 분석하여 숫자(1~4)만 반환하세요. 다른 말은 절대 하지 마세요.

1. 가게/카테고리 요청: 특정 가게(점포)를 보여달라고 할 때. (ex: 키위 사려는데 어느 가게에서 살 수 있나요?)
2. 메뉴/주문 관련: 특정 메뉴의 가격을 묻거나, 메뉴 추천을 원할 때. (ex: 키위 사려는데 얼마인가요?)
3. 위치/길찾기: 가게의 위치를 물을 때만
4. 총 가격 문의: 각 메뉴들을 샀을 때의 총 가격을 요청할 때

입력:
"""
    messages = [
        {"role": "system", "content": prompt},
        {"role": "user", "content": text}
    ]

    try:
        intent_str = local_chat_completion(
            messages,
            temperature=0.0,
            max_tokens=8,
        )
        match = re.search(r'\d', intent_str)
        if match:
            return int(match.group())
        raise ValueError(f"로컬 LLM 의도 분류 결과에 숫자가 없습니다: {intent_str}")
    except Exception as local_error:
        logging.warning(
            "Local intent detection failed; falling back to OpenAI: %s",
            local_error
        )

    try:
        intent_str = openai_chat_completion(
            messages,
            model="gpt-4o-mini",
            temperature=0.0,
            max_tokens=5,
        )
        match = re.search(r'\d', intent_str)
        if match:
            return int(match.group())
    except Exception as openai_error:
        logging.error(f"OpenAI intent fallback failed: {openai_error}")

    return 4


# [변경] chat_history 인자 제거 및 관련 로직 삭제
def get_response_by_intent(intent, text, admin_id, kiosk_id, language):
    """
    분류된 인텐트에 따라 적절한 데이터와 프롬프트를 구성하여 GPT 호출
    이전 대화 내역은 반영하지 않음.
    """

    system_prompt = "" # 초기화

    # ---------------------------
    # Intent 1, 2, 3, 4 처리
    # ---------------------------
    if intent in [1, 2, 3, 4]:
        admin_json_path = BASE_DIR / f"{admin_id}.json"
        if not os.path.exists(admin_json_path):
            return {"error": "admin_id.json 파일 없음"}

        with open(admin_json_path, 'r', encoding='utf-8') as f:
            admin_data = json.load(f)

        menu_context = transform_categories(language, admin_data.get("categories", []))

        # =====================================================================
        # Language Branch
        # =====================================================================
        if language == "ko":

            # ================================================================
            # Intent 1: 가게(Category) 탐색
            # ================================================================
            if intent == 1:
                system_prompt = f"""
        당신은 시장 길잡이 AI입니다.
        사용자의 목적에 맞는 '가게(Category)'를 찾아주세요.

        [지침]
        1. 사용자가 찾는 메뉴를 [메뉴 데이터]에서 검색하세요.
        2. 여러 가게에서 팔고 있다면 `chat_message`에 가게명을 모두 나열하세요.
        3. `result.items` 배열에 **해당 메뉴를 판매하는 모든 가게의 정보**를 담으세요.
        4. **중요: items[0]은 반드시 가격/판매단위(menuCount)가 최저인 가게여야 합니다.**

        [메뉴 데이터]
        {json.dumps(menu_context, ensure_ascii=False)}

        JSON 출력 예시:
        {{
          "user_message": "{text}",
          "chat_message": "키위는 'A농산', 'B청과', 'C유통'에서 판매 중입니다. 가장 저렴한 곳은 'B청과'입니다.",
          "result": {{
            "status": "success",
            "intent": "get_store",
            "items": [
              {{ "category_id": 10, "category_type": "청과", "menu_id": null }},
              {{ "category_id": 12, "category_type": "청과", "menu_id": null }},
              {{ "category_id": 15, "category_type": "청과", "menu_id": null }}
            ]
          }}
        }}
        """

            # ================================================================
            # Intent 2: 메뉴(Menu) 상세 조회
            # ================================================================
            elif intent == 2:
                system_prompt = f"""
        당신은 시장 키오스크 판매원 AI입니다.
        특정 '메뉴(Menu)'의 상세 정보를 처리하세요.

        [지침]
        1. 사용자가 찾는 메뉴를 [메뉴 데이터]에서 검색하세요.
        2. 여러 가게에서 팔고 있다면 `chat_message`에 **가게명, 판매단위(menuCount), 가격**을 정확히 나열하세요.
        3. **중요: menuCount 값을 임의 변경하지 마세요.**
        4. `result`에는 **가격/판매단위(menuCount)가 최저인 상품의 menu_id와 category_id**를 담으세요.

        [메뉴 데이터 구조]
        - 형식: [menuId, menuName, menuPrice, menuCount]
        - 예: [8, "수박", 16000, "1통"]

        [메뉴 데이터]
        {json.dumps(menu_context, ensure_ascii=False)}

        JSON 출력 예시:[menuName]
        {{
          "user_message": "{text}",
          "chat_message": "[menuName]는 [categoryName]에서 [menuCount] [menuPrice]원, [categoryName]에서 [menuCount] [menuPrice]원입니다. 개당 가격 기준으로 가장 저렴한 'A가게' 화면입니다.",
          "result": {{
            "status": "success",
            "intent": "get_menu",
            "items": [
              {{ "menu_id": <최저가 메뉴ID>, "category_type": <카테고리 타입>, "category_id": <가게ID> }}
            ]
          }}
        }}
        """

            # ================================================================
            # Intent 3: 위치 / 지도
            # ================================================================
            elif intent == 3:
                map_context_str = load_map_simple_list()

                system_prompt = f"""
        당신은 시장 안내 도우미입니다.
        사용자가 찾는 가게의 위치(ID)를 알려주세요.
        가게 이름이 정확하지 않아도 가장 유사한 가게를 찾으세요.

        [가게 목록 (ID:이름)]
        {map_context_str}

        오직 JSON만 출력하세요.
        {{
          "user_message": "{text}",
          "chat_message": null,
          "result": {{
            "status": "success",
            "intent": "get_location",
            "items": [
              {{ "target_id": "<ID>" }}
            ]
          }}
        }}
        """


            # ================================================================
            # Intent 4: 가격 계산
            # ================================================================
            elif intent == 4:
                system_prompt = f"""
            당신은 시장 가격 계산 도우미입니다. 사용자가 요청한 여러 상품의 총 가격을 정확하게 계산하여 안내하세요.

            [메뉴 데이터의 가격 의미 - 반드시 준수]
            - menuPrice는 낱개 가격이 아니라 menuCount에 적힌 **판매 묶음 1개의 가격**입니다.
            - 예: [14, "그린키위", 5000, "6개"]는 키위 1개가 5000원이 아니라
              **키위 6개 묶음이 5000원**이라는 뜻입니다.
            - 예: [11, "샤인머스켓", 20000, "1박스 (3송이)"]는
              **1박스가 20000원**이라는 뜻입니다.

            [계산 지침]
            1. 사용자가 가게명을 지정하면 반드시 그 가게의 메뉴 데이터만 사용하세요.
            2. 사용자가 낱개 수량을 요청하면:
               필요한 판매 묶음 수 = ceil(요청 낱개 수 / menuCount의 낱개 수)
               소계 = 필요한 판매 묶음 수 × menuPrice
            3. 사용자가 박스/바구니/통/송이처럼 menuCount의 판매 단위로 요청하면:
               소계 = 요청한 판매 단위 수 × menuPrice
            4. menuPrice에 요청 낱개 수를 직접 곱하지 마세요.
            5. 각 상품의 요청량, 판매 묶음 수, 묶음 가격, 소계를 검산한 뒤 모두 합산하세요.

            [계산 예시]
            - 그린키위가 6개 5000원일 때 12개 요청:
              ceil(12 / 6) = 2묶음, 2 × 5000 = 10000원
            - 샤인머스켓이 1박스 20000원일 때 1박스 요청:
              1 × 20000 = 20000원
            - 위 두 상품의 합계: 10000 + 20000 = 30000원

            [출력 지침]
            오직 JSON만 출력하세요.


            [메뉴 데이터]
            {json.dumps(menu_context, ensure_ascii=False)}

            [메뉴 데이터 구조]
            - 형식: [menuId, menuName, menuPrice, menuCount]

            JSON 출력 예시:
            {{
              "user_message": "{text}",
              "chat_message": "<상품1> <요청량> (<판매 묶음 수>묶음 × <묶음 가격>원) <소계>원, <상품2> ..., 총 <합계>원입니다.",
              "result": {{
                "status": "success",
                "intent": "get_total_price",
                "items": [
                  {{
                    "menu_name": "<상품명>",
                    "requested_quantity": "<요청량>",
                    "package_count": <판매 묶음 수>,
                    "package_unit": "<menuCount>",
                    "package_price": <menuPrice>,
                    "subtotal": <소계>
                  }}
                ]
              }}
            }}
            """

            # ================================================================
            # Intent 5 (Else): 잡담 / 기타
            # ================================================================
            else:
                system_prompt = f"""
        당신은 친절한 키오스크 챗봇입니다.
        잡담, 인사, 기타 문의에 짧고 친절하게 응답하세요.

        오직 JSON만 출력하세요.
        {{
          "user_message": "{text}",
          "chat_message": "<응답>",
          "result": {{
            "status": "success",
            "intent": "chitchat",
            "items": []
          }}
        }}
        """


        # =====================================================================
        # English / Vietnamese
        # =====================================================================
        else:
            response_language = "Vietnamese" if language == "vi" else "English"

            # ================================================================
            # Intent 1: Category request
            # ================================================================
            if intent == 1:
                system_prompt = f"""
        You are a kiosk assistant. Respond in {response_language}.
        Current Intent: Request to view a specific category/store.

        [Menu Data]
        {json.dumps(menu_context, ensure_ascii=False)}

        Response MUST be JSON:
        {{
          "user_message": "{text}",
          "chat_message": "<{response_language} response confirming navigation>",
          "result": {{
            "status": "success",
            "intent": "get_store",
            "items": [
              {{
                "category_id": <int or null>,
                "menu_id": null,
                "quantity": null,
                "state": null
              }}
            ]
          }}
        }}
        """

            # ================================================================
            # Intent 2: Menu request
            # ================================================================
            elif intent == 2:
                system_prompt = f"""
        You are a kiosk assistant. Respond in {response_language}.
        Current Intent: Request for a specific menu item or order.

        [Menu Data]
        {json.dumps(menu_context, ensure_ascii=False)}

        Response MUST be JSON:
        {{
          "user_message": "{text}",
          "chat_message": "<{response_language} response regarding the menu>",
          "result": {{
            "status": "success",
            "intent": "get_menu",
            "items": [
              {{
                "menu_id": <int or null>,
                "category_id": <int or null>,
                "quantity": <int>,
                "state": "<add/remove>"
              }}
            ]
          }}
        }}
        """

            # ================================================================
            # Intent 3: Location
            # ================================================================
            elif intent == 3:
                map_context_str = load_map_simple_list()

                system_prompt = f"""
        You are a market guide. Respond in {response_language}.
        Find the store ID that best matches the user's query.

        [Store List (ID:Name)]
        {map_context_str}

        Response MUST be JSON:
        {{
          "user_message": "{text}",
          "chat_message": "<{response_language} response>",
          "result": {{
            "status": "success",
            "intent": "get_location",
            "items": [
              {{
                "target_id": "<ID>",
                "target_name": "<Store Name>"
              }}
            ]
          }}
        }}
        """

            # ================================================================
            # Intent 4: Total price
            # ================================================================
            elif intent == 4:
                system_prompt = f"""
        You are a kiosk price assistant. Respond in {response_language}.

        IMPORTANT PRICE RULE:
        - menuPrice is the price of ONE SALES PACKAGE described by menuCount.
          It is NOT the price of one individual item.
        - Example: [14, "Green kiwi", 5000, "6 items"] means six kiwis cost
          5000 total. Twelve kiwis require ceil(12 / 6) = 2 packages and cost
          2 × 5000 = 10000.
        - If the user requests boxes/baskets/whole packages, multiply the
          requested package count by menuPrice.
        - If a store is named, use menu data from that store only.
        - Verify package count, package price, each subtotal, and the final sum.
          Never multiply menuPrice directly by an individual-item quantity.

        [Menu Data]
        {json.dumps(menu_context, ensure_ascii=False)}

        Response MUST be JSON:
        {{
          "user_message": "{text}",
          "chat_message": "<{response_language} response with the calculated total>",
          "result": {{
            "status": "success",
            "intent": "get_total_price",
            "items": [
              {{
                "menu_name": "<menu name>",
                "requested_quantity": "<requested quantity>",
                "package_count": <number of sales packages>,
                "package_unit": "<menuCount>",
                "package_price": <menuPrice>,
                "subtotal": <subtotal>
              }}
            ]
          }}
        }}
        """

            # ================================================================
            # Chitchat / Else
            # ================================================================
            else:
                system_prompt = f"""
        You are a friendly kiosk chatbot. Respond in {response_language}.
        Respond briefly and politely to casual conversation.

        Response MUST be JSON:
        {{
          "user_message": "{text}",
          "chat_message": "<response>",
          "result": {{
            "status": "success",
            "intent": "chitchat",
            "items": []
          }}
        }}
        """

    # 공통 LLM 호출
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": text}
    ]

    try:
        local_response = local_chat_completion(
            messages,
            temperature=0.0,
            max_tokens=1200,
            json_mode=True,
        )

        # JSON 형식까지 정상일 때만 로컬 응답을 사용한다.
        json_match = re.search(r'\{.*\}', local_response, re.DOTALL)
        json.loads(json_match.group() if json_match else local_response)
        return local_response
    except Exception as local_error:
        logging.warning(
            "Local response generation failed; falling back to OpenAI: %s",
            local_error
        )
        print(f"⚠️ 로컬 LLM 호출 실패, OpenAI로 전환합니다: {local_error}")

    try:
        return openai_chat_completion(
            messages,
            model="gpt-5.2-chat-latest",
            json_mode=True,
        )
    except Exception as primary_openai_error:
        print(
            "⚠️ OpenAI 주 모델 호출 실패, gpt-4o로 전환합니다: "
            f"{primary_openai_error}"
        )
        try:
            return openai_chat_completion(
                messages,
                model="gpt-4o",
                temperature=0.5,
                json_mode=True,
            )
        except Exception as secondary_openai_error:
            return json.dumps({"error": str(secondary_openai_error)})


# ==========================================
# 4. Flask 라우트 (TTS 추가됨!)
# ==========================================

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "ok",
        "local_llm_url": LOCAL_LLM_BASE_URL,
    })


def ensure_local_tts_voice():
    with _local_tts_voice_lock:
        voices_request = UrlRequest(
            f"{LOCAL_TTS_BASE_URL}/v1/audio/voices",
            method="GET",
        )
        with urlopen(voices_request, timeout=LOCAL_TTS_TIMEOUT) as response:
            voices_data = json.loads(response.read().decode("utf-8"))

        voices = voices_data.get("voices", [])
        if any(voice.get("name") == LOCAL_TTS_VOICE for voice in voices):
            return

        if not LOCAL_TTS_VOICE_REFERENCE.is_file():
            raise RuntimeError(
                f"TTS voice reference is missing: {LOCAL_TTS_VOICE_REFERENCE}"
            )

        register_payload = json.dumps({
            "name": LOCAL_TTS_VOICE,
            "wav_b64": base64.b64encode(
                LOCAL_TTS_VOICE_REFERENCE.read_bytes()
            ).decode("ascii"),
        }).encode("utf-8")
        register_request = UrlRequest(
            f"{LOCAL_TTS_BASE_URL}/v1/audio/voices",
            data=register_payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(register_request, timeout=LOCAL_TTS_TIMEOUT):
            pass


@app.route('/api/tts', methods=['POST', 'OPTIONS'])
def generate_tts():
    if request.method == 'OPTIONS':
        return '', 200

    try:
        data = request.get_json(silent=True) or {}
        text = str(data.get('text') or '').strip()
        language = str(data.get('language') or 'ko').lower().split('-', 1)[0]

        if not text:
            return jsonify({"error": "No text provided"}), 400

        tts_text = normalize_korean_tts_text(text) if language == 'ko' else text
        ensure_local_tts_voice()
        payload = json.dumps({
            "model": LOCAL_TTS_MODEL,
            "input": tts_text,
            "voice": LOCAL_TTS_VOICE,
            "seed": LOCAL_TTS_SEED,
            "response_format": "wav",
        }, ensure_ascii=False).encode("utf-8")
        upstream_request = UrlRequest(
            f"{LOCAL_TTS_BASE_URL}/v1/audio/speech",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(upstream_request, timeout=LOCAL_TTS_TIMEOUT) as response:
            audio_bytes = response.read()

        try:
            with wave.open(io.BytesIO(audio_bytes), "rb") as wav_file:
                frame_rate = wav_file.getframerate()
                duration_seconds = (
                    wav_file.getnframes() / frame_rate if frame_rate > 0 else 0
                )
        except (wave.Error, EOFError) as wav_error:
            raise RuntimeError("Local TTS returned an invalid WAV file") from wav_error

        max_expected_seconds = max(6.0, len(tts_text) * 0.6)
        if duration_seconds < 0.25 or duration_seconds > max_expected_seconds:
            raise RuntimeError(
                "Local TTS returned abnormal audio "
                f"({duration_seconds:.2f}s for {len(tts_text)} characters)"
            )

        audio_data = io.BytesIO(audio_bytes)
        audio_data.seek(0)

        return send_file(
            audio_data,
            mimetype="audio/wav",
            as_attachment=False,
            download_name="speech.wav"
        )

    except HTTPError as e:
        upstream_error = e.read().decode("utf-8", errors="replace")
        print(f"TTS upstream HTTP error: {e.code} {upstream_error}")
        return jsonify({"error": upstream_error}), 502
    except URLError as e:
        print(f"TTS upstream connection error: {e.reason}")
        return jsonify({"error": "Local TTS service is unavailable"}), 503
    except Exception as e:
        print(f"TTS Error: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route('/stt', methods=['POST'])
def stt():
    try:
        audio_file = request.files['voice']
        kiosk_id = int(request.form['kiosk_id'])
        admin_id = int(request.form['admin_id'])

        waveform, sample_rate = torchaudio.load(io.BytesIO(audio_file.read()))
        if sample_rate != 16000:
            resampler = torchaudio.transforms.Resample(orig_freq=sample_rate, new_freq=16000)
            waveform = resampler(waveform)

        inputs = processor(waveform.squeeze().numpy(), sampling_rate=16000, return_tensors="pt")
        input_features = inputs.input_features.to(device)
        forced_decoder_ids = processor.get_decoder_prompt_ids(language="korean", task="transcribe")

        with torch.no_grad():
            generated_ids = model.generate(input_features, forced_decoder_ids=forced_decoder_ids, max_new_tokens=128)

        text = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
        print(f"📝 Whisper 결과: {text}")

        result = replace_phrases(text, admin_id)
        print(f"📝 Result 결과 (보정 후): {result}")

        return jsonify({
            "text": result,
            "kiosk_id": kiosk_id,
            "admin_id": admin_id
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/gpt', methods=['POST'])
def gpt():
    timer = Timer()
    try:
        timer.mark("request_received")

        data = request.get_json(force=True)
        timer.mark("parsed_json")

        if not data or 'text' not in data or 'kiosk_id' not in data or 'admin_id' not in data:
            return jsonify({"error": "Missing required parameters.", "timings": timer.result()}), 400

        text = data['text']
        kiosk_id = int(data['kiosk_id'])
        admin_id = int(data['admin_id'])

        requested_language = data.get('language')
        language = requested_language if requested_language in ('ko', 'en', 'vi') else detect_language(text)
        timer.mark("language_detected")

        print(
            f"\n[AI REQUEST] admin_id={admin_id} kiosk_id={kiosk_id} "
            f"language={language}\n{text}",
            flush=True,
        )

        intent = detect_intent(text)
        timer.mark("intent_detected")
        print(f"[AI INTENT] {intent}", flush=True)

        gpt_raw_response = get_response_by_intent(intent, text, admin_id, kiosk_id, language)
        timer.mark("llm_response_received")
        print(f"[AI RAW RESPONSE]\n{gpt_raw_response}", flush=True)

        if isinstance(gpt_raw_response, dict) and "error" in gpt_raw_response:
            return jsonify({**gpt_raw_response, "timings": timer.result()}), 500

        cleaned_response = re.sub(
            r"^```(?:json)?\s*|`\s*```$",
            "",
            gpt_raw_response,
            flags=re.IGNORECASE | re.MULTILINE
        )
        timer.mark("codeblock_stripped")

        try:
            json_match = re.search(r'\{.*\}', cleaned_response, re.DOTALL)
            if json_match:
                result_json = json.loads(json_match.group())
            else:
                result_json = json.loads(cleaned_response)
            timer.mark("json_parsed")
        except json.JSONDecodeError as e:
            logging.error(f"JSON Parsing Error: {e}\nResponse: {cleaned_response}")
            return jsonify({"error": "Failed to parse GPT response", "raw": cleaned_response, "timings": timer.result()}), 500

        if "result" in result_json:
            result_json["result"]["kiosk_id"] = kiosk_id
            result_json["result"]["admin_id"] = admin_id

        timings = timer.result()
        result_json["timings"] = timings  # ✅ 응답에 포함
        logging.info(f"[GPT] timings={timings} intent={intent}")
        print(
            "[AI PARSED RESPONSE]\n"
            f"{json.dumps(result_json, ensure_ascii=False, indent=2)}\n"
            f"[AI TIMING] total={timings['total_ms']}ms",
            flush=True,
        )

        return jsonify(result_json)

    except Exception as e:
        timings = timer.result()
        print(f"[AI ERROR] {e}", flush=True)
        traceback.print_exc()
        logging.exception(f"[GPT] Endpoint Error timings={timings}")
        return jsonify({"error": str(e), "timings": timings}), 500



@app.route('/upload_jsons', methods=['POST'])
def upload_jsons():
    try:
        files = request.files.getlist('files')
        print(f"받은 파일 수: {len(files)}")
        results = []

        for file in files:
            data = file.read().decode('utf-8')
            try:
                json_data = json.loads(data)
            except Exception as e:
                return jsonify({"error": f"Invalid JSON in file {file.filename}: {str(e)}"}), 400

            admin_id = json_data.get('admin_id')
            if not admin_id:
                return jsonify({"error": f"admin_id not found in file {file.filename}"}), 400

            categories = json_data.get('categories', [])
            filtered_categories = [
                category for category in categories
                if category.get('categoryName') != '전체' and category.get('categoryNameEn') != 'All'
            ]
            json_data['categories'] = filtered_categories

            save_path = BASE_DIR / f"{admin_id}.json"
            with open(save_path, 'w', encoding='utf-8') as f:
                json.dump(json_data, f, ensure_ascii=False, indent=2)

            results.append({"admin_id": admin_id, "status": "saved"})

        return jsonify({"results": results})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    flask_debug = os.getenv("FLASK_DEBUG", "false").lower() in ("1", "true", "yes")
    ai_server_port = int(os.getenv("AI_SERVER_PORT", "8000"))
    app.run(
        host='0.0.0.0',
        port=ai_server_port,
        debug=flask_debug,
        use_reloader=flask_debug,
    )
