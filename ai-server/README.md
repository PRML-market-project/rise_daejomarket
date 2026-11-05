# 로컬 AI 서버

`code/app.py`가 `/health`, `/gpt`, `/stt`, `/api/tts`를 제공합니다. 검색은 `kiosk_search_context.py`와 `kiosk_search_prompt.txt`, 음성 정규화/참조 등록은 `tts_text_normalizer.py`, `tts_voice_reference.py`를 사용합니다.

`/gpt` 질의·응답은 요청마다 한 줄씩 `logs/qa/qa-YYYY-MM.jsonl`(월별)에 쌓입니다(`qa_log.py`). 각 줄에는 시각, 질문, 요청/응답 언어, 의도, 상태(`success`·`bad_request`·`parse_error`·`error`), 답변 메시지, 선택된 가게 ID·이름, 처리 시간(ms)이 들어갑니다. `QA_LOG_ENABLED=false`로 끄고 `QA_LOG_DIR`로 위치를 바꿀 수 있습니다. 이 파일은 Git·이전 번들·`cleanup-workspace.ps1` 정리 대상에서 제외됩니다.

프로젝트 루트의 `npm.cmd run dev:local`로 실행합니다. 개별 실행은 이 폴더에서 `.venv/Scripts/python.exe code/app.py`입니다. 기본 포트는 8000, LLM은 8010, TTS는 8020입니다.

Gemma 가중치는 `models/`, llama.cpp는 `.llama-cpp/`, TTS는 `qwen-tts-server/`, 번역은 `argos-translate-server/`에 둡니다. Whisper tiny와 CUDA 호환 PyTorch가 필요합니다. 환경변수 예시는 `.env.example`을 참고하세요.

`requirements.txt`에는 현재 API 실행에 직접 필요한 패키지만 지정합니다. 학습/Coqui TTS/CER 실험 의존성은 제외했습니다. 기존 가상환경은 유지합니다.

루트에서 테스트: `ai-server/.venv/Scripts/python.exe -m unittest discover -s ai-server/tests -v`.
