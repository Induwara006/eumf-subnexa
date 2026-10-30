"""Library match: before translating, tell a signed-in user whether a Sinhala subtitle
for the same film is already in the library.

How it matches: SubNexa never changes timestamps, so a library subtitle has the same cue
start times as the English file it was translated from. We compare the start times of the
uploaded SRT with those of each library subtitle (allowing a constant offset or a frame
rate change). Subtitle text is never compared or sent anywhere.

This module only READS the library (Supabase items saved by subnexa_library_auto, plus the
older local SQLite items). It adds no columns and changes no existing library code. Start
times of library files are fetched once and cached in memory.

Routes (signed-in users only):
  POST /library-match/check                    upload an SRT, get the best match or null
  GET  /library-match/download/{source}/{id}   download the matched library subtitle
"""
from __future__ import annotations

import bisect
import collections
import concurrent.futures as cf
import difflib
import os
import re
import sqlite3
import statistics
import threading
import time
from contextlib import closing
from urllib.parse import quote

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response

router = APIRouter(prefix="/library-match", tags=["library-match"])

MAX_BYTES = 2 * 1024 * 1024
MIN_CUES = 30                    # tiny files are too easy to match by accident
TOLERANCE_MS = 300               # a cue start within this distance counts as the same cue
LIKELY_SCORE = 0.90              # share of uploaded cues that must line up
EXACT_SCORE = 0.97
EXACT_OFFSET_MS = 100            # "exact" also needs (almost) no shift and no rate change
MAX_OFFSET_MS = 30_000
SCALES = (1.0, 25 / 23.976, 23.976 / 25)   # same speed, 23.976->25 fps, 25->23.976 fps
FETCH_BUDGET_S = 6.0             # wait at most this long for uncached library files
FETCH_MAX_PER_CHECK = 60
CACHE_MAX = 3000
CHECKS_PER_WINDOW = 20
WINDOW_S = 600

_UUID = re.compile(r"[0-9a-fA-F-]{36}")
_TIME = re.compile(r"(\d+):(\d\d):(\d\d)[,.](\d{1,3})")
_SRT_LINE = re.compile(r"^\s*(\d+:\d\d:\d\d[,.]\d{1,3})\s*-->", re.M)

_cache: dict[tuple[str, str], tuple[float, list[int]]] = {}
_cache_lock = threading.Lock()
_pool = cf.ThreadPoolExecutor(max_workers=6, thread_name_prefix="library-match")
_hits: dict[str, list[float]] = {}


# ---------------------------------------------------------------- parsing

def _to_ms(value: str) -> int | None:
    m = _TIME.fullmatch(value.strip())
    if not m:
        return None
    h, mi, s, frac = m.groups()
    return ((int(h) * 60 + int(mi)) * 60 + int(s)) * 1000 + int(frac.ljust(3, "0"))


def starts_from_text(text: str, fmt: str = "srt") -> list[int]:
    """Sorted cue start times in milliseconds from SRT or ASS text."""
    text = text.replace("\ufeff", "")
    values: list[int] = []
    if fmt == "ass":
        fields = ["Layer", "Start", "End", "Style", "Name", "MarginL", "MarginR", "MarginV", "Effect", "Text"]
        in_events = False
        for line in text.splitlines():
            if re.match(r"^\s*\[", line):
                in_events = bool(re.match(r"^\s*\[Events\]", line, re.I))
                continue
            if not in_events:
                continue
            if re.match(r"^Format:", line, re.I):
                fields = [f.strip() for f in line.split(":", 1)[1].split(",")]
            elif re.match(r"^Dialogue:", line, re.I) and "Start" in fields:
                parts = line.split(":", 1)[1].lstrip().split(",", len(fields) - 1)
                if len(parts) == len(fields):
                    ms = _to_ms(parts[fields.index("Start")])
                    if ms is not None:
                        values.append(ms)
    else:
        for raw in _SRT_LINE.findall(text):
            ms = _to_ms(raw)
            if ms is not None:
                values.append(ms)
    return sorted(values)


# ---------------------------------------------------------------- matching

def align(upload: list[int], cand: list[int]) -> tuple[float, int, float]:
    """Best (score, offset_ms, scale) of `upload` start times against `cand` start times.

    score = share of uploaded cues that land within TOLERANCE_MS of a candidate cue after
    shifting by offset_ms. Gates and offset voting keep this cheap.
    """
    if len(upload) < 2 or len(cand) < 2:
        return 0.0, 0, 1.0
    span_u, span_c = upload[-1] - upload[0], cand[-1] - cand[0]
    if span_u <= 0 or span_c <= 0 or not 0.6 <= len(cand) / len(upload) <= 1.6:
        return 0.0, 0, 1.0
    best = (0.0, 0, 1.0)
    step = max(1, len(upload) // 80)
    for scale in SCALES:
        if not 0.9 <= span_c / (span_u * scale) <= 1.1:   # film length must roughly agree
            continue
        scaled = [x * scale for x in upload]
        votes: collections.Counter = collections.Counter()
        diffs: dict[int, list[float]] = collections.defaultdict(list)
        for x in scaled[::step]:
            lo = bisect.bisect_left(cand, x - MAX_OFFSET_MS)
            hi = bisect.bisect_right(cand, x + MAX_OFFSET_MS)
            for c in cand[lo:hi]:
                d = c - x
                bucket = round(d / 100)
                votes[bucket] += 1
                diffs[bucket].append(d)
        if not votes:
            continue
        top = votes.most_common(1)[0][0]
        near = diffs[top] + diffs.get(top - 1, []) + diffs.get(top + 1, [])
        offset = statistics.median(near)
        hit = 0
        for x in scaled:
            target = x + offset
            i = bisect.bisect_left(cand, target)
            nearest = min((abs(cand[j] - target) for j in (i - 1, i) if 0 <= j < len(cand)), default=10**9)
            if nearest <= TOLERANCE_MS:
                hit += 1
        score = hit / len(upload)
        if score > best[0]:
            best = (score, int(round(offset)), scale)
    return best


def classify(score: float, offset: int, scale: float) -> str | None:
    if score >= EXACT_SCORE and abs(scale - 1) < 1e-9 and abs(offset) <= EXACT_OFFSET_MS:
        return "exact"
    if score >= LIKELY_SCORE:
        return "likely"
    return None


# ---------------------------------------------------------------- library sources

def _title_key(value: str) -> str:
    return " ".join(re.findall(r"[a-z0-9\u0d80-\u0dff]+", value.lower()))


def _supabase_candidates() -> list[dict]:
    import json
    from subnexa_library_auto import request
    _, raw = request("GET", "/rest/v1/subnexa_library_items?select=id,title,year,format,poster_type,translated_by&limit=1000")
    rows = json.loads(raw)
    out = []
    for row in rows if isinstance(rows, list) else []:
        rid, fmt = str(row.get("id", "")), row.get("format")
        if _UUID.fullmatch(rid) and fmt in ("srt", "ass"):
            out.append({"source": "supabase", "id": rid, "title": str(row.get("title") or ""),
                        "year": str(row.get("year") or ""), "format": fmt,
                        "translated_by": row.get("translated_by"),
                        "poster_url": f"/library/items/{rid}/poster" if row.get("poster_type") else None})
    return out


def _local_candidates() -> list[dict]:
    import subnexa_library as lib
    if not lib.DB_PATH.is_file():
        return []
    with closing(sqlite3.connect(lib.DB_PATH)) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT id,title,year,format,poster_type FROM items").fetchall()
    return [{"source": "local", "id": r["id"], "title": r["title"], "year": r["year"], "format": r["format"],
             "translated_by": None,
             "poster_url": f"/library/items/{r['id']}/poster" if r["poster_type"] else None} for r in rows]


def list_candidates() -> list[dict]:
    out: list[dict] = []
    # The live library is Supabase. The old local SQLite items are only checked when
    # SUBNEXA_MATCH_INCLUDE_LOCAL=1, so test leftovers on a dev machine are not offered.
    loaders = [_supabase_candidates] + ([_local_candidates] if os.getenv("SUBNEXA_MATCH_INCLUDE_LOCAL") == "1" else [])
    for loader in loaders:
        try:
            out.extend(loader())
        except Exception as error:  # one broken source must not block the other
            print(f"[SubNexa Library Match] {loader.__name__} unavailable: {type(error).__name__}", flush=True)
    return out


def _load_text(cand: dict) -> str:
    if cand["source"] == "supabase":
        from subnexa_library_auto import request, BUCKET
        _, body = request("GET", f"/storage/v1/object/authenticated/{BUCKET}/{cand['id']}/subtitle.{cand['format']}")
        return body.decode("utf-8-sig")
    import subnexa_library as lib
    return (lib.FILES_DIR / f"{int(cand['id'])}.sub.{cand['format']}").read_bytes().decode("utf-8-sig")


def _fingerprint(cand: dict) -> list[int] | None:
    """Start times of a library file, cached (files never change once published)."""
    key = (cand["source"], str(cand["id"]))
    with _cache_lock:
        hit = _cache.get(key)
    if hit and (hit[1] or time.time() - hit[0] < 300):      # failures are retried after 5 min
        return hit[1] or None
    try:
        starts = starts_from_text(_load_text(cand), cand["format"])
    except Exception as error:
        print(f"[SubNexa Library Match] could not read an item: {type(error).__name__}", flush=True)
        starts = []
    with _cache_lock:
        if len(_cache) >= CACHE_MAX:
            _cache.pop(next(iter(_cache)))
        _cache[key] = (time.time(), starts)
    return starts or None


def _cached(cand: dict) -> list[int] | None:
    with _cache_lock:
        hit = _cache.get((cand["source"], str(cand["id"])))
    return hit[1] if hit and hit[1] else None


def find_match(upload_starts: list[int], filename: str = "") -> dict | None:
    cands = list_candidates()
    want = _title_key(re.sub(r"\.(srt|ass)$", "", filename or "", flags=re.I))
    pending = [c for c in cands if _cached(c) is None]
    pending.sort(key=lambda c: -difflib.SequenceMatcher(None, want, _title_key(f"{c['title']} {c['year']}")).ratio())
    futures = [_pool.submit(_fingerprint, c) for c in pending[:FETCH_MAX_PER_CHECK]]
    if futures:
        cf.wait(futures, timeout=FETCH_BUDGET_S)   # stragglers keep running and fill the cache
    best = None
    for cand in cands:
        starts = _cached(cand)
        if not starts:
            continue
        score, offset, scale = align(upload_starts, starts)
        kind = classify(score, offset, scale)
        if kind and (best is None or score > best[0]):
            best = (score, offset, scale, kind, cand)
    if not best:
        return None
    score, offset, scale, kind, cand = best
    return {**{k: cand[k] for k in ("source", "id", "title", "year", "format", "translated_by", "poster_url")},
            "confidence": kind, "score": round(score, 3), "offset_ms": offset, "scale": round(scale, 5)}


# ---------------------------------------------------------------- routes

def _signed_in(request: Request) -> dict:
    from subnexa_auth import _user
    user = _user(request)
    if not user or not isinstance(user.get("sub"), str):
        raise HTTPException(status_code=401, detail="Sign in to check the library")
    return user


def _throttle(sub: str) -> None:
    now = time.time()
    recent = [t for t in _hits.get(sub, []) if now - t < WINDOW_S]
    if len(recent) >= CHECKS_PER_WINDOW:
        raise HTTPException(status_code=429, detail="Too many library checks. Try again in a few minutes.")
    recent.append(now)
    _hits[sub] = recent


@router.post("/check")
async def check(request: Request, file: UploadFile = File(...)):
    user = _signed_in(request)
    _throttle(user["sub"])
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Maximum file size is 2 MB.")
    try:
        starts = starts_from_text(data.decode("utf-8-sig"), "srt")
    except UnicodeDecodeError:
        return {"match": None}
    if len(starts) < MIN_CUES:
        return {"match": None}
    return {"match": await run_in_threadpool(find_match, starts, file.filename or "")}


def _safe_name(title: str, fmt: str) -> str:
    stem = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", title).strip(" .") or "subtitles"
    return f"{stem}_sinhala_by_subnexa_ai.{fmt}"


@router.get("/download/{source}/{item_id}")
def download(source: str, item_id: str, request: Request):
    _signed_in(request)
    cand = next((c for c in list_candidates() if c["source"] == source and str(c["id"]) == item_id), None)
    if not cand:                      # only items that really are in the library
        raise HTTPException(status_code=404, detail="Subtitle not found.")
    try:
        text = _load_text(cand)
    except Exception:
        raise HTTPException(status_code=404, detail="Subtitle file is missing.")
    mime = "application/x-subrip" if cand["format"] == "srt" else "text/x-ssa"
    return Response(
        content=text.encode("utf-8"),
        media_type=f"{mime}; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=\"subnexa_{cand['id']}.{cand['format']}\"; "
                                        f"filename*=UTF-8''{quote(_safe_name(cand['title'], cand['format']))}",
                 "X-Content-Type-Options": "nosniff"},
    )
