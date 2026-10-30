"""Durable per-user fair-use accounting. Provider keys never define the user."""
import hashlib
import os
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field
from subnexa_usage import rpc, settings
from subnexa_auth import _user, current_user_sub, current_user_email

class FairUseError(RuntimeError):
    pass

def identity(sub=None):
    sub = sub or current_user_sub()
    if not sub:
        raise FairUseError("Sign in to translate.")
    return hashlib.sha256(sub.encode()).hexdigest()

def limits():
    return {"p_files": 4, "p_requests": 1}  # v2 RPC ignores personal request counts.

def is_admin(email):
    allowed = {entry.strip().casefold() for entry in os.getenv("SUBNEXA_ADMIN_EMAILS", "").split(",") if entry.strip()}
    return isinstance(email, str) and bool(email.strip()) and email.strip().casefold() in allowed


def account(kind="status", job="", sub=None, verified_user=None):
    # verified_user is supplied only by the signed-cookie status route below.
    if verified_user is not None:
        sub = verified_user["sub"]
        email = verified_user.get("email", "")
    else:
        email = current_user_email() if sub is None or sub == current_user_sub() else None
    identity(sub)  # An allowlisted email must never bypass authentication.
    if is_admin(email):
        return {"allowed": True, "is_admin": True, "unlimited": True,
                "files": None, "requests": None, "file_limit": None,
                "request_limit": None, "reset_at": None}

    if kind == "request":
        return {"allowed": True}
    try:
        result = rpc("subnexa_fairuse_files_v2", {"p_scope": settings()[2], "p_user": identity(sub),
            "p_kind": kind, "p_job": job, "p_event": str(uuid.uuid4()), **limits()})
    except FairUseError:
        raise
    except Exception as exc:
        raise FairUseError("Usage tracking is temporarily unavailable. Your progress is saved. Try again shortly.") from exc
    if not result.get("allowed"):
        reset = datetime.fromisoformat(result["reset_at"]).astimezone(ZoneInfo("Asia/Colombo"))
        raise FairUseError("Your daily limit of 4 files is reached. Progress is saved. Next reset: " + reset.strftime("%d %b, %I:%M %p") + " (Sri Lanka).")
    return result

def reserve_request():
    return account("request")

router = APIRouter()
@router.get("/fair-use")
def status(request: Request):
    from fastapi.responses import JSONResponse
    return JSONResponse(account(verified_user=_user(request)), headers={"Cache-Control": "no-store"})

class Submission(BaseModel):
    kind: str
    title: str = Field(min_length=1, max_length=160)
    details: str = Field(min_length=1, max_length=2000)
    event_id: uuid.UUID

@router.post("/community")
def submit(body: Submission, request: Request):
    user = _user(request)
    origin = request.headers.get("origin", "").rstrip("/")
    allowed = os.getenv("SUBNEXA_FRONTEND_URL", "http://localhost:3000").rstrip("/")
    if origin != allowed:
        raise HTTPException(403, "Request origin is not allowed.")
    if body.kind not in ("request", "report") or not body.title.strip() or not body.details.strip():
        raise HTTPException(400, "Enter a title and details.")
    result = rpc("subnexa_community_v1", {"p_scope": settings()[2], "p_user": identity(user["sub"]),
        "p_kind": body.kind, "p_title": body.title.strip(), "p_details": body.details.strip(),
        "p_event": str(body.event_id)})
    if not result.get("allowed"):
        raise HTTPException(429, "Daily submission limit reached. Try again after the next reset.")
    return {"saved": True}
