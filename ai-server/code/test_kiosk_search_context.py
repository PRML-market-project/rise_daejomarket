import unittest

from kiosk_search_context import build_search_prompt, format_chat_message, load_map_shops, select_shops, warm_food_recommendation_priorities


class KioskSearchContextTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.shops = load_map_shops()

    def test_canonical_map_ids_and_categories(self):
        self.assertGreater(len(self.shops), 100)
        names = {shop["name"]: shop for shop in self.shops}
        self.assertEqual(names["진영153수산"]["id"], "585:28882")
        self.assertEqual(names["진영153수산"]["category"], "수산")

    def test_named_shop_and_category_search(self):
        self.assertEqual(select_shops("언니들의빈티지 어디야?", self.shops, [])[0]["name"], "언니들의빈티지")
        restaurants = select_shops("주변식당 찾아줘", self.shops, [])
        self.assertTrue(restaurants)
        self.assertTrue(all(shop["category"] == "식당" for shop in restaurants))

    def test_unknown_shop_has_no_match(self):
        self.assertEqual(select_shops("없는가게 어디야?", self.shops, []), [])

    def test_rainy_day_warm_food_has_all_four_priorities(self):
        question = "비 오는 날 따뜻한 음식 추천해줘."
        preferred = warm_food_recommendation_priorities(question, self.shops)
        self.assertEqual([shop["name"] for shop in preferred], ["행운손만두", "옛날죽집", "장터빈대떡", "도깨비칼국수"])
        prompt = build_search_prompt(2, question, "ko", self.shops, [])
        for shop in preferred:
            self.assertIn(shop["id"], prompt)
            self.assertIn(shop["name"], prompt)
        self.assertEqual(warm_food_recommendation_priorities("비가 오는 날 따뜻한 음식 추천해 주세요", self.shops), preferred)

    def test_warm_food_priorities_do_not_apply_to_unrelated_requests(self):
        for question in ("식당 추천해줘", "비 오는 날 차가운 음식 추천해줘", "따뜻한 음식 파는 가게 위치"):
            self.assertEqual(warm_food_recommendation_priorities(question, self.shops), [])

    def test_warm_food_priorities_follow_current_catalog(self):
        shops = [dict(shop) for shop in self.shops if shop["id"] != "585:28790"]
        next(shop for shop in shops if shop["id"] == "585:28762")["name"] = "변경된 만두 가게"
        preferred = warm_food_recommendation_priorities("비 오는 날 따뜻한 음식 추천해줘", shops)
        self.assertEqual(len(preferred), 3)
        self.assertEqual(preferred[0]["name"], "변경된 만두 가게")
        self.assertNotIn("585:28790", {shop["id"] for shop in preferred})

    def test_side_dish_query_does_not_expand_to_all_food_shops(self):
        matched = select_shops("반찬가게", self.shops, [{"name": "반찬가게", "keywords": "반찬"}])
        self.assertTrue(matched)
        self.assertTrue(all("반찬" in shop["name"] for shop in matched))

    def test_admin_keywords_and_tag_terms(self):
        shops = [dict(shop) for shop in self.shops]
        shops[0]["keywords"] = "수제쿠키, 디저트"
        tags = [{"name": "간식가게", "keywords": "수제쿠키, 식품", "visible": True}]
        self.assertEqual(select_shops("수제쿠키", shops, tags)[0]["id"], shops[0]["id"])
        self.assertEqual(select_shops("간식가게", shops, tags)[0]["id"], shops[0]["id"])
        prompt = build_search_prompt(1, "간식가게", "ko", shops, tags)
        self.assertIn("수제쿠키, 식품", prompt)
        self.assertIn("get_store", prompt)

    def test_chat_message_removes_match_list(self):
        explanation = "비 오는 날 따뜻하게 즐기기 좋은 음식으로 칼국수와 전을 추천해 드립니다. 아래 가게들을 확인해 보세요."
        raw = explanation + "  [카테고리 매치] - 도깨비칼국수 (시장 남측) - 장터빈대떡 (시장 서측 통로)"
        self.assertEqual(format_chat_message(raw), explanation)
        self.assertEqual(format_chat_message("**" + raw + "**"), explanation)
        self.assertEqual(format_chat_message("아래 가게들을 확인해 보세요.\n- 도깨비칼국수\n- 장터빈대떡"), "아래 가게들을 확인해 보세요.")

    def test_chat_message_limit_includes_spaces_and_punctuation(self):
        for message in ["가" * 85, "가" * 86, "가 나. " * 30, "Please check the shops. " * 10, "Vui lòng hỏi trực tiếp cửa hàng. " * 10]:
            result = format_chat_message(message)
            self.assertLessEqual(len(result), 85)
        self.assertEqual(format_chat_message("가" * 85), "가" * 85)
        self.assertEqual(format_chat_message("가" * 86), "가" * 84 + "…")

    def test_long_reply_preserves_complete_sentence(self):
        first = "찾으시는 가게를 안내해 드릴게요."
        self.assertEqual(format_chat_message(first + " " + "추가 안내 " * 30), first)
        english = "Please check the shops below."
        self.assertEqual(format_chat_message(english + " " + "Additional details " * 20), english)


if __name__ == "__main__":
    unittest.main()
