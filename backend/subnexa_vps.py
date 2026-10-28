"""Explicit, server-only SubNexa 1.1 Ollama connection. Disabled by default."""
import hashlib
import json
import os
from urllib.parse import urlsplit
import requests


def settings():
    if os.getenv('SUBNEXA_11_ENABLED', '').lower() != 'true':
        raise RuntimeError('SubNexa 1.1 is not enabled.')
    url = os.getenv('SUBNEXA_11_URL', '').strip().rstrip('/')
    token = os.getenv('SUBNEXA_11_TOKEN', '').strip()
    model = os.getenv('SUBNEXA_11_MODEL', '').strip()
    parsed = urlsplit(url)
    local = parsed.hostname in ('localhost', '127.0.0.1', '::1')
    if not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or (parsed.scheme != 'https' and not (local and parsed.scheme == 'http')):
        raise RuntimeError('SubNexa 1.1 requires a valid HTTPS gateway URL.')
    if len(token) < 16 or not model:
        raise RuntimeError('SubNexa 1.1 token and exact installed model name are required.')
    return url, token, model


def configured():
    try:
        settings()
        return True
    except (ValueError, RuntimeError):
        return False


def cache_fingerprint():
    url, _, model = settings()
    return hashlib.sha256((url+'|'+model+'|single-pass-v1').encode()).hexdigest()[:16]


def select_batch(remaining, originals):
    selected, chars = [], 0
    for index in remaining:
        length = len(originals[index])
        if selected and (len(selected) >= 5 or chars+length > 1200):
            break
        selected.append(index)
        chars += length
    return selected


class VPSClient:
    def generate_array(self, prompt, expected):
        url, token, model = settings()
        payload = {'model': model, 'messages': [{'role': 'user', 'content': prompt}],
                   'stream': False, 'format': {'type': 'array', 'items': {'type': 'string'},
                   'minItems': expected, 'maxItems': expected},
                   'options': {'temperature': 0.2, 'num_predict': 4096}, 'keep_alive': '10m'}
        # Only enable this for an installed model that supports Ollama thinking controls.
        if os.getenv('SUBNEXA_11_DISABLE_THINKING', '').lower() == 'true':
            payload['think'] = False
        try:
            with requests.post(url+'/api/chat', json=payload,
                               headers={'Authorization': 'Bearer '+token},
                               timeout=(10, 200), allow_redirects=False, stream=True) as response:
                if response.status_code != 200:
                    raise RuntimeError(f'SubNexa 1.1 gateway HTTP {response.status_code}; saved progress can be resumed.')
                chunks, size = [], 0
                for chunk in response.iter_content(65536):
                    size += len(chunk)
                    if size > 2*1024*1024:
                        raise ValueError('SubNexa 1.1 response exceeded the output limit.')
                    chunks.append(chunk)
                data = json.loads(b''.join(chunks))
        except requests.RequestException:
            raise RuntimeError('SubNexa 1.1 gateway connection failed or timed out; resume later.') from None
        if not isinstance(data, dict) or data.get('done') is not True or data.get('done_reason') == 'length':
            raise ValueError('SubNexa 1.1 returned an incomplete response.')
        message = data.get('message')
        if not isinstance(message, dict) or not isinstance(message.get('content'), str):
            raise ValueError('SubNexa 1.1 returned no translation text.')
        result = json.loads(message['content'])
        if not isinstance(result, list) or len(result) != expected or not all(isinstance(x,str) for x in result):
            raise ValueError('SubNexa 1.1 returned an invalid subtitle array length or format.')
        return result
