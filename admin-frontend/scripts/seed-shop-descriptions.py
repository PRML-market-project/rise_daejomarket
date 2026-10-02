"""Fill missing descriptions and tags using shop names and existing categories.

These are editable draft descriptions, not verified claims about each business.
Run without arguments to review artifacts/shop-descriptions/preview.json.
Use --apply to save through the local kiosk API, preserving all other fields.
"""
import argparse
import json
import re
import urllib.request
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "artifacts/shop-descriptions"
BASE = "http://localhost:8080"

# Name-specific product clues take priority over broad map categories.
# Avoid unverified origin, opening hours, delivery, price and quality claims.
PROFILES = [
    (r"약국", "의약품과 건강 관련 제품을 알아볼 수 있는 약국입니다.", ["약국", "의약품", "건강용품"]),
    (r"여관", "시장 인근에서 숙박을 알아볼 수 있는 여관입니다.", ["숙박", "여관", "시장인근"]),
    (r"문방구", "학용품과 일상에 필요한 문구를 둘러볼 수 있어요.", ["문구", "학용품", "생활용품"]),
    (r"화장품", "화장품과 뷰티 제품을 둘러볼 수 있는 가게입니다.", ["화장품", "뷰티", "미용용품"]),
    (r"금거래", "금 거래와 귀금속 관련 상담을 받을 수 있는 가게입니다.", ["금거래", "귀금속", "상담"]),
    (r"금은", "귀금속과 장신구를 둘러볼 수 있는 가게입니다.", ["귀금속", "장신구", "금은방"]),
    (r"가구", "생활 공간에 어울리는 가구를 둘러볼 수 있어요.", ["가구", "생활가구", "집꾸미기"]),
    (r"그릇|주방", "그릇과 주방에서 쓰는 생활용품을 둘러볼 수 있어요.", ["그릇", "주방용품", "생활용품"]),
    (r"신발|슈즈", "일상에서 신는 신발을 둘러볼 수 있는 가게입니다.", ["신발", "패션", "생활잡화"]),
    (r"미용실", "헤어 스타일을 상담하고 머리를 손질할 수 있어요.", ["미용실", "헤어", "머리손질"]),
    (r"수선", "옷 수선을 상담할 수 있는 생활 서비스 가게입니다.", ["옷수선", "의류", "생활서비스"]),
    (r"이불", "이불과 침구류를 둘러볼 수 있는 가게입니다.", ["이불", "침구", "생활용품"]),
    (r"멍냥", "강아지와 고양이를 위한 반려동물 용품을 둘러볼 수 있어요.", ["반려동물", "강아지", "고양이"]),
    (r"빈티지", "다양한 스타일의 빈티지 의류를 둘러볼 수 있어요.", ["빈티지", "의류", "패션"]),
    (r"메리야스", "일상에 필요한 속옷과 의류를 둘러볼 수 있어요.", ["속옷", "의류", "생활의류"]),
    (r"의류|패션", "일상에 어울리는 옷과 패션 상품을 둘러볼 수 있어요.", ["의류", "패션", "옷쇼핑"]),
    (r"닭강정", "닭강정을 즐길 수 있는 시장 먹거리 가게입니다.", ["닭강정", "치킨", "시장먹거리"]),
    (r"통닭|치킨", "통닭과 치킨을 즐길 수 있는 시장 먹거리 가게입니다.", ["통닭", "치킨", "시장먹거리"]),
    (r"만두", "만두를 즐길 수 있는 시장 먹거리 가게입니다.", ["만두", "간식", "시장먹거리"]),
    (r"김치", "식탁에 곁들이는 김치를 고를 수 있는 가게입니다.", ["김치", "반찬", "식탁준비"]),
    (r"반찬", "매일 식탁에 곁들이기 좋은 반찬을 고를 수 있어요.", ["반찬", "집밥", "식탁준비"]),
    (r"젓갈", "밥상에 곁들이는 젓갈을 둘러볼 수 있는 가게입니다.", ["젓갈", "반찬", "식탁준비"]),
    (r"건어물|북어|황태", "건어물과 요리에 쓰는 수산 식재료를 둘러볼 수 있어요.", ["건어물", "수산식품", "식재료"]),
    (r"홍어", "홍어를 중심으로 수산 먹거리를 둘러볼 수 있어요.", ["홍어", "수산식품", "시장먹거리"]),
    (r"골뱅이", "골뱅이 관련 먹거리를 둘러볼 수 있는 가게입니다.", ["골뱅이", "수산식품", "시장먹거리"]),
    (r"약초|한약", "약초와 전통 건강 식재료를 둘러볼 수 있는 가게입니다.", ["약초", "전통식재료", "건강식품"]),
    (r"흑염소", "흑염소 관련 식품을 알아볼 수 있는 가게입니다.", ["흑염소", "건강식품", "식품"]),
    (r"고추", "고추와 양념에 쓰는 식재료를 둘러볼 수 있어요.", ["고추", "양념", "식재료"]),
    (r"참기름|기름", "요리에 곁들이는 기름과 식재료를 둘러볼 수 있어요.", ["참기름", "요리재료", "식재료"]),
    (r"방앗간", "곡물 가공과 방앗간 식재료를 알아볼 수 있어요.", ["방앗간", "곡물가공", "식재료"]),
    (r"쌀", "식탁에 필요한 쌀과 곡물을 둘러볼 수 있는 가게입니다.", ["쌀", "곡물", "장보기"]),
    (r"죽집", "한 끼로 즐기는 죽을 만날 수 있는 가게입니다.", ["죽", "한끼식사", "시장먹거리"]),
    (r"베이커리|굼빵|빵", "빵을 즐길 수 있는 시장 베이커리입니다.", ["빵", "베이커리", "간식"]),
    (r"두부", "요리와 반찬에 쓰는 두부를 고를 수 있는 가게입니다.", ["두부", "식재료", "반찬재료"]),
    (r"칼국수", "칼국수로 한 끼 식사를 즐길 수 있는 가게입니다.", ["칼국수", "면요리", "한끼식사"]),
    (r"국수", "국수로 한 끼 식사를 즐길 수 있는 가게입니다.", ["국수", "면요리", "한끼식사"]),
    (r"돈가스|돈까스", "돈가스를 즐길 수 있는 시장 식사 가게입니다.", ["돈가스", "한끼식사", "시장먹거리"]),
    (r"튀김", "튀김을 즐길 수 있는 시장 간식 가게입니다.", ["튀김", "간식", "시장먹거리"]),
    (r"족발", "족발을 즐길 수 있는 시장 먹거리 가게입니다.", ["족발", "고기요리", "시장먹거리"]),
    (r"곱창", "곱창 요리를 즐길 수 있는 먹거리 가게입니다.", ["곱창", "고기요리", "시장먹거리"]),
    (r"호떡.*떡갈비", "호떡과 떡갈비를 즐길 수 있는 시장 먹거리 가게입니다.", ["호떡", "떡갈비", "시장먹거리"]),
    (r"닭", "닭고기 식재료를 둘러볼 수 있는 가게입니다.", ["닭고기", "식재료", "장보기"]),
    (r"과일.*야채|야채.*과일", "과일과 야채를 함께 고를 수 있는 장보기 가게입니다.", ["과일", "야채", "장보기"]),
    (r"과일|청과", "식탁과 간식에 곁들이는 과일을 고를 수 있어요.", ["과일", "청과", "장보기"]),
    (r"나물", "밥상에 곁들이는 나물 식재료를 둘러볼 수 있어요.", ["나물", "채소", "식재료"]),
    (r"야채|상추|농산", "요리에 필요한 채소와 농산물을 고를 수 있어요.", ["야채", "농산물", "장보기"]),
    (r"생선", "요리에 필요한 생선 식재료를 둘러볼 수 있어요.", ["생선", "수산물", "식재료"]),
    (r"수산|해물", "생선과 해산물 등 수산 식재료를 둘러볼 수 있어요.", ["수산물", "해산물", "장보기"]),
    (r"한우", "한우를 중심으로 고기 식재료를 둘러볼 수 있어요.", ["한우", "정육", "고기장보기"]),
    (r"정육|축산|육류", "요리에 필요한 고기 식재료를 고를 수 있는 가게입니다.", ["정육", "고기", "식재료"]),
    (r"순대국", "순대국으로 한 끼 식사를 즐길 수 있는 가게입니다.", ["순대국", "국밥", "한끼식사"]),
    (r"순대", "순대를 즐길 수 있는 시장 먹거리 가게입니다.", ["순대", "시장먹거리", "한끼식사"]),
    (r"뷔페", "한식으로 식사를 즐길 수 있는 뷔페 가게입니다.", ["한식", "뷔페", "한끼식사"]),
    (r"지짐|빈대떡", "전과 부침 요리를 즐길 수 있는 시장 먹거리 가게입니다.", ["전", "부침요리", "시장먹거리"]),
    (r"어묵", "어묵을 즐길 수 있는 시장 먹거리 가게입니다.", ["어묵", "간식", "시장먹거리"]),
    (r"떡", "간식과 식탁에 곁들이는 떡을 고를 수 있는 가게입니다.", ["떡", "전통간식", "시장먹거리"]),
    (r"주전부리", "가볍게 즐길 간식을 둘러볼 수 있는 가게입니다.", ["간식", "주전부리", "시장먹거리"]),
    (r"술상", "식사와 곁들임 요리를 즐길 수 있는 먹거리 가게입니다.", ["먹거리", "식사", "곁들임요리"]),
]
FALLBACKS = {
    "식품": ("시장 장보기에 필요한 식품을 둘러볼 수 있는 가게입니다.", ["식품", "장보기", "시장가게"]),
    "식당": ("한 끼 식사를 즐길 수 있는 시장 식당입니다.", ["식사", "시장식당", "한끼식사"]),
    "정육": ("요리에 필요한 고기 식재료를 고를 수 있는 가게입니다.", ["정육", "고기", "식재료"]),
    "청과": ("과일과 채소 등 농산물을 둘러볼 수 있는 가게입니다.", ["청과", "농산물", "장보기"]),
    "수산": ("요리에 필요한 수산 식재료를 둘러볼 수 있는 가게입니다.", ["수산물", "식재료", "장보기"]),
    "잡화": ("일상에 필요한 생활잡화를 둘러볼 수 있는 가게입니다.", ["생활잡화", "생활용품", "시장가게"]),
    "서비스업": ("일상에 필요한 서비스를 알아볼 수 있는 시장 가게입니다.", ["생활서비스", "상담", "시장가게"]),
}


def draft(name, category):
    for pattern, description, tags in PROFILES:
        if re.search(pattern, name):
            return description, tags.copy()
    description, tags = FALLBACKS.get(category, FALLBACKS["잡화"])
    return description, tags.copy()


def request(data=None):
    url = BASE + "/api/kiosk-experience" + ("/shops" if data is not None else "")
    payload = None if data is None else json.dumps(data, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=payload, method="GET" if data is None else "PUT",
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=600) as response:
        return json.load(response)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    source = (ROOT / "admin-frontend/src/data/kioskMapShops.generated.ts").read_text(encoding="utf-8")
    canonical = [dict(zip(("id", "name", "category"), row)) for row in re.findall(
        r'id: "([^"]+)".*?name: "([^"]+)".*?category: "([^"]+)"', source)]
    categories = {item["id"]: item["category"] for item in canonical}
    config = request()
    originals = config["shops"]
    missing_ids = {item["id"] for item in canonical} - {item["id"] for item in originals}
    if missing_ids:
        raise RuntimeError("Missing managed shops; seed the shop list first: " + str(missing_ids))
    merged = [dict(item) for item in originals]
    preview = []
    for item in merged:
        if item["id"] not in categories:
            continue
        description, tags = draft(item["name"], categories[item["id"]])
        assert len(description) <= 60
        assert len(tags) == len(set(tags)) == 3 and all(0 < len(tag) <= 20 for tag in tags)
        changed = []
        if not (item.get("description") or "").strip():
            item["description"] = description
            changed.append("description")
        if not item.get("tags"):
            item["tags"] = tags
            changed.append("tags")
        if changed:
            preview.append(dict(id=item["id"], name=item["name"], description=item["description"], tags=item["tags"], changed=changed))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / "preview.json").write_text(json.dumps(preview, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(dict(shops=len(canonical), descriptionsAdded=sum("description" in p["changed"] for p in preview),
                         tagsAdded=sum("tags" in p["changed"] for p in preview)), ensure_ascii=True), flush=True)
    if not args.apply or not preview:
        return
    backup = OUTPUT / ("config-before-" + datetime.now().strftime("%Y%m%d-%H%M%S") + ".json")
    backup.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")
    if request()["shops"] != originals:
        raise RuntimeError("Shop settings changed during preparation; re-run to merge latest data.")
    request({"shops": merged})
    saved = request()
    actual = {item["id"]: item for item in saved["shops"]}
    for item in merged:
        assert actual[item["id"]] == item, "Saved shop differs: " + item["id"]
    (OUTPUT / "shops-applied.json").write_text(json.dumps(saved["shops"], ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(dict(savedShops=len(saved["shops"]), verified=True,
                         pendingTranslations=saved.get("pendingTranslations", 0))), flush=True)


if __name__ == "__main__":
    main()
