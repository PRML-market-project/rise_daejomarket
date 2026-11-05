"""Exercise production response postprocessing without loading speech models."""
import ast
import json
from pathlib import Path
import random
import re
import logging
import time
import traceback

from flask import Flask, jsonify, request

import kiosk_search_context as context
import qa_log


def load_answer(shops, tags, generate, rng=None):
    namespace = dict(vars(context))
    namespace.update(json=json, re=re, random=rng or random,
                     load_kiosk_context=lambda: (shops, tags), generate_json_response=generate)
    source = Path(__file__).resolve().parents[1] / 'code' / 'app.py'
    node = next(n for n in ast.parse(source.read_text(encoding='utf-8')).body
                if isinstance(n, ast.FunctionDef) and n.name == 'answer_from_current_kiosk_data')
    exec(compile(ast.Module(body=[node], type_ignores=[]), str(source), 'exec'), namespace)
    return namespace[node.name]


def load_gpt_app(answer, detect_intent, qa_records=None):
    """Exercise the production HTTP handler without initializing GPU speech models.

    Q&A log records are collected in ``qa_records`` instead of being written to disk.
    """
    app = Flask(__name__)
    namespace = dict(vars(context))
    records = qa_records if qa_records is not None else []
    namespace.update(app=app, request=request, jsonify=jsonify, time=time,
                     logging=logging, detect_intent=detect_intent, traceback=traceback,
                     append_qa_log=records.append, summarize_answer=qa_log.summarize_answer,
                     response_language_for_question=lambda text, language: language,
                     get_response_by_intent=lambda intent, text, admin, kiosk, language:
                     answer(intent, text, language))
    source = Path(__file__).resolve().parents[1] / 'code' / 'app.py'
    nodes = [node for node in ast.parse(source.read_text(encoding='utf-8')).body
             if isinstance(node, (ast.FunctionDef, ast.ClassDef))
             and node.name in ('now_ms', 'Timer', 'gpt')]
    exec(compile(ast.Module(body=nodes, type_ignores=[]), str(source), 'exec'), namespace)
    return app
