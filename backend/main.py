
from fastapi import FastAPI, UploadFile, File, HTTPException
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


@app.post("/translate-srt-stream")
async def translate_srt_stream(
    file: UploadFile = File(...),
    style: str = Form("natural"),
    glossary: str = Form("[]"),
    output_format: str = Form("srt"),
    opening_credit: bool = Form(False)
):
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





    job_id = get_job_id(content, style, pipeline_version=(
        GLOSSARY_PIPELINE_VERSION + ":" + glossary_fingerprint(glossary_rules)
    ))

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
                    completed=completed, total=total)
        yield event("progress", completed=completed, total=total)
        yield event("activity", stage="ready", message="Translation job ready",
                    completed=completed, total=total)
        if glossary_rules:
            yield event("activity", stage="glossary", count=len(glossary_rules))
            print(f"[SubNexa Glossary] {len(glossary_rules)} rules active", flush=True)

        remaining = [i for i in range(total) if str(i) not in saved]
        planner = AdaptiveBatchPlanner()
        while remaining:
            indexes = planner.select(remaining, originals)
            remaining = remaining[len(indexes):]
            queue = [indexes]
            had_split = False
            print(f"[SubNexa] adaptive batch: {len(indexes)} entries "
                  f"(target={planner.target_lines}, "
                  f"english_chars={sum(len(originals[i]) for i in indexes)})",
                  flush=True)
            # Existing frontend ignores unknown stages, but the normal
            # translation/review/progress events still render as before.
            yield event("activity", stage="batch_planned", count=len(indexes),
                        start=indexes[0] + 1, end=indexes[-1] + 1,
                        target=planner.target_lines)

            while queue:
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

                            def on_stage(stage, count):
                                stage_queue.put_nowait((stage, count))

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
                    print(f"[SubNexa] paused: unrepaired subtitle(s) "
                          f"{[i + 1 for i in unresolved]}", flush=True)
                    yield event("activity", stage="paused", count=len(unresolved))
                    yield event("error", message=(
                        "Translation paused. Valid subtitles are saved. "
                        "Try again later to resume."
                    ))
                    return

                except Exception as error:
                    if _can_split(error) and len(active) > 1:
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
                    yield event("activity", stage="paused", count=len(active))
                    yield event("error", message=(
                        "Translation paused. Completed subtitles are saved. "
                        "Try again later to resume."
                    ))
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

            if not had_split:
                planner.success()

        rendered, credit_added = render_subtitles(
            subtitles, output_format, opening_credit
        )
        if opening_credit:
            yield event("activity", stage="credit_added" if credit_added
                        else "credit_skipped")
        yield event("activity", stage="done", count=total)
        # Include legacy 'srt' field only for SRT clients that expect it.
        data = {"content": rendered, "format": output_format,
                "opening_credit_added": credit_added}
        if output_format == "srt":
            data["srt"] = rendered
        yield event("complete", **data)


    return StreamingResponse(
        generate_progress(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"
        }
    )


# SubNexa V4.2 — consent-based user-owned Google Cloud Gemini keys
from subnexa_auth import router as subnexa_auth_router, UserKeyASGIMiddleware
app.include_router(subnexa_auth_router)
app.add_middleware(UserKeyASGIMiddleware)
