from flask import Flask, request, jsonify, send_file
# from pyngrok import ngrok
import torch
from transformers import WhisperForConditionalGeneration, WhisperProcessor
import torchaudio
import os
import json
import openai
import io
from flask_cors import CORS
import logging
from jamo import hangul_to_jamo
import Levenshtein
import langdetect
import re
from dotenv import load_dotenv
from pathlib import Path
import uuid
import asyncio
import edge_tts


# ==========================================
# 1. 초기 설정 및 환경 변수
# ==========================================
DATA_DIR = Path(__file__).resolve().parent.parent / ".venv" / "data"
MAP_FILE = DATA_DIR / "map_simple_list.json"

BASE_DIR = Path(__file__).resolve().parent.parent / ".venv" / "data"
BASE_DIR.mkdir(parents=True, exist_ok=True)
# CHAT_HISTORY_DIR = './chat_history/'  # 대화 내역 저장 경로 불필요

print("📂 DATA BASE_DIR =", BASE_DIR)

load_dotenv()

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# 로그 설정
logging.basicConfig(filename="gpt_api_logs.log", level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# OpenAI API 키 설정
openai.api_key = os.getenv("OPENAI_API_KEY")
print("OPENAI_API_KEY loaded:", bool(openai.api_key))
if not openai.api_key:
    raise RuntimeError("OPENAI_API_KEY가 .env에서 로드되지 않았습니다.")

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
    with open(MAP_FILE, "r", encoding="utf-8") as f:
        map_data = json.load(f)

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
            else:
                transformed_menus.append([menu['menuId'], menu['menuName'], menu['menuNameEn'], price, count])

        # [수정] categoryType 추출 (없을 경우 빈 문자열)
        category_type = cat.get('categoryType', '')

        result.append({
            "categoryId": cat['categoryId'],
            "categoryName": cat['categoryName'],
            "categoryNameEn": cat['categoryNameEn'],
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
    GPT를 사용하여 사용자 의도를 1, 2, 3 중 하나로 분류 (데이터 미포함, 가벼운 프롬프트)
    이전 대화 내역은 반영하지 않음.
    """
    prompt = """
다음 문장의 의도를 분석하여 숫자(1~3)만 반환하세요. 다른 말은 절대 하지 마세요.

1. 가게/카테고리 요청: 특정 가게(점포)를 보여달라고 할 때. (ex: 키위 사려는데 어느 가게에서 살 수 있나요?)
2. 메뉴/주문 관련: 특정 메뉴의 가격을 묻거나, 메뉴 추천을 원할 때. (ex: 키위 사려는데 얼마인가요?)
3. 위치/길찾기: 가게의 위치를 물을 때만
4. 총 가격 문의: 각 메뉴들을 샀을 때의 총 가격을 요청할 때

입력:
"""
    messages = [{"role": "system", "content": prompt}]

    # [삭제됨] 이전 대화 내역(chat_history) 추가 로직 제거

    messages.append({"role": "user", "content": text})

    try:
        completion = openai.ChatCompletion.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.0,
            max_tokens=5
        )
        intent_str = completion.choices[0].message.content.strip()
        match = re.search(r'\d', intent_str)
        if match:
            return int(match.group())
        return 4
    except Exception as e:
        logging.error(f"Intent detection failed: {e}")
        return 4


# [변경] chat_history 인자 제거 및 관련 로직 삭제
def get_response_by_intent(intent, text, admin_id, kiosk_id, language):
    """
    분류된 인텐트에 따라 적절한 데이터와 프롬프트를 구성하여 GPT 호출
    이전 대화 내역은 반영하지 않음.
    """

    # ---------------------------
    # Intent 1, 2: 메뉴 및 카테고리
    # ---------------------------
    if intent in [1, 2, 4]:
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
        4. **중요: items[0]은 반드시 최저가 가게여야 합니다.**

        [메뉴 데이터]
        {json.dumps(menu_context, ensure_ascii=False)}

        JSON 출력 예시:
        {{
          "user_message": "{text}",
          "chat_message": "키위는 'A농산', 'B청과', 'C유통'에서 판매 중입니다. 가장 저렴한 'B청과' 화면입니다.",
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
        4. `result`에는 **최저가 상품의 menu_id와 category_id**를 담으세요.

        [메뉴 데이터 구조]
        - 형식: [menuId, menuName, menuPrice, menuCount]
        - 예: [8, "수박", 16000, "1통"]

        [메뉴 데이터]
        {json.dumps(menu_context, ensure_ascii=False)}

        JSON 출력 예시:
        {{
          "user_message": "{text}",
          "chat_message": "[categoryName]가게는 [menuName] [menuCount] [menuPrice]원, [categoryName]가게는 [menuName] [menuCount] [menuPrice]원입니다. 가장 저렴하게 판매 중인 'A가게' 화면입니다.",
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


            elif intent == 4:

                system_prompt = f"""
            당신은 시장 가격 계산 도우미입니다. 사용자가 요청한 여러 상품의 총 가격을 계산하고 안내하세요.
            [지침]
            1. [메뉴 데이터]에서 사용자가 언급한 각 상품의 단가를 찾으세요.
            2. 요청 수량에 맞춰 개별 금액과 총 합계 금액을 계산하세요.
            3. `chat_message`에는 각 총액을 언급하세요.
            
            [메뉴 데이터]
            {json.dumps(menu_context, ensure_ascii=False)}
            
            [메뉴 데이터 구조]
            - 형식: [menuId, menuName, menuPrice, menuCount]
            - 예: [8, "수박", 16000, "1통"]
            
            JSON 출력 예시:
            {{
              "user_message": "{text}",
              "chat_message": "각 상품을 모두 구매하면 총가격원 입니다.",
              "result": {{
                "status": "success",
                "intent": "get_total_price",
                "items": [ null
                ]
              }}
            }}
            """

            # ================================================================
            # Intent 5: 잡담 / 기타
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
        # English
        # =====================================================================
        else:

            # ================================================================
            # Intent 1: Category request
            # ================================================================
            if intent == 1:
                system_prompt = f"""
        You are a kiosk assistant.
        Current Intent: Request to view a specific category/store.

        [Menu Data]
        {json.dumps(menu_context, ensure_ascii=False)}

        Response MUST be JSON:
        {{
          "user_message": "{text}",
          "chat_message": "<English response confirming navigation>",
          "result": {{
            "status": "success",
            "intent": "get_category",
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
        You are a kiosk assistant.
        Current Intent: Request for a specific menu item or order.

        [Menu Data]
        {json.dumps(menu_context, ensure_ascii=False)}

        Response MUST be JSON:
        {{
          "user_message": "{text}",
          "chat_message": "<English response regarding the menu>",
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
        You are a market guide.
        Find the store ID that best matches the user's query.

        [Store List (ID:Name)]
        {map_context_str}

        Response MUST be JSON:
        {{
          "user_message": "{text}",
          "chat_message": "<English response>",
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
            # Intent 4: Chitchat
            # ================================================================
            else:
                system_prompt = f"""
        You are a friendly kiosk chatbot.
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

    # 공통 GPT 호출
    messages = [{"role": "system", "content": system_prompt}]

    # [삭제됨] 이전 대화 내역(chat_history) 추가 로직 제거

    messages.append({"role": "user", "content": text})

    completion = openai.ChatCompletion.create(
        model="gpt-4o",
        messages=messages,
        temperature=0.5
    )

    return completion.choices[0].message.content.strip()


# ==========================================
# 4. Flask 라우트 (TTS 추가됨!)
# ==========================================

@app.route('/api/tts', methods=['POST', 'OPTIONS'])
def generate_tts():
    if request.method == 'OPTIONS':
        return '', 200

    try:
        data = request.json
        text = data.get('text')
        language = data.get('language', 'ko')

        if not text:
            return jsonify({"error": "No text provided"}), 400

        voice = "ko-KR-SunHiNeural"
        if language == 'en':
            voice = "en-US-AriaNeural"

        filename = f"tts_{uuid.uuid4()}.mp3"

        async def run_tts():
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(filename)

        asyncio.run(run_tts())

        with open(filename, 'rb') as f:
            audio_data = io.BytesIO(f.read())

        os.remove(filename)
        audio_data.seek(0)

        return send_file(
            audio_data,
            mimetype="audio/mpeg",
            as_attachment=False,
            download_name="speech.mp3"
        )

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
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/gpt', methods=['POST'])
def gpt():
    try:
        data = request.get_json(force=True)
        if not data or 'text' not in data or 'kiosk_id' not in data or 'admin_id' not in data:
            return jsonify({"error": "Missing required parameters."}), 400

        text = data['text']
        kiosk_id = int(data['kiosk_id'])
        admin_id = int(data['admin_id'])

        # [변경] 대화 내역(chat_history) 로드 로직 제거
        # chat_history_path = BASE_DIR / f"chat_history_{admin_id}_{kiosk_id}.json"
        # chat_history = []
        # if os.path.exists(chat_history_path):
        #     with open(chat_history_path, 'r', encoding='utf-8') as f:
        #         chat_history = json.load(f)

        # 2. 언어 감지
        language = detect_language(text)

        # 3. [STEP 1] 의도 파악 (대화 내역 인자 제거)
        intent = detect_intent(text)
        logging.info(f"Detected Intent: {intent} (Text: {text})")
        print(f"🧐 분석된 의도(Intent): {intent}")

        # 4. [STEP 2] 의도에 따른 데이터 선택 및 응답 생성 (대화 내역 인자 제거)
        gpt_raw_response = get_response_by_intent(intent, text, admin_id, kiosk_id, language)

        # 에러 처리
        if isinstance(gpt_raw_response, dict) and "error" in gpt_raw_response:
            return jsonify(gpt_raw_response), 500

        logging.info(f"Raw GPT response: {gpt_raw_response}")
        print(f"raw GPT 응답 {gpt_raw_response}")

        # 5. JSON 파싱 및 후처리
        # 코드블록 제거
        cleaned_response = re.sub(r"^```(?:json)?\s*|`\s*```$", "", gpt_raw_response, flags=re.IGNORECASE | re.MULTILINE)

        try:
            # JSON 부분만 추출 시도
            json_match = re.search(r'\{.*\}', cleaned_response, re.DOTALL)
            if json_match:
                result_json = json.loads(json_match.group())
            else:
                result_json = json.loads(cleaned_response)
        except json.JSONDecodeError as e:
            logging.error(f"JSON Parsing Error: {e}\nResponse: {cleaned_response}")
            return jsonify({"error": "Failed to parse GPT response", "raw": cleaned_response}), 500

        # 필수 필드 주입
        if "result" in result_json:
            result_json["result"]["kiosk_id"] = kiosk_id
            result_json["result"]["admin_id"] = admin_id

        print(f"🤖 최종 GPT 응답:\n{json.dumps(result_json, ensure_ascii=False, indent=2)}")

        # [변경] 대화 내역 저장 로직 제거
        # chat_history.append({ ... })
        # with open(...) ...

        return jsonify(result_json)

    except Exception as e:
        logging.exception("GPT Endpoint Error:")
        return jsonify({"error": str(e)}), 500


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
    app.run(host='0.0.0.0', port=8000, debug=True)