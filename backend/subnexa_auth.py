"""SubNexa adult-eligible, user-owned Gemini key connection (integration starter).

A separate Google OAuth cloud-platform consent is required to create an auth key
in an EXISTING user-owned Cloud project. No OAuth refresh tokens are retained.
No API keys or OAuth tokens are returned to the browser.

Production requires persistent secure DB, audited scope verification and auth hardening.
"""
from __future__ import annotations

import contextvars
import hashlib
import os
import re
import secrets
import sqlite3
import time
from http.cookies import SimpleCookie
from pathlib import Path
from urllib.parse import urlencode

import requests
from cloudflare_subnexa import active as cloudflare_active, configured as cloudflare_configured
from subnexa_failover import active as hybrid_active, configured as hybrid_configured, authorized_gemini_key
from cryptography.fernet import Fernet
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from pydantic import BaseModel

router = APIRouter(prefix="/subnexa-auth", tags=["SubNexa Google Login"])
_current_key = contextvars.ContextVar("subnexa_current_user_gemini_key", default=None)
_current_sub = contextvars.ContextVar("subnexa_current_user_sub", default=None)
PROJECT_ID = re.compile(r"^(?:[a-z][a-z0-9-]{4,61}[a-z0-9]|[0-9]{6,20})$")
FRONTEND = os.getenv("SUBNEXA_FRONTEND_URL", "http://localhost:3000").rstrip("/")
COOKIE_SECURE = os.getenv("SUBNEXA_COOKIE_SECURE", "false").lower() == "true"
COOKIE_SAMESITE = os.getenv("SUBNEXA_COOKIE_SAMESITE", "lax").lower()
DB_PATH = os.getenv("SUBNEXA_USER_DB", "subnexa_users.db")
COOKIE_NAME = "subnexa_session"
STATE_COOKIE = "subnexa_oauth_state"
GOOGLE_AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN = "https://oauth2.googleapis.com/token"
USERINFO = "https://openidconnect.googleapis.com/v1/userinfo"
CLOUD_SCOPE = "https://www.googleapis.com/auth/cloud-platform"
BASE_SCOPES = "openid email profile"
API_SERVICE = "generativelanguage.googleapis.com"


class SubNexaDiagnosticFailure(RuntimeError):
    """Safe category only: no provider response bodies, secrets or tokens."""
    def __init__(self, stage: str, reason: str, status: int | None = None):
        self.stage = stage
        self.reason = reason
        self.status = status
        super().__init__("Google request failed at " + stage)


def _env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing server-only configuration: {name}")
    return value


def _signer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(_env("SUBNEXA_SESSION_SECRET"), salt="subnexa-web-login-v1")


def _state_signer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(_env("SUBNEXA_SESSION_SECRET"), salt="subnexa-cloud-consent-v1")


def _cipher() -> Fernet:
    return Fernet(_env("SUBNEXA_USER_ENCRYPTION_KEY").encode())


def _db():
    # SQLite is LOCAL DEVELOPMENT ONLY. Use an encrypted persistent DB for deployed apps.
    db = sqlite3.connect(DB_PATH, timeout=10)
    db.execute("""CREATE TABLE IF NOT EXISTS user_keys (
        google_sub TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        service_account_email TEXT NOT NULL,
        key_resource TEXT NOT NULL,
        encrypted_key BLOB NOT NULL,
        created_at INTEGER NOT NULL
    )""")
    return db


def _get_record(sub):
    with _db() as db:
        row = db.execute("SELECT project_id,service_account_email,key_resource,encrypted_key "
                         "FROM user_keys WHERE google_sub=?", (sub,)).fetchone()
    return row


def _save_record(sub, project_id, sa_email, resource, api_key):
    if not resource or not api_key:
        raise RuntimeError("Google returned no usable API key")
    with _db() as db:
        db.execute("INSERT OR REPLACE INTO user_keys VALUES (?,?,?,?,?,?)", (
            sub, project_id, sa_email, resource, _cipher().encrypt(api_key.encode()), int(time.time())
        ))


def current_user_sub():
    """Unique authenticated Google subject for per-user cache isolation."""
    return _current_sub.get()


def current_translation_key():
    """Read-only request-scoped key. Never mutate process-wide GEMINI_API_KEY."""
    return _current_key.get()


def _user_from_cookie_value(cookie: str | None):
    if not cookie:
        return None
    try:
        obj = _signer().loads(cookie, max_age=7 * 86400)
        return obj if isinstance(obj, dict) and obj.get("sub") else None
    except (BadSignature, SignatureExpired):
        return None


def _user(request: Request):
    obj = _user_from_cookie_value(request.cookies.get(COOKIE_NAME))
    if obj is None:
        raise HTTPException(status_code=401, detail="Sign in with Google first")
    return obj


def _cookie_kwargs(max_age):
    return dict(httponly=True, secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE,
                max_age=max_age, path="/")


def _oauth_url(mode, params, response):
    nonce = secrets.token_urlsafe(32)
    state = {"nonce": nonce, "mode": mode, **params}
    state_blob = _state_signer().dumps(state)
    response.set_cookie(STATE_COOKIE, state_blob, **_cookie_kwargs(600))
    scopes = BASE_SCOPES + (" " + CLOUD_SCOPE if mode == "connect" else "")
    # Explicit incremental consent; never ask for offline access / refresh tokens.
    query = dict(client_id=_env("GOOGLE_OAUTH_CLIENT_ID"),
                 redirect_uri=_env("GOOGLE_OAUTH_REDIRECT_URI"),
                 response_type="code", scope=scopes, state=nonce,
                 include_granted_scopes="true", prompt="consent" if mode == "connect" else "select_account")
    return GOOGLE_AUTHORIZE + "?" + urlencode(query)


def _google_call(method, url, token, payload=None, timeout=15, stage="google_request"):
    # Diagnostic failures include only a fixed stage/reason and HTTP status.
    # Never log or reflect token, URL, project ID or response body.
    try:
        response = requests.request(method, url, headers={"Authorization": f"Bearer {token}"},
                                    json=payload, timeout=timeout)
    except requests.RequestException:
        raise SubNexaDiagnosticFailure(stage, "network_error") from None
    if response.status_code >= 400:
        raise SubNexaDiagnosticFailure(stage, "http_error", response.status_code)
    try:
        return response.json()
    except ValueError:
        raise SubNexaDiagnosticFailure(stage, "invalid_response") from None


def _poll_operation(access_token, op, max_attempts=14):
    name = op.get("name", "")
    if not name or not re.fullmatch(r"operations/[A-Za-z0-9._-]+", name):
        raise RuntimeError("Google returned an unexpected operation name")
    for _ in range(max_attempts):
        if op.get("done"):
            if op.get("error"):
                raise SubNexaDiagnosticFailure("key_creation_poll", "operation_failed")
            return op.get("response", {})
        time.sleep(1)
        op = _google_call("GET", f"https://apikeys.googleapis.com/v2/{name}", access_token,
                          stage="key_creation_poll")
    raise RuntimeError("Google key creation is processing; check Google Cloud before retrying")


def _ensure_api_enabled(token, project_id, service):
    # Service Usage activation is an admin action and may fail due to IAM/billing/policy.
    url = f"https://serviceusage.googleapis.com/v1/projects/{project_id}/services/{service}"
    service_stages = {
        "apikeys.googleapis.com": "api_keys_service",
        "iam.googleapis.com": "iam_service",
        API_SERVICE: "gemini_service",
    }
    stage = service_stages.get(service, "cloud_service")
    state = _google_call("GET", url, token, stage=stage)
    if state.get("state") == "ENABLED":
        return
    raise SubNexaDiagnosticFailure(stage, "not_enabled")


def _ensure_service_account(token, project_id, sub):
    ident = "subnexa-" + hashlib.sha256(sub.encode()).hexdigest()[:14]
    email = f"{ident}@{project_id}.iam.gserviceaccount.com"
    url = f"https://iam.googleapis.com/v1/projects/{project_id}/serviceAccounts/{email}"
    try:
        response = requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=15)
    except requests.RequestException:
        raise SubNexaDiagnosticFailure("service_account_lookup", "network_error") from None
    if response.status_code == 200:
        return email
    if response.status_code != 404:
        raise SubNexaDiagnosticFailure("service_account_lookup", "http_error", response.status_code)
    created = _google_call("POST", f"https://iam.googleapis.com/v1/projects/{project_id}/serviceAccounts", token,
                           {"accountId": ident, "serviceAccount": {"displayName": "SubNexa Gemini translation"}},
                           stage="service_account_create")
    account_email = created.get("email", "")
    if account_email != email:
        raise RuntimeError("Google returned unexpected service-account identity")
    return email


def _provision_key(token, project_id, sub):
    # Never create a new Cloud project, configure billing, or expand project quotas.
    for service in ("apikeys.googleapis.com", "iam.googleapis.com", API_SERVICE):
        _ensure_api_enabled(token, project_id, service)
    sa_email = _ensure_service_account(token, project_id, sub)
    payload = {
        "displayName": "SubNexa AI — user authorized Gemini key",
        "restrictions": {"apiTargets": [{"service": API_SERVICE}]},
        "serviceAccountEmail": sa_email,   # Crucial for 2026 auth key type.
    }
    op = _google_call("POST", f"https://apikeys.googleapis.com/v2/projects/{project_id}/locations/global/keys", token, payload,
                      stage="key_creation_request")
    key_info = _poll_operation(token, op)
    key_resource = key_info.get("name", "")
    key_string = key_info.get("keyString", "")
    if not key_resource or not key_string:
        raise SubNexaDiagnosticFailure("key_creation_response", "missing_key_string")
    return sa_email, key_resource, key_string


@router.get("/login")
def login():
    response = RedirectResponse("/", status_code=302)
    url = _oauth_url("login", {}, response)
    response.headers["location"] = url
    return response


@router.get("/callback")
def callback(request: Request, code: str = "", state: str = "", error: str = ""):
    response = RedirectResponse(FRONTEND + "/?subnexa_login=complete", status_code=302)
    stored = request.cookies.get(STATE_COOKIE)
    response.delete_cookie(STATE_COOKIE, path="/")
    try:
        if error or not code or not state or not stored:
            raise RuntimeError("Google consent cancelled or expired")
        obj = _state_signer().loads(stored, max_age=600)
        if obj.get("nonce") != state:
            raise RuntimeError("Invalid OAuth state")
        token_reply = requests.post(GOOGLE_TOKEN, data={
            "client_id": _env("GOOGLE_OAUTH_CLIENT_ID"),
            "client_secret": _env("GOOGLE_OAUTH_CLIENT_SECRET"),
            "code": code, "redirect_uri": _env("GOOGLE_OAUTH_REDIRECT_URI"),
            "grant_type": "authorization_code"}, timeout=15)
        if not token_reply.ok:
            raise RuntimeError("Google rejected OAuth authorization code")
        bundle = token_reply.json()
        token = bundle.get("access_token")
        if not token:
            raise RuntimeError("Google returned no access token")
        profile = _google_call("GET", USERINFO, token)
        sub = profile.get("sub", "")
        if not sub or not profile.get("email_verified"):
            raise RuntimeError("Google email is not verified")
        if obj["mode"] == "login":
            user = {"sub": sub, "name": profile.get("name", ""), "email": profile.get("email", "")}
            response.set_cookie(COOKIE_NAME, _signer().dumps(user), **_cookie_kwargs(7 * 86400))
        elif obj["mode"] == "connect":
            signed_user = _user_from_cookie_value(request.cookies.get(COOKIE_NAME))
            if not signed_user or signed_user["sub"] != sub or signed_user["sub"] != obj.get("sub"):
                raise RuntimeError("Google account differs from signed-in SubNexa account")
            if CLOUD_SCOPE not in bundle.get("scope", "").split():
                raise RuntimeError("Cloud permission was not granted")
            if _get_record(sub):
                raise RuntimeError("A key is already connected; disconnect it before creating another")
            project_id = obj["project_id"]
            sa, resource, key = _provision_key(token, project_id, sub)
            _save_record(sub, project_id, sa, resource, key)
        else:
            raise RuntimeError("Unknown authorization mode")
    except SubNexaDiagnosticFailure as exc:
        # Only allowlisted stage/reason and integer HTTP status; no provider data.
        query = {"subnexa_error": "permission_or_setup_required",
                 "subnexa_stage": exc.stage, "subnexa_reason": exc.reason}
        if exc.status is not None:
            query["subnexa_http"] = str(exc.status)
        response.headers["location"] = FRONTEND + "/?" + urlencode(query)
    except (RuntimeError, BadSignature, SignatureExpired, ValueError, requests.RequestException):
        # Preserve existing non-cloud behavior without disclosing tokens/errors.
        response.headers["location"] = FRONTEND + "/?subnexa_error=connection_failed"
    return response


@router.get("/session")
def session(request: Request):
    user = _user_from_cookie_value(request.cookies.get(COOKIE_NAME))
    if not user:
        return {"signed_in": False, "connected": False,
                "personal_key_connected": False, "personal_project_id": None}
    row = _get_record(user["sub"])
    # SubNexa V4.4 Cloudflare provider: connection is a SERVER CONFIGURATION
    # status, never an assertion of remaining free Neurons or live model access.
    using_cloudflare = cloudflare_active()
    using_hybrid = hybrid_active()
    # SubNexa V4.5 hybrid provider: configured != live inference success.
    primary_ready = bool(row) or bool(authorized_gemini_key())
    backup_ready = cloudflare_configured()
    provider = "gemini_cloudflare" if using_hybrid else "cloudflare" if using_cloudflare else "gemini"
    return {"signed_in": True, "name": user.get("name", ""),
            "email": user.get("email", ""),
            # Personal connection is distinct from server-configured providers.
            "personal_key_connected": bool(row),
            "personal_project_id": row[0] if row else None,
            "provider": provider,
            "primary_configured": primary_ready if using_hybrid else None,
            "backup_configured": backup_ready if using_hybrid else None,
            "connected": (primary_ready or backup_ready) if using_hybrid else
                         (backup_ready if using_cloudflare else bool(row)),
            "project_id": None if (using_cloudflare or using_hybrid) else (row[0] if row else None),
            "remaining_credits": None,
            "quota_notice": ("Gemini primary and Cloudflare backup are configured server-side; live access and remaining provider allowance are not verified."
                if using_hybrid else
                "Cloudflare server token configured; actual access and remaining shared daily Neurons are not verified."
                if using_cloudflare else
                "Google Gemini quotas are project-level. Exact remaining allowance not verified here.")}


class ConnectRequest(BaseModel):
    project_id: str
    eligible_adult: bool
    accepts_terms: bool
    acknowledges_costs: bool


@router.post("/connect/start")
def connect(request: Request, form: ConnectRequest):
    user = _user(request)
    if request.headers.get("origin") != FRONTEND:
        raise HTTPException(status_code=403, detail="Untrusted origin")
    if not (form.eligible_adult and form.accepts_terms and form.acknowledges_costs):
        raise HTTPException(400, "Cloud connection requires eligible adult consent and cost acknowledgment")
    if not PROJECT_ID.fullmatch(form.project_id):
        raise HTTPException(400, "Invalid Google Cloud project ID")
    if form.project_id.isdecimal():
        raise HTTPException(400, "Use the Cloud project ID, not the numeric project number")
    if _get_record(user["sub"]):
        raise HTTPException(409, "Your project is already connected")
    from starlette.responses import Response
    temp = Response()
    url = _oauth_url("connect", {"sub": user["sub"], "project_id": form.project_id}, temp)
    response = JSONResponse({"authorize_url": url})
    for header, value in temp.raw_headers:
        if header.lower() == b"set-cookie":
            response.raw_headers.append((header, value))
    return response


@router.post("/logout")
def logout(request: Request):
    if request.headers.get("origin") != FRONTEND:
        raise HTTPException(status_code=403, detail="Untrusted origin")
    response = JSONResponse({"ok": True})
    response.delete_cookie(COOKIE_NAME, path="/")
    return response


class UserKeyASGIMiddleware:
    """Scope-bound user key even during StreamingResponse; no global key swapping.

    IMPORTANT: Apply to the FastAPI app AFTER app.include_router(router).
    This enforces sign-in and connected key for all /translate* routes.
    """
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        path, method = scope.get("path", ""), scope.get("method", "GET")
        if method != "POST" or not (path == "/translate" or path.startswith("/translate-srt")):
            return await self.app(scope, receive, send)
        headers = {k.decode("latin1").lower(): v.decode("latin1") for k, v in scope.get("headers", [])}
        if headers.get("origin") != FRONTEND:
            return await _deny(send, 403, b'{"detail":"Untrusted origin"}', headers.get("origin"))
        jar = SimpleCookie()
        try:
            jar.load(headers.get("cookie", ""))
            cookie = jar[COOKIE_NAME].value if COOKIE_NAME in jar else None
        except Exception:
            cookie = None
        user = _user_from_cookie_value(cookie)
        if not user:
            return await _deny(send, 401, b'{"detail":"Sign in with Google first"}', headers.get("origin"))
        # SubNexa V4.5 hybrid provider: login is still mandatory; an authorized
        # per-user Gemini key or explicitly configured site key can be primary.
        # Cloudflare backup uses the site's shared quota, never a personal quota.
        if hybrid_active():
            row = _get_record(user["sub"])
            if not (row or hybrid_configured()):
                return await _deny(send, 503, b'{"detail":"Neither Gemini nor Cloudflare is configured"}', headers.get("origin"))
            key_token = None
            if row:
                try:
                    decrypted = _cipher().decrypt(row[3]).decode()
                    key_token = _current_key.set(decrypted)
                except Exception:
                    # An authorized site key or Cloudflare may still be available.
                    if not hybrid_configured():
                        return await _deny(send, 503, b'{"detail":"No readable AI credentials are available"}', headers.get("origin"))
            sub_token = _current_sub.set(user["sub"])
            try:
                await self.app(scope, receive, send)
            finally:
                _current_sub.reset(sub_token)
                if key_token is not None:
                    _current_key.reset(key_token)
            return
        # SubNexa V4.4 Cloudflare provider: maintain login and per-user
        # translation progress isolation, without requiring a Gemini key.
        if cloudflare_active():
            if not cloudflare_configured():
                return await _deny(send, 503, b'{"detail":"Cloudflare server configuration is missing"}', headers.get("origin"))
            sub_token = _current_sub.set(user["sub"])
            try:
                await self.app(scope, receive, send)
            finally:
                _current_sub.reset(sub_token)
            return
        row = _get_record(user["sub"])
        if not row:
            return await _deny(send, 403, b'{"detail":"Connect an eligible Google Cloud project first"}', headers.get("origin"))
        try:
            key = _cipher().decrypt(row[3]).decode()
        except Exception:
            return await _deny(send, 503, b'{"detail":"Connected key cannot be read"}', headers.get("origin"))
        token = _current_key.set(key)
        sub_token = _current_sub.set(user["sub"])
        try:
            await self.app(scope, receive, send)
        finally:
            _current_sub.reset(sub_token)
            _current_key.reset(token)


async def _deny(send, status, body, origin=None):
    # Explicit CORS only for the configured frontend; do not reflect arbitrary origins.
    # This middleware returns before the application's regular CORSMiddleware runs.
    response_headers = [(b"content-type", b"application/json"),
                        (b"content-length", str(len(body)).encode())]
    if origin == FRONTEND:
        response_headers.extend([
            (b"access-control-allow-origin", FRONTEND.encode("utf-8")),
            (b"access-control-allow-credentials", b"true"),
            (b"vary", b"Origin"),
        ])
    await send({"type": "http.response.start", "status": status,
                "headers": response_headers})
    await send({"type": "http.response.body", "body": body})
