"""SubNexa subtitle library.

The site owner uploads finished subtitle files (SRT or ASS) together with a movie
poster. Visitors can search the library and download files without signing in.

Storage: a small SQLite database plus a folder of files, both next to this file.
NOTE: Render free web services have an ephemeral disk, so on Render these are wiped
on every redeploy/restart. Use a persistent disk (or move storage to R2/Supabase)
before relying on this in production. Local testing needs nothing extra.

The Restricted area (upload / delete) is protected by SUBNEXA_LIBRARY_ADMIN_KEY (set it in
.env, at least 12 characters). If it is not set, uploads are disabled. Wrong passwords are
throttled (8 per 10 minutes per address).
"""
from __future__ import annotations

import hmac
import os
import re
import sqlite3
import time
from contextlib import closing
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, File, Form, Header, HTTPException, Query, Request, UploadFile
from fastapi.responses import Response

router = APIRouter(prefix="/library", tags=["library"])

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.getenv("SUBNEXA_LIBRARY_DB") or BASE_DIR / "subnexa_library.db")
FILES_DIR = Path(os.getenv("SUBNEXA_LIBRARY_DIR") or BASE_DIR / "library_files")
MAX_SUB_BYTES = 2 * 1024 * 1024
MAX_POSTER_BYTES = 2 * 1024 * 1024
POSTER_TYPES = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp"}
SUB_MIME = {"srt": "application/x-subrip", "ass": "text/x-ssa"}


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    FILES_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute(
        """CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            year TEXT NOT NULL DEFAULT '',
            language TEXT NOT NULL DEFAULT 'Sinhala',
            format TEXT NOT NULL,
            poster_type TEXT NOT NULL DEFAULT '',
            downloads INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL
        )"""
    )
    return conn


# Wrong-password throttle (in memory): per client address, plus a looser global cap.
_FAILS: dict[str, list[float]] = {}
FAIL_LIMIT = 8
FAIL_WINDOW = 600  # seconds


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip() or "unknown"
    return request.client.host if request.client else "unknown"


def _require_admin(key: str | None, request: Request) -> None:
    expected = os.getenv("SUBNEXA_LIBRARY_ADMIN_KEY", "")
    if len(expected) < 12:
        raise HTTPException(
            status_code=503,
            detail="The restricted area is disabled. Set SUBNEXA_LIBRARY_ADMIN_KEY (12+ characters) on the server.",
        )
    ip = _client_ip(request)
    now = time.time()
    for name in (ip, "*"):
        recent = [t for t in _FAILS.get(name, []) if now - t < FAIL_WINDOW]
        if recent or name == "*":
            _FAILS[name] = recent
        else:
            _FAILS.pop(name, None)
    if len(_FAILS.get(ip, [])) >= FAIL_LIMIT or len(_FAILS["*"]) >= FAIL_LIMIT * 5:
        raise HTTPException(status_code=429, detail="Too many wrong passwords. Try again in a few minutes.")
    if not key or not hmac.compare_digest(key.encode("utf-8"), expected.encode("utf-8")):
        _FAILS.setdefault(ip, []).append(now)
        _FAILS["*"].append(now)
        raise HTTPException(status_code=403, detail="Wrong password.")


@router.post("/admin/check")
def admin_check(request: Request, x_library_admin_key: str | None = Header(None)):
    """Used by the Restricted area box to confirm the password before showing upload tools."""
    _require_admin(x_library_admin_key, request)
    return {"ok": True}


def _poster_type(data: bytes) -> str:
    if data.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return ""


def _public(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "title": row["title"],
        "year": row["year"],
        "language": row["language"],
        "format": row["format"],
        "downloads": row["downloads"],
        "poster_url": f"/library/items/{row['id']}/poster" if row["poster_type"] else None,
        "download_url": f"/library/items/{row['id']}/download",
    }


def _remove_files(item_id: int) -> None:
    for path in FILES_DIR.glob(f"{int(item_id)}.*"):
        try:
            path.unlink()
        except OSError:
            pass


def _download_name(title: str, fmt: str) -> str:
    stem = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", title).strip(" .") or "subtitles"
    return f"{stem}_sinhala_by_subnexa_ai.{fmt}"


@router.get("/items")
def list_items(q: str = Query("", max_length=80), limit: int = Query(60, ge=1, le=200)):
    q = q.strip()
    sql = "SELECT * FROM items"
    params: list = []
    if q:
        escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        sql += " WHERE title LIKE ? ESCAPE '\\' OR year LIKE ? ESCAPE '\\'"
        params += [f"%{escaped}%", f"%{escaped}%"]
    sql += " ORDER BY id DESC LIMIT ?"
    params.append(limit)
    with closing(_connect()) as conn:
        rows = conn.execute(sql, params).fetchall()
    return {"items": [_public(r) for r in rows]}


@router.get("/items/{item_id}/poster")
def poster(item_id: int):
    with closing(_connect()) as conn:
        row = conn.execute("SELECT poster_type FROM items WHERE id = ?", (item_id,)).fetchone()
    if not row or not row["poster_type"]:
        raise HTTPException(status_code=404, detail="Poster not found.")
    path = FILES_DIR / f"{item_id}.poster.{row['poster_type']}"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Poster not found.")
    return Response(
        content=path.read_bytes(),
        media_type=POSTER_TYPES[row["poster_type"]],
        headers={"Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff"},
    )


@router.get("/items/{item_id}/download")
def download(item_id: int):
    with closing(_connect()) as conn:
        row = conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Subtitle not found.")
        path = FILES_DIR / f"{item_id}.sub.{row['format']}"
        if not path.is_file():
            raise HTTPException(status_code=404, detail="Subtitle file is missing.")
        conn.execute("UPDATE items SET downloads = downloads + 1 WHERE id = ?", (item_id,))
        conn.commit()
    name = _download_name(row["title"], row["format"])
    fallback = f"subnexa_{item_id}.{row['format']}"
    return Response(
        content=path.read_bytes(),
        media_type=f"{SUB_MIME[row['format']]}; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{fallback}"; filename*=UTF-8\'\'{quote(name)}',
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.post("/items")
async def create_item(
    request: Request,
    title: str = Form(...),
    year: str = Form(""),
    language: str = Form("Sinhala"),
    subtitle: UploadFile = File(...),
    poster_image: UploadFile | None = File(None),
    x_library_admin_key: str | None = Header(None),
):
    _require_admin(x_library_admin_key, request)
    title = title.strip()
    year = year.strip()
    language = language.strip() or "Sinhala"
    if not title or len(title) > 120:
        raise HTTPException(status_code=400, detail="Title is required (max 120 characters).")
    if year and not re.fullmatch(r"\d{4}", year):
        raise HTTPException(status_code=400, detail="Year must be 4 digits, e.g. 2024.")
    if len(language) > 30:
        raise HTTPException(status_code=400, detail="Language is too long.")

    name = (subtitle.filename or "").lower()
    fmt = "srt" if name.endswith(".srt") else "ass" if name.endswith(".ass") else ""
    if not fmt:
        raise HTTPException(status_code=400, detail="Subtitle must be an .srt or .ass file.")
    sub_bytes = await subtitle.read(MAX_SUB_BYTES + 1)
    if len(sub_bytes) > MAX_SUB_BYTES:
        raise HTTPException(status_code=413, detail="Subtitle file is larger than 2 MB.")
    try:
        text = sub_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Subtitle file must be UTF-8.")
    if (fmt == "srt" and "-->" not in text) or (fmt == "ass" and "[Events]" not in text):
        raise HTTPException(status_code=400, detail=f"This does not look like a valid {fmt.upper()} file.")

    poster_bytes = b""
    poster_kind = ""
    if poster_image is not None and poster_image.filename:
        poster_bytes = await poster_image.read(MAX_POSTER_BYTES + 1)
        if len(poster_bytes) > MAX_POSTER_BYTES:
            raise HTTPException(status_code=413, detail="Poster is larger than 2 MB.")
        poster_kind = _poster_type(poster_bytes)
        if not poster_kind:
            raise HTTPException(status_code=400, detail="Poster must be a JPG, PNG or WebP image.")

    with closing(_connect()) as conn:
        cur = conn.execute(
            "INSERT INTO items (title, year, language, format, poster_type, created_at) VALUES (?,?,?,?,?,?)",
            (title, year, language, fmt, poster_kind, int(time.time())),
        )
        item_id = cur.lastrowid
        try:
            (FILES_DIR / f"{item_id}.sub.{fmt}").write_bytes(sub_bytes)
            if poster_kind:
                (FILES_DIR / f"{item_id}.poster.{poster_kind}").write_bytes(poster_bytes)
            conn.commit()
        except OSError:
            conn.rollback()
            _remove_files(item_id)
            raise HTTPException(status_code=500, detail="Could not save the files on the server.")
        row = conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
    return _public(row)


@router.delete("/items/{item_id}")
def delete_item(item_id: int, request: Request, x_library_admin_key: str | None = Header(None)):
    _require_admin(x_library_admin_key, request)
    with closing(_connect()) as conn:
        cur = conn.execute("DELETE FROM items WHERE id = ?", (item_id,))
        conn.commit()
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Subtitle not found.")
    _remove_files(item_id)
    return {"deleted": item_id}
