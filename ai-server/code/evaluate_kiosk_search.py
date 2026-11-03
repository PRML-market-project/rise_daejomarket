"""Run with python -X utf8 ...; --mode local calls real Gemma without loading Whisper.

Offline tests validate retrieval and postprocessing only; they do NOT evaluate LLM quality.
Local tests run the real app response function with its generator directed to local Gemma.
No paid API fallback is used. Full responses and per-shop exposure are saved for review.
"""
import argparse
import ast
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
import io
import json
from pathlib import Path
import random
import re
import subprocess
import time
from unittest.mock import patch
from urllib.request import Request, urlopen

import kiosk_search_context as context
from kiosk_search_cases import build_cases

ROOT = Path(__file__).resolve().parents[2]


def load_answer(shops, tags, generate, baseline=False, rng=None):
    """Compile only the production function, avoiding speech model initialization."""
    namespace = dict(vars(context))
    if baseline:
        old = subprocess.check_output(["git", "show", "HEAD:ai-server/code/kiosk_search_context.py"], cwd=ROOT).decode("utf-8")
        exec(compile(old, str(context.MAP_SOURCE), "exec"), namespace)
        namespace["broad_category_shops"] = lambda *_: []
        namespace["required_recommendation_shops"] = lambda *_: []
    namespace.update(json=json, re=re, random=rng or random,
                     load_kiosk_context=lambda: (shops, tags), generate_json_response=generate)
    source = Path(__file__).with_name("app.py")
    node = next(n for n in ast.parse(source.read_text(encoding="utf-8")).body
                if isinstance(n, ast.FunctionDef) and n.name == "answer_from_current_kiosk_data")
    exec(compile(ast.Module(body=[node], type_ignores=[]), str(source), "exec"), namespace)
    return namespace[node.name]


def validate(case, answer, known):
    errors = []
    result = answer.get("result", {})
    items = result.get("items", [])
    ids = [i.get("target_id") for i in items]
    if result.get("status") != "success": errors.append("invalid_status")
    if result.get("intent") != {1:"get_store", 2:"get_menu", 3:"get_location", 4:"get_total_price"}[case["intent"]]:
        errors.append("invalid_intent")
    if len(ids) != len(set(ids)): errors.append("duplicate_ids")
    if set(ids) - known: errors.append("invented_ids")
    missing = set(case.get("required", [])) - set(ids)
    if missing: errors.append(f"missing:{','.join(sorted(missing))}")
    if "allowed" in case and set(ids) - set(case["allowed"]): errors.append("irrelevant_shops")
    if len(ids) < case.get("min_items", 0): errors.append("too_few")
    if len(ids) > case.get("max_items", len(known)): errors.append("too_many")
    message = answer.get("chat_message", "")
    if not isinstance(message, str) or not message.strip() or len(message) > 85: errors.append("invalid_message")
    if case.get("message_any") and not any(w in message for w in case["message_any"]): errors.append("missing_guidance")
    if any(w in message for w in case.get("message_none", [])): errors.append("false_claim")
    return errors, ids


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=["offline", "local"], default="offline")
    parser.add_argument("--baseline", action="store_true")
    parser.add_argument("--experience", type=Path, help="Explicit admin snapshot; never silently used in production")
    parser.add_argument("--groups", default="named,category,edge")
    parser.add_argument("--workers", type=int, default=1)
    parser.add_argument("--base-url", default="http://127.0.0.1:8010/v1")
    parser.add_argument("--output", type=Path, default=ROOT / "artifacts/kiosk-search-evaluation")
    args = parser.parse_args()
    if args.experience:
        experience = json.loads(args.experience.read_text(encoding="utf-8"))
        if isinstance(experience, list): experience = {"shops": experience}
        with patch.object(context, "urlopen", return_value=io.BytesIO(json.dumps(experience).encode())):
            shops, tags = context.load_kiosk_context()
        source = str(args.experience)
    else:
        shops, tags = context.load_kiosk_context(fetch_experience=False)
        source = "map catalog only (no admin overrides)"
    cases = [c for c in build_cases(shops) if c["group"] in args.groups.split(",")]
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "cases.json").write_text(json.dumps(cases, ensure_ascii=False, indent=2), encoding="utf-8")
    (args.output / "catalog.json").write_text(json.dumps(shops, ensure_ascii=False, indent=2), encoding="utf-8")
    rows = []
    (args.output / "responses.jsonl").write_text("", encoding="utf-8")
    known = {s["id"] for s in shops}

    def run(case):
        metadata = {}
        def generate(prompt, text, max_tokens=1200):
            if args.mode == "offline":
                # Deliberately omit category results to test the coverage repair.
                ids = [] if case["group"] == "category" else case.get("required", [])
                return json.dumps(dict(chat_message="가게 정보를 확인해 보세요.", result=dict(items=[dict(target_id=i) for i in ids])))
            payload = dict(model="local-gemma", messages=[dict(role="user", content=prompt + "\n\n[사용자 입력]\n" + text)],
                           temperature=0, max_tokens=max_tokens, response_format={"type":"json_object"},
                           chat_template_kwargs={"enable_thinking":False})
            req = Request(args.base_url + "/chat/completions", data=json.dumps(payload).encode(), headers={"Content-Type":"application/json"})
            with urlopen(req, timeout=180) as response: data = json.load(response)
            metadata.update(usage=data.get("usage"), model=data.get("model"), finish_reason=data["choices"][0].get("finish_reason"))
            raw = data["choices"][0]["message"]["content"]
            metadata["raw_model_response"] = raw
            return raw
        started = time.perf_counter()
        try:
            answer = json.loads(load_answer(shops, tags, generate, args.baseline)(case["intent"], case["question"], case.get("language", "ko")))
            check_case = case if args.mode == "local" else {k:v for k,v in case.items() if k not in ("message_any", "message_none", "min_items", "max_items")}
            errors, ids = validate(check_case, answer, known)
            return dict(case=case, answer=answer, ids=ids, errors=errors, seconds=round(time.perf_counter()-started, 3), **metadata)
        except Exception as error:
            return dict(case=case, ids=[], errors=[f"{type(error).__name__}:{error}"], seconds=round(time.perf_counter()-started, 3), **metadata)

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = [pool.submit(run, c) for c in cases]
        for future in as_completed(futures):
            row = future.result(); rows.append(row)
            print(f"[{len(rows)}/{len(cases)}] {row['case']['id']}: {'FAIL ' + str(row['errors']) if row['errors'] else 'PASS'}", flush=True)
            with (args.output / "responses.jsonl").open("a", encoding="utf-8") as stream:
                stream.write(json.dumps(row, ensure_ascii=False) + "\n")
    exposure, opportunities = Counter(), Counter()
    by_group = defaultdict(Counter)
    for row in rows:
        exposure.update(row["ids"])
        opportunities.update(row["case"].get("required", []))
        by_group[row["case"]["group"]]["failed" if row["errors"] else "passed"] += 1
    # Fairness is measured WITHIN relevant category pools, not by forcing all
    # categories into the same number of unrelated queries.
    fairness = []
    rng = random.Random(20261103)
    for category in sorted({s["category"] for s in shops}):
        pool = [s for s in shops if s["category"] == category]
        top = Counter(); orders = set()
        answer = load_answer(shops, tags, lambda *_a, **_k: '{"chat_message":"가게를 확인해 보세요.","result":{"items":[]}}', args.baseline, rng)
        for _ in range(1000):
            ids = [i["target_id"] for i in json.loads(answer(1, f"{category} 추천해줘", "ko"))["result"]["items"]]
            orders.add(tuple(ids)); top.update(ids[:6])
        values = [top[s["id"]] for s in pool]
        fairness.append(dict(category=category, shops=len(pool), trials=1000, unique_orders=len(orders),
                             top6_min=min(values), top6_max=max(values), zero_top6=[s["id"] for s in pool if not top[s["id"]]],
                             top6_by_id=dict(top)))
    report = dict(mode=args.mode, baseline=args.baseline, catalog_source=source, shops=len(shops), cases=len(rows),
                  passed=sum(not r["errors"] for r in rows), groups=dict(by_group),
                  zero_exposure=[s["id"] for s in shops if not exposure[s["id"]]],
                  per_shop=[dict(id=s["id"], name=s["name"], category=s["category"], exposure=exposure[s["id"]], required_opportunities=opportunities[s["id"]]) for s in shops],
                  fairness_postprocessing_only=fairness,
                  failures=[dict(id=r["case"]["id"], errors=r["errors"]) for r in rows if r["errors"]])
    (args.output / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k:report[k] for k in ("mode","shops","cases","passed","groups","zero_exposure")}, ensure_ascii=True))
    return 0 if report["passed"] == report["cases"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
