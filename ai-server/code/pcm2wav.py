import os
from pydub import AudioSegment

# PCM 파일이 있는 디렉토리
input_dir = "C:\\Users\\user\\Desktop\\4-1\\캡스톤디자인\\한-영 음성발화 데이터_음식\Validation\\원천데이터_ko"
# 변환된 WAV 파일 저장 디렉토리
output_dir = "C:\\Users\\user\\Desktop\\4-1\\캡스톤디자인\\한-영 음성발화 데이터_음식\\processed_data_validation_ko\\validation_wave"

os.makedirs(output_dir, exist_ok=True)

# PCM 파일 설정
sample_rate = 48000
sample_width = 3
channels = 1

for filename in os.listdir(input_dir):
    if filename.endswith('.pcm'):
        pcm_path = os.path.join(input_dir, filename)
        wav_filename = os.path.splitext(filename)[0] + '.wav'
        wav_path = os.path.join(output_dir, wav_filename)

        # PCM 로드
        audio = AudioSegment.from_file(
            pcm_path,
            format="raw",
            frame_rate=sample_rate,
            channels=channels,
            sample_width=sample_width
        )

        # 변환: 16kHz, 16비트, 모노
        audio = audio.set_frame_rate(16000)
        audio = audio.set_sample_width(2)
        audio = audio.set_channels(1)

        # WAV로 저장
        audio.export(wav_path, format="wav")
        print(f"변환 완료: {wav_filename}")
