# 대조시장 안내 키오스크

키보드·음성·손글씨로 가게를 검색하고 시장 지도로 안내합니다. 한국어·영어·베트남어와 관리자 화면을 제공합니다.

## 새 PC로 이전

준비된 **`transfer-ready` 폴더 전체**를 새 Windows 11 PC의 **`C:\daejo`** 같은 짧은 영문 경로로 복사합니다.
인터넷 연결과 NVIDIA 드라이버를 준비한 뒤 **`setup.cmd` → `start.cmd`** 순서로 실행합니다.
`check.cmd`는 파일·GPU·서비스 상태를 확인합니다. [이전 안내](deployment/README.md)를 참고하세요.
이전본에는 Node·JDK·.NET SDK·Python·MySQL, 모델, DB SQL 백업, 업로드 파일과 운영 설정을 포함합니다.
패키지 의존성은 첫 설치 때 인터넷에서 받습니다. 기존 DB가 있으면 덮어쓰지 않습니다.

## 실행

Windows PowerShell에서 프로젝트 루트를 기준으로 실행합니다.

준비된 실행 환경이 있으면 `start.cmd`로도 실행할 수 있습니다.
새 PC 번들은 전역 PATH를 변경하지 않으므로 **`start.cmd`를 사용**합니다. 아래 npm 명령은 Node가 PATH에 등록된 개발 환경용입니다.

```powershell
npm.cmd run dev:local
```

번역 → Gemma → TTS → 백엔드 → AI → 손글씨 → 프런트엔드 순서로 준비 상태를 확인합니다. 관리자 화면은 키오스크 프런트엔드의 `/dashboard`에 포함되어 있으므로, 별도 Next.js 관리자 앱(포트 3000)은 `npm.cmd run dev:admin`(`run-all.ps1 -WithAdmin`)으로 실행할 때만 함께 띄웁니다. 기존 서비스는 재사용하며 새로 실행한 서비스는 `Ctrl+C`로 함께 종료합니다. 로그는 `.local-service-logs/`에 생성됩니다.

Cloudflare 터널로 로컬 백엔드와 AI 서버를 연결하려면 `cloudflared`를 설치하고 `npm.cmd run dev:server`를 실행합니다. 출력된 `VITE_API_URL`, `VITE_GPT_API_URL`을 Vercel에 설정한 뒤 재배포합니다. 이 모드도 같은 통합 실행기를 사용합니다.

| 경로 | 역할 |
| --- | --- |
| `frontend/` | Vite 키오스크와 공용 관리자 UI |
| `admin-frontend/` | 공용 UI를 직접 사용하는 별도 Next.js 관리자 앱 (선택, `-WithAdmin`) |
| `backend/` | Spring Boot API, 인증, 가게·홍보·번역 관리 |
| `ai-server/code/` | Flask API, 검색 프롬프트·가게 데이터 연동·TTS 프록시 |
| `ai-server/models/` | 선택한 Gemma 12B UD-Q6_K_XL 가중치 |
| `ai-server/.llama-cpp/` | llama.cpp 서버와 런타임 DLL |
| `ai-server/qwen-tts-server/` | TTS 실행 파일·가중치·기준 음성 |
| `ai-server/argos-translate-server/` | CPU 번역 서비스와 설치된 번역 모델 |
| `ai-server/tests/` | 검색·가게 선택·음성 참조 회귀 테스트 |
| `handwriting-server/` | Windows 손글씨 인식 서비스 |

| 서비스 | 주소 |
| --- | --- |
| 키오스크 | http://localhost:5173 |
| 키오스크 관리자 | http://localhost:5173/dashboard |
| 별도 관리자 (`-WithAdmin`일 때만) | http://localhost:3000 |
| 백엔드 | http://localhost:8080 |
| AI | http://localhost:8000 |
| Gemma | http://localhost:8010 |
| TTS | http://localhost:8020 |
| 손글씨 | http://localhost:17832 |
| 번역 | http://localhost:17834 |

키오스크 왼쪽 위 로고를 1초 안에 5번 누르면 관리자 화면을 엽니다. 기본 초기 관리자 계정은 `daejo_admin` / `2580`이며, 기존 계정은 유지됩니다. 백엔드의 `KIOSK_ADMIN_USERNAME`, `KIOSK_ADMIN_PASSWORD`, `KIOSK_ADMIN_BOOTSTRAP_ENABLED`로 초기 계정 생성을 설정할 수 있습니다.

## 필수 환경과 설치

`setup.cmd` 이전본에는 아래 실행 환경이 포함돼 있으므로 개별 전역 설치 없이 설치기를 사용합니다.
Node.js/npm, Java 20, MySQL, Python, .NET SDK와 Windows 손글씨 인식 환경이 필요합니다. 백엔드의 `application.yml`, 각 서비스의 `.env`, Python 가상환경과 번역 모델은 로컬 운영 파일입니다.

```powershell
npm.cmd --prefix frontend ci
npm.cmd --prefix admin-frontend ci   # 별도 관리자 앱을 쓸 때만
ai-server/.venv/Scripts/python.exe -m pip install -r ai-server/requirements.txt
ai-server/argos-translate-server/.venv/Scripts/python.exe -m pip install -r ai-server/argos-translate-server/requirements.txt
```

Python 가상환경이 없는 새 PC에서는 위 경로에 먼저 가상환경을 생성합니다. PyTorch·torchaudio는 대상 GPU와 호환되는 CUDA 빌드로 준비합니다. Whisper tiny는 최초 실행 전에 Hugging Face 캐시에 준비되어 있어야 합니다. 번역 모델 설치는 [Argos 안내](ai-server/argos-translate-server/README.md)를 따릅니다.

LLM은 **Gemma 4 12B instruction UD-Q6_K_XL 하나**를 사용합니다. 파일·런타임 배치는 [모델 안내](ai-server/models/README.md), TTS는 [음성 합성 안내](ai-server/qwen-tts-server/README.md)를 확인하세요. Gemma 외에도 TTS talker·codec과 번역·STT 모델은 각 기능 실행에 필요합니다.

`frontend/.env`:

```env
VITE_API_URL=http://localhost:8080
VITE_GPT_API_URL=http://localhost:8000
```

AI 기본 환경변수는 [ai-server/.env.example](ai-server/.env.example)에 있습니다. OpenAI 폴백은 `OPENAI_API_KEY`를 설정한 경우에만 활성화됩니다. 기존 운영 `.env`는 유지합니다.

Vercel 프로젝트의 Root Directory는 `frontend`입니다. `/login`과 `/dashboard`가 키오스크 빌드에 포함됩니다. 별도 관리자 도메인이 필요할 때만 `VITE_ADMIN_URL`을 설정합니다. 손글씨 요청도 백엔드가 프록시하므로 별도 손글씨 터널은 필요하지 않습니다.

## 점검

```powershell
npm.cmd --prefix frontend run build
npm.cmd --prefix admin-frontend run build
ai-server/.venv/Scripts/python.exe -m unittest discover -s ai-server/tests -v
ai-server/argos-translate-server/.venv/Scripts/python.exe -m unittest discover -s ai-server/argos-translate-server -p test_server.py
```

프런트엔드 회귀 테스트는 `frontend` 폴더에서 `scripts/test-*.mjs`를 Node로 실행합니다. 백엔드 단위 테스트는 `backend`에서 다음 명령으로 실행합니다. Windows 한글 경로를 피하도록 테스트 빌드만 임시 디렉터리에 둡니다.

```powershell
.\gradlew.bat -I translation-test.init.gradle test --tests '*Test'
```

## 파일 관리

학습/CER 실험, 비교 산출물, 소스 ZIP, 예전 LLM, 미사용 UI 복사본과 C++ 빌드 소스는 제거했습니다. 앱 소스·검증 테스트·필수 네이티브 DLL·가중치·음성 참조·번역 데이터·화면 자산은 유지합니다. 관리자 앱은 `frontend/src/features/admin`을 직접 사용하므로 지도 소스 동기화 단계가 없습니다.

서비스를 종료한 뒤 재생성 가능한 캐시와 오래된 로그를 정리합니다.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/cleanup-workspace.ps1
powershell -ExecutionPolicy Bypass -File scripts/cleanup-workspace.ps1 -Apply
```

`.git`, 운영 환경설정, 데이터베이스 파일과 가상환경은 정리 대상이 아닙니다. 모델과 네이티브 런타임은 Git에서 제외되므로 새 PC에 별도로 준비해야 합니다.
