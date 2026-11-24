"""Local-only experiment. Does not modify production prompts, config or Q&A logs."""
import argparse
import ast
import importlib.util
import collections
import itertools
import json
from pathlib import Path
import random
import re
import statistics
import sys
import time
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
sys.dont_write_bytecode = True
BASELINE_SOURCE = Path(__file__).resolve().parent / "baseline-source"
spec = importlib.util.spec_from_file_location("benchmark_search_context", BASELINE_SOURCE / "kiosk_search_context.py")
context = importlib.util.module_from_spec(spec)
spec.loader.exec_module(context)

OUT = Path(__file__).resolve().parent
BASE_CANDIDATES = context.select_search_candidates
BASE_PROMPT = context.build_search_prompt
VARIANTS = {"baseline": (0.0, False, False), "temp03": (0.3, False, False),
            "temp06": (0.6, False, False), "expand03": (0.3, True, False),
            "coverage03": (0.3, True, True), "focused03": (0.3, True, True),
            "union03": (0.3, True, True)}
QUESTIONS = {
    "warmshort": "따뜻한 요리", "warmrecommend": "따뜻한 음식 추천해줘",
    "rain": "비 오는 날 따뜻한 음식 추천해줘", "three": "식당 3곳만 추천해줘",
    "exclude": "만두 말고 따뜻한 음식 추천해줘", "allergy": "땅콩 알레르기 있어. 안전한 간식 추천해줘",
    "warmthree": "따뜻한 요리 3곳만 추천해줘",
}
# Manually reviewed meal/ready-to-eat descriptions in the frozen backup. This
# reference measures meal-type relevance, not verified serving temperature/safety.
MEAL_NAMES = {"행운손만두", "황가네순대국 (2층)", "곰순이네 한식뷔페", "서울지짐이", "유명한튀김",
              "옛날죽집", "통큰족발", "소문난순대", "어묵집", "바로돈가스", "불광동족발", "남도술상",
              "왕십리곱창", "꽉찬소곱창", "행복통닭", "도깨비칼국수", "칠공주 호떡&떡갈비", "장터빈대떡", "불광돌쇠닭강정"}
COVERAGE = """
For broad warm-meal requests, consider every supported meal and ready-to-eat
alternative: soup/noodles, dumplings, porridge, pancakes, cooked-rice meals,
grilled/fried dishes and hot snacks. Check each candidate rather than stopping
after a short list of famous soup shops. Include all useful supported alternatives.
Raw meat/fish/vegetables, dried ingredients, cold side dishes and generic grocery
shops are not ready-to-eat warm meals just because their descriptions say cooking.
Do not infer current serving temperature, stock or allergy safety. When needed,
say the user should ask the shop. Counts, exclusions and dietary constraints always
override broad coverage. Never add unrelated shops just to reach a number.
"""


def snapshot():
    sql = (ROOT / "deployment/database.sql").read_text(encoding="utf-8")
    line = next(x for x in sql.splitlines() if x.startswith("INSERT INTO `kiosk_experience` VALUES"))
    values = re.findall(r"'((?:[^'\\]|\\.)*)'", line)
    escapes = {"0": "\0", "n": "\n", "r": "\r", "t": "\t", "b": "\b", "Z": "\x1a"}
    def decode(value):
        return re.sub(r"\\(.)", lambda m: escapes.get(m[1], m[1]), value)
    overrides, tags = [], []
    for value in values:
        try:
            data = json.loads(decode(value))
        except ValueError:
            continue
        if isinstance(data, list) and data and "description" in data[0]:
            overrides = data
        elif isinstance(data, list) and data and "keywords" in data[0] and "visible" in data[0]:
            tags = [tag for tag in data if tag.get("visible")]
    shops = context.load_map_shops(ROOT / "frontend/src/data/figma-map-shops.ts")
    by_id = {s["id"]: s for s in shops}
    for item in overrides:
        shop = by_id.get(item["id"])
        if shop:
            for key in ("name", "description", "keywords", "tags"):
                if key in item:
                    shop[key] = item[key]
    (OUT / "catalog-snapshot.json").write_text(json.dumps({"source": "deployment/database.sql", "snapshot_updated": values[1], "shops": shops, "tags": tags}, ensure_ascii=False, indent=2), encoding="utf-8")
    return shops, tags


def expanded_candidates(question, shops, tags):
    if "따뜻" not in question and "요리" not in question:
        return BASE_CANDIDATES(question, shops, tags)
    pool = [s for s in shops if s["category"] not in ("잡화", "서비스업")]
    matched = context.select_shops(question, pool, tags)
    ids = {s["id"] for s in matched}
    return matched + [s for s in pool if s["id"] not in ids]


def production_answer(namespace):
    file = BASELINE_SOURCE / "app.py"
    tree = ast.parse(file.read_text(encoding="utf-8"))
    node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "answer_from_current_kiosk_data")
    exec(compile(ast.Module(body=[node], type_ignores=[]), str(file), "exec"), namespace)
    return namespace[node.name]


def focused_candidates(question, shops, tags):
    if "따뜻" not in question or re.search(r"알레르기|채식|비건|식재료|가격|얼마", question):
        return BASE_CANDIDATES(question, shops, tags)
    direct = r"만두|순대|칼국수|빈대떡|부침|지짐|국밥|어묵|돈가스|곱창|닭강정|통닭|치킨|족발|호떡|떡갈비|튀김|죽|식사|한 끼"
    pool = []
    for shop in shops:
        description = shop.get("description") or ""
        if re.search(r"식재료|쌀과 곡물|김치|젓갈|반찬", description):
            continue
        if shop["category"] == "식당" or re.search(direct, shop["name"] + " " + description):
            pool.append(shop)
    return pool


def unconstrained_warm(question):
    if "따뜻" not in question:
        return False
    remaining = re.sub(r"\s+", "", question)
    for term in ("추천해주세요", "추천해줘요", "추천해줘", "비가오는날", "비오는날", "따뜻한", "따뜻하게", "음식", "요리", "먹거리", "추천", "대조시장", "시장에서", "좀", "해줘", "주세요"):
        remaining = remaining.replace(term, "")
    return not re.sub(r"[?!.,，]", "", remaining)


def one_run(variant, key, repeat, shops, tags, replay=None):
    temperature, expand, coverage = VARIANTS[variant]
    question = QUESTIONS[key]
    context.select_search_candidates = focused_candidates if variant in ("focused03", "union03") else expanded_candidates if expand else BASE_CANDIDATES
    context.build_search_prompt = lambda *a: BASE_PROMPT(*a) + (COVERAGE if coverage else "")
    record = {"variant": variant, "case": key, "question": question, "repeat": repeat,
              "temperature": temperature, "seed": 101 + repeat * 101}
    candidates = context.select_search_candidates(question, shops, tags)
    record["candidate_count"] = len(candidates)
    start = time.perf_counter()
    def generate(prompt, text, max_tokens):
        if replay is not None:
            record.update({k: replay.get(k) for k in ("usage", "finish_reason", "raw")})
            record["replayed_from"] = {k: replay[k] for k in ("variant", "case", "repeat", "seconds")}
            return json.dumps(context.parse_model_response(record["raw"]), ensure_ascii=False)
        payload = {"model": "local-gemma", "messages": [{"role": "user", "content": prompt + "\n\n[사용자 입력]\n" + text}],
                   "temperature": temperature, "seed": record["seed"], "max_tokens": max_tokens,
                   "response_format": {"type": "json_object"}, "chat_template_kwargs": {"enable_thinking": False}}
        req = Request("http://127.0.0.1:8010/v1/chat/completions", data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
        with urlopen(req, timeout=120) as response:
            result = json.load(response)
        record["usage"] = result.get("usage")
        record["finish_reason"] = result["choices"][0].get("finish_reason")
        record["raw"] = result["choices"][0]["message"]["content"]
        return json.dumps(context.parse_model_response(record["raw"]), ensure_ascii=False)
    namespace = dict(vars(context))
    namespace.update(json=json, re=re, random=random.Random(123), load_kiosk_context=lambda: (shops, tags), generate_json_response=generate)
    if variant == "union03":
        namespace["required_recommendation_shops"] = lambda q, pool: focused_candidates(q, pool, tags) if unconstrained_warm(q) else context.required_recommendation_shops(q, pool)
    try:
        answer = json.loads(production_answer(namespace)(1, question, "ko"))
        record["answer"] = answer
        ids = [x["target_id"] for x in answer["result"]["items"]]
        by_id = {s["id"]: s for s in shops}
        names = [by_id[i]["name"] for i in ids]
        record.update(count=len(ids), ids=ids, names=names,
                      reference_hits=sum(name in MEAL_NAMES for name in names),
                      weaker_evidence=[name for name in names if name not in MEAL_NAMES],
                      invalid_ids=[i for i in ids if i not in by_id],
                      message=answer["chat_message"])
        if key == "three": record["constraint_ok"] = len(ids) == 3 and all(by_id[i]["category"] == "식당" for i in ids)
        if key == "warmthree": record["constraint_ok"] = len(ids) == 3
        if key == "exclude": record["constraint_ok"] = all("만두" not in name for name in names)
        if key == "allergy": record["constraint_ok"] = not any(term in answer["chat_message"] for term in ("안전해요", "안심하고", "걱정 없이", "알레르기 없이")) and any(term in answer["chat_message"] for term in ("확인", "문의", "알레르기"))
    except Exception as error:
        record["error"] = f"{type(error).__name__}: {error}"
    record["seconds"] = round(time.perf_counter() - start, 3)
    return record


def summarize(records):
    groups = collections.defaultdict(list)
    for record in records:
        groups[(record["variant"], record["case"])].append(record)
    rows = []
    for (variant, case), group in groups.items():
        good = [r for r in group if "count" in r]
        row = {"variant": variant, "case": case, "runs": len(group), "errors": len(group)-len(good)}
        if good:
            pairs = list(itertools.combinations(good, 2))
            row.update(mean_count=statistics.mean(r["count"] for r in good), count_range=[min(r["count"] for r in good), max(r["count"] for r in good)],
                       mean_seconds=round(statistics.mean(r["seconds"] for r in good), 3) if not any("replayed_from" in r for r in good) else None,
                       mean_source_model_seconds=round(statistics.mean(r.get("replayed_from", {}).get("seconds", r["seconds"]) for r in good), 3),
                       mean_replay_processing_seconds=round(statistics.mean(r["seconds"] for r in good), 3) if any("replayed_from" in r for r in good) else None,
                       distinct_messages=len({r["message"] for r in good}), distinct_sets=len({tuple(sorted(r["ids"])) for r in good}),
                       union_shops=len(set().union(*(set(r["ids"]) for r in good))),
                       mean_jaccard=statistics.mean(len(set(a["ids"])&set(b["ids"]))/max(1,len(set(a["ids"])|set(b["ids"]))) for a,b in pairs) if pairs else None,
                       meal_type_reference_fraction=sum(r["reference_hits"] for r in good)/max(1,sum(r["count"] for r in good)),
                       weaker_evidence=sorted(set().union(*(set(r["weaker_evidence"]) for r in good))),
                       constraints=[r["constraint_ok"] for r in good if "constraint_ok" in r])
        rows.append(row)
    (OUT / "summary.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--variants", default=",".join(VARIANTS))
    parser.add_argument("--questions", default="warmshort,warmrecommend")
    parser.add_argument("--repeats", type=int, default=3)
    args = parser.parse_args()
    shops,tags = snapshot()
    output = OUT / "results.jsonl"
    records = [json.loads(line) for line in output.read_text(encoding="utf-8").splitlines()] if output.exists() else []
    done = {(r["variant"],r["case"],r["repeat"]) for r in records}
    for key in args.questions.split(","):
        for variant in args.variants.split(","):
            for repeat in range(args.repeats):
                if (variant,key,repeat) in done: continue
                replay = next((r for r in records if r["variant"] == "focused03" and r["case"] == key and r["repeat"] == repeat), None) if variant == "union03" else None
                if variant == "union03" and replay is None:
                    raise ValueError("Run focused03 first; union03 is an offline replay of the same model output")
                result = one_run(variant,key,repeat,shops,tags,replay=replay)
                with output.open("a",encoding="utf-8") as file: file.write(json.dumps(result,ensure_ascii=False)+"\n")
                records.append(result)
                summarize(records)
                print(json.dumps({k:result.get(k) for k in ("variant","case","repeat","candidate_count","count","seconds","finish_reason","error","weaker_evidence")},ensure_ascii=False),flush=True)
    summarize(records)


if __name__ == "__main__": main()
