"""Run after start.cmd: verify migrated data, assets, search, STT and TTS over HTTP."""
import io
import argparse
import json
from pathlib import Path
import time
import sys
from urllib.parse import urlsplit
import wave

import requests

ROOT = Path(__file__).resolve().parents[1]


def checked(response):
    response.raise_for_status()
    return response


def run(with_llm=False):
    results = {}
    data = checked(requests.get('http://127.0.0.1:8080/api/kiosk-experience', timeout=5)).json()
    results['data'] = {key: len(data[key]) for key in ('shops', 'searchTags', 'promotions')}
    for query in ('모든 점포 다보여줘', '모든 점포 다 보여줘'):
        started = time.perf_counter()
        answer = checked(requests.post('http://127.0.0.1:8000/gpt', json={
            'text': query, 'language': 'ko', 'admin_id': 1, 'kiosk_id': 1,
        }, timeout=10)).json()
        ids = [item['target_id'] for item in answer['result']['items']]
        assert len(ids) == len(set(ids)) == 126, 'Incomplete or duplicate catalog'
        results[query] = {'items': len(ids), 'seconds': round(time.perf_counter() - started, 3)}
    for promotion in data['promotions']:
        if promotion.get('type') != 'image':
            continue
        url = promotion.get('url') or promotion.get('src')
        if url and urlsplit(url).path.startswith('/images/'):
            asset = checked(requests.get('http://127.0.0.1:8080' + urlsplit(url).path, timeout=10))
            assert len(asset.content) > 0
            results['uploaded_image_bytes'] = len(asset.content)
            break
    reference = ROOT / 'ai-server/qwen-tts-server/voices/friendly-female-reference.wav'
    with reference.open('rb') as stream:
        recognition = checked(requests.post('http://127.0.0.1:8000/stt',
            files={'voice': ('reference.wav', stream, 'audio/wav')},
            data={'admin_id': 1, 'kiosk_id': 1}, timeout=40)).json()
    assert recognition.get('text', '').strip()
    results['stt'] = recognition['text']
    speech = checked(requests.post('http://127.0.0.1:8000/api/tts', json={
        'text': '대조시장에 오신 것을 환영합니다.', 'language': 'ko',
    }, timeout=90))
    with wave.open(io.BytesIO(speech.content)) as audio:
        results['tts_seconds'] = round(audio.getnframes() / audio.getframerate(), 2)
    assert results['tts_seconds'] > 0.25
    for port in (5173, 3000):
        checked(requests.get(f'http://localhost:{port}', timeout=30))
    results['handwriting_recognizers'] = checked(requests.get(
        'http://127.0.0.1:17832/recognizers', timeout=5)).json()
    if with_llm:
        sys.path.insert(0, str(ROOT / 'ai-server/code'))
        from kiosk_search_context import build_search_prompt, load_kiosk_context, parse_model_response
        shops, tags = load_kiosk_context()
        known = {shop['id'] for shop in shops}
        results['local_llm'] = []
        for text in ('반찬가게 어디에 있어?', '비 오는 날 따뜻한 음식 추천해줘', '선물 추천해줘'):
            started = time.perf_counter()
            generated = checked(requests.post('http://127.0.0.1:8010/v1/chat/completions', json={
                'model': 'local-gemma', 'messages': [{'role': 'user',
                    'content': build_search_prompt(1, text, 'ko', shops, tags) + '\n' + text}],
                'temperature': 0, 'max_tokens': 768, 'response_format': {'type': 'json_object'},
                'chat_template_kwargs': {'enable_thinking': False},
            }, timeout=45)).json()
            parsed = parse_model_response(generated['choices'][0]['message']['content'])
            ids = [item['target_id'] for item in parsed['result']['items']]
            assert ids and set(ids) <= known
            results['local_llm'].append({'query': text, 'items': len(set(ids)),
                                        'seconds': round(time.perf_counter() - started, 3)})
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--with-llm', action='store_true')
    run(parser.parse_args().with_llm)
