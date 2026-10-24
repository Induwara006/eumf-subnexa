"""Optional, server-side CodeCraft failover for EUMF SubNexa.

Uses the provider's OpenAI-compatible chat-completions API, not Google's SDK.
No key is stored here; it is read from backend/.env at request time.
"""

from __future__ import annotations

import json
import os
import socket
import urllib.error
import urllib.request

BASE_URL = 'https://codecraftapi.com/v1'
DEFAULT_MODEL = 'gemini-3.7-flash'


class CodeCraftError(RuntimeError):
    def __init__(self, message: str, status: int | None = None):
        self.status = status
        super().__init__(message)


def _api_key() -> str:
    return (os.getenv('CODECRAFT_API_KEY') or os.getenv('BACKUP_API_KEY') or '').strip()


def enabled() -> bool:
    return bool(_api_key()) and os.getenv('CODECRAFT_FALLBACK_ENABLED', 'true').lower() not in ('0', 'false', 'no')


def should_fallback(error: Exception) -> bool:
    """Only fail over on temporary primary outages and rate limits.

    Do not hide authentication, invalid model, malformed input or quality errors.
    """
    if not enabled():
        return False
    if isinstance(error, (TimeoutError, ConnectionError, socket.timeout, OSError)):
        return True
    code = getattr(error, 'code', None) or getattr(error, 'status_code', None)
    if code in (429, 500, 502, 503, 504):
        return True
    if code in (400, 401, 402, 403, 404, 422):
        return False
    reason = str(error).upper()
    # Google genai exposes e.g. '503 UNAVAILABLE' or '429 RESOURCE_EXHAUSTED'.
    return any(token in reason for token in (
        '503 UNAVAILABLE', '502 BAD_GATEWAY', '504 GATEWAY_TIMEOUT',
        '429 RESOURCE_EXHAUSTED', 'RESOURCE_EXHAUSTED',
        'SERVICE UNAVAILABLE', 'SERVER DISCONNECTED',
        'CONNECTION RESET', 'CONNECTION TIMED OUT',
    ))


def _request(path: str, *, body: dict | None = None) -> dict:
    key = _api_key()
    if not key:
        raise CodeCraftError('CodeCraft key is not configured.')
    if os.getenv('CODECRAFT_FALLBACK_ENABLED', 'true').lower() in ('0','false','no'):
        raise CodeCraftError('CodeCraft fallback is disabled.')
    headers = {
        'Authorization': 'Bearer ' + key,
        'Accept': 'application/json',
        # Match the diagnostic request; some API gateways reject urllib's default UA.
        'User-Agent': 'SubNexa-Diagnostic/1.0',
    }
    data = None
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    request = urllib.request.Request(BASE_URL + path, data=data, headers=headers,
                                     method='POST' if body is not None else 'GET')
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            raw = response.read(2_000_001)
            if len(raw) > 2_000_000:
                raise CodeCraftError('CodeCraft response is unexpectedly large.')
    except urllib.error.HTTPError as error:
        message = f'CodeCraft HTTP {error.code}'
        # Deliberately don't echo request headers or the API key.
        try:
            payload = json.loads(error.read(16_384).decode('utf-8'))
            detail = payload.get('error')
            if isinstance(detail, dict) and isinstance(detail.get('message'), str):
                message += ': ' + detail['message'][:150]
        except (ValueError, UnicodeError, AttributeError):
            pass
        raise CodeCraftError(message, status=error.code) from None
    except (urllib.error.URLError, TimeoutError, socket.timeout) as error:
        raise CodeCraftError('CodeCraft network unavailable or timed out.') from error
    try:
        result = json.loads(raw)
    except (ValueError, UnicodeError):
        raise CodeCraftError('CodeCraft response is not JSON.') from None
    if not isinstance(result, dict):
        raise CodeCraftError('CodeCraft response has an unexpected shape.')
    return result


def list_models() -> list[dict]:
    """GET /models: caller's own authorized models, no translation charged."""
    payload = _request('/models')
    models = payload.get('data')
    if not isinstance(models, list):
        raise CodeCraftError('CodeCraft models list is invalid.')
    return [model for model in models if isinstance(model, dict)]


def generate_array(prompt: str, expected: int) -> list[str]:
    """Request an array; preserve the legacy SubNexa JSON-array contract."""
    model = (os.getenv('CODECRAFT_MODEL') or DEFAULT_MODEL).strip()
    data = _request('/chat/completions', body={
        'model': model,
        'messages': [
            {'role': 'system', 'content': (
                'You are a precise English-to-Sinhala subtitle translation and '
                'review assistant. Follow the user prompt exactly. Output ONLY '
                'a valid JSON array of Sinhala strings, not an object or markdown. '
                'Keep every [[SNX_XXXX]] glossary placeholder byte-for-byte.'
            )},
            {'role': 'user', 'content': prompt},
        ],
        'temperature': 0.3,
        'max_tokens': 8192,
        'stream': False,
    })
    choices = data.get('choices')
    if not isinstance(choices, list) or not choices:
        raise CodeCraftError('CodeCraft returned no completion choices.')
    first = choices[0]
    if not isinstance(first, dict) or first.get('finish_reason') == 'length':
        raise ValueError('CodeCraft output hit token limit; retry with a smaller batch.')
    message = first.get('message')
    content = message.get('content') if isinstance(message, dict) else None
    if not isinstance(content, str) or not content.strip():
        raise ValueError('CodeCraft returned empty or non-text content.')
    try:
        result = json.loads(content.strip())
    except ValueError:
        raise ValueError('CodeCraft did not return a valid JSON subtitle array.') from None
    if not isinstance(result, list) or len(result) != expected:
        raise ValueError('CodeCraft subtitle array count mismatch.')
    if not all(isinstance(line, str) and line.strip() for line in result):
        raise ValueError('CodeCraft returned invalid subtitle text.')
    return result
