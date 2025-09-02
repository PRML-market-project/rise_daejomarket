from flask import Flask, request, jsonify
from pyngrok import ngrok
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

# 로그 파일 설정
logging.basicConfig(filename="gpt_api_logs.log", level=logging.INFO)

# OpenAI API 키 설정
openai.api_key = ""

def detect_language(text):
    try:
        return langdetect.detect(text)
    except:
        return "unknown"

def correct_text_with_gpt(text):
    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",  # 또는 "gpt-3.5-turbo" 사용 가능
            messages=[
                {"role": "system", "content": "음식 키오스크 시스템이기 때문에 음식, 주문과 관련된 요청 문장이 들어올 가능성이 높아. 한국어 음성 인식 결과를 자연스럽게 고쳐줘."},
                {"role": "user", "content": text}
            ]
        )
        corrected = response.choices[0].message.content.strip()
        return corrected

    except Exception as e:
        print(f"❌ GPT 교정 실패: {e}")
        return text  # 실패 시 원본 텍스트 반환


def load_menu_db(admin_id):
    path = f"\\pj\\.venv\\data\\{admin_id}.json" ####################################################################### your path
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
        menus += ["주문해줘", "추가해줘", "담아줘", "주문내역"]  # 메뉴에 강제로 추가
    except Exception as e:
        raise ValueError(f"menu DB 로딩 중 오류 발생: {e}")

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

    # 겹치는 범위 제거 (긴 범위 우선)
    filtered = []
    used = set()
    for start, end, match in sorted(replacements, key=lambda x: -(x[1] - x[0])):
        if not any(i in used for i in range(start, end)):
            filtered.append((start, end, match))
            used.update(range(start, end))

    # 치환 적용
    for start, end, match in reversed(filtered):
        tokens[start:end] = [match]

    return ' '.join(tokens)




# Whisper 모델 로딩
model = WhisperForConditionalGeneration.from_pretrained("openai/whisper-tiny").to(device)
processor = WhisperProcessor.from_pretrained("openai/whisper-tiny")

print("🔥 모델 로딩 완료")

# Flask 앱 생성
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

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
        input_features = inputs.input_features.to('cuda')
        forced_decoder_ids = processor.get_decoder_prompt_ids(language="korean", task="transcribe")

        with torch.no_grad():
            generated_ids = model.generate(input_features, forced_decoder_ids=forced_decoder_ids, max_new_tokens=128)

        text = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
        print(f"📝 Whisper 결과: {text}")

        result = replace_phrases(text, admin_id)
        #result = correct_text_with_gpt(result)
        print(f"📝 Result 결과: {result}")

        return jsonify({
            "text": result,
            "kiosk_id": kiosk_id,
            "admin_id": admin_id
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

logging.basicConfig(level=logging.INFO)

# chat_history 저장 위치 (예시)
CHAT_HISTORY_DIR = './chat_history/'

def load_chat_history(admin_id):
    path = os.path.join(CHAT_HISTORY_DIR, f'{admin_id}.json')
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    else:
        return []

def save_chat_history(admin_id, chat_history):
    os.makedirs(CHAT_HISTORY_DIR, exist_ok=True)
    path = os.path.join(CHAT_HISTORY_DIR, f'{admin_id}.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(chat_history, f, ensure_ascii=False, indent=2)

# 변환 함수
def transform_categories(language, cat_list):
    result = []
    for cat in cat_list:
        transformed_menus = []
        for menu in cat['menus']:
            price = int(menu['menuPrice']) if isinstance(menu['menuPrice'], float) else menu['menuPrice']
            # ko면 menuNameEn 빼고, en이면 menuName 빼기
            if language == 'ko':
                transformed_menus.append([menu['menuId'], menu['menuName'], price])
            elif language == 'en':
                transformed_menus.append([menu['menuId'], menu['menuNameEn'], price])
            else:
                # 기본은 모두 포함
                transformed_menus.append([menu['menuId'], menu['menuName'], menu['menuNameEn'], price])
        result.append({
            "categoryId": cat['categoryId'],
            "categoryName": cat['categoryName'],
            "categoryNameEn": cat['categoryNameEn'],
            "menus": transformed_menus
        })
        #print(result)
    return result


@app.route('/gpt', methods=['POST'])
def gpt():
    try:
        data = request.get_json(force=True)
        if not data or 'text' not in data or 'kiosk_id' not in data or 'admin_id' not in data:
            return jsonify({"error": "Missing required parameters."}), 400

        text = data['text']
        kiosk_id = int(data['kiosk_id'])
        admin_id = int(data['admin_id'])

        chat_history_path = f"/pj/.venv/data/chat_history{admin_id}_{kiosk_id}.json"
        admin_json_path = f"/pj/.venv/data/{admin_id}.json"

        chat_history = []
        if os.path.exists(chat_history_path):
            with open(chat_history_path, 'r', encoding='utf-8') as f:
                chat_history = json.load(f)

        if not os.path.exists(admin_json_path):
            return jsonify({"error": "admin_id.json 파일이 존재하지 않습니다."}), 404

        with open(admin_json_path, 'r', encoding='utf-8') as f:
            admin_data = json.load(f)


        language = detect_language(text)

        output = {
            "admin_id": admin_id,
            "categories": transform_categories(language, admin_data.get("categories", []))
        }

        if language == 'ko':
            prompt = """
당신은 음식 키오스크 챗봇이야. 사용자의 입력을 다음 다섯 가지 의도 중 하나로 분류하고, 반드시 적절한 JSON 응답을 작성해. 되묻지 말고 반드시 한 번에 처리해.

가능한 의도:
1. get_category: 특정 카테고리 요청 → items에 category_id 포함
2. get_menu: 특정 메뉴 요청, 메뉴 추천, 가격 요청(가격이 같으면 똑같다고해) → items에 menu_id, category_id 포함
3. update_cart: 장바구니 추가/제거/전체제거 요청 → items에 menu_id, quantity, state 포함
4. place_order: 주문 해달라고 하면 place_order
5. get_order_history: 주문 내역 요청 (예: "주문내역 보여줘")

응답 형식은 JSON 객체로 하며, 필요한 경우 하나 이상의 항목을 배열 형태로 포함할 수 있습니다.
예: "items": [{...}, {...}]
"""
            prompt2 = """            
**응답은 반드시 아래와 같은 JSON 형식으로만 작성하고, items는 배열 형태로 하나 이상의 항목을 포함할 수 있음**

Json Format:
{
  "user_message": "<입력 문장>",
  "chat_message": "<한국어로만 응답>",
  "result": {
    "status": "success",
    "intent": "<One of this: get_category, get_menu, update_cart, place_order, get_order_history>",
    "items": [
      {
        "menu_id": <Integer or null>,
        "category_id": <Integer or null>,
        "quantity": <Integer or null>,
        "state": "<\"add\" or \"remove\" or \"removeall\" or null>"
      }
    ]
  }
}
"""
        else:
            prompt = """
You are a kiosk assistant. Your task is to classify the user's input into one of the following five intents and respond in JSON format with appropriate fields filled. You must correct any typos automatically — do not ask for clarification.

The 5 possible intents are:
1. get_category: When the user requests a specific category → include category_id.
2. get_menu: When the user requests a specific menu or asks for recommendations → include menu_id, category_id.
3. update_cart: When the user adds or removes or remove all an item → include menu_id, quantity, and state ("add", "remove", or "removeall").
4. place_order: When the user confirms the order.
5. get_order_history: When the user asks to check their past orders.

The response should be a JSON object. If there are multiple items, include them in an array like: "items": [{...}, {...}]
"""
            prompt2 = """
The response MUST follow this format exactly, and the items field must be an array that can include one or more objects.

JSON Format:
{
  "user_message": "<Corrected input sentence>",
  "chat_message": "<Respond only in English>",
  "result": {
    "status": "success",
    "intent": "<One of: get_category, get_menu, update_cart, place_order, get_order_history>",
    "items": [
      {
        "menu_id": <Integer or null>,
        "category_id": <Integer or null>,
        "quantity": <Integer or null>,
        "state": "<\"add\" or \"remove\" or \"removeall\" or null>"
      }
    ]
  }
}
"""

        context = f"""
Here is the menu and category data:

categories and menu = {json.dumps(output, ensure_ascii=False, indent=2)}

"""

        messages = [{
            "role": "system",
            "content": prompt + "\n"+ context + "\n\n⬇ 다음은 최근 사용자와의 대화 3쌍이야. 문맥 파악을 위해 참고해.\n"
        }]

        for pair in chat_history[-3:]:
            messages.extend([
                {"role": "user", "content": pair.get("user_message", "")},
                {"role": "assistant", "content": pair.get("chat_message", "")}
            ])

        messages.append({"role": "user", "content": text})
        messages.append({"role": "system", "content": prompt2})

        logging.info(f"Sending messages to OpenAI: {messages}")

        completion = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=messages,
            temperature=0.5
        )

        response_text = completion.choices[0].message.content.strip()
        logging.info(f"Raw GPT response: {response_text}")

        # 코드블록 제거
        response_text = re.sub(r"^```(?:json)?\s*|`\s*```$", "", response_text, flags=re.IGNORECASE)

        # JSON 부분만 추출
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if not json_match:
            logging.error("GPT response does not contain JSON.")
            return jsonify({"error": "GPT response does not contain JSON."}), 500

        try:
            result = json.loads(json_match.group())
        except json.JSONDecodeError as e:
            logging.error(f"JSON parse error: {e}")
            return jsonify({"error": "Failed to parse GPT response as JSON."}), 500

        # 키오스크, 어드민 아이디 추가
        if "result" not in result:
            return jsonify({"error": "'result' key missing in GPT response JSON."}), 500

        result["result"]["kiosk_id"] = kiosk_id
        result["result"]["admin_id"] = admin_id
        print(f" GPT 응답:\n{result}")

        logging.info(f"GPT parsed response:\n{result}")

        # 대화 내역 저장
        chat_history.append({
            "user_message": text,
            "chat_message": result.get("chat_message", "")
        })

        with open(chat_history_path, 'w', encoding='utf-8') as f:
            json.dump(chat_history, f, ensure_ascii=False, indent=2)

        return jsonify(result)

    except Exception as e:
        logging.exception("GPT Error:")
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

            # "전체" 또는 "All" 카테고리 제거
            categories = json_data.get('categories', [])
            filtered_categories = [
                category for category in categories
                if category.get('categoryName') != '전체' and category.get('categoryNameEn') != 'All'
            ]
            json_data['categories'] = filtered_categories

            # 저장 경로 및 파일명 설정
            save_dir = "/pj/.venv/data"
            os.makedirs(save_dir, exist_ok=True)
            save_path = os.path.join(save_dir, f"{admin_id}.json")

            # JSON 파일 저장
            with open(save_path, 'w', encoding='utf-8') as f:
                json.dump(json_data, f, ensure_ascii=False, indent=2)

            results.append({"admin_id": admin_id, "status": "saved"})

        return jsonify({"results": results})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    port = 8000
    #public_url = ngrok.connect(port)
    #print(f" 공용 주소: {public_url}")
    app.run(port=port)