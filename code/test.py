import torch
from transformers import AutoModelForCTC, AutoProcessor
import sounddevice as sd
import numpy as np
import tkinter as tk
from tkinter import messagebox
from transformers import WhisperForConditionalGeneration, WhisperProcessor
import openai

from jamo import hangul_to_jamo
import Levenshtein

# 고유명사 DB 예시
menu_db = {
    1: ["메인", "음료", "주류", "삼겹살", "목살", "볶음밥", "콜라", "사이다", "물", "참이슬", "테라", "하이볼"]
}


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


def replace_phrases(text, kiosk_id, threshold=2):
    if kiosk_id not in menu_db:
        raise ValueError(f"Kiosk ID {kiosk_id} is not defined in menu_db.")

    tokens = text.split()
    ngrams = generate_ngrams(tokens)
    replacements = []

    for start, end, phrase in ngrams:
        cleaned = clean_text(phrase)
        best_match = None
        best_score = float('inf')
        for menu in menu_db[kiosk_id]:
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


#openai.api_key = "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"  # 너의 키로 교체

model = WhisperForConditionalGeneration.from_pretrained("C:\\Users\\user\\Desktop\\4-1\\캡스톤디자인\\한-영 음성발화 데이터_음식\\whisper_finetuned_ko\\checkpoint-217").to('cuda')
#model = WhisperForConditionalGeneration.from_pretrained("openai/whisper-medium").to('cuda')
processor = WhisperProcessor.from_pretrained("openai/whisper-medium")
print("🔥 학습된 모델 로딩 완료")

def correct_text_with_gpt(text):
    try:
        response = openai.ChatCompletion.create(
            model="gpt-4.1-nano",  # 또는 "gpt-3.5-turbo" 사용 가능
            messages=[
                {"role": "system", "content": "키오스크 시스템이기 때문에 음식과 관련된 요청 문장이 들어올 가능성이 높아. 특히 고유명사 '참잇을'->'참이슬' 같은 걸 잘 교정해야해. 한국어 음성 인식 결과를 자연스럽게 고쳐줘."},
                {"role": "user", "content": text}
            ]
        )
        corrected = response.choices[0].message.content.strip()
        return corrected
    except Exception as e:
        print(f"❌ GPT 교정 실패: {e}")
        return text  # 실패 시 원본 텍스트 반환

# 녹음 함수 (무음 감지 포함)
def record_audio(max_duration=7, samplerate=16000, silence_threshold=0.01, silence_duration=0.5):
    print("🎤 녹음 시작...")
    audio = []
    silence_counter = 0
    block_size = int(0.1 * samplerate)  # 0.1초 단위로 체크

    stream = sd.InputStream(samplerate=samplerate, channels=1, dtype='float32', blocksize=block_size)
    stream.start()

    while True:
        block, _ = stream.read(block_size)
        block = block.squeeze()
        audio.append(block)

        volume = np.linalg.norm(block)  # 소리 크기 계산
        if volume < silence_threshold:
            silence_counter += 0.1
        else:
            silence_counter = 0  # 소리가 나면 리셋

        # 무음이 일정 시간 지속되면 종료
        if silence_counter > silence_duration:
            print("🛑 무음 감지! 녹음 종료.")
            break

        # 최대 녹음 시간 초과
        if len(audio) * 0.1 > max_duration:
            print("⏰ 최대 녹음 시간 초과, 자동 종료.")
            break

    stream.stop()
    stream.close()
    audio = np.concatenate(audio)
    print("✅ 녹음 완료.")
    return audio


# 음성 인식 함수
def transcribe_audio(audio_data, samplerate=16000):
    inputs = processor(audio_data, sampling_rate=samplerate, return_tensors="pt")
    input_features = inputs.input_features.to('cuda')

    forced_decoder_ids = processor.get_decoder_prompt_ids(language="korean", task="transcribe")

    with torch.no_grad():
        generated_ids = model.generate(
            input_features,
            forced_decoder_ids=forced_decoder_ids
        )

    transcription = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
    return transcription


# 버튼 클릭 시 실행 함수
def on_button_click():
    try:
        audio_data = record_audio(max_duration=10)
        text = transcribe_audio(audio_data)
        print(text)
        #text = "참잇을이랑 두부 스기 야기동을 한 개 줘"
        kiosk_id = 1
        result = replace_phrases(text, kiosk_id)
        print(result)
        # 출력: "참이슬 두부스키야키동 한 개 줘"

        # GPT로 자연스러운 문장 교정
        #corrected_text = correct_text_with_gpt(text)
        #print(f"✅ GPT 교정 결과: {corrected_text}")

        print("📝 변환된 텍스트:", result)
        messagebox.showinfo("음성 인식 결과", result)
    except Exception as e:
        print("❌ 에러:", e)
        messagebox.showerror("에러", str(e))


# 간단한 GUI
root = tk.Tk()
root.title("음성 인식 키오스크 테스트")

button = tk.Button(root, text="🎤 녹음 시작", command=on_button_click, font=("Arial", 20), width=20, height=2)
button.pack(pady=30)

root.mainloop()