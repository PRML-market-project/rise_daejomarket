import ast
import io
import json
from pathlib import Path
import tempfile
import threading
import unittest
from urllib.request import Request

from tts_voice_reference import build_voice_reference


class VoiceReferenceTests(unittest.TestCase):
    def test_conditioning_has_a_distinct_identity(self):
        reference = build_voice_reference("friendly_female", b"wave", " Hello. \n")
        self.assertEqual(reference["ref_text"], "Hello.")
        self.assertNotEqual(reference["name"], "friendly_female")
        self.assertEqual(reference, build_voice_reference("friendly_female", b"wave", "Hello."))
        self.assertNotEqual(reference["name"], build_voice_reference("friendly_female", b"new-wave", "Hello.")["name"])
        self.assertNotEqual(reference["name"], build_voice_reference("friendly_female", b"wave", "Another transcript.")["name"])

    def test_empty_transcript_cannot_silently_use_x_vector_mode(self):
        with self.assertRaises(ValueError):
            build_voice_reference("friendly_female", b"wave", " \n")

    def test_existing_legacy_voice_does_not_skip_icl_registration(self):
        # Execute the real registration function without loading Whisper/Gemma.
        module = ast.parse(Path(__file__).with_name("app.py").read_text(encoding="utf-8"))
        function = next(node for node in module.body if isinstance(node, ast.FunctionDef) and node.name == "ensure_local_tts_voice")
        registered = {"friendly_female"}
        requests = []

        def upstream(request, timeout):
            self.assertEqual(timeout, 5)
            requests.append(request)
            if request.get_method() == "POST":
                payload = json.loads(request.data)
                self.assertEqual(payload["ref_text"], "Hello.")
                self.assertIn("wav_b64", payload)
                registered.add(payload["name"])
                return io.BytesIO(b"{}")
            return io.BytesIO(json.dumps({"voices": [{"name": name} for name in registered]}).encode())

        with tempfile.TemporaryDirectory() as folder:
            wav = Path(folder) / "reference.wav"
            wav.write_bytes(b"wave")
            wav.with_suffix(".txt").write_text("Hello.", encoding="utf-8")
            namespace = {
                "_local_tts_voice_lock": threading.Lock(),
                "LOCAL_TTS_VOICE_REFERENCE": wav,
                "LOCAL_TTS_VOICE": "friendly_female",
                "LOCAL_TTS_BASE_URL": "http://tts.test",
                "LOCAL_TTS_TIMEOUT": 5,
                "build_voice_reference": build_voice_reference,
                "UrlRequest": Request, "urlopen": upstream, "json": json,
            }
            exec(compile(ast.Module(body=[function], type_ignores=[]), "app.py", "exec"), namespace)
            ensure = namespace["ensure_local_tts_voice"]
            name = ensure()
            self.assertTrue(name.startswith("friendly_female_icl_"))
            self.assertEqual([r.get_method() for r in requests], ["GET", "POST"])
            self.assertEqual(ensure(), name)
            self.assertEqual([r.get_method() for r in requests], ["GET", "POST", "GET"])
            registered.clear()  # Native restart: re-register the same reference.
            self.assertEqual(ensure(), name)
            self.assertEqual(requests[-1].get_method(), "POST")


if __name__ == "__main__":
    unittest.main()
