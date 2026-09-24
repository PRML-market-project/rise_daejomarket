import unittest
from fastapi.testclient import TestClient
from server import create_app
from engine import ArgosEngine

class FakeEngine:
    def translate(self, text, source, targets):
        return {target: f"{text}-{target}" for target in targets}

class ServerTests(unittest.TestCase):
    def test_health_and_response_mapping(self):
        with TestClient(create_app(FakeEngine)) as client:
            self.assertEqual(client.get("/health").json()["engine"], "argos")
            data = client.post("/translate", json={"texts": ["김치"]}).json()
            self.assertEqual(data["results"][0], {"sourceText": "김치", "translations": {"en": "김치-en", "vi": "김치-vi"}})

    def test_invalid_inputs(self):
        with TestClient(create_app(FakeEngine)) as client:
            for payload in [{"texts": []}, {"texts": [""]}, {"texts": ["x"], "source": "fr"}, {"texts": ["x"], "targets": ["xx"]}, {"texts": ["x" * 20001]}]:
                self.assertEqual(client.post("/translate", json=payload).status_code, 422)

    def test_shop_names_preserve_identity(self):
        with TestClient(create_app(FakeEngine)) as client:
            row = client.post("/translate", json={"texts": ["불광일등약국"], "nameTexts": ["불광일등약국"]}).json()["results"][0]
            self.assertIn("불광일등약국", row["translations"]["en"])
            self.assertIn("bulgwang", row["translations"]["en"])
            self.assertEqual(row["translations"]["en"], row["translations"]["vi"])

    def test_failure_is_not_a_successful_translation(self):
        class BrokenEngine:
            def translate(self, *args):
                raise RuntimeError("test error")
        with TestClient(create_app(BrokenEngine)) as client:
            self.assertEqual(client.post("/translate", json={"texts": ["김치"]}).status_code, 503)

    def test_pivot_reuses_english_and_cache(self):
        class Model:
            def __init__(self, prefix):
                self.calls, self.prefix = 0, prefix
            def translate(self, text):
                self.calls += 1
                return self.prefix + text
        engine = ArgosEngine.__new__(ArgosEngine)
        engine.ko_en, engine.en_vi = Model("en:"), Model("vi:")
        expected = {"en": "en:김치", "vi": "vi:en:김치"}
        self.assertEqual(engine.translate("김치", "ko", ["en", "vi"]), expected)
        self.assertEqual(engine.translate("김치", "ko", ["en", "vi"]), expected)
        self.assertEqual(engine.ko_en.calls, 1)
        self.assertEqual(engine.en_vi.calls, 1)

if __name__ == "__main__":
    unittest.main()
