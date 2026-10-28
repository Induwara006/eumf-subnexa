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
MODE_VPS = 'subnexa_11'
VALID_MODES = frozenset((MODE_NORMAL, MODE_PRO, MODE_VPS))


def selected_mode():
    return _selected.get()


def set_mode(value: str):
    if value not in VALID_MODES:
        raise ValueError('Unknown SubNexa AI model choice')
    from subnexa_account_pool import start_pools
    return (_selected.set(value), start_pools())


def reset_mode(token):
    from subnexa_account_pool import reset_pools
    mode_token, pool_token = token
    reset_pools(pool_token)
    _selected.reset(mode_token)


def gemini_site_configured() -> bool:
    # In production the Cloudflare-only authentication branch does not attach
    # personal Google API keys. Require a legitimately configured site key for Pro.
    from subnexa_account_pool import configured
    return configured('gemini')


def availability():
    from subnexa_vps import configured as vps_configured
    return {MODE_NORMAL: cf_configured(), MODE_PRO: gemini_site_configured(), MODE_VPS: vps_configured()}


def routed_client(personal_key=None):
    from subnexa_account_pool import pooled_client
    mode = selected_mode()
    if mode == MODE_VPS:
        from subnexa_vps import VPSClient
        return VPSClient()
    if mode == MODE_NORMAL:
        return pooled_client('cloudflare')
    if mode == MODE_PRO:
        return pooled_client('gemini')
    raise RuntimeError('No model selected for routed client')
