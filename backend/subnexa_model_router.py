"""SubNexa V4.7: explicit, per-job translation provider selection.

SubNexa 0.2 -> Cloudflare Workers AI; SubNexa Pro -> Google Gemini.
The selected provider is server-enforced. No silent cross-provider fallback,
no automatic credential generation and no invented credit balance.
"""
from __future__ import annotations

import contextvars
import os

from cloudflare_subnexa import CloudflareClient, configured as cf_configured

_selected = contextvars.ContextVar('subnexa_v47_selected_provider', default=None)

MODE_NORMAL = 'subnexa_02'
MODE_PRO = 'subnexa_pro'
VALID_MODES = frozenset((MODE_NORMAL, MODE_PRO))


def selected_mode():
    return _selected.get()


def set_mode(value: str):
    if value not in VALID_MODES:
        raise ValueError('Unknown SubNexa AI model choice')
    return _selected.set(value)


def reset_mode(token):
    _selected.reset(token)


def gemini_site_configured() -> bool:
    # In production the Cloudflare-only authentication branch does not attach
    # personal Google API keys. Require a legitimately configured site key for Pro.
    return bool(os.getenv('GEMINI_API_KEY', '').strip())


def availability():
    return {MODE_NORMAL: cf_configured(), MODE_PRO: gemini_site_configured()}


def routed_client(personal_key=None):
    mode = selected_mode()
    if mode == MODE_NORMAL:
        if not cf_configured():
            raise RuntimeError('SubNexa 0.2 is unavailable: Cloudflare AI is not configured')
        return CloudflareClient()
    if mode == MODE_PRO:
        # This is a server-managed Pro feature; do not use tokens from the
        # browser. Provider access and quota are checked by actual API calls.
        key = os.getenv('GEMINI_API_KEY', '').strip()
        if not key:
            raise RuntimeError('SubNexa Pro is unavailable: Gemini has not been configured')
        from google import genai
        return genai.Client(api_key=key)
    raise RuntimeError('No model selected for routed client')
