import unittest

from kiosk_search_context import build_search_prompt, format_chat_message, load_map_shops, select_shops


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
