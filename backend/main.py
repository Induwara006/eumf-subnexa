
from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import srt
import asyncio
import json

from glossary_engine import parse_glossary, glossary_fingerprint, preview_glossary
from subtitle_export import render_subtitles, download_filename
from urllib.parse import quote


BATCHING_VERSION = "adaptive-v3.3-targeted"
GLOSSARY_PIPELINE_VERSION = "natural-ai-review-v3.9-meaning-dialogue"


class AdaptiveBatchPlanner:
    """Size batches by recent reliability and English dialogue length.

    The planner changes API request grouping only. It never modifies translations,
    timestamps, or cache identity; existing V3.1 progress is reusable.
    """

    INITIAL_LINES = 25
    MIN_LINES = 5
    MAX_LINES = 40
    MAX_ENGLISH_CHARS = 3200

    def __init__(self):
        self.target_lines = self.INITIAL_LINES

    def select(self, remaining, source_texts):
        """Return a nonempty prefix of uncached subtitle positions."""
        batch = []
        total_chars = 0
        for index in remaining:
            n_chars = len(source_texts[index])
            if batch and (
                len(batch) >= self.target_lines
                or total_chars + n_chars > self.MAX_ENGLISH_CHARS
            ):
                break
            batch.append(index)
            total_chars += n_chars
        return batch

    def success(self):
        # Grow cautiously after a clean batch, never exceeding the hard cap.
        self.target_lines = min(self.MAX_LINES, self.target_lines + 10)

    def shrink(self, failed_count):
        # After a malformed output, keep later batches small instead of
        # repeatedly testing the same oversized input length.
        self.target_lines = max(self.MIN_LINES, min(self.target_lines // 2,
                                                    max(self.MIN_LINES, failed_count // 2)))


def _is_transient(error):
    details = str(error).upper()
    return "503" in details or "UNAVAILABLE" in details


def _is_quota(error):
    details = str(error).upper()
    return "429" in details or "RESOURCE_EXHAUSTED" in details


def _can_split(error):
    """Only halve outputs that may improve with fewer entries.

    Quota exhaustion, unavailable models, permission/authentication failures and
    unknown network errors must not trigger a cascade of paid/free-tier calls.
    """
    details = str(error).upper()
    if _is_quota(error) or _is_transient(error):
        return False
    if any(marker in details for marker in (
        "404", "NOT_FOUND", "401", "UNAUTHENTICATED",
        "403", "PERMISSION_DENIED", "API_KEY",
    )):
        return False
    return isinstance(error, ValueError) or any(marker in details for marker in (
        "TOKEN LIMIT", "CONTEXT LENGTH", "REQUEST TOO LARGE", "INPUT TOO LONG"
    ))

def _neighbor_context(indexes, source_texts):
    """A small English scene window for EVERY batch, not only tiny retries.

    This improves speaker/register continuity at adaptive batch boundaries
    without translating the context lines or sending an extra API request.
    """
    if not indexes:
        return None
    first, last = min(indexes), max(indexes)
    near = list(range(max(0, first - 2), first))
    near += list(range(last + 1, min(len(source_texts), last + 3)))
    selected = set(indexes)
    neighbors = [
        {"entry": pos + 1, "english": source_texts[pos]}
        for pos in near if pos not in selected and source_texts[pos].strip()
    ]
    return neighbors or None


from progress_store import get_job_id, save_progress, load_progress, PIPELINE_VERSION

app = FastAPI(title="EUMF SubNexa API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {"message": "EUMF SubNexa Backend is working!"}


@app.get("/health")
def health():
    return {"status": "OK", "project": "EUMF SubNexa"}


@app.post("/upload")
async def upload_subtitle(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".srt"):
        raise HTTPException(
            status_code=400,
            detail="Please upload an SRT file."
        )

    content = await file.read(2 * 1024 * 1024 + 1)

    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="File is too large. Maximum size is 2 MB."
        )

    try:
        subtitle_text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400,
            detail="Please upload a UTF-8 encoded SRT file."
        )

    try:
        subtitles = list(srt.parse(subtitle_text))
    except srt.SRTParseError:
        raise HTTPException(
            status_code=400,
            detail="Invalid SRT subtitle format."
        )

    if not subtitles:
        raise HTTPException(
            status_code=400,
            detail="No subtitles found."
        )

    return {
        "filename": file.filename,
        "message": "Subtitle uploaded successfully!",
        "total_subtitles": len(subtitles),
        "preview": subtitle_text[:500],
        "subtitles": [
            {
                "number": sub.index,
                "start": str(sub.start),
                "end": str(sub.end),
                "text": sub.content
            }
            for sub in subtitles[:5]
        ]
    }


from pydantic import BaseModel
from translator import translate_to_sinhala
from translator import translate_batch_to_sinhala, PartialBatchTranslationError


class TranslationRequest(BaseModel):
    text: str
    style: str = "natural"
    glossary: list[dict] | None = None


class GlossaryPreviewRequest(BaseModel):
    text: str
    glossary: list[dict]


@app.post("/glossary/preview")
def glossary_preview(request: GlossaryPreviewRequest):
    try:
        rules = parse_glossary(request.glossary)
        if len(request.text) > 10000:
            raise ValueError("Preview text must be at most 10,000 characters.")
        return preview_glossary(request.text, rules)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error



@app.post("/translate")
async def translate_subtitle(request: TranslationRequest):
    if not request.text.strip():
        raise HTTPException(
            status_code=400,
            detail="Please provide English text."
        )

    try:
        from subnexa_fairuse import account
        import hashlib
        await asyncio.to_thread(account, "file", hashlib.sha256((request.text + request.style + str(request.glossary)).encode()).hexdigest())
        rules = parse_glossary(request.glossary)
        sinhala_text = await translate_to_sinhala(
            request.text,
            request.style,
            glossary=rules
        )

        return {
            "english": request.text,
            "sinhala": sinhala_text,
            "style": request.style
        }

    except ValueError as error:
        if "GEMINI_API_KEY" in str(error):
            raise HTTPException(status_code=503, detail="AI translation is not configured.")
        raise HTTPException(status_code=400, detail=str(error)) from error
from fastapi import Form
from fastapi.responses import Response
from urllib.error import URLError, HTTPError


@app.post("/translate-srt")
async def translate_srt(
    file: UploadFile = File(...),
    style: str = Form("natural"),
    glossary: str = Form("[]"),
    output_format: str = Form("srt"),
    opening_credit: bool = Form(False)
):
    if not file.filename or not file.filename.lower().endswith(".srt"):
        raise HTTPException(status_code=400, detail="Please upload an SRT file.")

    content = await file.read(2 * 1024 * 1024 + 1)

    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Maximum file size is 2 MB.")

    from subnexa_fairuse import account
    import hashlib
    await asyncio.to_thread(account, "file", hashlib.sha256(content + style.encode() + glossary.encode()).hexdigest())

    try:
        subtitle_text = content.decode("utf-8-sig")
        subtitles = list(srt.parse(subtitle_text))
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="SRT must be UTF-8 encoded.")
    except srt.SRTParseError:
        raise HTTPException(status_code=400, detail="Invalid SRT format.")

    if not subtitles:
        raise HTTPException(status_code=400, detail="No subtitles found.")

   
    if len(subtitles) > 1500:
        raise HTTPException(
            status_code=400,
            detail="Maximum 1500 subtitles allowed."
        )

    try:
        glossary_rules = parse_glossary(glossary)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    if output_format not in ("srt", "ass"):
        raise HTTPException(status_code=400, detail="Output format must be srt or ass.")


    


    # The non-streaming endpoint uses the same adaptive planning as SSE.
    original_texts = [sub.content for sub in subtitles]
    remaining = [i for i, text in enumerate(original_texts) if text.strip()]
    planner = AdaptiveBatchPlanner()
    while remaining:
        indexes = planner.select(remaining, original_texts)
        remaining = remaining[len(indexes):]
        queue = [indexes]
        had_split = False
        print(f"[SubNexa] adaptive batch: {len(indexes)} entries; "
              f"target={planner.target_lines}", flush=True)
        while queue:
            part = queue.pop(0)
            try:
                translations = await translate_batch_to_sinhala(
                    [original_texts[i] for i in part], style,
                    context_texts=_neighbor_context(part, original_texts),
                    glossary=glossary_rules
                )
                if len(translations) != len(part):
                    raise ValueError("Subtitle count mismatch")
            except PartialBatchTranslationError as error:
                for local_index, translation in error.valid_translations.items():
                    subtitles[part[local_index]].content = translation
                unresolved = [part[i] for i in error.invalid_indexes]
                print(f"[SubNexa] kept {len(error.valid_translations)} valid lines; "
                      f"retry only {len(unresolved)} bad line(s)", flush=True)
                if (len(part) <= 1 or not unresolved or
                        (error.cause is not None and
                         (_is_quota(error.cause) or _is_transient(error.cause)))):
                    raise HTTPException(
                        status_code=503,
                        detail="Quality repair could not finish the remaining subtitles."
                    ) from error
                had_split = True
                planner.shrink(len(part))
                queue = [[i] for i in unresolved] + queue
                continue
            except Exception as error:
                if _can_split(error) and len(part) > 1:
                    had_split = True
                    planner.shrink(len(part))
                    middle = len(part) // 2
                    print(f"[SubNexa] splitting {len(part)} entries: "
                          f"{type(error).__name__}: {error}", flush=True)
                    queue = [part[:middle], part[middle:]] + queue
                    continue
                print(f"[SubNexa] translation paused: {type(error).__name__}: "
                      f"{error}", flush=True)
                raise HTTPException(
                    status_code=503,
                    detail="Translation failed. Check backend terminal."
                ) from error
            for i, translated_text in zip(part, translations):
                subtitles[i].content = translated_text
        if not had_split:
            planner.success()


    rendered, _ = render_subtitles(subtitles, output_format, opening_credit)
    # Non-streaming API remains usable by existing clients; the web frontend
    # uses the streaming endpoint and picks its own download name manually.
    output_name = download_filename(file.filename, output_format)
    ascii_fallback = "subnexa_generated_by_subnexa_ai." + output_format
    mime = ("text/x-ssa" if output_format == "ass"
            else "application/x-subrip")
    return Response(
        content=rendered,
        media_type=f"{mime}; charset=utf-8",
        headers={"Content-Disposition": (
            f'attachment; filename="{ascii_fallback}"; '
            f"filename*=UTF-8''{quote(output_name)}"
        )}
    )

from fastapi.responses import StreamingResponse




# SubNexa V4.7 MODEL SELECTOR: configuration availability only, not live quota.
@app.get("/subnexa-models")
async def subnexa_models():
    from subnexa_model_router import availability
    from fastapi.responses import JSONResponse
    return JSONResponse({"available": availability(), "credits_verified": False},
                        headers={"Cache-Control": "no-store"})


@app.get("/quota")
async def quota_status(request: Request):
    from subnexa_auth import _user
    from subnexa_quota import snapshot
    from translator import MODEL
    from fastapi.responses import JSONResponse
    if not _user(request):  # Same signed-cookie check as translation controls.
        raise HTTPException(status_code=401, detail="Sign in to view quota")
    data = await asyncio.to_thread(snapshot, MODEL)
    return JSONResponse(data, headers={"Cache-Control": "no-store"})


# SubNexa V5.0 local single-process cooperative job controls.
# Multi-worker deployments need shared durable coordination and authenticated ownership.
import secrets
import hmac
from subnexa_auth import current_user_sub

_ACTIVE_TRANSLATIONS = {}

async def _translation_events(record):
    """Subscribers may disconnect without cancelling the paid translation job."""
    cursor = 0
    while True:
        async with record["condition"]:
            if cursor == len(record["events"]) and not record["done"]:
                try:
                    await asyncio.wait_for(record["condition"].wait(), timeout=10)
                except asyncio.TimeoutError:
                    pass
            events = record["events"][cursor:]
            cursor += len(events)
            done = record["done"]
        for chunk in events:
            yield chunk
        if done:
            return
        if not events:
            yield ": heartbeat\n\n"


def _translation_response(record):
    return StreamingResponse(_translation_events(record), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


class TranslationControlRequest(BaseModel):
    token: str
    action: str

@app.post("/translation/control")
async def control_translation(request: TranslationControlRequest, http_request: Request):
    # The Google middleware protects /translate* but intentionally does not wrap
    # /translation/control. Verify the signed session on this route explicitly.
    # Origin protection prevents cross-site form/fetch control requests.
    from subnexa_auth import _user, FRONTEND
    if http_request.headers.get("origin") != FRONTEND:
        raise HTTPException(status_code=403, detail="Untrusted origin")
    user = _user(http_request)
    if request.action not in ("pause", "stop"):
        raise HTTPException(status_code=400, detail="Unknown translation action")
    # Match an unpredictable server-issued token AND its authenticated owner.
    record = next((value for key, value in _ACTIVE_TRANSLATIONS.items()
                   if hmac.compare_digest(key, request.token)), None)
    if record is None:
        raise HTTPException(status_code=404, detail="Translation no longer active")
    if record["owner"] != user["sub"]:
        raise HTTPException(status_code=403, detail="Not your translation")
    record["action"] = request.action
    return {"accepted": True, "state": "stopping" if request.action == "stop" else "pausing"}

@app.post("/translate-srt-stream")
async def translate_srt_stream(
    http_request: Request,
    file: UploadFile = File(...),
    style: str = Form("natural"),
    glossary: str = Form("[]"),
    output_format: str = Form("srt"),
    opening_credit: bool = Form(False),
    model_choice: str = Form("subnexa_02")
):
    from subnexa_auth import _user
    signed_profile = _user(http_request)
    # Capture only verified identity needed by the detached producer; never take
    # author name/id from a form field or a frontend session JSON response.
    library_user = {"sub": signed_profile["sub"], "name": signed_profile.get("name", "")}
    # SubNexa V4.7: model choice is validated on the server, not trusted from UI.
    from subnexa_model_router import availability, VALID_MODES
    if model_choice not in VALID_MODES:
        raise HTTPException(status_code=400, detail="Unknown SubNexa AI model")
    if not availability()[model_choice]:
        raise HTTPException(status_code=503, detail=(
            "SubNexa 1.1 is not configured yet" if model_choice == "subnexa_11" else
            "SubNexa Pro (Gemini) is not configured yet" if model_choice == "subnexa_pro"
            else "SubNexa 0.2 (Cloudflare) is not configured yet"))
    # Validate file
    if not file.filename or not file.filename.lower().endswith(".srt"):
        raise HTTPException(
            status_code=400,
            detail="Please upload an SRT file."
        )

    content = await file.read(2 * 1024 * 1024 + 1)

    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="Maximum file size is 2 MB."
        )

    try:
        subtitle_text = content.decode("utf-8-sig")
        subtitles = list(srt.parse(subtitle_text))
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400,
            detail="SRT must be UTF-8 encoded."
        )
    except srt.SRTParseError:
        raise HTTPException(
            status_code=400,
            detail="Invalid SRT format."
        )

    if not subtitles:
        raise HTTPException(
            status_code=400,
            detail="No subtitles found."
        )

    # SubNexa 0.2 supports 2,000+ subtitle lines by processing multiple safe batches.
    # SubNexa Pro accepts up to 2,500 entries using its existing adaptive batches.
    max_subtitles = 5000 if model_choice == "subnexa_02" else 2500
    if len(subtitles) > max_subtitles:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {max_subtitles} subtitles allowed."
        )

    try:
        glossary_rules = parse_glossary(glossary)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    if output_format not in ("srt", "ass"):
        raise HTTPException(status_code=400, detail="Output format must be srt or ass.")





    vps_cache = ""
    if model_choice == "subnexa_11":
        from subnexa_vps import cache_fingerprint
        vps_cache = ":" + cache_fingerprint()
    job_id = get_job_id(content, style, pipeline_version=(
        GLOSSARY_PIPELINE_VERSION + ":" + glossary_fingerprint(glossary_rules) + ":model:" + model_choice + vps_cache
    ))

    # Issue a unique token per active browser stream. Never use a guessed/cached job ID
    # as authority for interruption. Block duplicate active streams for the same cache.
    from subnexa_auth import current_user_sub
    owner = current_user_sub()
    if owner != library_user["sub"]:
        raise HTTPException(status_code=401, detail="Translation session mismatch")
    for rec in _ACTIVE_TRANSLATIONS.values():
        if rec["job_id"] != job_id:
            continue
        if rec["owner"] != owner:
            raise HTTPException(status_code=409, detail="This subtitle translation is already running")
        if rec["export"] != (output_format, opening_credit):
            raise HTTPException(status_code=409, detail="Resume with the same output format and credit setting")
        return _translation_response(rec)
    from subnexa_fairuse import account
    await asyncio.to_thread(account, "file", job_id)
    # Recheck after the database await: another request may have started the job.
    for rec in _ACTIVE_TRANSLATIONS.values():
        if rec["job_id"] != job_id:
            continue
        if rec["owner"] != owner:
            raise HTTPException(status_code=409, detail="This subtitle translation is already running")
        if rec["export"] != (output_format, opening_credit):
            raise HTTPException(status_code=409, detail="Resume with the same output format and credit setting")
        return _translation_response(rec)
    control_token = secrets.token_urlsafe(32)
    control_record = {"job_id": job_id, "owner": owner, "action": None,
                      "export": (output_format, opening_credit), "events": [],
                      "condition": asyncio.Condition(), "done": False}
    _ACTIVE_TRANSLATIONS[control_token] = control_record

    async def generate_progress():
        # Per-job provider state: inherited by translator worker tasks/threads,
        # never shared with another Google user or simultaneous SRT request.
        from subnexa_failover import start_job, take_switch_notice
        start_job()
        total = len(subtitles)
        originals = [sub.content for sub in subtitles]
        saved = load_progress(job_id)
        # Ignore stray/out-of-range/corrupt cache items without deleting the file.
        saved = {
            str(i): saved[str(i)] for i in range(total)
            if str(i) in saved and isinstance(saved[str(i)], str)
        }
        print(f"[SubNexa] pipeline={GLOSSARY_PIPELINE_VERSION} "
              f"batching={BATCHING_VERSION} job={job_id[:10]} "
              f"cached={len(saved)}", flush=True)

        for i, sub in enumerate(subtitles):
            if str(i) in saved:
                sub.content = saved[str(i)]
            elif not originals[i].strip():
                # Empty subtitle entries do not require a paid API request.
                saved[str(i)] = originals[i]

        def event(kind, **data):
            return "data: " + json.dumps(
                {"type": kind, **data}, ensure_ascii=False
            ) + "\n\n"

        completed = len(saved)
        yield event("resume_status", resumed=completed > 0,
                    completed=completed, total=total, control_token=control_token)

        def interruption_event(action_override=None, reason=None):
            # Only exported completed nonblank translations; keep original timestamps.
            partial = [srt.Subtitle(index=i + 1, start=sub.start, end=sub.end,
                                    content=saved[str(i)])
                       for i, sub in enumerate(subtitles)
                       if str(i) in saved and saved[str(i)].strip()]
            content = srt.compose(partial, reindex=True) if partial else ""
            name = download_filename(file.filename, "srt")
            name = name.removesuffix("_generated_by_subnexa_ai.srt")
            name = f"{name}_draft_{len(partial)}_of_{total}.srt"
            return event("interrupted", action=action_override or control_record["action"] or "paused",
                         completed=len(saved), total=total, draft_count=len(partial),
                         filename=name, content=content, reason=reason)

        yield event("progress", completed=completed, total=total)
        yield event("activity", stage="ready", message="Translation job ready",
                    completed=completed, total=total)
        if glossary_rules:
            yield event("activity", stage="glossary", count=len(glossary_rules))
            print(f"[SubNexa Glossary] {len(glossary_rules)} rules active", flush=True)

        # SubNexa V4.8 CLOUDFLARE NORMAL: up to 1,000 lines per request,
        # reduced by conservative text budget to avoid truncated Cloudflare JSON.
        # Gemini's existing adaptive planner is unchanged.
        from subnexa_model_router import selected_mode
        from subnexa_cf_normal_v48 import select_cloudflare_batch
        cf_normal = selected_mode() == "subnexa_02"
        vps_mode = selected_mode() == "subnexa_11"
        from subnexa_vps import select_batch as select_vps_batch
        remaining = [i for i in range(total) if str(i) not in saved]
        planner = AdaptiveBatchPlanner()
        deferred = set()
        final_repair_pass = False
        planned_batches = 0
        pro_mode = selected_mode() == "subnexa_pro"
        if pro_mode:
            from subnexa_usage import snapshot
            yield event("activity", stage="gemini_usage", count=await asyncio.to_thread(snapshot))
            from subnexa_quota import snapshot as quota_snapshot
            from translator import MODEL
            yield event("activity", stage="quota", count=await asyncio.to_thread(quota_snapshot, MODEL))
        while remaining:
            if control_record["action"]:
                save_progress(job_id, saved)
                yield interruption_event()
                return
            if pro_mode and total > 100 and planned_batches and planned_batches % 5 == 0:
                for seconds in range(30, 0, -1):
                    if control_record["action"]:
                        save_progress(job_id, saved)
                        yield interruption_event()
                        return
                    yield event("activity", stage="batch_cooldown", count=seconds)
                    await asyncio.sleep(1)
                yield event("activity", stage="batch_cooldown", count=0)
            planned_batches += 1
            indexes = (select_vps_batch(remaining, originals) if vps_mode else
                       select_cloudflare_batch(remaining, originals) if cf_normal
                       else planner.select(remaining, originals))
            remaining = remaining[len(indexes):]
            queue = [indexes]
            had_split = False
            print(f"[SubNexa] adaptive batch: {len(indexes)} entries "
                  f"(target={5 if vps_mode else 1000 if cf_normal else planner.target_lines}, "
                  f"english_chars={sum(len(originals[i]) for i in indexes)})",
                  flush=True)
            # Existing frontend ignores unknown stages, but the normal
            # translation/review/progress events still render as before.
            yield event("activity", stage="batch_planned", count=len(indexes),
                        start=indexes[0] + 1, end=indexes[-1] + 1,
                        target=(5 if vps_mode else 1000 if cf_normal else planner.target_lines))

            while queue:
                if control_record["action"]:
                    save_progress(job_id, saved)
                    yield interruption_event()
                    return
                part = queue.pop(0)
                active = [i for i in part if str(i) not in saved]
                if not active:
                    continue

                texts = [originals[i] for i in active]
                try:
                    print(f"[SubNexa] translating + reviewing {len(active)} entries "
                          f"(starting {active[0] + 1})", flush=True)
                    for attempt in range(3):
                        try:
                            # Forward actual model-stage callbacks immediately as SSE.
                            stage_queue = asyncio.Queue()

                            stage_loop = asyncio.get_running_loop()
                            def on_stage(stage, count):
                                if control_record["action"] and stage == "rate_wait":
                                    raise RuntimeError("Translation control requested")
                                stage_loop.call_soon_threadsafe(stage_queue.put_nowait, (stage, count))

                            worker = asyncio.create_task(
                                translate_batch_to_sinhala(
                                    texts, style, on_stage=on_stage,
                                    context_texts=_neighbor_context(active, originals),
                                    glossary=glossary_rules
                                )
                            )
                            try:
                                while not worker.done() or not stage_queue.empty():
                                    try:
                                        stage, count = await asyncio.wait_for(
                                            stage_queue.get(), timeout=0.35
                                        )
                                    except asyncio.TimeoutError:
                                        continue
                                    yield event("activity", stage=stage, count=count,
                                                start=active[0] + 1,
                                                end=active[-1] + 1)
                                translations = await worker
                            finally:
                                if not worker.done():
                                    worker.cancel()
                            break
                        except Exception as error:
                            if _is_quota(error):
                                raise  # Waiting cannot reset daily quota.
                            if not _is_transient(error) or attempt == 2:
                                raise
                            wait_seconds = 5 * (2 ** attempt)
                            print(f"[SubNexa] Gemini busy; retry in "
                                  f"{wait_seconds}s", flush=True)
                            yield event("activity", stage="retry", count=len(active),
                                        seconds=wait_seconds)
                            await asyncio.sleep(wait_seconds)

                    if take_switch_notice():
                        yield event("activity", stage="provider_fallback",
                                    message="Gemini unavailable: continuing with Cloudflare backup",
                                    start=active[0] + 1, end=active[-1] + 1,
                                    completed=len(saved), total=total)
                    if len(translations) != len(active):
                        raise ValueError("Subtitle count mismatch")
                    if any(not isinstance(value, str) or not value.strip()
                           for value in translations):
                        raise ValueError("AI returned empty/invalid subtitle text")

                except PartialBatchTranslationError as error:
                    # Preserve valid entries immediately; a bad repair should
                    # never make us pay to translate the other 39 lines again.
                    for local_index, translated_text in error.valid_translations.items():
                        source_index = active[local_index]
                        subtitles[source_index].content = translated_text
                        saved[str(source_index)] = translated_text
                    save_progress(job_id, saved)
                    if error.valid_translations:
                        yield event("activity", stage="saved",
                                    count=len(error.valid_translations))
                        yield event("progress", completed=len(saved), total=total)

                    if control_record["action"]:
                        yield interruption_event()
                        return

                    unresolved = [active[i] for i in error.invalid_indexes]
                    print(f"[SubNexa] preserved {len(error.valid_translations)} "
                          f"valid lines; targeted retry for "
                          f"{len(unresolved)} line(s): "
                          f"{[i + 1 for i in unresolved]}", flush=True)
                    # If the repair request itself hit an API outage/quota,
                    # pause. Retrying other lines now would waste requests.
                    hard_failure = (
                        error.cause is not None and
                        (_is_quota(error.cause) or _is_transient(error.cause) or
                         not _can_split(error.cause))
                    )
                    if unresolved and len(active) > 1 and not hard_failure:
                        had_split = True
                        planner.shrink(len(active))
                        yield event("activity", stage="repair",
                                    count=len(unresolved),
                                    start=unresolved[0] + 1,
                                    end=unresolved[-1] + 1)
                        # Each unresolved subtitle is retried independently.
                        # The good entries will never be retranslated.
                        queue = [[i] for i in unresolved] + queue
                        continue
                    if unresolved and not hard_failure and selected_mode() in ("subnexa_pro", "subnexa_11"):
                        deferred.update(unresolved)
                        print(f"[SubNexa] deferred subtitle(s) "
                              f"{[i + 1 for i in unresolved]}; continuing pending work",
                              flush=True)
                        yield event("activity", stage="repair_deferred",
                                    count=len(unresolved))
                        continue
                    print(f"[SubNexa] paused: unrepaired subtitle(s) "
                          f"{[i + 1 for i in unresolved]}", flush=True)
                    yield event("activity", stage="failed", count=len(unresolved))
                    yield interruption_event("failed", str(error.cause) if isinstance(error.cause, FairUseError) else None)
                    return

                except Exception as error:
                    if control_record["action"]:
                        save_progress(job_id, saved)
                        yield interruption_event()
                        return
                    if (_can_split(error) or (cf_normal and getattr(error, "category", None) == "response")) and len(active) > 1:
                        had_split = True
                        planner.shrink(len(active))
                        middle = len(active) // 2
                        print(f"[SubNexa] splitting batch of {len(active)}: "
                              f"{type(error).__name__}: {error}; "
                              f"next_target={planner.target_lines}", flush=True)
                        yield event("activity", stage="split", count=len(active))
                        queue = [active[:middle], active[middle:]] + queue
                        continue

                    print(f"[SubNexa] translation paused near subtitle "
                          f"{active[0] + 1}: {type(error).__name__}: {error}",
                          flush=True)
                    save_progress(job_id, saved)
                    yield event("activity", stage="failed", count=len(active))
                    yield interruption_event("failed", str(error) if isinstance(error, FairUseError) else None)
                    return

                for i, translated_text in zip(active, translations):
                    subtitles[i].content = translated_text
                    saved[str(i)] = translated_text
                print(f"[SubNexa] reviewed {len(translations)} entries", flush=True)
                yield event("activity", stage="batch_complete", count=len(translations),
                            start=active[0] + 1, end=active[-1] + 1)

                # Persist each successful subbatch before moving on.
                save_progress(job_id, saved)
                yield event("activity", stage="saved", count=len(translations))
                yield event("progress", completed=len(saved), total=total)
                await asyncio.sleep(0)
                if control_record["action"]:
                    yield interruption_event()
                    return

            if not had_split:
                planner.success()

            if not remaining and deferred and not final_repair_pass:
                remaining = sorted(i for i in deferred if str(i) not in saved)
                deferred.clear()
                final_repair_pass = True
                if remaining:
                    print(f"[SubNexa] final contextual repair: {len(remaining)} lines",
                          flush=True)
                    yield event("activity", stage="repair", count=len(remaining))

        if control_record["action"]:
            save_progress(job_id, saved)
            yield interruption_event()
            return
        pending = [i for i in range(total) if str(i) not in saved]
        if pending:
            save_progress(job_id, saved)
            print(f"[SubNexa] final repair incomplete; pending subtitle(s) "
                  f"{[i + 1 for i in pending]}", flush=True)
            yield event("activity", stage="failed", count=len(pending))
            yield interruption_event("failed")
            return
        rendered, credit_added = render_subtitles(
            subtitles, output_format, opening_credit
        )
        if opening_credit:
            yield event("activity", stage="credit_added" if credit_added
                        else "credit_skipped")
        yield event("activity", stage="library_saving", count=total)
        try:
            from subnexa_library_auto import publish_completed
            library_status = await asyncio.to_thread(
                publish_completed, user=library_user, job_id=job_id,
                original_filename=file.filename, content=rendered,
                output_format=output_format, opening_credit=opening_credit,
                completed=len(saved), total=total
            )
        except Exception as error:
            print(f"[SubNexa Library] publication failed: {type(error).__name__}", flush=True)
            library_status = {"saved": False, "reason": "library_unavailable"}
        yield event("activity", stage="library_saved" if library_status.get("saved") else "library_failed", count=total)
        yield event("activity", stage="done", count=total)
        # Include legacy 'srt' field only for SRT clients that expect it.
        data = {"content": rendered, "format": output_format,
                "opening_credit_added": credit_added, "library": library_status}
        if output_format == "srt":
            data["srt"] = rendered
        yield event("complete", **data)


    async def run_translation():
        from subnexa_model_router import set_mode, reset_mode
        token = set_mode(model_choice)
        try:
            async for chunk in generate_progress():
                async with control_record["condition"]:
                    control_record["events"].append(chunk)
                    control_record["condition"].notify_all()
        except Exception as error:
            print(f"[SubNexa] job failed: {type(error).__name__}", flush=True)
            async with control_record["condition"]:
                control_record["events"].append("data: " + json.dumps({
                    "type": "error", "message": "Translation interrupted. Resume to recover saved progress."
                }) + "\n\n")
        finally:
            async with control_record["condition"]:
                control_record["done"] = True
                control_record["condition"].notify_all()
            _ACTIVE_TRANSLATIONS.pop(control_token, None)
            reset_mode(token)

    # Strong reference retains the producer after an HTTP disconnect. It finishes
    # normally or responds to the existing authenticated Pause/Stop controls.
    control_record["task"] = asyncio.create_task(run_translation())
    return _translation_response(control_record)


# SubNexa V4.2 — consent-based user-owned Google Cloud Gemini keys
from subnexa_auth import router as subnexa_auth_router, UserKeyASGIMiddleware
app.include_router(subnexa_auth_router)
from subnexa_profile import router as subnexa_profile_router
app.include_router(subnexa_profile_router)
from subnexa_library import router as subnexa_library_router
app.include_router(subnexa_library_router)
from subnexa_library_match import router as subnexa_library_match_router
app.include_router(subnexa_library_match_router)
app.add_middleware(UserKeyASGIMiddleware)

from subnexa_fairuse import router as fairuse_router, FairUseError
from fastapi.responses import JSONResponse
app.include_router(fairuse_router)
@app.exception_handler(FairUseError)
async def fairuse_error(request: Request, exc: FairUseError):
    return JSONResponse(status_code=429, content={"detail": str(exc)}, headers={"Cache-Control": "no-store"})
