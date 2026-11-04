"""Use the same map catalog and admin overrides as the kiosk search screen."""

import json
import os
import re
import unicodedata
from pathlib import Path
from urllib.request import urlopen


MAP_SOURCE = Path(__file__).resolve().parents[2] / "frontend/src/data/figma-map-shops.ts"
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


def select_shops(question, shops, tags, limit=None):
    query = _normalize(question)
    words = [_normalize(word) for word in re.split(r"[\s,，?!]+", question) if len(_normalize(word)) > 1]
    words += [_normalize(term) for term in ("반찬", "간식", "만두", "국수", "두부", "문구", "신발")
              if _normalize(term) in query]
    category_aliases = {
        "식당": ("식당", "음식점", "주변식당", "맛집", "restaurant", "quán ăn", "nhà hàng"),
        "식품": ("식품",),
        "청과": ("청과", "과일", "키위", "사과", "채소", "야채", "fruit"),
        "정육": ("정육", "고기", "육류", "meat"),
        "수산": ("수산", "생선", "해산물", "seafood"),
        "잡화": ("잡화", "생활용품", "옷", "의류", "clothing"),
        "서비스업": ("서비스업", "약국", "pharmacy"),
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
    stop_words = {_normalize(word) for word in ("어디", "가게", "점포", "찾아줘", "있나요", "알려줘", "정보")}
    for position, shop in enumerate(shops):
        name = _normalize(shop["name"])
        category = _normalize(shop["category"])
        searchable = "\0".join(_normalize(value) for value in (
            shop["name"], shop.get("description") or "", shop.get("keywords") or "",
            *(shop.get("tags") or [])))
        score = 0
        if name and name in query:
            score += 100
        score += 12 * sum(1 for word in words if word in searchable and word not in stop_words)
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


def broad_category_shops(question, shops):
    """Only expand unconstrained category questions, never a specific product/preference."""
    query = re.sub(r"\s+", "", question.lower())
    categories = set()
    aliases = {
        "식당": ("주변식당", "음식점", "식당", "맛집", "restaurants", "restaurant", "nhà hàng", "quán ăn"),
        "식품": ("식품",), "청과": ("청과", "과일", "야채", "채소"),
        "정육": ("정육", "고기", "육류"), "수산": ("수산", "생선", "해산물"),
        "잡화": ("잡화",), "서비스업": ("서비스업",),
    }
    for category, terms in aliases.items():
        for term in sorted(terms, key=len, reverse=True):
            term = re.sub(r"\s+", "", term)
            if term in query:
                categories.add(category)
                query = query.replace(term, " ")
    # Any remaining substantive term means the LLM must assess the condition.
    neutral = ("대조시장", "주변", "가게", "점포", "전체", "모두", "전부", "추천", "목록", "안내",
               "찾아주세요", "찾아줘", "보여주세요", "보여줘", "알려주세요", "알려줘", "해주세요", "해줘",
               "어디있나요", "어디", "있나요", "살 수 있는", "파는", "살", "좀", "please", "recommend", "show", "find", "near me",
               "gợi ý", "을", "를", "이", "가", "은", "는", "에", "도", "와", "과")
    for word in neutral:
        word = re.sub(r"\s+", "", word)
        query = query.replace(word, " ")
    if re.sub(r"[\s?!.,，/]+", "", query):
        return []
    return [shop for shop in shops if shop["category"] in categories]


def is_recommendation_question(question):
    query = _normalize(question)
    return any(_normalize(term) in query for term in (
        "추천", "뭐 먹", "뭐먹", "먹을 만", "먹을만", "어디가 좋", "어디가좋",
        "recommend", "suggest", "what to eat", "where should", "gợi ý", "đề xuất",
    ))


def select_search_candidates(question, shops, tags):
    broad = broad_category_shops(question, shops)
    if broad:
        return broad
    exclusion = re.split(r"말고|빼고|제외하고|아닌", question, maxsplit=1)
    if len(exclusion) == 2:
        excluded_categories = {shop["category"] for shop in broad_category_shops(exclusion[0], shops)}
        positive = select_shops(exclusion[1], shops, tags)
        if excluded_categories and positive:
            return [shop for shop in positive if shop["category"] not in excluded_categories]
    semantic = is_recommendation_question(question) or any(term in question.lower() for term in (
        "먹", "마실", "선물", "살 수", "사고 싶", "파는", "구매", "what to eat"))
    if semantic:
        # Situation-based recommendations may have no literal keyword match.
        # Let the LLM judge the map catalog, with direct matches listed first.
        query = _normalize(question)
        food_query = any(_normalize(term) in query for term in (
            "먹", "식당", "음식", "식사", "간식", "브런치", "restaurant", "what to eat", "nhà hàng", "quán ăn"))
        mixed_request = any(_normalize(term) in query for term in ("옷", "의류", "미용", "약", "수선", "문구", "잡화", "숙박"))
        # Broad food alternatives can include ready-to-eat shops categorized as
        # meat/fish/groceries, but a salon or pharmacy is never a meal alternative.
        pool = [shop for shop in shops if shop["category"] not in ("잡화", "서비스업")] if food_query and not mixed_request else shops
        matched = select_shops(question, pool, tags, limit=None)
        matched_ids = {shop["id"] for shop in matched}
        return matched + [shop for shop in pool if shop["id"] not in matched_ids]
    return select_shops(question, shops, tags)


def warm_food_recommendation_priorities(question, shops):
    query = _normalize(question)
    rainy_day = any(_normalize(term) in query for term in ("비 오는 날", "비가 오는 날"))
    if not is_recommendation_question(question) or not rainy_day or _normalize("따뜻") not in query:
        return []
    # Curated market examples: dumplings, porridge, pancakes, and noodles.
    # Resolve against current map/admin data so renamed or removed shops are
    # never represented with a stale name or an invented ID.
    preferred_ids = ("585:28762", "585:28790", "585:28803", "585:28874")
    by_id = {shop["id"]: shop for shop in shops}
    return [by_id[shop_id] for shop_id in preferred_ids if shop_id in by_id]


def required_recommendation_shops(question, shops):
    """Repair omissions only for the existing unconstrained rainy/warm-food guide.

    Any leftover constraint/product/count leaves selection entirely to the model.
    """
    preferred = warm_food_recommendation_priorities(question, shops)
    if not preferred:
        return []
    query = _normalize(question)
    terms = ("비가 오는 날", "비 오는 날", "따뜻한", "따뜻하게", "음식", "먹거리", "먹을", "추천해 주세요",
             "추천해줘요", "추천해줘", "추천", "대조시장", "시장에서", "좀", "해줘", "주세요")
    for term in sorted(terms, key=lambda value: len(_normalize(value)), reverse=True):
        query = query.replace(_normalize(term), "")
    return [] if re.sub(r"[?!.,，]+", "", query) else preferred


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


def parse_model_response(raw):
    """Recover complete card objects if generation stops partway through items.

    Never invent a missing message or ID. The caller still validates every ID
    against current candidates and removes duplicates before returning cards.
    """
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    try:
        return json.loads(match.group() if match else raw)
    except json.JSONDecodeError:
        message_field = re.search(r'"chat_message"\s*:\s*', raw)
        items_field = re.search(r'"items"\s*:\s*\[', raw)
        if not message_field or not items_field or message_field.start() > items_field.start():
            raise
        decoder = json.JSONDecoder()
        message, _ = decoder.raw_decode(raw[message_field.end():])
        if not isinstance(message, str) or not message.strip():
            raise ValueError("Incomplete kiosk message")
        remaining = raw[items_field.end():].lstrip()
        items = []
        while remaining.startswith("{"):
            try:
                item, end = decoder.raw_decode(remaining)
            except json.JSONDecodeError:
                break
            if not isinstance(item, dict) or not isinstance(item.get("target_id"), str):
                raise ValueError("Invalid incomplete kiosk card")
            items.append(item)
            remaining = remaining[end:].lstrip()
            if not remaining.startswith(","):
                break
            remaining = remaining[1:].lstrip()
        if not items:
            raise ValueError("No complete kiosk cards to recover")
        return {"chat_message": message, "result": {"items": items}}


def build_search_prompt(intent, question, language, shops, tags):
    candidates = select_search_candidates(question, shops, tags)
    recommendation = is_recommendation_question(question) or len(candidates) > 20
    response_language = {"vi": "Vietnamese", "en": "English"}.get(language, "Korean")
    public_fields = ("id", "name", "category", "section", "description", "keywords", "tags")
    broad = broad_category_shops(question, shops)
    # Compact rows retain evidence for EVERY semantic candidate without duplicating
    # the full catalog in two sections of the local model's context window.
    fields = ("id", "name", "category") if broad else (
        ("id", "name", "category", "description", "clues") if recommendation else public_fields)
    rows = []
    for shop in candidates:
        evidence = dict(shop)
        # Indexing often repeats the name/category/description verbatim. Keep
        # novel evidence for every shop instead of paying the token cost twice.
        existing = _normalize(" ".join(str(shop.get(key) or "") for key in ("name", "category", "description")))
        evidence["keywords"] = ",".join(term.strip() for term in re.split(r"[,，]", shop.get("keywords") or "")
                                         if term.strip() and _normalize(term.strip()) not in existing)
        evidence["tags"] = [tag for tag in shop.get("tags") or [] if _normalize(tag) not in existing]
        evidence["clues"] = ",".join(filter(None, [evidence["keywords"], *evidence["tags"]]))
        rows.append([evidence.get(key) or "" for key in fields])
    priorities = [shop["id"] for shop in warm_food_recommendation_priorities(question, candidates)]
    result_intent = {1: "get_store", 2: "get_menu", 3: "get_location", 4: "get_total_price"}.get(intent, "get_store")
    contract = {"user_message": question, "chat_message": "answer", "result": {
        "status": "success", "intent": result_intent, "items": [{"target_id": "map ID"}]}}
    instructions = Path(__file__).with_name("kiosk_search_prompt.txt").read_text(encoding="utf-8")
    return instructions + "\n" + "\n".join((
        "Response language: " + response_language,
        "Required intent: " + result_intent,
        "JSON schema example: " + json.dumps(contract, ensure_ascii=False),
        "[Visible search tags] " + json.dumps(tags, ensure_ascii=False, separators=(",", ":")),
        "[Rainy-day warm-food priority shops] " + json.dumps(priorities),
        "[Shop row fields] " + json.dumps(fields),
        "[Candidate rows] " + json.dumps(rows, ensure_ascii=False, separators=(",", ":")),
    ))
