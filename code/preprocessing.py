import os
import json
from pydub import AudioSegment

# 디렉토리 설정
audio_dir = "C:\\Users\\user\\Desktop\\4-1\\캡스톤디자인\\한-영 음성발화 데이터_음식\\processed_data_validation_ko\\validation_wave"
json_dir = "C:\\Users\\user\\Desktop\\4-1\\캡스톤디자인\\한-영 음성발화 데이터_음식\\Validation\\라벨링데이터_ko"
output_audio_dir = "C:\\Users\\user\\Desktop\\4-1\\캡스톤디자인\\한-영 음성발화 데이터_음식\\processed_data_validation_ko\\validation_output_wave"
output_jsonl_path = "C:\\Users\\user\\Desktop\\4-1\\캡스톤디자인\\한-영 음성발화 데이터_음식\\processed_data_validation_ko\\validation_output_jsonl\\validation_output.jsonl"

os.makedirs(output_audio_dir, exist_ok=True)

jsonl_lines = []

# 모든 JSON 파일 순회
for json_filename in os.listdir(json_dir):
    if not json_filename.endswith('.json'):
        continue

    json_path = os.path.join(json_dir, json_filename)
    base_name = os.path.splitext(json_filename)[0]
    wav_path = os.path.join(audio_dir, base_name + '.wav')

    if not os.path.exists(wav_path):
        print(f"[경고] {wav_path} 없음. 건너뜀.")
        continue

    # 오디오 불러오기
    audio = AudioSegment.from_wav(wav_path)

    # JSON 파싱
    with open(json_path, 'r', encoding='utf-8') as f:
        metadata = json.load(f)

    for idx, dialog in enumerate(metadata["dialogs"]):
        if dialog.get("deleted") == True:
            continue
        if "text" not in dialog or "startTime" not in dialog or "endTime" not in dialog:
            print(f"[경고] {json_filename}의 {idx}번째 dialog에 필요한 키 없음. 건너뜀.")
            continue

        start_ms = int(float(dialog["startTime"]) * 1000)
        end_ms = int(float(dialog["endTime"]) * 1000)

        segment = audio[start_ms:end_ms]
        segment_filename = f"{base_name}_{idx:04d}.wav"
        segment_path = os.path.join(output_audio_dir, segment_filename)
        segment.export(segment_path, format="wav")

        jsonl_lines.append({
            "audio": segment_path,
            "text": dialog["text"]
        })

# jsonl 저장
with open(output_jsonl_path, 'w', encoding='utf-8') as f:
    for line in jsonl_lines:
        f.write(json.dumps(line, ensure_ascii=False) + '\n')

print(f"완료! 총 {len(jsonl_lines)}개의 샘플 저장됨.")
