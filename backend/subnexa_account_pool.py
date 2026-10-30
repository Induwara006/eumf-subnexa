"""Server-only, per-job credential pools. Never switches providers."""
import contextvars
import json
import os
from types import SimpleNamespace

_state = contextvars.ContextVar('subnexa_account_pools', default=None)


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
            import re
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
    import re
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
    return status == 429 or getattr(error, 'category', None) == 'rate_limit'


class PoolModels:
    def __init__(self, provider, values):
        self.provider = provider
        self.values = values
        self.index = 0
        self.client = None

    def generate_content(self, **kwargs):
        while self.index < len(self.values):
            quota_attempt = None
            if self.client is None:
                if self.provider == 'gemini':
                    from google import genai
                    self.client = genai.Client(
                        api_key=self.values[self.index],
                        http_options={"timeout": 90000,
                                      "retry_options": {"attempts": 1}},
                    )
                else:
                    from cloudflare_subnexa import CloudflareClient
                    self.client = CloudflareClient(*self.values[self.index])
            try:
                if self.provider == 'gemini':
                    from subnexa_usage import pace, record
                    pace(self.values[self.index], kwargs.get('model', 'default'))
                    from subnexa_quota import reserve, publish
                    quota_attempt = reserve(self.values[self.index], kwargs.get('model', 'default'))
                if self.provider == 'gemini':
                    from subnexa_fairuse import reserve_request
                    reserve_request()
                response = self.client.models.generate_content(**kwargs)
                if self.provider == 'gemini':
                    record(response)
                    publish(kwargs.get('model', 'default'))
                return response
            except Exception as error:
                if self.provider == 'gemini' and quota_attempt:
                    from subnexa_quota import failure, publish
                    failure(error, quota_attempt)
                    publish(kwargs.get('model', 'default'))
                if not quota_error(error):
                    raise
                close = getattr(self.client, 'close', None)
                if close:
                    try:
                        close()
                    except Exception:
                        pass
                self.client = None
                self.index += 1
                if self.index < len(self.values):
                    print(f'[SubNexa] {self.provider}: quota/rate limit; switching to account {self.index + 1}/{len(self.values)}', flush=True)
        raise AccountPoolExhausted(f'{self.provider} account pool exhausted; saved progress can be resumed later.') from None


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
