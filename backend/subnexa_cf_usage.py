"""Observed Cloudflare attempts/tokens; independent of Gemini accounting."""
import threading
import uuid
from datetime import datetime, timezone, timedelta
from subnexa_usage import rpc, settings

_lock = threading.Lock()
_flush_lock = threading.Lock()
_pending = {}
_lost = False


def flush():
    if not _flush_lock.acquire(False):
        return
    try:
        with _lock:
            batch = list(_pending.items())[:16]
        for key, value in batch:
            try:
                if rpc('subnexa_cf_record_v1', value).get('saved') is not True:
                    break
            except Exception:
                break
            with _lock:
                _pending.pop(key, None)
    finally:
        _flush_lock.release()


def record(payload=None, started=None):
    """Called once per HTTP attempt, including rejected and malformed responses."""
    global _lost
    try:
        usage = payload.get('usage', {}) if isinstance(payload, dict) else {}
        total = usage.get('total_tokens') if isinstance(usage, dict) else None
        valid = lambda n: isinstance(n, int) and not isinstance(n, bool) and n >= 0
        if not valid(total) and isinstance(usage, dict):
            a, b = usage.get('prompt_tokens'), usage.get('completion_tokens')
            if valid(a) and valid(b):
                total = a + b
        _, _, scope = settings()
        key = str(uuid.uuid4())
        value = {'p_event': key, 'p_scope': scope,
                 'p_day': (started or datetime.now(timezone.utc)).date().isoformat(),
                 'p_tokens': total if valid(total) else 0,
                 'p_missing': 0 if valid(total) else 1}
        with _lock:
            if len(_pending) < 512:
                _pending[key] = value
            else:
                _lost = True
        flush()
    except Exception:
        _lost = True  # Telemetry must never interrupt translation.


def snapshot():
    try:
        flush()
        _, _, scope = settings()
        row = rpc('subnexa_cf_snapshot_v1', {'p_scope': scope})
        if any(not isinstance(row.get(k), int) or row[k] < 0
               for k in ('used', 'requests_used', 'missing')):
            raise ValueError('Invalid totals')
        with _lock:
            pending = len(_pending)
        return dict(row, available=True, pending=pending,
                    incomplete=bool(_lost or pending or row['missing']),
                    storage='supabase', provider='cloudflare')
    except Exception:
        return {'available': False, 'provider': 'cloudflare'}
