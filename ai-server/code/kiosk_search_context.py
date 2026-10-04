"""Use the same map catalog and admin overrides as the kiosk search screen."""

import json
import os
import re
import unicodedata
from pathlib import Path
from urllib.request import urlopen


MAP_SOURCE = Path(__file__).resolve().parents[2] / "frontend/ml-test-main/src/data/figma-map-shops.ts"
EXPERIENCE_URL = os.getenv("KIOSK_EXPERIENCE_URL", "http://127.0.0.1:8080/api/kiosk-experience")
FIELD = re.compile(r'([a-zA-Z]+):\s*(?:"((?:[^"\\]|\\.)*)"|(-?\d+(?:\.\d+)?))')


def _normalize(value):
    value = unicodedata.normalize("NFD", str(value or "")).lower()
    return "".join(char for char in value if not char.isspace() and not unicodedata.combining(char))


def load_map_shops(source=MAP_SOURCE):
    shops = []
    for line in source.read_text(encoding="utf-8").splitlines():
        if not line.lstrip().startswith("{ id:"):
            continue
        fields = {}
        for key, quoted, number in FIELD.findall(line):
            fields[key] = json.loads('"' + quoted + '"') if quoted else float(number)
        if all(key in fields for key in ("id", "name", "category", "section")):
            shops.append({key: fields[key] for key in ("id", "name", "category", "section")})
    if not shops:
        raise ValueError(f"지도 점포를 읽을 수 없습니다: {source}")
    return shops


def load_kiosk_context(fetch_experience=True):
    shops = load_map_shops()
    experience = {}
    if fetch_experience:
        try:
            with urlopen(EXPERIENCE_URL, timeout=2) as response:
                experience = json.load(response)
        except (OSError, ValueError) as error:
            # The kiosk also falls back to the map catalog if the backend is offline.
            print(f"Kiosk experience unavailable; using map catalog: {error}", flush=True)

    by_id = {shop["id"]: shop for shop in shops}
    name_counts = {}
    for shop in shops:
        name_counts[shop["name"]] = name_counts.get(shop["name"], 0) + 1
    for override in experience.get("shops", []):
        shop = by_id.get(override.get("id"))
        if shop is None and name_counts.get(override.get("name")) == 1:
            shop = next(item for item in shops if item["name"] == override["name"])
        if shop is not None:
            for key in ("name", "description", "keywords", "tags"):
                if key in override:
                    shop[key] = override[key]
    return shops, [tag for tag in experience.get("searchTags", []) if tag.get("visible")]


def select_shops(question, shops, tags, limit=18):
    query = _normalize(question)
    words = [_normalize(word) for word in re.split(r"[\s,，?!]+", question) if len(_normalize(word)) > 1]
    words += [term for term in ("반찬", "간식") if term in query]
    category_aliases = {
        "식당": ("식당", "음식점", "주변식당", "맛집", "restaurant", "quán ăn", "nhà hàng"),
        "식품": ("식품",),
        "청과": ("청과", "과일", "키위", "사과", "채소", "야채", "fruit"),
        "정육": ("정육", "고기", "육류", "meat"),
        "수산": ("수산", "생선", "해산물", "seafood"),
    }
    wanted_categories = {category for category, aliases in category_aliases.items()
                         if any(_normalize(alias) in query for alias in aliases)}
    tag_terms = []
    # A configured tag is an OR search over its comma-separated terms, not a literal query.
    for tag in tags:
        if _normalize(tag.get("name")) in query:
            for term in re.split(r"[,，]", tag.get("keywords") or ""):
                normalized_term = _normalize(term.strip())
                if normalized_term:
                    tag_terms.append(normalized_term)
                for category, aliases in category_aliases.items():
                    if normalized_term in {_normalize(alias) for alias in aliases}:
                        wanted_categories.add(category)

    ranked = []
    for position, shop in enumerate(shops):
        name = _normalize(shop["name"])
        category = _normalize(shop["category"])
        searchable = _normalize(" ".join(str(value) for value in (
            shop["name"], shop.get("description") or "", shop.get("keywords") or "",
            *(shop.get("tags") or []))))
        score = 0
        if name and name in query:
            score += 100
        score += 12 * sum(1 for word in words if word in searchable and word not in ("어디", "가게", "찾아줘", "있나요"))
        if shop["category"] in wanted_categories:
            score += 5
        if any(term in searchable or term == category for term in tag_terms):
            score += 8
        if category and category in query:
            score += 5
        if score:
            ranked.append((-score, position, shop))
    ranked.sort(key=lambda entry: (entry[0], entry[1]))
    exact_names = [shop for _, _, shop in ranked if _normalize(shop["name"]) in query]
    if exact_names:
        return exact_names[:limit]
    return [shop for _, _, shop in ranked[:limit]]


def format_chat_message(message):
    """Keep the kiosk's short explanation separate from its shop cards."""
    message = message.replace("**", "")
    message = re.split(r"\[\s*(?:카테고리\s*매치|검색\s*매치|category\s*matches?|search\s*matches?)\s*\]", message, maxsplit=1, flags=re.IGNORECASE)[0]
    message = re.split(r"\n\s*(?:[-*•]|\d+[.)])\s+", message, maxsplit=1)[0]
    message = re.sub(r"\s+", " ", message).strip()
    if len(message) > 85:
        # Keep a complete sentence when possible, rather than cutting its ending.
        endings = list(re.finditer(r"[.!?。！？](?=\s|$)", message[:86]))
        if endings and endings[-1].end() <= 85:
            message = message[:endings[-1].end()].strip()
        else:
            shortened = message[:84].rstrip()
            if " " in shortened:
                shortened = shortened.rsplit(" ", 1)[0]
            message = shortened + "…"
    return message


def build_search_prompt(intent, question, language, shops, tags):
    candidates = select_shops(question, shops, tags)
    response_language = {"vi": "Vietnamese", "en": "English"}.get(language, "Korean")
    public_fields = ("id", "name", "category", "section", "description", "keywords", "tags")
    compact = [{key: shop[key] for key in public_fields if shop.get(key)} for shop in candidates]
    tag_context = [{key: tag[key] for key in ("name", "keywords") if tag.get(key)} for tag in tags]
    result_intent = {1: "get_store", 2: "get_menu", 3: "get_location", 4: "get_total_price"}.get(intent, "get_store")
    return f"""You are the Daejo Market kiosk guide.
The response language for this question is {response_language}. Write the entire chat_message in
{response_language}: English questions get English answers, Vietnamese questions get Vietnamese
answers, and Korean questions get Korean answers. For short or mixed-language questions, use the
selected kiosk language supplied as the response language.
Translate all explanatory text, including uncertainty and price-unavailable messages, into the
response language. Keep proper shop names in Korean exactly as supplied; never translate them.
Keep JSON keys, intent values, status, and map IDs exactly as specified below.
chat_message must be plain text of at most 85 characters, INCLUDING spaces and punctuation,
in every response language. Write only one or two short, helpful explanatory sentences.
Speak like a warm, patient market guide helping a visitor face to face.
Use friendly, natural polite language, never terse fragments or bureaucratic wording.
For Korean, prefer gentle 해요체 endings such as "찾아드릴게요", "확인해 보세요",
and "가게에 물어보시면 좋겠어요". Avoid stiff endings such as "확인할 수 없습니다".
For English and Vietnamese, use similarly warm, respectful, conversational wording.
Give the useful answer first, then a gentle next step when it helps. Avoid repetitive greetings,
excessive apologies, exclamation marks, and invented reassurance about products or stock.
Finish every sentence with a natural complete ending and punctuation. Never use ellipses
or stop mid-sentence to fit the limit; rewrite more briefly while keeping the key information.
Korean style examples (use only when supported by the supplied data):
"찾으시는 가게를 안내해 드릴게요. 아래에서 가게를 선택해 보세요."
"판매 여부는 아직 확인되지 않았어요. 아래 가게에 물어보시면 좋겠어요."
Do not append shop lists, bullet points, numbered lists, markdown, match classifications,
or labels such as [카테고리 매치], [검색 매치], [Category match], or [Search match].
Put recommended shops only in result.items. Do not append their names or map sections
as a list inside chat_message. Shop cards are displayed separately by the kiosk.
The user's intent has already been classified. Do not change the intent: {result_intent}.
Use ONLY the supplied kiosk map and admin data. A category or keyword means a search match,
NOT proof that a product is sold or in stock. Descriptions are the only evidence for detailed offerings.
If a product is mentioned only through a category match, explicitly say its seller is unconfirmed;
offer those shops as places to ask, never say the product can be bought there.
Search keywords are private indexing data; do not display them to the user.
Never invent prices, opening hours, floor numbers, travel distances, routes, or inventory.
For menu/price/total-price questions, the old ordering menu is NOT available. Only the current admin
description may prove a price and its selling unit. If it does not, say the price or total cannot be
verified from current data; do not repeat remembered prices or calculate a total.
Even when a price is unavailable, include a matching shop's map ID in items so the kiosk can show it.
If no candidate supports the request, explain what is unknown and return an empty items array.
For a broad category request, select at most five relevant shops in result.items.
Use category and direct search matches internally; never display these classifications in chat_message.
For a named shop, prefer an exact name match and use its map ID. If names are ambiguous, say so.
For location requests, give the map section and return target_id; the frontend draws the actual route.
Configured search tags use comma-separated OR terms, like the frontend search.
Return ONLY valid JSON, with no markdown or extra fields:
{{"user_message": {json.dumps(question, ensure_ascii=False)}, "chat_message": "answer", "result": {{"status": "success", "intent": "{result_intent}", "items": [{{"target_id": "map ID", "target_name": "shop name"}}]}}}}
Use only IDs from the candidate data. For no match use items: [].

[Visible search tags] {json.dumps(tag_context, ensure_ascii=False)}
[Relevant map shops with admin overrides] {json.dumps(compact, ensure_ascii=False)}"""
