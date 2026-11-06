"""SubNexa live user admission via Supabase service-role RPC. No user PII saved."""
import hashlib
import os
import requests


class PresenceUnavailable(RuntimeError):
    pass


def _rpc(name, body):
    url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    key = (os.getenv("SUPABASE_SECRET_KEY", "").strip()
           or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip())
    if not url.startswith("https://") or not key:
        raise PresenceUnavailable("Live user counter is not configured")
    try:
        response = requests.post(
            f"{url}/rest/v1/rpc/{name}",
            json=body,
            headers={"apikey": key, "Authorization": f"Bearer {key}",
                     "Content-Type": "application/json"},
            timeout=(3, 6),
        )
        if not response.ok:
            raise PresenceUnavailable(f"Live user counter database rejected request (HTTP {response.status_code})")
        return response.json()
    except (requests.RequestException, ValueError) as error:
        raise PresenceUnavailable("Live user counter database unavailable") from error


def _identity(user):
    return hashlib.sha256(("subnexa-presence-v1:" + user["sub"]).encode()).hexdigest()


def _admin(user):
    allowed = {s.strip().lower() for s in os.getenv("SUBNEXA_ADMIN_EMAILS", "").split(",") if s.strip()}
    return bool(allowed and user.get("email", "").lower() in allowed)


def admit(user):
    result = _rpc("subnexa_presence_admit_v1", {"p_user_hash": _identity(user), "p_admin": _admin(user)})
    if not isinstance(result, dict) or not isinstance(result.get("allowed"), bool):
        raise PresenceUnavailable("Live user counter response invalid")
    return result["allowed"]


def release(user):
    if not _admin(user):
        _rpc("subnexa_presence_release_v1", {"p_user_hash": _identity(user)})
