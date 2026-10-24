"""Safe, read-only CodeCraft API diagnostics for EUMF SubNexa.

Place this file beside backend/.env and run it in the backend virtualenv.
It sends GET /v1/models only (no subtitles, prompts, or billable inference).
It never prints the API key or raw server error bodies.
"""
from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from urllib.parse import urlsplit

try:
    from dotenv import load_dotenv
except ImportError:
    print("python-dotenv is missing. Activate backend venv first.")
    raise SystemExit(1)

load_dotenv()
key = (os.getenv("CODECRAFT_API_KEY") or os.getenv("BACKUP_API_KEY") or "").strip()
if not key:
    print("CodeCraft key not configured in backend/.env")
    raise SystemExit(1)

# Do not silently follow redirects: avoids inadvertently sending a Bearer token
# to an unrelated host and helps identify a misconfigured API URL.
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

opener = urllib.request.build_opener(NoRedirect())


def safe_error_code(raw: bytes) -> str:
    try:
        body = json.loads(raw)
        error = body.get("error", {}) if isinstance(body, dict) else {}
        if isinstance(error, dict):
            code = error.get("code")
        else:
            code = body.get("code") if isinstance(body, dict) else None
        if isinstance(code, str) and re.fullmatch(r"[A-Za-z0-9_-]{1,70}", code):
            return code
    except (ValueError, TypeError):
        pass
    return "not provided"


for host in ("https://codecraftapi.com", "https://www.codecraftapi.com"):
    print("\nTesting", urlsplit(host).hostname)
    req = urllib.request.Request(
        host + "/v1/models",
        headers={
            "Authorization": "Bearer " + key,
            "Accept": "application/json",
            "User-Agent": "SubNexa-Diagnostic/1.0",
        },
        method="GET",
    )
    try:
        with opener.open(req, timeout=15) as response:
            raw = response.read(1_000_000)
            content_type = response.headers.get("Content-Type", "unknown").split(";")[0]
            print("HTTP:", response.status)
            print("Content-Type:", content_type)
            try:
                body = json.loads(raw)
                models = body.get("data") if isinstance(body, dict) else None
                if isinstance(models, list):
                    print("Models available:", len(models))
                    gemini_ids = [m.get("id") for m in models if isinstance(m, dict)
                                  and isinstance(m.get("id"), str)
                                  and "gemini" in m["id"].lower()]
                    print("Gemini model IDs:", gemini_ids[:15])
                else:
                    print("Unexpected response JSON format")
            except (ValueError, UnicodeError):
                print("Response was not JSON")
    except urllib.error.HTTPError as exc:
        raw = exc.read(16000)
        print("HTTP:", exc.code)
        print("Content-Type:", exc.headers.get("Content-Type", "unknown").split(";")[0])
        print("Provider error code:", safe_error_code(raw))
        if exc.code in (301, 302, 303, 307, 308):
            location = exc.headers.get("Location", "")
            destination = urlsplit(location)
            print("Redirect hostname:", destination.hostname or "not specified")
    except (urllib.error.URLError, TimeoutError) as exc:
        print("Network connection failed or timed out (no key shown).")

print("\nFinished. Share ONLY this diagnostic output, never the key or .env file.")
