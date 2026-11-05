import _runtime
import contextlib
import io
import json
import os
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import Mock, patch

from helpers import load_answer, load_gpt_app
from kiosk_search_context import load_map_shops
from qa_log import append_qa_log, summarize_answer


class QaLogFileTests(unittest.TestCase):
    def test_appends_one_utf8_json_line_per_record_in_a_monthly_file(self):
        now = datetime(2026, 11, 5, 15, 0, tzinfo=timezone.utc)
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {"QA_LOG_DIR": directory}):
            path = append_qa_log({"question": "반찬가게 어디에 있어?", "status": "success"}, now=now)
            append_qa_log({"question": "Show me all shops", "status": "success"}, now=now)
            self.assertEqual(path, Path(directory) / "qa-2026-11.jsonl")
            lines = path.read_text(encoding="utf-8").splitlines()
        self.assertEqual(len(lines), 2)
        first = json.loads(lines[0])
        self.assertEqual(first["question"], "반찬가게 어디에 있어?")
        self.assertEqual(first["timestamp"], "2026-11-05T15:00:00.000+00:00")
        self.assertIn("반찬가게", lines[0])  # Korean stays readable, not \\u-escaped.

    def test_can_be_disabled_and_never_raises_on_write_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.dict(os.environ, {"QA_LOG_DIR": directory, "QA_LOG_ENABLED": "false"}):
                self.assertIsNone(append_qa_log({"question": "x"}))
            self.assertEqual(list(Path(directory).iterdir()), [])
            blocker = Path(directory) / "not-a-directory"
            blocker.write_text("", encoding="utf-8")
            with patch.dict(os.environ, {"QA_LOG_DIR": str(blocker)}), self.assertLogs(level="WARNING"):
                self.assertIsNone(append_qa_log({"question": "x"}))

    def test_summary_keeps_message_and_selected_shops(self):
        summary = summarize_answer({
            "chat_message": "두 곳을 찾았어요.",
            "result": {"status": "success", "intent": "get_store",
                       "items": [{"target_id": "a", "target_name": "가"}, {"target_id": "b", "target_name": "나"}]},
        })
        self.assertEqual(summary["item_count"], 2)
        self.assertEqual(summary["items"], [{"id": "a", "name": "가"}, {"id": "b", "name": "나"}])
        self.assertEqual(summary["result_intent"], "get_store")
        self.assertEqual(summarize_answer({"error": "x"})["item_count"], 0)


class GptRouteQaLogTests(unittest.TestCase):
    def test_route_records_answered_and_rejected_requests(self):
        shops = load_map_shops()
        records = []
        generate = Mock(return_value='{"chat_message":"가게를 확인해 보세요.","result":{"items":[]}}')
        client = load_gpt_app(load_answer(shops, [], generate), Mock(return_value=3), records).test_client()
        with contextlib.redirect_stdout(io.StringIO()):
            ok = client.post('/gpt', json={'text': '모든 점포 다 보여줘', 'language': 'ko',
                                           'admin_id': 7, 'kiosk_id': 9})
            bad = client.post('/gpt', json={'text': '반찬가게'})
        self.assertEqual((ok.status_code, bad.status_code), (200, 400))
        answered, rejected = records
        self.assertEqual(answered["status"], "success")
        self.assertEqual(answered["question"], "모든 점포 다 보여줘")
        self.assertEqual((answered["language"], answered["intent"]), ("ko", 1))
        self.assertEqual((answered["admin_id"], answered["kiosk_id"]), (7, 9))
        self.assertEqual(answered["item_count"], len(shops))
        self.assertIsInstance(answered["total_ms"], float)
        self.assertEqual(rejected["status"], "bad_request")


if __name__ == '__main__':
    unittest.main()
