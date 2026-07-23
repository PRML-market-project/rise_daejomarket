import os

# Avoid a Windows/Numba cache-path stall while qwen_tts imports librosa.
os.environ.setdefault("NUMBA_DISABLE_JIT", "1")

import torch
import soundfile as sf
from qwen_tts import Qwen3TTSModel


MODEL_ID = "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice"
OUTPUT_PATH = "output_custom_voice_ko.wav"


def main() -> None:
    model = Qwen3TTSModel.from_pretrained(
        MODEL_ID,
        device_map="cuda:0",
        dtype=torch.bfloat16,
        # flash-attn is not installed in this Windows environment, so use
        # PyTorch's built-in CUDA attention implementation.
        attn_implementation="sdpa",
    )

    wavs, sample_rate = model.generate_custom_voice(
        text="안녕하세요. 한국어 음성 합성 샘플입니다. 오늘도 좋은 하루 보내세요. 감사합니다. 도움이 필요하신가요 ?",
        language="Korean",
        speaker="Sohee",
        instruct="밝고 자연스러운 목소리로 말해 주세요.",
    )

    sf.write(OUTPUT_PATH, wavs[0], sample_rate)
    print(f"Saved: {OUTPUT_PATH} (sample rate: {sample_rate} Hz)")


if __name__ == "__main__":
    main()
