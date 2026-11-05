# Windows 11 / RTX 5060 Ti 16GB 이전

기존 PC에서 준비한 `transfer-ready` 폴더 전체를 외장 SSD 등으로 옮깁니다.
소스만 Git으로 복제하면 모델·업로드·운영 설정·DB 백업·실행 환경이 빠집니다.

1. 새 PC의 **NVIDIA Windows 11 드라이버**를 설치/업데이트합니다. 현재 네이티브 CUDA 런타임과 호환되는 드라이버가 필요합니다.
2. `transfer-ready`의 내용을 **`C:\daejo`** 같은 짧은 영문 경로에 놓습니다. 한글 경로는 MySQL 도구의 경로 처리 문제로 설치기가 거부합니다.
3. 인터넷에 연결한 뒤 **`setup.cmd`를 더블클릭**합니다. 필요 시 Microsoft Visual C++ 설치에 대한 관리자 권한 창이 열립니다.
   다시 설치할 때는 먼저 `start.cmd` 실행 창에서 `Ctrl+C`로 프로그램을 종료합니다.
4. Windows 설정 → 시간 및 언어 → 언어 및 지역 → 한국어 → 언어 옵션에서 **필기**를 설치합니다. 영어·베트남어 필기가 필요하면 해당 언어의 제공되는 필기 기능도 준비합니다.
5. **`start.cmd`를 더블클릭**합니다. 모든 서비스가 준비되면 `http://localhost:5173`을 엽니다. 종료는 실행 창에서 `Ctrl+C`입니다.
6. **`check.cmd`**로 파일·GPU 드라이버·서비스 상태를 확인합니다. 전체 파일 SHA256 확인은 `powershell -ExecutionPolicy Bypass -File scripts/check-windows.ps1 -Full`입니다.

## 포함된 것과 설치 과정

- `.runtime/`: 현재 검증된 Windows x64 Node 24.12.0, JDK 20.0.2, .NET SDK 8.0.423, Python 3.10.11 기본 실행 환경, MySQL 8.0.36. 원본 라이선스도 유지합니다.
- `data/models/whisper-tiny/`: 프로젝트 밖 Hugging Face 캐시에서 가져온 STT 모델. AI 서버가 이 폴더를 우선 사용합니다.
- `data/uploads/`: 기존 `C:/Users/user/Desktop/pj/datastore`의 이미지·영상 등 업로드 파일. 실행 시 백엔드에 새 절대 경로를 전달합니다.
- `ai-server/models`, `.llama-cpp`, `qwen-tts-server`, `argos-translate-server/data`: Gemma·TTS·번역의 모델과 런타임·기준 음성.
- `deployment/database.sql`: 원본 MySQL의 `prml_market_db` 일관된 SQL 백업. 관리자 계정·가게 관리 데이터·홍보·태그·번역 설정을 포함합니다.
- `deployment/database-counts.json`: 원본의 각 테이블 행 수. 첫 DB 복원 시 전부 대조합니다.
- `deployment/manifest.json`: 필수 모델·업로드·SQL 파일의 크기와 SHA256.
- `.env`, 백엔드 `application.yml`: 현재 운영 설정. 백업과 함께 개인/인증 정보가 포함되므로 공개 저장소에 올리지 않습니다.

설치기는 두 Python 가상환경을 새 경로에 만들고 **CPU PyTorch** 및 requirements를 설치합니다.
`requirements-*.lock.txt`가 있으면 별도 빈 환경에서 검증한 전체 패키지 버전을 그대로 사용합니다.
프런트엔드 npm 패키지, Gradle, NuGet 의존성은 인터넷에서 준비하므로 첫 설치에는 시간이 걸립니다.
기존 Python `.venv`, `node_modules`, 캐시, 실행 중인 MySQL 데이터 디렉터리는 이전본에 포함하지 않습니다.

## MySQL

새 PC의 MySQL은 설치형 Windows 서비스가 아니라 이 프로젝트의 `.runtime/mysql`을 사용합니다.
`127.0.0.1:13306`으로만 열고 `data/mysql`에 저장합니다. 다른 3306 데이터베이스는 건드리지 않습니다.
루트 비밀번호는 설치 시 무작위 생성해 `deployment/portable-db.json`에 보관합니다.
빈 DB에만 SQL을 자동 복원하며, 설치를 다시 실행해도 기존 테이블을 덮어쓰지 않습니다.
`run-all.ps1`이 MySQL도 함께 시작하고 정상 종료합니다.
프로젝트 경로가 바뀌면 `setup.cmd`를 다시 실행해 MySQL 절대 경로와 가상환경을 갱신합니다.

## 16GB GPU와 첫 실행 점검

Gemma 12B UD-Q6_K_XL와 TTS를 유지합니다. STT/번역은 CPU로 실행합니다.
`start.cmd`는 VRAM을 줄이기 위해 K/V 캐시를 `q8_0`로 실행합니다. 모델 가중치의 Q6 양자화는 그대로입니다.
검색 프롬프트가 6천 토큰을 넘는 경우가 있어 컨텍스트 8192는 유지합니다.
기존 f16 캐시와 비교하려면 `powershell -ExecutionPolicy Bypass -File run-all.ps1 -KvCacheType f16`으로 실행합니다.
5060 Ti에서의 실제 GPU 메모리와 응답 속도는 이 PC에서 아직 측정하지 않았습니다.
`nvidia-smi`로 **검색과 음성 출력이 겹치는 순간**의 메모리를 확인합니다.
컨텍스트 8192를 포함한 구성을 16GB에서 여유 있게 실행할 수 있다고 보장하지 않습니다.
모델 로딩 실패/OOM이면 로그를 확인한 뒤 컨텍스트·캐시·GPU 오프로딩을 조정해야 합니다.

검색(전체 126곳/반찬 가게), 한국어 음성 입력·출력, 손글씨, 관리자 로그인, 홍보 이미지·영상을 확인합니다.
실행 중인 서비스에 대한 검색·음성·이미지·화면 자동 점검은 `ai-server/.venv/Scripts/python.exe -X utf8 scripts/smoke-local.py --with-llm`입니다.
서비스 로그는 `.local-service-logs/`, DB 초기 설정 로그는 `deployment/mysql-setup*.log`에 남습니다.
준비한 PC에서의 검증 결과는 `deployment/validation-report.json`에 있습니다. 5060 Ti 실물에서의 검증 결과는 아닙니다.

## 이전본을 다시 만들 때

원본 PC에서 외부 업로드·모델·DB를 다시 모으려면:

```powershell
ai-server/.venv/Scripts/python.exe -X utf8 scripts/portable.py collect
powershell -ExecutionPolicy Bypass -File scripts/export-transfer.ps1
```

`collect`는 이 원본 PC의 설치 경로와 `application.yml`의 MySQL 접속 정보를 사용합니다.
새 PC의 변경된 DB를 내보낼 때는 `deployment/portable-db.json` 접속 정보로 별도 SQL 백업합니다.
이전본 생성 후 원본의 DB·업로드를 바꿨다면 출발 전에 백업과 이전본을 다시 생성합니다.
