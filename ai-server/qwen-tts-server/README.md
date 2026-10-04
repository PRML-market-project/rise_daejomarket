# Qwen3 TTS server

Local Qwen3-TTS service hosted under `ai-server`.

## Runtime

- Talker: `models/qwen-talker-0.6b-base-Q8_0.gguf`
- Codec/tokenizer: `models/qwen-tokenizer-12hz-Q8_0.gguf`
- Talker KV cache: 1024 tokens
- Default voice: `friendly_female`, cloned from `voices/friendly-female-reference.wav`
- Reference transcript: `voices/friendly-female-reference.txt` (must match the recording)
- Clone mode: ICL (audio + transcript), instead of speaker embedding only
- Engine: `qwentts.cpp`
- Local endpoint: `http://127.0.0.1:8020/v1/audio/speech`
- Frontend endpoint: AI server proxy at `/api/tts`

`run-all.ps1` starts `qwentts.cpp/build/Release/tts-server.exe` automatically.
The CUDA build targets the RTX 5090 (`sm_120a`) using CUDA 13.1.

The AI proxy registers the reference as `friendly_female_icl_<hash>` and uses
that name for synthesis. The hash includes both the WAV and its transcript so
an existing speaker-only registration cannot silently reuse the old clone mode.
Use `/api/tts` through the AI proxy to register this voice automatically.

Example request to the native server:

```powershell
$body = @{
    model = "qwen3-tts-0.6b-base-q8"
    voice = "<registered friendly_female_icl_hash from /v1/audio/voices>"
    input = "안녕하세요"
    response_format = "wav"
} | ConvertTo-Json

Invoke-WebRequest `
    -Uri "http://127.0.0.1:8020/v1/audio/speech" `
    -Method Post `
    -ContentType "application/json" `
    -Body $body `
    -OutFile "speech.wav"
```
