"""Supabase observed usage, not Google quota. Server-only credentials."""
import contextvars
import hashlib
import math
import os
import threading
import time
from collections import defaultdict, deque
from datetime import datetime
from zoneinfo import ZoneInfo

callback = contextvars.ContextVar('gemini_telemetry', default=None)
_lock = threading.Lock()
_windows = defaultdict(deque)


def emit(stage, value):
    cb = callback.get()
    if cb:
        cb(stage, value)


def pace(key, model):
    # Shared across jobs in this process. Same-project keys can be grouped using
    # GEMINI_PROJECT_IDS_JSON (same order as GEMINI_API_KEYS_JSON).
    from subnexa_quota import rate_config
    config = rate_config(key, model)
    bucket = (config['project'], model)
    rpm = config['rpm']
    while True:
        with _lock:
            now = time.monotonic()
            q = _windows[bucket]
            while q and now - q[0] >= 61:
                q.popleft()
            if len(q) < rpm:
                q.append(now)
                break
            delay = max(0.01, 61 - (now - q[0]))
        emit('rate_wait', math.ceil(delay))
        time.sleep(min(1, delay))
    emit('rate_wait', 0)



# Pending records retry on subsequent usage/snapshot calls in this process.
# Confirmed records are durable in Supabase; pending records are not durable.
_pending = {}
_pending_lock = threading.Lock()
_flush_lock = threading.Lock()
_lost = False


def settings():
    from urllib.parse import urlsplit
    import re
    url = os.getenv('SUPABASE_URL', '').strip().rstrip('/')
    key = (os.getenv('SUPABASE_SECRET_KEY', '').strip()
           or os.getenv('SUPABASE_SERVICE_ROLE_KEY', '').strip())
    parsed = urlsplit(url)
    if (parsed.scheme != 'https' or not parsed.hostname or parsed.username
            or parsed.password or parsed.query or parsed.fragment or parsed.path):
        raise RuntimeError('Set the backend SUPABASE_URL to the HTTPS project URL.')
    if not key or key.startswith('sb_publishable_'):
        raise RuntimeError('Set a backend Supabase secret/service-role key.')
    scope = os.getenv('SUBNEXA_USAGE_SCOPE', 'production').strip()
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,64}', scope):
        raise RuntimeError('Invalid SUBNEXA_USAGE_SCOPE.')
    headers = {'apikey': key, 'Content-Type': 'application/json'}
    if not key.startswith('sb_secret_'):
        headers['Authorization'] = 'Bearer ' + key
    return url, headers, scope


def rpc(name, payload):
    import requests
    url, headers, _ = settings()
    # Never follow redirects carrying elevated credentials.
    # Reuse the identical event UUID when retrying an ambiguous write.
    for attempt in range(2):
        try:
            with requests.post(url + '/rest/v1/rpc/' + name, headers=headers,
                               json=payload, timeout=(3, 5), allow_redirects=False) as r:
                if r.status_code == 200:
                    data = r.json()
                    if not isinstance(data, dict):
                        raise RuntimeError('Invalid usage response.')
                    return data
                if r.status_code not in (429, 500, 502, 503, 504):
                    raise RuntimeError('Usage database request rejected.')
        except (requests.RequestException, ValueError):
            pass
        if attempt == 0:
            time.sleep(0.2)
    raise RuntimeError('Usage database temporarily unavailable.')


def day():
    return datetime.now(ZoneInfo('America/Los_Angeles')).date().isoformat()


def flush_pending():
    if not _flush_lock.acquire(blocking=False):
        return
    try:
        with _pending_lock:
            items = list(_pending.items())[:8]
        for event_id, payload in items:
            try:
                result = rpc('subnexa_usage_record_v1', payload)
                if result.get('saved') is not True:
                    raise RuntimeError('Usage write not acknowledged')
            except Exception:
                break
            with _pending_lock:
                _pending.pop(event_id, None)
    finally:
        _flush_lock.release()


def snapshot():
    try:
        flush_pending()
        _, _, scope = settings()
        row = rpc('subnexa_usage_snapshot_v1', {'p_scope': scope})
        if (not isinstance(row.get('used'), int) or row['used'] < 0
                or not isinstance(row.get('missing'), int) or row['missing'] < 0
                or not isinstance(row.get('day'), str)):
            raise ValueError('Invalid usage totals')
        budget = max(0, int(os.getenv('SUBNEXA_GEMINI_DAILY_TOKEN_BUDGET', '0')))
        with _pending_lock:
            pending = len(_pending)
            incomplete = _lost or pending > 0 or row['missing'] > 0
        return {'used': row['used'], 'missing': row['missing'], 'budget': budget or None,
                'remaining': max(0, budget-row['used']) if budget and not incomplete else None,
                'day': row['day'], 'available': True, 'pending': pending,
                'incomplete': incomplete, 'storage': 'supabase', 'scope': scope}
    except Exception:
        return {'available': False, 'remaining': None, 'storage': 'supabase'}


def record(response):
    import uuid
    global _lost
    meta = getattr(response, 'usage_metadata', None)
    total = meta.get('total_token_count') if isinstance(meta, dict) else getattr(meta, 'total_token_count', None)
    valid = isinstance(total, int) and not isinstance(total, bool) and total >= 0
    try:
        _, _, scope = settings()
        event_id = str(uuid.uuid4())
        payload = {'p_event_id': event_id, 'p_scope': scope, 'p_day': day(),
                   'p_tokens': total if valid else 0, 'p_missing': 0 if valid else 1}
        with _pending_lock:
            if len(_pending) >= 512:
                _lost = True
            else:
                _pending[event_id] = payload
        emit('gemini_usage', snapshot())
    except Exception:
        # Accounting outages must not discard a usable translation response.
        _lost = True
        emit('gemini_usage', {'available': False, 'remaining': None, 'storage': 'supabase'})
