"""Integration check: real models, with all network connections forbidden."""
from unittest.mock import patch
from engine import ArgosEngine

with patch("socket.socket.connect", side_effect=AssertionError("Unexpected network access")):
    engine = ArgosEngine()
    result = engine.translate("신선한 과일과 채소를 판매합니다.", "ko", ["en", "vi"])
    assert result["en"].strip() and result["vi"].strip()
    assert result["en"] != "신선한 과일과 채소를 판매합니다."
    print(result)
    print("PASS: real Korean -> English -> Vietnamese inference with network blocked")
