"""Build a versioned, transcribed reference for Qwen's ICL voice cloning."""

import base64
import hashlib


def build_voice_reference(name: str, wav_bytes: bytes, transcript: str) -> dict:
    transcript = transcript.strip()
    if not transcript:
        raise ValueError("TTS voice reference transcript is empty")
    # A name alone does not identify the conditioning. The native server's
    # voice listing has no mode/transcript field, so an old x-vector-only
    # registration must never satisfy a request for the ICL reference.
    digest = hashlib.sha256(wav_bytes + b"\0" + transcript.encode("utf-8")).hexdigest()[:12]
    return {
        "name": f"{name}_icl_{digest}",
        "ref_text": transcript,
        "wav_b64": base64.b64encode(wav_bytes).decode("ascii"),
    }
