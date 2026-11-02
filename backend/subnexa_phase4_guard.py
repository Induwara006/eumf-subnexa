"""Phase 4A: bounded, per-process abuse guard for SubNexa backend.

This is an additional safety layer, not a distributed rate-limiting guarantee.
For multiple Render instances/workers, use a shared Redis/edge limiter.
"""
from __future__ import annotations

from collections import defaultdict, deque
from threading import Lock
from time import monotonic
from urllib.parse import unquote

MAX_BODY_BYTES = 3 * 1024 * 1024  # multipart overhead + 2 MB subtitle
WINDOW_SECONDS = 60
# Avoid tight retry loops; normal subtitle resume remains permitted.
LIMITS = {
    "/translate-srt-stream": 20,
    "/translate-srt": 20,
    "/translate": 20,
    "/upload": 30,
    "/translation/control": 60,
    "/subnexa-auth/login": 20,
    "/subnexa-auth/admin/handoff": 20,
}
MAX_SUBJECTS = 10000


def guarded_path(path: str):
    return LIMITS.get(path)


class Phase4AbuseGuard:
    def __init__(self, app):
        self.app = app
        self.lock = Lock()
        self.events = defaultdict(deque)

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http":
            return await self.app(scope, receive, send)
        method = scope.get("method", "GET").upper()
        path = unquote(scope.get("path", ""))
        cap = guarded_path(path)
        if not cap or method == "OPTIONS":
            return await self.app(scope, receive, send)
        client = scope.get("client")
        # Never trust client-supplied X-Forwarded-For here. ASGI server controls client.
        ip = str(client[0]) if client else "unknown"
        headers = {k.lower(): v for k, v in scope.get("headers", [])}
        content_length = headers.get(b"content-length")
        if content_length:
            try:
                size = int(content_length)
            except (ValueError, OverflowError):
                return await self.reject(send, 400, "Invalid Content-Length.")
            if size < 0 or (method in ("POST", "PUT", "PATCH") and size > MAX_BODY_BYTES):
                return await self.reject(send, 413, "Request body exceeds limit.")
        now = monotonic()
        key = (ip, path)
        with self.lock:
            # Prevent unbounded idle-key memory growth.
            if len(self.events) > MAX_SUBJECTS:
                for k in list(self.events):
                    dq = self.events[k]
                    while dq and now - dq[0] >= WINDOW_SECONDS:
                        dq.popleft()
                    if not dq:
                        del self.events[k]
                if len(self.events) > MAX_SUBJECTS:
                    self.events.clear()  # fail-open under extreme address churn
            times = self.events[key]
            while times and now - times[0] >= WINDOW_SECONDS:
                times.popleft()
            limited = len(times) >= cap
            if not limited:
                times.append(now)
        if limited:
            return await self.reject(send, 429, "Too many requests. Retry shortly.", retry_after="60")

        # Enforce the actual transferred size (also covers chunked requests and
        # lying/absent Content-Length), before any endpoint side effects occur.
        if method in ("POST", "PUT", "PATCH"):
            chunks = []
            received = 0
            while True:
                message = await receive()
                if message["type"] == "http.disconnect":
                    return
                if message["type"] != "http.request":
                    continue
                chunk = message.get("body", b"")
                received += len(chunk)
                if received > MAX_BODY_BYTES:
                    return await self.reject(send, 413, "Request body exceeds limit.")
                chunks.append(chunk)
                if not message.get("more_body", False):
                    break
            # Replay bounded chunks once, preserving receive() semantics.
            pending = iter(chunks)
            len_remaining = [len(chunks)]
            async def replay_receive():
                if len_remaining[0]:
                    len_remaining[0] -= 1
                    return {"type": "http.request", "body": next(pending),
                            "more_body": len_remaining[0] > 0}
                return await receive()
            return await self.app(scope, replay_receive, send)
        return await self.app(scope, receive, send)

    @staticmethod
    async def reject(send, code, message, retry_after=None):
        import json
        headers = [(b"content-type", b"application/json"), (b"cache-control", b"no-store")]
        if retry_after: headers.append((b"retry-after", retry_after.encode()))
        body = json.dumps({"detail": message}).encode("utf-8")
        await send({"type": "http.response.start", "status": code, "headers": headers})
        await send({"type": "http.response.body", "body": body})
