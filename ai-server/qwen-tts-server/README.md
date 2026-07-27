# Qwen3 TTS server

Local Qwen3-TTS service hosted under `ai-server`.

## Runtime

- Talker: `models/qwen3-tts-12hz-0.6b-customvoice-q8_0.gguf`
- Codec/tokenizer: `models/qwen-tokenizer-12hz-Q8_0.gguf`
- Talker KV cache: 1024 tokens
- Default speaker: `sohee`
- Default instructions: `밝고 자연스러운 목소리로 말해 주세요.`
- Engine: `qwentts.cpp`
- Local endpoint: `http://127.0.0.1:8020/v1/audio/speech`
- Frontend endpoint: AI server proxy at `/api/tts`

`run-all.ps1` starts `qwentts.cpp/build/Release/tts-server.exe` automatically.
The CUDA build targets the RTX 5090 (`sm_120a`) using CUDA 13.1.

Example request to the native server:

```powershell
$body = @{
    model = "qwen3-tts-0.6b-customvoice-q8"
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
