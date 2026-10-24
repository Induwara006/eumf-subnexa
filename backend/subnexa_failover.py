"""SubNexa V4.5: request/job-scoped Gemini -> Cloudflare outage failover.

The primary Gemini request uses an authorized request-owned key when present, or
an explicitly configured server GEMINI_API_KEY. Cloudflare is the BACKUP only.
All credentials remain server-side; no quota circumvention or key minting.
"""
from __future__ import annotations

import contextvars
import os
import re
import socket
from types import SimpleNamespace

from cloudflare_subnexa import CloudflareClient, configured as cloudflare_configured

MODE = "gemini_cloudflare"
_job_route = contextvars.ContextVar("subnexa_v45_route", default=None)


def active() -> bool:
    return os.getenv("SUBNEXA_AI_PROVIDER", "gemini").strip().lower() == MODE


def authorized_gemini_key(user_key: str | None = None) -> str:
    """User-scoped key preferred, otherwise the site's explicitly set key.

    Does not fetch from Google accounts, create keys, or expand user quotas.
    """
    return (user_key or os.getenv("GEMINI_API_KEY") or "").strip()


def configured(user_key: str | None = None) -> bool:
    return bool(authorized_gemini_key(user_key) or cloudflare_configured())


def start_job() -> None:
    """Call once at the beginning of an SSE translation job.

    Mutable state propagates into asyncio.to_thread via copied context, and
    remains attached to this job, never globally shared between signed-in users.
    """
    _job_route.set({"backup": False, "announced": False, "reason": None})


def _state() -> dict:
    state = _job_route.get()
    if state is None:
        return {"backup": False, "announced": False, "reason": None}
    return state


def take_switch_notice() -> bool:
    """Emit exactly one user-facing provider_fallback activity per SSE job."""
    state = _job_route.get()
    if not active() or state is None or not state["backup"] or state["announced"]:
        return False
    state["announced"] = True
    return True


def temporary_gemini_error(exc: BaseException) -> bool:
    """Only outages, rate limits and network timeouts trigger failover.

    Never route invalid requests, bad keys, denied access or malformed data to
    a different provider. Do not infer outages from an arbitrary exception.
    """
    status = getattr(exc, "status_code", None)
    if status is None:
        status = getattr(exc, "code", None)
    if isinstance(status, int):
        if status in (400, 401, 402, 403, 404, 422):
            return False
        if status in (429, 500, 502, 503, 504):
            return True
    detail = str(exc).upper()
    if re.search(r"(?<!\d)(?:400|401|402|403|404|422)(?!\d)", detail):
        return False
    if any(word in detail for word in ("PERMISSION_DENIED", "UNAUTHENTICATED", "INVALID_ARGUMENT", "API_KEY_INVALID", "BILLING_REQUIRED")):
        return False
    if re.search(r"(?<!\d)(?:429|500|502|503|504)(?!\d)", detail):
        return True
    if any(word in detail for word in (
        "RESOURCE_EXHAUSTED", "RATE LIMIT", "QUOTA EXCEEDED",
        "SERVICE UNAVAILABLE", "DEADLINE_EXCEEDED", "DEADLINE EXCEEDED",
        "GATEWAY TIMEOUT", "SERVER DISCONNECTED", "CONNECTION RESET",
        "CONNECTION TIMED OUT", "CONNECTERROR", "READTIMEOUT",
        "TEMPORARILY UNAVAILABLE",
    )):
        return True
    # SDKs often wrap transport errors in their own HTTP client exception;
    # inspecting the cause chain catches them without matching generic failures.
    cursor = exc
    for _ in range(4):
        if isinstance(cursor, (TimeoutError, ConnectionError, socket.timeout, socket.gaierror)):
            return True
        cursor = getattr(cursor, "__cause__", None)
        if cursor is None:
            break
    return False


class _HybridModels:
    def __init__(self, primary_key: str):
        self._primary_key = primary_key
        self._primary = None
        self._cloudflare = CloudflareClient()

    def generate_content(self, *, model, contents, config=None):
        """Each entire translation/review pass is retried on backup at most once."""
        state = _state()
        if state["backup"]:
            return self._cloudflare.models.generate_content(model=model, contents=contents, config=config)

        if not self._primary_key:
            # Explicitly configured cloudflare works even when the site has no
            # authorized Gemini key. This is not a free Gemini key generator.
            if not cloudflare_configured():
                raise RuntimeError("Neither an authorized Gemini key nor Cloudflare backup is configured")
            state["backup"] = True
            state["reason"] = "no_primary_key"
            print("[SubNexa AI] Gemini not configured; using Cloudflare provider", flush=True)
            return self._cloudflare.models.generate_content(model=model, contents=contents, config=config)

        if self._primary is None:
            from google import genai  # Already required by SubNexa's translator
            self._primary = genai.Client(api_key=self._primary_key)
        try:
            return self._primary.models.generate_content(model=model, contents=contents, config=config)
        except Exception as error:
            if not temporary_gemini_error(error) or not cloudflare_configured():
                raise
            # Sticky for this SSE job: previously SAVED lines remain untouched;
            # future batches/review calls use Cloudflare without trying Gemini.
            state["backup"] = True
            state["reason"] = "temporary_primary_failure"
            print("[SubNexa AI] Gemini unavailable; switching current batch and remaining job to Cloudflare", flush=True)
            return self._cloudflare.models.generate_content(model=model, contents=contents, config=config)


class HybridClient:
    def __init__(self, primary_key: str):
        self.models = _HybridModels(primary_key)
