# LLM 가중치

사용 모델: **Gemma 4 12B instruction UD-Q6_K_XL**.

- 파일: `gemma-4-12b-it-UD-Q6_K_XL.gguf`
- 크기: 10,685,012,800 bytes
- 출처: https://huggingface.co/unsloth/gemma-4-12b-it-GGUF
- Revision: `fc034cfff751157913579611efad8462ac1be606`
- SHA256: `70d04059c74be85c5e709921f05acac412b8b8f24f3ee7dd07e91ddc5f4d4de8`

`run-all.ps1`이 `.llama-cpp/llama-server.exe`로 이 파일을 실행합니다. alias는 `local-gemma`, 포트는 8010, 컨텍스트는 8192입니다. 텍스트 검색용이므로 mmproj/MTP 파일은 사용하지 않습니다.

모델 파일은 Git 제외 대상이며, 다른 LLM 가중치는 보관하지 않습니다. TTS·Whisper·번역 가중치는 다른 기능의 필수 모델이므로 별도로 유지합니다.
