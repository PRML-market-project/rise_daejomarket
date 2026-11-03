"""Real /gpt Flask route + local intent/response models, without speech startup.

Run with ai-server/.venv/Scripts/python.exe -X utf8 ... --experience <snapshot>.
Uses only the local model. No paid API fallback and no admin writes.
"""
import argparse
import ast
import contextlib
import io
import json
import logging
from pathlib import Path
import random
import re
import time
import traceback
from unittest.mock import patch

from flask import Flask, request, jsonify
import langdetect
from openai import OpenAI

import kiosk_search_context as context
from kiosk_search_cases import build_cases
from evaluate_kiosk_search import validate


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--experience", type=Path)
    parser.add_argument("--output", type=Path, default=Path("artifacts/kiosk-search-evaluation/endpoint.json"))
    args = parser.parse_args()
    if args.experience:
        data = json.loads(args.experience.read_text(encoding="utf-8"))
        if isinstance(data, list): data = {"shops": data}
        with patch.object(context, "urlopen", return_value=io.BytesIO(json.dumps(data).encode())):
            shops, tags = context.load_kiosk_context()
    else:
        shops, tags = context.load_kiosk_context(fetch_experience=False)
    app = Flask(__name__)
    namespace = dict(vars(context))
    namespace.update(app=app, request=request, jsonify=jsonify, langdetect=langdetect,
                     json=json, logging=logging, random=random, re=re, time=time, traceback=traceback,
                     load_kiosk_context=lambda: (shops, tags), LOCAL_LLM_MODEL="local-gemma", client=None,
                     local_client=OpenAI(base_url="http://127.0.0.1:8010/v1", api_key="local", max_retries=0, timeout=60))
    names = {"now_ms", "Timer", "local_chat_completion", "openai_chat_completion", "detect_language",
             "response_language_for_question", "answer_from_current_kiosk_data", "detect_intent",
             "get_response_by_intent", "generate_json_response", "gpt"}
    source = Path(__file__).with_name("app.py")
    nodes = [n for n in ast.parse(source.read_text(encoding="utf-8")).body if isinstance(n, (ast.FunctionDef, ast.ClassDef)) and n.name in names]
    exec(compile(ast.Module(body=nodes, type_ignores=[]), str(source), "exec"), namespace)
    selected = {"pasta", "implicit-food", "rain", "allergy", "one", "three", "exclude", "order", "pay",
                "price", "total", "stock", "coding", "math", "injection", "unknown", "english", "vietnamese"}
    cases = [c for c in build_cases(shops) if c["id"] in selected]
    cases += [c for c in build_cases(shops) if c["id"] in ("named:585:28762:3", "category:식당:추천해줘")]
    rows = []
    for case in cases:
        with contextlib.redirect_stdout(io.StringIO()):
            response = app.test_client().post("/gpt", json=dict(text=case["question"], admin_id=1, kiosk_id=1, language=case.get("language", "ko")))
        answer = response.get_json()
        errors, _ = validate(case, answer, {s["id"] for s in shops})
        if response.status_code != 200: errors.append(f"HTTP:{response.status_code}")
        if answer.get("result", {}).get("admin_id") != 1: errors.append("missing_admin_id")
        if answer.get("result", {}).get("kiosk_id") != 1: errors.append("missing_kiosk_id")
        rows.append(dict(case=case, answer=answer, errors=errors))
        print(case["id"], "PASS" if not errors else f"FAIL {errors}", flush=True)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{sum(not r['errors'] for r in rows)}/{len(rows)} passed")
    return int(any(r["errors"] for r in rows))


if __name__ == "__main__":
    raise SystemExit(main())
