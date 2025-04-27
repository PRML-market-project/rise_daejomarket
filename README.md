pcm2wav.py
PCM → WAV 변환 스크립트 설명
📂 입력
디렉토리: C:\Users\user\Desktop\....
파일 형식: 24-bit PCM 파일 (.pcm 확장자)

📂 출력
디렉토리: C:\Users\user\Desktop\....
파일 형식: WAV 파일 (.wav 확장자, 변환된 스펙: 16kHz, 16bit, mono)

⚙️ 변환 과정
입력 폴더의 .pcm 파일을 하나씩 읽어들임
파일을 다음과 같이 변환:
샘플레이트: 48,000 Hz → 16,000 Hz
샘플폭: 24-bit (3 bytes) → 16-bit (2 bytes)
채널: Mono 유지
변환된 오디오를 .wav 파일로 저장

--------------------------------------------------------------------------------------

preprocessing.py
WAV 세그먼트 추출 및 JSONL 생성 스크립트 설명
📂 입력
오디오 파일 디렉토리: C:\Users\user\Desktop\... (변환된 WAV 파일들)
라벨링 JSON 디렉토리: C:\Users\user\Desktop\... (대화 구간과 텍스트 정보가 담긴 JSON 파일들)

📂 출력
잘린 오디오 세그먼트 디렉토리: C:\Users\user\Desktop\... 
JSONL 파일: C:\Users\user\Desktop\...

⚙️ 변환 과정
JSON 파일마다 대응하는 WAV 파일을 찾음
JSON의 "dialogs" 리스트를 순회하며:
"deleted"가 True인 항목은 건너뜀
"startTime", "endTime" 기준으로 WAV 파일을 자름
잘린 오디오를 개별 WAV 파일로 저장 (ex: 파일명_0000.wav)
JSONL용 데이터 (audio 경로, text)를 리스트에 추가
모든 데이터를 .jsonl 파일로 저장
한 줄마다 { "audio": 오디오경로, "text": 텍스트 } 형식

--------------------------------------------------------------------------------------

train_preprocessing.py
Whisper용 데이터 전처리 및 저장 스크립트 설명
📂 입력
Training 데이터: training_output.jsonl
Validation 데이터: validation_output.jsonl
(모두 audio 경로와 text가 저장된 JSONL 파일)

📂 출력
전처리된 pickle 파일
train_dataset_processed.pkl
val_dataset_processed.pkl

⚙️ 변환 과정
Whisper 모델 (openai/whisper-small) 설정
WhisperProcessor 로 오디오 특징 추출 + 텍스트 토크나이징
데이터셋 로딩
datasets 라이브러리 사용해 JSONL 파일 로드
audio 컬럼을 오디오 데이터로 변환 (샘플링 레이트 16kHz)
데이터 전처리
오디오 → input_features 추출
텍스트 → labels 토크나이즈
전처리된 데이터 저장
pickle로 각각 저장 (훈련/검증용)

--------------------------------------------------------------------------------------

train.py
Whisper 모델 파인튜닝 스크립트 설명
📂 입력
전처리된 pickle 파일
train_dataset_processed.pkl
val_dataset_processed.pkl

📂 출력
파인튜닝된 모델 (output_dir에 저장)

⚙️ 학습 흐름
Whisper 모델 및 Processor 로드
openai/whisper-small
Processor에 language='Korean' 설정

데이터셋 로딩
pickle로 전처리된 학습/검증 데이터 불러옴

데이터 콜레이터 커스터마이징
input_features 패딩
labels 패딩 후 손실(loss) 계산 제외할 부분 -100으로 처리
BOS 토큰 자동 제거 처리

학습 세팅 (Seq2SeqTrainingArguments)
배치 크기: 2
gradient_accumulation: 8
learning rate: 1e-5
max_steps: 4000
evaluation + save: 매 1000스텝
fp16: 사용 안 함 (필요 시 설정 가능)
TensorBoard 리포트 끔 (report_to="none")

학습 실행 (Seq2SeqTrainer)
커스텀 데이터 콜레이터 사용
Processor를 tokenizer로 사용
자동으로 검증, 저장 진행

--------------------------------------------------------------------------------------

test.py
Whisper 기반 실시간 음성 인식 GUI 프로그램 설명

📂 주요 구성
모델 로드
파인튜닝된 Whisper 모델 (checkpoint-4000)
원본 Processor (openai/whisper-small)
녹음 기능 (무음 감지 포함)
sounddevice로 마이크 입력
0.1초마다 소리 크기 체크
일정 시간 이상 무음이면 자동 녹음 종료
음성 인식
녹음된 오디오를 Processor로 전처리
모델로 텍스트 생성 (강제 디코딩: 한국어 지정)
GUI (Tkinter 사용)
버튼 클릭 → 녹음 → 변환 → 팝업창으로 텍스트 표시

⚙️ 세부 세팅
samplerate=16000 (Whisper 기본 설정)
silence_threshold=0.01, silence_duration=0.5초
녹음 최대 7초 제한

--------------------------------------------------------------------------------------
Package            Version
------------------ ------------
accelerate         0.17.0
aiohappyeyeballs   2.6.1
aiohttp            3.11.18
aiosignal          1.3.2
attrs              25.3.0
audioread          3.0.1
certifi            2025.1.31
cffi               1.17.1
charset-normalizer 3.4.1
colorama           0.4.6
contourpy          1.3.2
cycler             0.12.1
datasets           3.5.0
decorator          5.2.1
dill               0.3.8
evaluate           0.4.3
filelock           3.16.1
fonttools          4.57.0
frozenlist         1.6.0
fsspec             2024.10.0
huggingface-hub    0.30.2
idna               3.10
Jinja2             3.1.4
joblib             1.4.2
kiwisolver         1.4.8
lazy_loader        0.4
librosa            0.11.0
llvmlite           0.44.0
MarkupSafe         2.1.5
matplotlib         3.10.1
more-itertools     10.6.0
mpmath             1.3.0
msgpack            1.1.0
multidict          6.4.3
multiprocess       0.70.16
networkx           3.4.2
numba              0.61.0
numpy              2.1.2
openai-whisper     20240930
packaging          25.0
pandas             2.2.3
pillow             11.0.0
pip                25.0.1
platformdirs       4.3.7
pooch              1.8.2
propcache          0.3.1
psutil             7.0.0
pyarrow            19.0.1
pycparser          2.22
pydub              0.25.1
pyparsing          3.2.3
python-dateutil    2.9.0.post0
pytz               2025.2
PyYAML             6.0.2
regex              2024.11.6
requests           2.32.3
safetensors        0.5.3
scikit-learn       1.6.1
scipy              1.15.2
setuptools         68.2.0
six                1.17.0
sounddevice        0.5.1
soundfile          0.13.1
soxr               0.5.0.post1
SpeechRecognition  3.14.2
sympy              1.13.3
threadpoolctl      3.6.0
tiktoken           0.9.0
tokenizers         0.13.3
torch              2.7.0+cu118
torchaudio         2.7.0+cu118
torchvision        0.22.0+cu118
tqdm               4.67.1
transformers       4.28.0
typing_extensions  4.12.2
tzdata             2025.2
urllib3            2.3.0
wheel              0.41.2
xxhash             3.5.0
yarl               1.20.0
