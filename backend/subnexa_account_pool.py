"""Server-only, per-job credential pools. Never switches providers.

v2 changes (same public API as before):
  * Shared health state across ALL jobs: a key that hit 429 is skipped by every
    job until its cooldown expires (previously each job burned through all keys).
  * Proactive per-key, per-model RPM limiter (sliding 60s window) so most 429s
    never happen.
  * Cooldown length is taken from the error (Retry-After / "retry in Ns" /
    daily-quota detection) instead of a fixed sleep.
  * Optional same-provider model fallback (GEMINI_FALLBACK_MODELS).
  * Cached client per key (no new client per request).
  * Random starting index per job so concurrent jobs do not pile onto key 1.
  * Fails fast (AccountPoolExhausted) when every key is cooling down for longer
    than POOL_MAX_WAIT_SECONDS, so the job pauses and can resume later.

Optional environment variables:
  GEMINI_RPM_PER_KEY        default 8   (requests/minute allowed per key per model; 0 = disabled)
  GEMINI_FALLBACK_MODELS    default ""  (comma separated, e.g. "gemini-2.5-flash-lite")
  POOL_MAX_WAIT_SECONDS     default 90  (max time one call may wait for a key to become ready)
"""
import contextvars
import hashlib
import json
import os
import random
import re
import threading
import time
from collections import deque
from types import SimpleNamespace

_state = contextvars.ContextVar('subnexa_account_pools', default=None)


# --------------------------------------------------------------------------
# Config helpers
# --------------------------------------------------------------------------
def _env_int(name, default):
    try:
        return int(os.getenv(name, '').strip() or default)
    except ValueError:
        return default


def _env_float(name, default):
    try:
        return float(os.getenv(name, '').strip() or default)
    except ValueError:
        return default


def _rpm_limit():
    return _env_int('GEMINI_RPM_PER_KEY', 8)


def _max_wait():
    return _env_float('POOL_MAX_WAIT_SECONDS', 90.0)


def _fallback_models():
    raw = os.getenv('GEMINI_FALLBACK_MODELS', '')
    return [m.strip() for m in raw.split(',') if m.strip()]


# --------------------------------------------------------------------------
# Shared (process-wide) key health: cooldowns + RPM windows
# --------------------------------------------------------------------------
_lock = threading.Lock()
_cooldowns = {}   # (key_id, model) -> monotonic time when usable again
_windows = {}     # (key_id, model) -> deque of monotonic timestamps (last 60s)


def _key_id(key):
    """Stable short id so raw keys are never stored in dicts or logs."""
    return hashlib.sha256(repr(key).encode()).hexdigest()[:12]


def _claim(provider, key_id, model, rpm):
    """Try to reserve one request slot. Returns (ok, seconds_to_wait)."""
    now = time.monotonic()
    slot = (key_id, model)
    with _lock:
        until = _cooldowns.get(slot, 0.0)
        if until > now:
            return False, until - now
        if provider == 'gemini' and rpm > 0:
            window = _windows.setdefault(slot, deque())
            while window and now - window[0] >= 60.0:
                window.popleft()
            if len(window) >= rpm:
                return False, 60.0 - (now - window[0])
            window.append(now)
        return True, 0.0


def _cool(key_id, model, seconds):
    with _lock:
        _cooldowns[(key_id, model)] = max(
            _cooldowns.get((key_id, model), 0.0), time.monotonic() + seconds)


def _retry_hint(error, text):
    """Best-effort extraction of a server-provided retry delay (seconds)."""
    response = getattr(error, 'response', None)
    headers = getattr(response, 'headers', None)
    if headers:
        try:
            value = headers.get('retry-after') or headers.get('Retry-After')
            if value:
                return float(value)
        except (TypeError, ValueError):
            pass
    for pattern in (r'retry in ([\d.]+)\s*s', r'retryDelay\W+([\d.]+)s'):
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            try:
                return float(match.group(1))
            except ValueError:
                pass
    return None


def _cooldown_seconds(error):
    text = str(error)
    flat = re.sub(r'[\s_]+', '', text).upper()
    if 'PERDAY' in flat:
        return 1800.0                      # daily quota exhausted for this key/model
    hint = _retry_hint(error, text)
    if hint is not None:
        return min(hint + 1.0, 300.0)
    if '503' in flat or 'UNAVAILABLE' in flat or 'HIGHDEMAND' in flat:
        return random.uniform(4.0, 8.0)    # transient overload
    return random.uniform(20.0, 35.0)      # plain 429: per-minute bucket


def pool_status(provider='gemini', model='default'):
    """Small helper for dashboards: how many keys are ready right now."""
    try:
        values = credentials(provider)
    except RuntimeError:
        return {'total': 0, 'ready': 0}
    now = time.monotonic()
    rpm = _rpm_limit() if provider == 'gemini' else 0
    ready = 0
    with _lock:
        for v in values:
            slot = (_key_id(v), model)
            if _cooldowns.get(slot, 0.0) > now:
                continue
            window = _windows.get(slot)
            if rpm > 0 and window and sum(1 for t in window if now - t < 60.0) >= rpm:
                continue
            ready += 1
    return {'total': len(values), 'ready': ready}


# --------------------------------------------------------------------------
# Per-job pool setup (unchanged API)
# --------------------------------------------------------------------------
def start_pools():
    return _state.set({})


def reset_pools(token):
    _state.reset(token)


def credentials(provider):
    name = 'GEMINI_API_KEYS_JSON' if provider == 'gemini' else 'CLOUDFLARE_ACCOUNTS_JSON'
    raw = os.getenv(name, '').strip()
    if raw:
        try:
            values = json.loads(raw)
            if not isinstance(values, list) or not values:
                raise ValueError()
            if provider == 'gemini':
                if any(not isinstance(v, str) or not v.strip() for v in values):
                    raise ValueError()
                return list(dict.fromkeys(v.strip() for v in values))
            if any(not isinstance(v, dict) or not isinstance(v.get('account_id'), str)
                   or not re.fullmatch('[0-9a-fA-F]{32}', v['account_id'])
                   or not isinstance(v.get('api_token'), str) or not v['api_token'].strip()
                   for v in values):
                raise ValueError()
            if len({v['account_id'].lower() for v in values}) != len(values):
                raise ValueError()
            return [(v['account_id'], v['api_token'].strip()) for v in values]
        except (ValueError, TypeError):
            raise RuntimeError(f'Invalid {name}: configure at least one valid account credential.') from None
    if provider == 'gemini':
        key = os.getenv('GEMINI_API_KEY', '').strip()
        return [key] if key else []
    account = os.getenv('CLOUDFLARE_ACCOUNT_ID', '').strip()
    key = os.getenv('CLOUDFLARE_API_TOKEN', '').strip()
    return [(account, key)] if re.fullmatch('[0-9a-fA-F]{32}', account) and key else []


def configured(provider):
    try:
        return bool(credentials(provider))
    except RuntimeError:
        return False


class AccountPoolExhausted(RuntimeError):
    pass


def quota_error(error):
    status = next((getattr(error, name) for name in ('http_status', 'status_code', 'code')
                   if getattr(error, name, None) is not None), None)
    err_str = str(error).upper()
    return (
        status in (429, 503)
        or getattr(error, 'category', None) == 'rate_limit'
        or "503" in err_str
        or "UNAVAILABLE" in err_str
        or "HIGH DEMAND" in err_str
    )


# --------------------------------------------------------------------------
# Pool
# --------------------------------------------------------------------------
class PoolModels:
    def __init__(self, provider, values):
        self.provider = provider
        self.values = values
        # Random start so concurrent jobs spread over different keys.
        self.index = random.randrange(len(values)) if values else 0
        self._clients = {}

    # -- client cache ------------------------------------------------------
    def _client_for(self, key_id, key):
        client = self._clients.get(key_id)
        if client is not None:
            return client
        if self.provider == 'gemini':
            from google import genai
            client = genai.Client(
                api_key=key,
                http_options={"timeout": 60000, "retry_options": {"attempts": 1}},
            )
        else:
            from cloudflare_subnexa import CloudflareClient
            client = CloudflareClient(*key)
        self._clients[key_id] = client
        return client

    def _drop_client(self, key_id):
        client = self._clients.pop(key_id, None)
        close = getattr(client, 'close', None)
        if close:
            try:
                close()
            except Exception:
                pass

    # -- selection -----------------------------------------------------------
    def _pick(self, models, rpm):
        """Return (index, model, None) for a usable slot, or (None, None, shortest_wait)."""
        total = len(self.values)
        soonest = None
        for model in models:                       # primary model first, then fallbacks
            for step in range(total):
                idx = (self.index + step) % total
                ok, wait = _claim(self.provider, _key_id(self.values[idx]), model, rpm)
                if ok:
                    return idx, model, None
                soonest = wait if soonest is None else min(soonest, wait)
        return None, None, soonest

    # -- main entry ----------------------------------------------------------
    def generate_content(self, **kwargs):
        total = len(self.values)
        primary = kwargs.get('model', 'default')
        models = [primary]
        if self.provider == 'gemini':
            models += [m for m in _fallback_models() if m != primary]
        rpm = _rpm_limit()
        deadline = time.monotonic() + _max_wait()
        announced = False

        while True:
            idx, model, wait = self._pick(models, rpm)

            if idx is None:
                remaining = deadline - time.monotonic()
                if wait is None or remaining <= 0 or wait > remaining:
                    raise AccountPoolExhausted(
                        f'{self.provider} account pool exhausted; saved progress can be resumed later.'
                    ) from None
                if not announced:
                    print(f'[SubNexa] {self.provider}: all {total} accounts busy; '
                          f'waiting ~{wait:.0f}s for the first one to free up', flush=True)
                    announced = True
                time.sleep(min(wait, remaining) + random.uniform(0.05, 0.4))
                continue

            key = self.values[idx]
            key_id = _key_id(key)
            call_kwargs = dict(kwargs)
            if 'model' in kwargs:
                call_kwargs['model'] = model
            if model != primary:
                print(f'[SubNexa] gemini: using fallback model {model}', flush=True)

            quota_attempt = None
            try:
                client = self._client_for(key_id, key)
                if self.provider == 'gemini':
                    from subnexa_usage import pace, record
                    pace(key, model)
                    from subnexa_quota import reserve, publish
                    quota_attempt = reserve(key, model)
                    from subnexa_fairuse import reserve_request
                    reserve_request()
                response = client.models.generate_content(**call_kwargs)
                if self.provider == 'gemini':
                    record(response)
                    publish(model)
                # Success: next request starts on the following account.
                self.index = (idx + 1) % total
                return response
            except Exception as error:
                if self.provider == 'gemini' and quota_attempt:
                    from subnexa_quota import failure, publish
                    failure(error, quota_attempt)
                    publish(model)
                text = str(error).upper()
                if model != primary and ('NOT_FOUND' in text or '404' in text):
                    # A fallback model Google no longer serves must not stop the job:
                    # skip it on every key for an hour and carry on with the primary.
                    for value in self.values:
                        _cool(_key_id(value), model, 3600.0)
                    print(f'[SubNexa] {self.provider}: fallback model {model} is not available; '
                          f'skipping it for 1 hour', flush=True)
                    continue
                if not quota_error(error):
                    raise
                seconds = _cooldown_seconds(error)
                _cool(key_id, model, seconds)
                self._drop_client(key_id)
                self.index = (idx + 1) % total
                print(f'[SubNexa] {self.provider}: account {idx + 1}/{total} '
                      f'cooling down {seconds:.0f}s (model={model})', flush=True)
                # No fixed sleep: the next loop picks a ready account immediately,
                # or waits exactly as long as the shortest cooldown.


def pooled_client(provider):
    state = _state.get()
    if state is None:
        state = {}
        _state.set(state)
    if provider not in state:
        values = credentials(provider)
        if not values:
            raise RuntimeError(f'{provider} is not configured.')
        state[provider] = SimpleNamespace(models=PoolModels(provider, values))
    return state[provider]
