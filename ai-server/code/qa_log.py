"""Append one JSON line per kiosk question/answer so searches can be analysed later."""
import json
import logging
import os
import threading
from datetime import datetime
from pathlib import Path

DEFAULT_LOG_DIR = Path(__file__).resolve().parents[1] / "logs" / "qa"
_write_lock = threading.Lock()


def qa_log_enabled():
    return os.getenv("QA_LOG_ENABLED", "true").strip().lower() not in ("0", "false", "no", "off")


def qa_log_path(now):
    """One file per month keeps files small enough to open while staying easy to merge."""
    return Path(os.getenv("QA_LOG_DIR") or DEFAULT_LOG_DIR) / f"qa-{now:%Y-%m}.jsonl"


def append_qa_log(record, now=None):
    """Write the record as a single JSONL line; logging must never break a kiosk answer."""
    if not qa_log_enabled():
        return None
    now = now or datetime.now().astimezone()
    path = qa_log_path(now)
    line = json.dumps({"timestamp": now.isoformat(timespec="milliseconds"), **record},
                      ensure_ascii=False, default=str)
    try:
        with _write_lock:
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open("a", encoding="utf-8", newline="\n") as file:
                file.write(line + "\n")
    except OSError as error:
        logging.warning("Q&A log write failed (%s): %s", path, error)
        return None
    return path


def summarize_answer(result_json):
    """Keep the parts of a /gpt answer that matter for analysis, not the full payload."""
    result = result_json.get("result") if isinstance(result_json.get("result"), dict) else {}
    items = result.get("items") if isinstance(result.get("items"), list) else []
    shops = [{"id": item.get("target_id"), "name": item.get("target_name")}
             for item in items if isinstance(item, dict)]
    return {
        "chat_message": result_json.get("chat_message"),
        "result_intent": result.get("intent"),
        "result_status": result.get("status"),
        "item_count": len(shops),
        "items": shops,
    }
