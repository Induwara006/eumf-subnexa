"""Best-effort TMDB poster for a freshly published library item.

Put this file in the backend folder (next to subnexa_library_auto.py).
Call attach_poster_async(...) right AFTER the library item row has been created.
It never raises: if anything fails the item simply stays without a poster
(the backfill script can add it later).

Needs TMDB_READ_ACCESS_TOKEN in backend/.env (the same variable the website's poster search uses).
"""
from __future__ import annotations

import logging
import os
import re
import threading
from pathlib import Path

import requests

log = logging.getLogger("subnexa.library.poster")

POSTER_PATH = re.compile(r"^/[A-Za-z0-9_-]{5,60}\.(?:jpg|png)$")
MAX_POSTER = 2 * 1024 * 1024
MIME = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp"}


def _token() -> str:
    token = os.getenv("TMDB_READ_ACCESS_TOKEN") or os.getenv("TMDB_API_READ_TOKEN") or ""
    if token:
        return token.strip()
    try:  # local development fallback: the frontend's env file
        from dotenv import dotenv_values
        for name in (".env.local", ".env"):
            found = dotenv_values(Path(__file__).resolve().parent.parent / "frontend" / name).get("TMDB_READ_ACCESS_TOKEN")
            if found:
                return found.strip()
    except ImportError:
        pass
    return ""


def _kind(data: bytes) -> str:
    if data.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return ""


def _pick(title: str, year: str, series: bool, token: str) -> dict | None:
    reply = requests.get(
        "https://api.themoviedb.org/3/search/multi",
        params={"query": title, "include_adult": "false", "language": "en-US", "page": 1},
        headers={"Authorization": f"Bearer {token}", "accept": "application/json"},
        timeout=(5, 10),
    )
    reply.raise_for_status()
    hits = [x for x in reply.json().get("results", [])
            if x.get("media_type") in ("movie", "tv") and POSTER_PATH.match(x.get("poster_path") or "")]
    want = "tv" if series else "movie"

    def rank(x):
        date = (x.get("release_date") or x.get("first_air_date") or "")[:4]
        return (x["media_type"] != want, bool(year) and date != year)

    hits.sort(key=rank)
    return hits[0] if hits else None


def attach_poster(item_id: str, title: str, year: str = "", series: bool = False) -> bool:
    """Download the best TMDB poster and attach it to the item. Returns True if a poster was added."""
    try:
        # Imported here to avoid a circular import with subnexa_library_auto.
        from subnexa_library_auto import BUCKET, request

        token = _token()
        if not token or not title.strip():
            log.info("[SubNexa Library Poster] skipped (no TMDB token or empty title)")
            return False
        pick = _pick(title.strip(), year or "", series, token)
        if not pick:
            log.info("[SubNexa Library Poster] no TMDB match for %r", title)
            return False
        image = requests.get(f"https://image.tmdb.org/t/p/w500{pick['poster_path']}", timeout=(5, 15))
        image.raise_for_status()
        data = image.content
        kind = _kind(data)
        if not kind or len(data) > MAX_POSTER:
            log.warning("[SubNexa Library Poster] unusable image for %r", title)
            return False
        status, _ = request("POST", f"/storage/v1/object/{BUCKET}/{item_id}/poster.{kind}", data=data,
                            headers={"Content-Type": MIME[kind], "x-upsert": "false"},
                            accepted=(200, 201, 400, 409))
        if status in (400, 409):   # a poster file already exists: leave it alone
            return False
        request("PATCH", f"/rest/v1/subnexa_library_items?id=eq.{item_id}", payload={"poster_type": kind},
                headers={"Content-Type": "application/json", "Prefer": "return=minimal"})
        log.info("[SubNexa Library Poster] added %s poster to %s (%r)", kind, item_id, title)
        return True
    except Exception as error:   # never break publishing because of a poster
        log.warning("[SubNexa Library Poster] failed for %r: %s: %s", title, type(error).__name__, error)
        return False


def attach_poster_async(item_id: str, title: str, year: str = "", series: bool = False) -> None:
    """Fire and forget, so the translation response is not delayed by the TMDB lookup."""
    threading.Thread(target=attach_poster, args=(item_id, title, year, series), daemon=True).start()
