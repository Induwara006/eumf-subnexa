"""SubNexa V4.4: server-only Cloudflare Workers AI text generation adapter.

Implements the small Gemini generate_content interface used by translator.py.
Does not create accounts, mint tokens, invent quota figures, or bypass access rules.
"""
from __future__ import annotations

import json
import os
import re
import time
from types import SimpleNamespace

import requests

DEFAULT_MODEL = "@cf/qwen/qwen3-30b-a3b-fp8"
ACCOUNT_ID_PATTERN = re.compile(r"^[0-9a-fA-F]{32}$")


def active() -> bool:
    return os.getenv("SUBNEXA_AI_PROVIDER", "gemini").strip().lower() == "cloudflare"


def configured() -> bool:
    from subnexa_account_pool import configured as pool_configured
    return pool_configured('cloudflare')


def provider_details() -> dict:
    return {
        "provider": "cloudflare" if active() else "gemini",
        "available": configured() if active() else False,
        "model": (os.getenv("CLOUDFLARE_AI_MODEL") or DEFAULT_MODEL) if active() else None,
        "remaining_credits": None,  # Cloudflare does not give a live free-balance figure here.
    }


class CloudflareAIError(RuntimeError):
    def __init__(self, category: str, http_status: int | None = None, reason: str | None = None):
        self.reason = reason
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
        raise CloudflareAIError("response", reason="non_text_content")
    text = content.strip()
    if not text:
        raise CloudflareAIError("response", reason="empty_content")
    # Common formatting drift from chat models; JSON remains the sole accepted payload.
    text = re.sub(r"^<think>[\s\S]*?</think>\s*", "", text, count=1)
    fence = re.fullmatch(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
    if fence:
        text = fence.group(1).strip()
    try:
        parsed = json.loads(text)
    except (ValueError, TypeError) as exc:
        raise CloudflareAIError("response", reason="invalid_json") from exc
    if not isinstance(parsed, list) or any(not isinstance(item, str) for item in parsed):
        raise CloudflareAIError("response", reason="expected_string_array")
    return json.dumps(parsed, ensure_ascii=False)


class _CloudflareModels:
    def __init__(self, account=None, token=None):
        self.account = account
        self.token = token

    def generate_content(self, *, model: str, contents: str, config=None):
        """Use the provider-selected model, not Gemini's positional model argument."""
        account = self.account or os.getenv("CLOUDFLARE_ACCOUNT_ID", "").strip()
        token = self.token or os.getenv("CLOUDFLARE_API_TOKEN", "").strip()
        if not ACCOUNT_ID_PATTERN.fullmatch(account) or not token:
            raise CloudflareAIError("configuration")
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
        # One initial request plus at most two malformed-response retries.
        # HTTP quota/auth/network errors still go to the existing account pool.
        for attempt in range(1, 4):
            try:
                from subnexa_fairuse import reserve_request
                reserve_request()
                result = requests.post(
                    url, json=data,
                    headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
                    timeout=(10, 90),
                )
            except requests.RequestException as exc:
                raise CloudflareAIError("unavailable") from exc
            finish = "unknown"
            content_chars = 0
            try:
                if not 200 <= result.status_code < 300:
                    raise CloudflareAIError(_error_category(result.status_code), result.status_code)
                try:
                    payload = result.json()
                except ValueError as exc:
                    raise CloudflareAIError("response", reason="invalid_response_json") from exc
                try:
                    choice = payload["choices"][0]
                    raw = choice["message"]["content"]
                    reported_finish = choice.get("finish_reason")
                    # Only allowlisted metadata is logged; never log model text,
                    # keys, request headers, account IDs or subtitle prompts.
                    if reported_finish in ("stop", "length", "content_filter", "tool_calls"):
                        finish = reported_finish
                    content_chars = len(raw) if isinstance(raw, str) else 0
                except (KeyError, IndexError, TypeError, AttributeError) as exc:
                    raise CloudflareAIError("response", reason="missing_message_content") from exc
                if finish == "length":
                    raise CloudflareAIError("response", reason="output_token_limit")
                if finish == "content_filter":
                    raise CloudflareAIError("response", reason="content_filtered")
                return SimpleNamespace(text=_normalize(raw))
            except CloudflareAIError as error:
                if error.category != "response":
                    raise
                print(f"[SubNexa 0.2] response rejected: reason={error.reason or 'unknown'} "
                      f"finish={finish} content_chars={content_chars} "
                      f"max_tokens={data['max_tokens']} attempt={attempt}/3", flush=True)
                # Filtering is not a transient formatting error; don't retry it.
                if attempt == 3 or error.reason == "content_filtered":
                    raise
            finally:
                result.close()
            print(f"[SubNexa 0.2] retrying malformed response ({attempt}/2)", flush=True)
            time.sleep(attempt)



class CloudflareClient:
    def __init__(self, account=None, token=None):
        self.models = _CloudflareModels(account, token)
