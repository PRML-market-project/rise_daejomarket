"""Exercise production response postprocessing without loading speech models."""
import ast
import json
from pathlib import Path
import random
import re

import kiosk_search_context as context


def load_answer(shops, tags, generate, rng=None):
    namespace = dict(vars(context))
    namespace.update(json=json, re=re, random=rng or random,
                     load_kiosk_context=lambda: (shops, tags), generate_json_response=generate)
    source = Path(__file__).resolve().parents[1] / 'code' / 'app.py'
    node = next(n for n in ast.parse(source.read_text(encoding='utf-8')).body
                if isinstance(n, ast.FunctionDef) and n.name == 'answer_from_current_kiosk_data')
    exec(compile(ast.Module(body=[node], type_ignores=[]), str(source), 'exec'), namespace)
    return namespace[node.name]
