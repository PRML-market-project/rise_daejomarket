"""Run the changed production functions against the local LLM, without speech startup."""
import ast
import json
import logging
from pathlib import Path
import random
import re
import sys
import time
from types import SimpleNamespace
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "ai-server/code"))
import kiosk_search_context as context

folder = Path(__file__).resolve().parent
data = json.loads((folder / "catalog-snapshot.json").read_text(encoding="utf-8"))
calls = []
def create(**kwargs):
    payload = dict(kwargs)
    payload.update(payload.pop("extra_body", {}))
    calls.append({"temperature": payload.get("temperature"), "max_tokens": payload.get("max_tokens")})
    req = Request("http://127.0.0.1:8010/v1/chat/completions", data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
    with urlopen(req, timeout=120) as response:
        result = json.load(response)
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=result["choices"][0]["message"]["content"]))])

def no_paid_fallback(*args, **kwargs):
    raise AssertionError("Unexpected fallback during local verification")

namespace = dict(vars(context))
namespace.update(json=json, re=re, logging=logging, random=random, LOCAL_LLM_MODEL="local-gemma",
                 local_client=SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create))),
                 openai_chat_completion=no_paid_fallback, load_kiosk_context=lambda: (data["shops"], data["tags"]))
source = ROOT / "ai-server/code/app.py"
names = {"local_chat_completion", "generate_json_response", "answer_from_current_kiosk_data", "detect_intent"}
nodes = [node for node in ast.parse(source.read_text(encoding="utf-8")).body if isinstance(node, ast.FunctionDef) and node.name in names]
exec(compile(ast.Module(body=nodes, type_ignores=[]), str(source), "exec"), namespace)

records = []
for question in ("따뜻한 요리", "따뜻한 음식 추천해줘", "따뜻한 요리 3곳만 추천해줘", "만두 말고 따뜻한 음식 추천해줘", "행운손만두 가격 얼마야?"):
    calls.clear()
    start = time.perf_counter()
    intent = namespace["detect_intent"](question)
    answer = json.loads(namespace["answer_from_current_kiosk_data"](intent, question, "ko"))
    ids = [item["target_id"] for item in answer["result"]["items"]]
    shop_by_id = {shop["id"]: shop for shop in data["shops"]}
    names = [shop_by_id[i]["name"] for i in ids]
    assert calls[0]["temperature"] == 0.0
    assert calls[-1]["temperature"] == (0.0 if "가격" in question else 0.3)
    assert len(ids) == len(set(ids))
    if question in ("따뜻한 요리", "따뜻한 음식 추천해줘"):
        assert set(ids) == {s["id"] for s in context.warm_meal_shops(data["shops"])}
    if "3곳만" in question: assert len(ids) == 3
    if "말고" in question: assert all("만두" not in name for name in names)
    if "가격" in question:
        assert names == ["행운손만두"]
        assert "등록된 가격 정보가 없어요" in answer["chat_message"]
    record = {"question": question, "intent": intent, "model_calls": list(calls), "count": len(ids), "names": names,
              "message": answer["chat_message"], "seconds": round(time.perf_counter()-start, 3)}
    records.append(record)
    print(json.dumps(record, ensure_ascii=False), flush=True)
    (folder / "implementation-verification.json").write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
print("All production-function checks passed.")
