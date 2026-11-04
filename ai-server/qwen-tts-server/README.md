# Qwen TTS 런타임

`run-all.ps1`이 다음 구성으로 8020 포트를 실행합니다.

```text
runtime/tts-server.exe
runtime/ggml.dll
runtime/ggml-base.dll
runtime/ggml-cpu.dll
runtime/ggml-cuda.dll
models/qwen-talker-0.6b-base-Q8_0.gguf
models/qwen-tokenizer-12hz-Q8_0.gguf
voices/friendly-female-reference.wav
voices/friendly-female-reference.txt
```

Gemma를 선택하더라도 TTS talker와 codec은 음성 합성에 필요합니다. AI 프록시 `/api/tts`가 한국어 정규화와 기준 음성 ICL 등록을 처리합니다. WAV와 transcript는 한 쌍으로 유지해야 합니다.

원본 엔진은 https://github.com/ServeurpersoCom/qwentts.cpp 입니다. 현재 실행 파일 버전은 `0948650 (2026-07-24)`, CUDA 13.1 / RTX 5090 `sm_120a` 빌드이며 talker KV는 1024입니다. 다른 GPU에서는 대상 아키텍처에 맞는 실행 파일이 필요합니다. 수정/빌드는 별도 소스 체크아웃에서 수행하고 결과만 `runtime`에 배치합니다. 배포 라이선스는 런타임 폴더에 유지합니다.

통합 실행기가 `.llama-cpp`를 PATH에 추가해 공용 CUDA DLL을 사용합니다. 전체 C++ 소스·빌드 캐시·테스트·양자화 CLI는 실행 경로에서 제거했습니다. 가중치 출처: https://huggingface.co/Serveurperso/Qwen3-TTS-GGUF
