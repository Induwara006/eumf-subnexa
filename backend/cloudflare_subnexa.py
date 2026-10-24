"""SubNexa V4.4: server-only Cloudflare Workers AI text generation adapter.

Implements the small Gemini generate_content interface used by translator.py.
Does not create accounts, mint tokens, invent quota figures, or bypass access rules.
"""
from __future__ import annotations

import json
import os
import re
from types import SimpleNamespace

import requests

DEFAULT_MODEL = "@cf/qwen/qwen3-30b-a3b-fp8"
ACCOUNT_ID_PATTERN = re.compile(r"^[0-9a-fA-F]{32}$")


def active() -> bool:
    return os.getenv("SUBNEXA_AI_PROVIDER", "gemini").strip().lower() == "cloudflare"


def configured() -> bool:
    account = os.getenv("CLOUDFLARE_ACCOUNT_ID", "").strip()
    token = os.getenv("CLOUDFLARE_API_TOKEN", "").strip()
    return bool(ACCOUNT_ID_PATTERN.fullmatch(account) and token)


def provider_details() -> dict:
    return {
        "provider": "cloudflare" if active() else "gemini",
        "available": configured() if active() else False,
        "model": (os.getenv("CLOUDFLARE_AI_MODEL") or DEFAULT_MODEL) if active() else None,
        "remaining_credits": None,  # Cloudflare does not give a live free-balance figure here.
    }


class CloudflareAIError(RuntimeError):
    def __init__(self, category: str, http_status: int | None = None):
        self.category = category
        self.http_status = http_status
        # Intentionally never reflect provider bodies or credentials into a response.
        messages = {
            "configuration": "Cloudflare Workers AI is not configured on the server.",
            "authentication": "Cloudflare Workers AI token or account is not authorized.",
            "restricted_model": "Cloudflare model access denied; verify account permissions and model availability.",
            "rate_limit": "Cloudflare AI daily allocation or current capacity reached; retry later to resume.",
            "unavailable": "Cloudflare Workers AI is temporarily unavailable; retry later to resume.",
            "model": "Cloudflare model name or request format is not accepted.",
            "response": "Cloudflare returned a malformed or incomplete translation response.",
        }
        super().__init__(messages.get(category, messages["unavailable"]))


def _error_category(status: int) -> str:
    if status in (401,): return "authentication"
    if status == 403: return "restricted_model"
    if status == 429: return "rate_limit"
    if status in (400, 404, 422): return "model"
    return "unavailable"


def _normalize(content: str) -> str:
    if not isinstance(content, str):
        raise CloudflareAIError("response")
    text = content.strip()
    # Common formatting drift from chat models; JSON remains the sole accepted payload.
    text = re.sub(r"^<think>[\s\S]*?</think>\s*", "", text, count=1)
    fence = re.fullmatch(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
    if fence:
        text = fence.group(1).strip()
    try:
        parsed = json.loads(text)
    except (ValueError, TypeError) as exc:
        raise CloudflareAIError("response") from exc
    if not isinstance(parsed, list) or any(not isinstance(item, str) for item in parsed):
        raise CloudflareAIError("response")
    return json.dumps(parsed, ensure_ascii=False)


class _CloudflareModels:
    def generate_content(self, *, model: str, contents: str, config=None):
        """Use the provider-selected model, not Gemini's positional model argument."""
        if not configured():
            raise CloudflareAIError("configuration")
        account = os.getenv("CLOUDFLARE_ACCOUNT_ID", "").strip()
        token = os.getenv("CLOUDFLARE_API_TOKEN", "").strip()
        cf_model = (os.getenv("CLOUDFLARE_AI_MODEL") or DEFAULT_MODEL).strip()
        if not cf_model.startswith("@cf/"):
            raise CloudflareAIError("model")
        url = f"https://api.cloudflare.com/client/v4/accounts/{account}/ai/v1/chat/completions"
        data = {
            "model": cf_model,
            "messages": [
                {"role": "system", "content": "Translate English dialogue to idiomatic Sri Lankan Sinhala. Return ONLY a valid JSON array of strings in the exact same order, with protected tokens unchanged. No markdown, explanations, or reasoning."},
                {"role": "user", "content": contents},
            ],
            "max_tokens": max(128, min(int(os.getenv("CLOUDFLARE_AI_MAX_TOKENS", "4096")), 8192)),
            "temperature": 0.2,
            "stream": False,
        }
        try:
            result = requests.post(
                url, json=data,
                headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
                timeout=(10, 90),
            )
        except requests.RequestException as exc:
            raise CloudflareAIError("unavailable") from exc
        if not 200 <= result.status_code < 300:
            raise CloudflareAIError(_error_category(result.status_code), result.status_code)
        try:
            payload = result.json()
            raw = payload["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise CloudflareAIError("response") from exc
        return SimpleNamespace(text=_normalize(raw))


class CloudflareClient:
    def __init__(self):
        self.models = _CloudflareModels()
