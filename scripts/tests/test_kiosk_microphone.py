import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "configure-kiosk-microphone.py"
SPEC = importlib.util.spec_from_file_location("kiosk_microphone", SCRIPT)
microphone = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(microphone)


class KioskMicrophoneTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.profile = Path(self.temporary.name) / "kiosk-browser"
        self.preferences = self.profile / "Default" / "Preferences"

    def write(self, data):
        self.preferences.parent.mkdir(parents=True, exist_ok=True)
        self.preferences.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        return self.preferences.read_bytes()

    def read(self):
        return microphone.read_preferences(self.preferences)

    def rules(self):
        return self.read()["profile"]["content_settings"]["exceptions"]["media_stream_mic"]

    def test_first_launch_only_allows_the_two_local_kiosk_origins(self):
        self.assertTrue(microphone.configure_microphone(self.profile))
        self.assertTrue(microphone.microphone_ready(self.read()))
        self.assertEqual(set(self.rules()), set(microphone.KIOSK_PATTERNS))
        self.assertEqual(set(self.read()["profile"]["content_settings"]), {"exceptions"})
        self.assertEqual(set(self.read()["profile"]["content_settings"]["exceptions"]), {"media_stream_mic"})
        for rule in self.rules().values():
            self.assertEqual(rule["setting"], 1)
            self.assertTrue(rule["last_modified"].isdigit())

    def test_preserves_other_sites_ports_camera_and_existing_preferences(self):
        unrelated = {"http://localhost:3000,*": {"setting": 2}, "https://example.com:443,*": {"setting": 2}}
        original = self.write({
            "profile": {
                "name": "대조시장",
                "default_content_setting_values": {"media_stream_mic": 2, "media_stream_camera": 2},
                "content_settings": {"exceptions": {
                    "media_stream_mic": unrelated,
                    "media_stream_camera": {"http://localhost:5173,*": {"setting": 2}},
                }},
            },
            "homepage": "http://localhost:5173",
            "other": {"nested": [1, False, "설정 유지"]},
        })
        microphone.configure_microphone(self.profile)
        data = self.read()
        self.assertEqual(data["profile"]["name"], "대조시장")
        self.assertEqual(data["profile"]["default_content_setting_values"]["media_stream_mic"], 2)
        self.assertEqual(data["profile"]["content_settings"]["exceptions"]["media_stream_camera"], {"http://localhost:5173,*": {"setting": 2}})
        self.assertEqual(data["homepage"], "http://localhost:5173")
        self.assertEqual(data["other"], {"nested": [1, False, "설정 유지"]})
        for pattern, rule in unrelated.items():
            self.assertEqual(self.rules()[pattern], rule)
        self.assertEqual(self.preferences.with_name("Preferences.before-kiosk-microphone.bak").read_bytes(), original)
        self.assertFalse(self.preferences.read_bytes().startswith(b"\xef\xbb\xbf"))

    def test_replaces_blocks_and_temporary_grants_with_persistent_grants(self):
        self.write({"profile": {"content_settings": {"exceptions": {"media_stream_mic": {
            microphone.KIOSK_PATTERNS[0]: {"setting": 2},
            microphone.KIOSK_PATTERNS[1]: {"setting": 1, "expiration": "1", "model": 1, "lifetime": "100"},
        }}}}})
        self.assertFalse(microphone.microphone_ready(self.read()))
        microphone.configure_microphone(self.profile)
        for rule in self.rules().values():
            self.assertEqual(set(rule), {"setting", "last_modified"})
        self.assertTrue(microphone.microphone_ready(self.read()))

    def test_repeated_start_does_not_rewrite_valid_permissions(self):
        microphone.configure_microphone(self.profile)
        before = self.preferences.read_bytes()
        modified = self.preferences.stat().st_mtime_ns
        self.assertFalse(microphone.configure_microphone(self.profile))
        self.assertEqual(self.preferences.read_bytes(), before)
        self.assertEqual(self.preferences.stat().st_mtime_ns, modified)

    def test_read_only_check_does_not_create_a_profile(self):
        self.assertFalse(microphone.microphone_ready(self.read()))
        self.assertFalse(self.profile.exists())

    def test_invalid_existing_preferences_are_left_intact(self):
        for original in ('{invalid json', '[]', '{"profile": "invalid type"}'):
            with self.subTest(original=original):
                self.preferences.parent.mkdir(parents=True, exist_ok=True)
                self.preferences.write_text(original, encoding="utf-8")
                with self.assertRaises(ValueError):
                    microphone.configure_microphone(self.profile)
                self.assertEqual(self.preferences.read_text(encoding="utf-8"), original)
                self.assertFalse(self.preferences.with_name("Preferences.before-kiosk-microphone.bak").exists())

    def test_failed_atomic_replace_preserves_the_original_and_cleans_temporary_file(self):
        original = self.write({"profile": {"name": "existing"}})
        with patch.object(microphone.os, "replace", side_effect=OSError("test write failure")):
            with self.assertRaises(OSError):
                microphone.configure_microphone(self.profile)
        self.assertEqual(self.preferences.read_bytes(), original)
        self.assertEqual(list(self.preferences.parent.glob(".microphone-*.json")), [])


if __name__ == "__main__":
    unittest.main()
