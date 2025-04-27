import torch
from transformers import AutoModelForCTC, AutoProcessor
import sounddevice as sd
import numpy as np
import tkinter as tk
from tkinter import messagebox
from transformers import WhisperForConditionalGeneration, WhisperProcessor

model = WhisperForConditionalGeneration.from_pretrained(
    "C:\\Users\\user\\Desktop\\4-1\\캡스톤디자인\\한-영 음성발화 데이터_음식\\whisper_finetuned_ko\\checkpoint-4000"
).to('cuda')
processor = WhisperProcessor.from_pretrained("openai/whisper-small")
print("🔥 학습된 모델 로딩 완료")


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
        print("📝 변환된 텍스트:", text)
        messagebox.showinfo("음성 인식 결과", text)
    except Exception as e:
        print("❌ 에러:", e)
        messagebox.showerror("에러", str(e))


# 간단한 GUI
root = tk.Tk()
root.title("음성 인식 키오스크 테스트")

button = tk.Button(root, text="🎤 녹음 시작", command=on_button_click, font=("Arial", 20), width=20, height=2)
button.pack(pady=30)

root.mainloop()