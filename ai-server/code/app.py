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
from kiosk_search_context import build_search_prompt, load_kiosk_context, select_shops


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
        "origins": ["https://prmlfrontend.vercel.app", "http://localhost:5173", "http://127.0.0.1:5173"],
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


def load_search_phrases():
    shops, tags = load_kiosk_context()
    phrases = {shop["name"] for shop in shops}
    phrases.update(shop["category"] for shop in shops)
    phrases.update(tag["name"] for tag in tags if tag.get("name"))
    return list(phrases)


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
        menus = load_search_phrases()
        menus += ["주문해줘", "추가해줘", "담아줘", "주문내역"]
    except Exception as e:
        print(f"kiosk search data loading error (replace_phrases): {e}")
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


# ==========================================
# 3. 핵심 로직: 인텐트 분류 및 처리
# ==========================================

def answer_from_current_kiosk_data(intent, text, language):
    """Return the kiosk's JSON contract using only current map/admin shop data."""
    shops, tags = load_kiosk_context()
    candidates = select_shops(text, shops, tags)
    raw = generate_json_response(build_search_prompt(intent, text, language, shops, tags), text)
    try:
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        answer = json.loads(match.group() if match else raw)
    except (TypeError, ValueError):
        return raw
    if not isinstance(answer, dict) or "error" in answer:
        return raw

    candidate_by_id = {shop["id"]: shop for shop in candidates}
    result = answer.get("result") if isinstance(answer.get("result"), dict) else {}
    generated_items = result.get("items") if isinstance(result.get("items"), list) else []
    selected = []
    for item in generated_items:
        shop = candidate_by_id.get(item.get("target_id")) if isinstance(item, dict) else None
        if shop and shop["id"] not in {entry["target_id"] for entry in selected}:
            selected.append({"target_id": shop["id"], "target_name": shop["name"]})
    selected = selected[:5]

    # Explicitly named shops stay selectable even when a price is not registered.
    compact_query = re.sub(r"\s+", "", text).lower()
    named = [shop for shop in candidates if re.sub(r"\s+", "", shop["name"]).lower() in compact_query]
    if named and (intent in (2, 4) or not selected):
        selected = [{"target_id": shop["id"], "target_name": shop["name"]} for shop in named[:5]]

    message = answer.get("chat_message") if isinstance(answer.get("chat_message"), str) else ""
    selected_shops = [candidate_by_id[item["target_id"]] for item in selected]
    price_pattern = r"(?:₩\s*\d|\d[\d,]*\s*(?:원|₩|krw|vnd|동))"
    has_verified_prices = bool(selected_shops) and all(
        re.search(price_pattern, shop.get("description") or "", re.IGNORECASE)
        for shop in selected_shops
    )
    price_question = intent == 4 or bool(re.search(price_pattern, text, re.IGNORECASE)) or any(
        word in text.lower() for word in ("가격", "얼마", "합계", "총액", "price", "cost", "how much", "giá", "bao nhiêu")
    )
    if not has_verified_prices and (price_question or re.search(price_pattern, message, re.IGNORECASE)):
        name = ", ".join(shop["name"] for shop in selected_shops)
        message = {
            "vi": f"Chưa có giá được xác nhận trong dữ liệu hiện tại{(' của ' + name) if name else ''}. Vui lòng hỏi trực tiếp cửa hàng.",
            "en": f"No verified price is registered in the current data{(' for ' + name) if name else ''}. Please check with the shop.",
        }.get(language, f"{name + '의 ' if name else ''}현재 등록된 가격 정보가 없어 금액을 확인할 수 없습니다. 가게에 직접 확인해 주세요.")

    result_intent = {1: "get_store", 2: "get_menu", 3: "get_location", 4: "get_total_price"}.get(intent, "get_store")
    return json.dumps({
        "user_message": text,
        "chat_message": message,
        "result": {"status": "success", "intent": result_intent, "items": selected},
    }, ensure_ascii=False)


# [변경] chat_history 인자 제거 및 관련 로직 삭제
def detect_intent(text):
    """
    로컬 LLM을 우선 사용하여 사용자 의도를 1, 2, 3, 4 중 하나로 분류
    """
    prompt = """
다음 문장의 의도를 분석하여 숫자(1~4)만 반환하세요. 다른 말은 절대 하지 마세요.

1. 가게/카테고리 요청: 특정 가게를 보여달라거나 업종·상품으로 가게를 추천/검색할 때. (ex: 키위 사려는데 어느 가게에서 살 수 있나요? 주변식당 찾아줘, Find a restaurant near me)
2. 메뉴/주문 관련: 특정 메뉴의 가격을 묻거나, 메뉴 추천을 원할 때. (ex: 키위 사려는데 얼마인가요?)
3. 위치/길찾기: 이름이 지정된 가게의 위치나 길찾기를 물을 때만. '주변식당 찾아줘'처럼 업종 검색은 1번
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


def get_response_by_intent(intent, text, admin_id, kiosk_id, language):
    """Preserve the 1-4 intent contract while answering from the current kiosk data."""
    return answer_from_current_kiosk_data(intent, text, language)


def generate_json_response(system_prompt, text):
    """Generate the existing /gpt JSON envelope with the local model first."""
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
    """Retain the legacy endpoint without storing obsolete menu/price payloads."""
    try:
        files = request.files.getlist('files')
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

            results.append({"admin_id": admin_id, "status": "ignored_legacy_payload"})

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
