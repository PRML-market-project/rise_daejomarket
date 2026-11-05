import _runtime
import ast
import json
import random
import re
import unittest
from pathlib import Path
from unittest.mock import Mock

from kiosk_search_context import broad_category_shops, build_search_prompt, format_chat_message, is_all_shop_listing, is_recommendation_question, parse_model_response, required_recommendation_shops, select_search_candidates


class KioskSearchOrderTests(unittest.TestCase):
    def setUp(self):
        # Exercise the actual response pipeline without loading speech/LLM models.
        source = (Path(__file__).resolve().parents[1] / "code" / "app.py")
        module = ast.parse(source.read_text(encoding="utf-8"))
        function = next(node for node in module.body if isinstance(node, ast.FunctionDef)
                        and node.name == "answer_from_current_kiosk_data")
        self.shops = [
            {"id": str(index), "name": f"가게{index}", "category": "식당", "section": "A"}
            for index in range(4)
        ]
        self.generate = Mock()
        self.shuffle = Mock(side_effect=lambda items: items.reverse())
        namespace = {
            "json": json, "re": re, "random": Mock(shuffle=self.shuffle),
            "load_kiosk_context": lambda: (self.shops, []),
            "select_search_candidates": select_search_candidates,
            "broad_category_shops": broad_category_shops,
            "required_recommendation_shops": required_recommendation_shops,
            "parse_model_response": parse_model_response,
            "build_search_prompt": build_search_prompt,
            "is_recommendation_question": is_recommendation_question,
            "is_all_shop_listing": is_all_shop_listing,
            "format_chat_message": format_chat_message,
            "generate_json_response": self.generate,
        }
        exec(compile(ast.Module(body=[function], type_ignores=[]), str(source), "exec"), namespace)
        self.answer = namespace[function.name]

    def respond(self, ids, question="따뜻한 음식 추천해줘", intent=1):
        self.generate.return_value = json.dumps({
            "chat_message": "아래 가게들을 확인해 보세요.",
            "result": {"items": [{"target_id": shop_id} for shop_id in ids]},
        })
        return json.loads(self.answer(intent, question, "ko"))

    def test_shuffle_runs_for_each_search_after_validation(self):
        for _ in range(2):
            answer = self.respond(["0", "unknown", "1", "0", "2", "3"])
            self.assertEqual(answer["result"]["items"], [
                {"target_id": shop["id"], "target_name": shop["name"]}
                for shop in reversed(self.shops)
            ])
            self.assertEqual(answer["chat_message"], "아래 가게들을 확인해 보세요.")
        self.assertEqual(self.shuffle.call_count, 2)

    def test_repeated_searches_can_produce_different_orders(self):
        # Use a local seeded generator to verify variation without flaky tests.
        self.shuffle.side_effect = random.Random(42).shuffle
        orders = {
            tuple(item["target_id"] for item in self.respond(["0", "1", "2", "3"])["result"]["items"])
            for _ in range(8)
        }
        self.assertGreater(len(orders), 1)
        self.assertTrue(all(set(order) == {"0", "1", "2", "3"} for order in orders))

    def test_empty_single_and_named_shop_results_preserve_count(self):
        self.assertEqual(self.respond([])["result"]["items"], [])
        self.assertEqual(len(self.respond(["0"])["result"]["items"]), 1)
        named = self.respond(["1", "2"], question="가게0 가격 알려줘", intent=2)
        self.assertEqual(named["result"]["items"], [{"target_id": "0", "target_name": "가게0"}])


if __name__ == "__main__":
    unittest.main()
