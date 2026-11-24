import _runtime
import json
import unittest
from unittest.mock import Mock

from helpers import load_answer
from kiosk_search_context import (
    is_recommendation_question, required_recommendation_shops,
    search_response_temperature, select_search_candidates, warm_meal_shops,
)


class RecommendationPolicyTests(unittest.TestCase):
    def setUp(self):
        self.shops = [
            {"id": "dumpling", "name": "새 만두집", "category": "식당", "description": "즉석 만두를 즐길 수 있어요."},
            {"id": "porridge", "name": "새 죽집", "category": "식품", "description": "죽으로 한 끼 식사를 즐겨보세요."},
            {"id": "noodle", "name": "새 국수집", "category": "식당", "description": "한 끼 식사를 즐길 수 있어요."},
            {"id": "raw", "name": "요리 재료", "category": "정육", "description": "요리에 필요한 고기 식재료입니다."},
            {"id": "cold", "name": "김치집", "category": "식품", "description": "김치와 반찬을 고를 수 있어요."},
            {"id": "conflict", "name": "찹쌀순대", "category": "식당", "description": "식탁에 필요한 쌀과 곡물입니다."},
            {"id": "salon", "name": "새 미용실", "category": "서비스업", "description": "머리 손질"},
        ]

    def test_short_warm_queries_find_all_current_meal_types(self):
        for question in ("따뜻한 요리", "따뜻 한 음식", "따뜻한 음식", "뜨끈한 식사", "따뜻한 음식 추천해줘", "따뜻한 요리 여러 곳 많이 추천해줘"):
            with self.subTest(question=question):
                self.assertTrue(is_recommendation_question(question))
                self.assertEqual({s["id"] for s in select_search_candidates(question, self.shops, [])}, {"dumpling", "porridge", "noodle"})

    def test_repair_is_data_driven_and_deduplicates_model_results(self):
        generate = Mock(return_value=json.dumps({"chat_message": "가게에서 메뉴를 확인해 보세요.", "result": {"items": [{"target_id": "dumpling"}, {"target_id": "unknown"}]}}))
        answer = load_answer(self.shops, [], generate)
        data = json.loads(answer(1, "따뜻한 요리", "ko"))
        self.assertEqual({i["target_id"] for i in data["result"]["items"]}, {"dumpling", "porridge", "noodle"})
        self.assertEqual(len(data["result"]["items"]), 3)
        self.assertEqual(generate.call_args.kwargs["temperature"], 0.3)

    def test_conditions_and_products_do_not_trigger_forced_expansion(self):
        for condition in ("한 곳만", "3곳만", "만두 말고", "고기 빼고", "채식으로", "땅콩 알레르기 있어", "지금 열린 곳", "저렴한", "칼국수만", "새 만두집", "파는 가게 위치"):
            question = f"따뜻한 음식 추천해줘 {condition}"
            self.assertEqual(required_recommendation_shops(question, self.shops), [], question)
        generate = Mock(return_value='{"chat_message":"확인해 보세요.","result":{"items":[{"target_id":"porridge"}]}}')
        data = json.loads(load_answer(self.shops, [], generate)(1, "따뜻한 음식 한 곳만 추천해줘", "ko"))
        self.assertEqual(len(data["result"]["items"]), 1)

    def test_new_and_removed_shops_update_coverage_without_fixed_ids_or_count(self):
        shops = [s for s in self.shops if s["id"] != "dumpling"]
        shops.append({"id": "new", "name": "새 튀김집", "category": "식품", "description": "즉석 튀김"})
        self.assertEqual({s["id"] for s in required_recommendation_shops("따뜻한 요리", shops)}, {"porridge", "noodle", "new"})

    def test_excluding_warm_food_does_not_remove_cold_alternatives(self):
        for question in ("따뜻한 음식 말고 차가운 음식 추천해줘", "따뜻하지 않은 음식 추천해줘"):
            self.assertIn("cold", {s["id"] for s in select_search_candidates(question, self.shops, [])})
            self.assertEqual(required_recommendation_shops(question, self.shops), [])

    def test_prepared_food_evidence_can_coexist_with_ingredient_words(self):
        shop = {"id": "prepared", "name": "새 가게", "category": "식품", "description": "신선한 식재료로 만든 만두를 판매합니다."}
        self.assertEqual(warm_meal_shops([shop]), [shop])

    def test_only_recommendation_generation_uses_temperature_point_three(self):
        for question in ("따뜻한 요리", "식당 추천해줘", "간식 추천해줘"):
            self.assertEqual(search_response_temperature(1, question), 0.3)
        for intent, question in ((2, "만두 메뉴 추천해줘"), (3, "만두집 위치"), (4, "가격 합계"), (1, "행운손만두 가격 추천해줘"), (1, "지금 영업 중인 식당 추천해줘"), (1, "모든 가게")):
            self.assertEqual(search_response_temperature(intent, question), 0.0)


if __name__ == "__main__":
    unittest.main()
