# Argos 로컬 번역 서버

API 키나 건당 요금 없이 로컬 CPU에서 실행합니다. 최초 패키지·모델 설치에만
인터넷이 필요하며, 운영 중에는 외부 번역 API를 호출하지 않습니다.
한국어→영어 모델과 영어→베트남어 모델만 설치합니다.

## Windows

이 폴더에서 실행하세요. 기존 Python 환경과 분리하는 것을 권장합니다.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -X utf8 install_models.py
.\.venv\Scripts\python.exe -X utf8 server.py
```

현재 개발 PC에는 전용 가상환경과 모델 설치를 완료했습니다. 이 PC의 환경은
기존 PyTorch 설치를 재사용하도록 `--system-site-packages`로 생성했습니다.
다른 PC는 위의 독립 가상환경 설치 절차를 사용하면 됩니다.
설치 후에는 마지막 `server.py` 명령만 실행하면 됩니다.

## Linux

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python install_models.py
.venv/bin/python server.py
```

이 프로세스를 실행한 뒤 Java 백엔드를 시작/재시작하세요.
`GET http://127.0.0.1:17834/health`로 준비 상태를 확인할 수 있습니다.
기본값은 로컬 접근만 허용하며 CORS를 열지 않습니다. 프론트에서 직접 호출하지
않고 Java 백엔드에서만 호출합니다. 다른 호스트/컨테이너라면 내부망 주소를
`ARGOS_HOST`, `ARGOS_PORT`, 백엔드의 `ARGOS_TRANSLATOR_URL`로 설정하세요.
인증 없는 서버를 인터넷에 공개하지 마세요.

## 데이터와 운영

- 모델·캐시: `data/` (Git 제외). `ARGOS_DATA_DIR`로 위치 변경 가능.
- CPU 기본 사용. Java 요청 제한 시간 기본 120초.
- 동시 번역은 하나씩 처리하며 사용 중에는 503을 반환합니다.
- 요청당 16개/20,000자 보호 제한. Java는 8개씩 나눠 요청합니다.
- 번역 실패·서버 중단 시 한글과 기존 번역은 유지됩니다.
- 모델 파일과 문장 분리 보조 파일은 설치 단계에서 준비합니다.
- 한글 경로의 SentencePiece 파일 로딩 문제를 우회하도록 모델 바이트를 읽습니다.
- 상호명은 의미를 임의로 바꾸지 않도록 로마자 표기와 한글을 병기합니다.
  이는 공식 외국어 상호명이 아닙니다. `nameTexts`로 상호를 지정합니다.
- 분류·시장 위치 등 짧은 공통 용어는 `glossary.json`을 우선 사용합니다.
- 설명과 자유 입력 문장은 Argos로 번역합니다. 고유명사와 음식명은 검수가 필요합니다.

요청 예시:

```json
{"texts":["김치를 판매합니다."],"source":"ko","targets":["en","vi"],"nameTexts":[]}
```

## 테스트

```powershell
.\.venv\Scripts\python.exe -X utf8 -m unittest test_server
.\.venv\Scripts\python.exe -X utf8 offline_smoke.py
```

`offline_smoke.py`는 외부 소켓 연결을 차단한 상태에서 실제 모델을 불러와 번역합니다.

의존성·모델 라이선스는 배포 시 함께 보관하세요.
[Argos 공식 저장소](https://github.com/argosopentech/argos-translate),
[모델 목록](https://github.com/argosopentech/argospm-index).
