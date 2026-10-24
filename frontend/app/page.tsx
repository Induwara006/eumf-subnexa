"use client";
import SubNexaProviderStatus from "../components/SubNexaProviderStatus";
import SubNexaAccountDock from "../components/SubNexaAccountDock";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import "./subnexa.css";
import "./subnexa-v43.css";
import "./subnexa-compact-ui.css";

const API = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

const STYLES = [
  { value: "natural", title: "Natural", desc: "Everyday Sinhala that reads smoothly" },
  { value: "casual", title: "Casual", desc: "Spoken Sinhala, as people really talk" },
  { value: "formal", title: "Formal", desc: "Written Sinhala for documentaries and news" },
];

type Activity = { id: number; label: string; detail: string; tone: "info" | "success" | "warn" };
type ExportFormat = "srt" | "ass";
type ReadyDownload = { content: string; originalContent: string; filename: string; format: ExportFormat; creditAdded: boolean; creditRequested: boolean };

type GlossaryMode = "never_translate" | "custom_translation";
type GlossaryRule = {
  source: string;
  target: string;
  mode: GlossaryMode;
  case_sensitive: boolean;
};

type GlossaryPreview = {
  source: string;
  masked: string;
  restored_example: string;
  replacements: { placeholder: string; restored: string }[];
  note: string;
};

const GLOSSARY_PRESETS: Record<string, GlossaryRule[]> = {
  "Sci-Fi / Marvel": [
    { source: "Tony Stark", target: "ටෝනි ස්ටාර්ක්", mode: "custom_translation", case_sensitive: false },
    { source: "Arc Reactor", target: "", mode: "never_translate", case_sensitive: false },
    { source: "Wakanda", target: "වකන්ඩා", mode: "custom_translation", case_sensitive: false },
  ],
  "Anime": [
    { source: "Naruto", target: "නරුටෝ", mode: "custom_translation", case_sensitive: false },
    { source: "senpai", target: "", mode: "never_translate", case_sensitive: false },
    { source: "sensei", target: "", mode: "never_translate", case_sensitive: false },
  ],
  "Sri Lankan Places": [
    { source: "Colombo", target: "කොළඹ", mode: "custom_translation", case_sensitive: false },
    { source: "Kandy", target: "මහනුවර", mode: "custom_translation", case_sensitive: false },
    { source: "Galle", target: "ගාල්ල", mode: "custom_translation", case_sensitive: false },
  ],
};

function validateGlossaryRules(value: unknown): GlossaryRule[] {
  if (!Array.isArray(value) || value.length > 200) throw new Error("Glossary must be a list of at most 200 rules.");
  const seen = new Set<string>();
  return value.map((item, i) => {
    if (!item || typeof item !== "object") throw new Error(`Rule ${i + 1} is invalid.`);
    const record = item as Record<string, unknown>;
    const source = typeof record.source === "string" ? record.source.trim() : "";
    const mode = record.mode;
    const target = typeof record.target === "string" ? record.target.trim() : "";
    const caseSensitive = record.case_sensitive ?? false;
    if (!source || source.length > 100 || source.includes("\n")) throw new Error(`Rule ${i + 1} needs a valid source term.`);
    if (mode !== "never_translate" && mode !== "custom_translation") throw new Error(`Rule ${i + 1} has an invalid mode.`);
    if (mode === "custom_translation" && !target) throw new Error(`Rule ${i + 1} needs a custom Sinhala term.`);
    if (target.length > 120 || target.includes("\n")) throw new Error(`Rule ${i + 1} has an invalid target.`);
    if (typeof caseSensitive !== "boolean") throw new Error(`Rule ${i + 1} has invalid case sensitivity.`);
    if (seen.has(source.toLowerCase())) throw new Error(`Duplicate glossary term: ${source}`);
    seen.add(source.toLowerCase());
    return { source, mode, target: mode === "never_translate" ? "" : target, case_sensitive: caseSensitive };
  });
}

function downloadGlossary(text: string, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function readCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { current += '"'; i++; }
      else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(current); current = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(current); current = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else current += c;
  }
  if (quoted) throw new Error("CSV contains an unfinished quoted field.");
  row.push(current);
  if (row.some(Boolean)) rows.push(row);
  return rows;
}


export default function Home() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"source" | "translated" | "compare">("source");
  const [sourceText, setSourceText] = useState("");
  const [cueSearch, setCueSearch] = useState("");
  const [jumpNumber, setJumpNumber] = useState("");
  const [jumpTarget, setJumpTarget] = useState<number | null>(null);
  const [previewNotice, setPreviewNotice] = useState("");
  const [editingCue, setEditingCue] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editError, setEditError] = useState("");
  const [editedIndices, setEditedIndices] = useState<number[]>([]);
  const [cinemaOpen, setCinemaOpen] = useState(false);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [backgroundDim, setBackgroundDim] = useState(78);
  const [readyCardVisible, setReadyCardVisible] = useState(true);
  const [help, setHelp] = useState(false);
  const [glossarySearch, setGlossarySearch] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [style, setStyle] = useState("natural");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("srt");
  const [openingCredit, setOpeningCredit] = useState(true);
  const [readyDownload, setReadyDownload] = useState<ReadyDownload | null>(null);
  const hasReadyDownload = readyDownload !== null;
  const [loading, setLoading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [preview, setPreview] = useState("");
  const [progress, setProgress] = useState(0);
  const [translatedCount, setTranslatedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [glossaryRules, setGlossaryRules] = useState<GlossaryRule[]>([]);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [glossaryDraft, setGlossaryDraft] = useState<GlossaryRule>({
    source: "", target: "", mode: "never_translate", case_sensitive: false,
  });
  const [editingRule, setEditingRule] = useState<number | null>(null);
  const [glossaryNotice, setGlossaryNotice] = useState("");
  const [playgroundInput, setPlaygroundInput] = useState("Tony Stark activated the Arc Reactor.");
  const [playgroundResult, setPlaygroundResult] = useState<GlossaryPreview | null>(null);
  const [playgroundLoading, setPlaygroundLoading] = useState(false);
  const [glossaryReady, setGlossaryReady] = useState(false);

  const activityEnd = useRef<HTMLDivElement>(null);
  const previewViewport = useRef<HTMLDivElement>(null);
  const readyCardRef = useRef<HTMLElement>(null);
  const nextActivityId = useRef(0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("subnexa-glossary-v1");
      if (saved) setGlossaryRules(validateGlossaryRules(JSON.parse(saved)));
    } catch { /* Invalid saved glossary is ignored, never submitted to backend. */ }
    setGlossaryReady(true);
  }, []);

  useEffect(() => {
    if (glossaryReady) localStorage.setItem("subnexa-glossary-v1", JSON.stringify(glossaryRules));
  }, [glossaryRules, glossaryReady]);

  useEffect(() => {
    try {
      const stored = Number(localStorage.getItem("subnexa-background-dim"));
      if (stored >= 50 && stored <= 95) setBackgroundDim(stored);
    } catch { /* local preferences are optional */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem("subnexa-background-dim", String(backgroundDim)); } catch { /* private mode */ }
  }, [backgroundDim]);

  useEffect(() => {
    const card = readyCardRef.current;
    if (!readyDownload || !card || typeof IntersectionObserver === "undefined") {
      setReadyCardVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setReadyCardVisible(entry.isIntersecting), { threshold: 0.15 });
    observer.observe(card);
    return () => observer.disconnect();
  }, [hasReadyDownload]);

  useEffect(() => {
    if (jumpTarget === null) return;
    const item = previewViewport.current?.querySelector(`[data-cue-index="${jumpTarget}"]`);
    item?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setJumpTarget(null);
  }, [jumpTarget, cueSearch, tab]);

  function saveGlossaryRule() {
    try {
      const next = [...glossaryRules];
      if (editingRule === null) next.push(glossaryDraft);
      else next[editingRule] = glossaryDraft;
      setGlossaryRules(validateGlossaryRules(next));
      setGlossaryDraft({ source: "", target: "", mode: "never_translate", case_sensitive: false });
      setEditingRule(null);
      setPlaygroundResult(null);
      setGlossaryNotice("Glossary rule saved.");
    } catch (err) { setGlossaryNotice(err instanceof Error ? err.message : "Invalid glossary rule."); }
  }

  async function importGlossary(file: File | null) {
    if (!file) return;
    try {
      const content = (await file.text()).replace(/^\uFEFF/, "");
      let imported: unknown;
      if (file.name.toLowerCase().endsWith(".csv")) {
        const rows = readCsv(content);
        const headers = rows.shift()?.map(x => x.trim().toLowerCase()) || [];
        if (!["source", "target", "mode", "case_sensitive"].every(h => headers.includes(h))) {
          throw new Error("CSV headers must be: source,target,mode,case_sensitive");
        }
        imported = rows.map(row => {
          const get = (name: string) => row[headers.indexOf(name)]?.trim() || "";
          return { source: get("source"), target: get("target"), mode: get("mode"),
                   case_sensitive: get("case_sensitive").toLowerCase() === "true" };
        });
      } else imported = JSON.parse(content);
      setGlossaryRules(validateGlossaryRules(imported));
      setPlaygroundResult(null);
      setGlossaryNotice(`Imported ${Array.isArray(imported) ? imported.length : 0} glossary rules.`);
    } catch (err) { setGlossaryNotice(err instanceof Error ? err.message : "Cannot import glossary."); }
  }

  function exportGlossary(format: "json" | "csv") {
    if (format === "json") {
      downloadGlossary(JSON.stringify(glossaryRules, null, 2), "subnexa_glossary.json", "application/json;charset=utf-8");
    } else {
      const header = "source,target,mode,case_sensitive";
      const lines = glossaryRules.map(r => [r.source, r.target, r.mode, String(r.case_sensitive)].map(csvCell).join(","));
      downloadGlossary([header, ...lines].join("\r\n"), "subnexa_glossary.csv", "text/csv;charset=utf-8");
    }
  }

  async function runGlossaryPreview() {
    setPlaygroundLoading(true);
    setGlossaryNotice("");
    try {
      const response = await fetch(`${API}/glossary/preview`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: playgroundInput, glossary: glossaryRules }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Glossary preview failed.");
      setPlaygroundResult(data as GlossaryPreview);
    } catch (err) { setGlossaryNotice(err instanceof Error ? err.message : "Cannot preview glossary."); }
    finally { setPlaygroundLoading(false); }
  }

  function logActivity(label: string, detail = "", tone: Activity["tone"] = "info") {
    setActivity((previous) => [...previous.slice(-59), {
      id: nextActivityId.current++, label, detail, tone,
    }]);
  }

  useEffect(() => {
    const log = activityEnd.current?.parentElement;
    if (log) log.scrollTop = log.scrollHeight;
  }, [activity]);

  function notify(text: string, error = false) {
    setMessage(text);
    setIsError(error);
  }

  function downloadTranslatedFile() {
    if (!readyDownload) return;
    const mime = readyDownload.format === "ass"
      ? "text/x-ssa;charset=utf-8"
      : "application/x-subrip;charset=utf-8";
    const url = URL.createObjectURL(new Blob([readyDownload.content], { type: mime }));
    const link = document.createElement("a");
    link.href = url;
    link.download = readyDownload.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function pickFile(f: File | null) {
    if (loading) return;
    if (f && editedIndices.length && !window.confirm("Your manual subtitle edits have not been downloaded. Replace this file anyway?")) return;
    if (f && f.size > 2 * 1024 * 1024) {
      notify("File is too large. Choose an SRT file under 2 MB.", true);
      return;
    }
    if (f && !f.name.toLowerCase().endsWith(".srt")) {
      notify("Only .srt files are supported.", true);
      return;
    }
    setFile(f);
    setReadyDownload(null);
    setSourceText("");
    setCueSearch("");
    setJumpNumber("");
    setEditingCue(null);
    setEditedIndices([]);
    setPreviewNotice("");
    setTab("source");
    setMessage("");
    setPreview("");
    setProgress(0);
    setTranslatedCount(0);
    setTotalCount(0);
    setResuming(false);
    setActivity([]);
  }

  async function handleUpload() {
    if (!file) {
      notify("Select an SRT file first.", true);
      return;
    }

    setLoading(true);
    notify("");
    setPreview("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string" ? data.detail : "Upload failed."
        );
      }

      notify("Subtitle file loaded.");
      setSourceText(await file.text());
      setPreview(data.preview || "");
      setTab("source");
      setTotalCount(typeof data.total_subtitles === "number" ? data.total_subtitles : 0);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Cannot connect to backend.",
        true
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleTranslate() {
    if (editedIndices.length && !window.confirm("Your manual subtitle edits have not been downloaded. Start a new translation anyway?")) return;
    if (!file) {
      notify("Select an SRT file first.", true);
      return;
    }

    // Preflight: do not reset edits/progress or send paid AI requests for an unlinked account.
    // The server is the authority; this is only a friendly early UX check.
    try {
      const statusReply = await fetch(`${API}/subnexa-auth/session`, {
        credentials: "include", cache: "no-store",
      });
      if (!statusReply.ok) throw new Error("Session endpoint unavailable");
      const account = await statusReply.json();
      if (account.signed_in !== true) {
        notify("Sign in with Google in the account panel before translating.", true);
        return;
      }
      if (account.connected !== true) {
        notify("AI provider not connected. Open the Google account panel to check your connection. No translation request was sent.", true);
        return;
      }
    } catch {
      notify("Cannot check AI connection. Verify the SubNexa backend is running, then try again. No translation request was sent.", true);
      return;
    }

    setReadyDownload(null);
    setEditingCue(null);
    setEditedIndices([]);
    setCueSearch("");
    setPreviewNotice("");
    setTab("source");
    setLoading(true);
    setTranslating(true);
    setProgress(0);
    setResuming(false);
    setTranslatedCount(0);
    setTotalCount(0);
    setActivity([]);
    logActivity("Starting translation", "Connecting to SubNexa AI...");
    notify("Starting translation...");

    try {
      setSourceText(await file.text());
      const formData = new FormData();
      formData.append("file", file);
      formData.append("style", style);
      formData.append("glossary", JSON.stringify(glossaryRules));
      formData.append("output_format", exportFormat);
      formData.append("opening_credit", String(openingCredit));

      const response = await fetch(`${API}/translate-srt-stream`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const detail = typeof data?.detail === "string" ? data.detail : "";
        if (response.status === 401) throw new Error("Google session expired. Please sign in again.");
        if (response.status === 403) throw new Error("AI connection unavailable for this account. Check provider status in the account panel.");
        if (response.status === 429) throw new Error("AI provider is rate-limiting requests. Previously saved progress can be resumed when capacity returns.");
        if (response.status >= 500) throw new Error("SubNexa server or AI provider is temporarily unavailable. Retry later with the same file to resume saved progress.");
        throw new Error(detail || `Translation failed (HTTP ${response.status}).`);
      }

      if (!response.body) {
        throw new Error("Streaming is not supported.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completed = false;

      function processEvent(line: string) {
        if (!line.startsWith("data: ")) return;

        const data = JSON.parse(line.slice(6));

        if (data.type === "activity") {
          const count = typeof data.count === "number" ? data.count : 0;
          const range = data.start && data.end ? `#${data.start}–#${data.end}` : "";
          switch (data.stage) {
            case "glossary":
              logActivity("Glossary protection enabled", `${count} rules loaded`, "success");
              break;
            case "ready":
              logActivity("Job initialized", `${data.total ?? 0} subtitles detected`);
              break;
            case "translation":
              logActivity("Translating", `${count} subtitles ${range}`);
              break;
            case "review":
              logActivity("AI quality review", `Checking ${count} Sinhala lines`);
              break;
            case "repair":
              logActivity("Repairing subtitles", `${count} line(s) need correction`, "warn");
              break;
            case "review_complete":
              logActivity("Review completed", `${count} lines checked`, "success");
              break;
            case "review_fallback":
              logActivity("Review unavailable", "Validated draft used", "warn");
              break;
            case "credit_added":
              logActivity("Opening credit added", "SubNexa AI credit placed before first subtitle", "success");
              break;
            case "credit_skipped":
              logActivity("Opening credit skipped", "No 5-second opening gap was available");
              break;
            case "batch_complete":
              logActivity("Batch completed", `${count} subtitles ${range}`, "success");
              break;
            case "saved":
              logActivity("Progress saved", "Safe to resume if interrupted", "success");
              break;
            case "retry":
              logActivity("AI temporarily busy", `Retrying in ${data.seconds ?? "a few"} seconds`, "warn");
              break;
            case "split":
              logActivity("Adjusting batch size", "Retesting a smaller batch", "warn");
              break;
            case "paused":
              logActivity("Translation paused", "Completed work was saved", "warn");
              break;
            case "done":
              logActivity("All subtitles complete", `${count} entries processed`, "success");
              break;
          }
        }

        if (data.type === "resume_status") {
          setResuming(data.resumed === true);
          if (data.resumed === true) {
            logActivity("Resuming saved translation", `${data.completed}/${data.total} already finished`, "success");
            notify(
              `Resuming from ${data.completed} of ${data.total} subtitles...`
            );
          }
        }

        if (data.type === "progress") {
          setTranslatedCount(data.completed);
          setTotalCount(data.total);
          setProgress(
            data.total > 0
              ? Math.round((data.completed / data.total) * 100)
              : 0
          );
          // Keep the resume message visible when loading saved work.
          if (data.completed === 0) {
            notify("Translating your subtitles...");
          }
        }

        if (data.type === "complete") {
          const content = data.content ?? data.srt;
          if (typeof content !== "string") {
            throw new Error("The server did not return a subtitle file.");
          }
          const finalFormat: ExportFormat = data.format === "ass" ? "ass" : "srt";
          const originalName = (file?.name ?? "subtitles.srt").replace(/\.srt$/i, "").trim() || "subtitles";
          const filename = `${originalName}_generated_by_subnexa_ai.${finalFormat}`;
          completed = true;
          setTab("translated");
          setProgress(100);
          setReadyDownload({ content, originalContent: content, filename, format: finalFormat,
                             creditAdded: data.opening_credit_added === true,
                             creditRequested: openingCredit });
          notify("Your file is ready! Click Download to save it.");
        }

        if (data.type === "error") {
          throw new Error(data.message || "Translation failed.");
        }
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) processEvent(line.trim());
      }

      buffer += decoder.decode();
      if (buffer.trim()) processEvent(buffer.trim());

      if (!completed) {
        throw new Error("Translation stopped before completion.");
      }
    } catch (error) {
      const rawReason = error instanceof Error ? error.message : "Cannot connect to backend.";
      const reason = rawReason === "Failed to fetch" || rawReason.includes("NetworkError")
        ? "Cannot reach translation server. Check backend URL, browser network and CORS settings."
        : rawReason;
      logActivity("Translation error", reason, "warn");
      notify(reason, true);
    } finally {
      setLoading(false);
      setTranslating(false);
    }
  }

  const showProgress = translating || progress > 0;
  const done = !translating && progress === 100 && !isError && readyDownload !== null;

  const statusTitle = translating
    ? resuming ? "Resuming translation" : "Translating"
    : done ? "Translation complete"
    : isError ? "Translation paused" : "Ready to translate";

  const sourceCues = useMemo(() => parseStudioCues(sourceText || preview, "srt"), [sourceText, preview]);
  const translatedCues = useMemo(() => parseStudioCues(readyDownload?.content || "", readyDownload?.format || "srt"), [readyDownload]);
  const cues = tab === "source" ? sourceCues : translatedCues;
  const matchedSource = (cue: StudioCue) => findSourceMatch(cue, sourceCues);
  const visibleIndices = useMemo(() => {
    const query = cueSearch.trim().toLocaleLowerCase();
    return cues.flatMap((cue, index) => {
      if (!query) return [index];
      const match = sourceCues.find(src => src.start === cue.start && src.end === cue.end) || findSourceMatch(cue, sourceCues);
      const combined = `${cue.number} ${cue.time} ${cue.text} ${match?.text ?? ""}`.toLocaleLowerCase();
      return combined.includes(query) ? [index] : [];
    });
  }, [cues, sourceCues, cueSearch]);
  const sceneCue = cues[sceneIndex] || cues[0];
  const sceneSource = sceneCue ? matchedSource(sceneCue) : undefined;
  const sceneIsCredit = tab !== "source" && readyDownload?.creditAdded && sceneCue && !sceneSource;
  const visibleGlossary = glossaryRules.map((rule, index) => ({ rule, index })).filter(x =>
    (x.rule.source + " " + x.rule.target).toLocaleLowerCase().includes(glossarySearch.toLocaleLowerCase()));
  const editing = editingRule !== null;

  function jumpToCue() {
    const target = Number(jumpNumber.trim());
    if (!Number.isInteger(target) || target <= 0) {
      setPreviewNotice("Enter a valid subtitle number.");
      return;
    }
    const index = cues.findIndex(cue => Number(cue.number) === target);
    const resolved = index !== -1 ? index : target <= cues.length ? target - 1 : -1;
    if (resolved < 0) { setPreviewNotice(`Subtitle #${target} is not available in this view.`); return; }
    setCueSearch("");
    setJumpTarget(resolved);
    setSceneIndex(resolved);
    setPreviewNotice(`Jumped to subtitle #${target}.`);
  }

  function startEditing(index: number) {
    if (!readyDownload || translating) return;
    const cue = translatedCues[index];
    if (!cue || (readyDownload.creditAdded && !matchedSource(cue))) return;
    setEditingCue(index);
    setEditDraft(cue.text);
    setEditError("");
  }

  function saveEditedCue(index: number) {
    if (!readyDownload) return;
    try {
      const edited = replaceStudioCue(readyDownload.content, readyDownload.format, index, editDraft);
      setReadyDownload({ ...readyDownload, content: edited });
      setEditedIndices(previous => previous.includes(index) ? previous : [...previous, index]);
      setEditingCue(null);
      setEditError("");
      setPreviewNotice(`Subtitle #${translatedCues[index]?.number ?? index + 1} saved. Download to keep your edits.`);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Could not save this subtitle.");
    }
  }

  function restoreAiOutput() {
    if (!readyDownload) return;
    setReadyDownload({ ...readyDownload, content: readyDownload.originalContent });
    setEditingCue(null);
    setEditedIndices([]);
    setPreviewNotice("All manual edits discarded; restored the AI output.");
  }

  function resetTranslationResult() {
    if (translating) return;
    setReadyDownload(null);
    setEditedIndices([]);
    setEditingCue(null);
    setProgress(0);
    setTranslatedCount(0);
    setResuming(false);
    setTab("source");
  }

  return (
    <div className="sn-app" style={{ "--sn-dim": backgroundDim / 100 } as CSSProperties}>
      <header className="sn-topbar">
        <div className="sn-brand" aria-label="SubNexa by EUMF">
          <svg width="29" height="28" viewBox="0 0 29 28" fill="none" aria-hidden="true"><path d="M3 5h23v15H15l-6 5v-5H3V5Z" stroke="currentColor" strokeWidth="1.8"/><path d="M8 11h13M8 15h8" stroke="currentColor" strokeWidth="1.8"/></svg>
          <span>SubNexa</span><span className="sn-by">by EUMF</span>
        </div>
        <div className="sn-top-actions">
          <span className="sn-scope">Subtitle studio</span>
          <button type="button" className="sn-quiet" onClick={() => setHelp(!help)} aria-expanded={help}>
            Quick guide <span aria-hidden="true">↗</span>
          </button>
        </div>
      </header>

      <main className="sn-main">
        <SubNexaAccountDock />
        <SubNexaProviderStatus apiBase={API} />
        <div className="sn-title-row">
          <div><h1>Translation workspace <span className="sn-pro-mark">PRO</span></h1><p>Bring the story into Sinhala. Keep every timestamp.</p></div>
          <div className="sn-title-controls">
            <details className="sn-backdrop-settings">
              <summary title="Poster background settings" aria-label="Poster background settings">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.04.04-2 2-.04-.04a1.7 1.7 0 0 0-1.88-.34l-.36.15V21h-3v-.06a1.7 1.7 0 0 0-1.16-1.61 1.7 1.7 0 0 0-1.86.38l-.04.04-2-2 .04-.04a1.7 1.7 0 0 0 .34-1.88L6.7 15H5v-3h1.7a1.7 1.7 0 0 0 .36-1.88l-.04-.04 2-2 .04.04a1.7 1.7 0 0 0 1.88.34L11.3 8V6h3v2l.36.15a1.7 1.7 0 0 0 1.88-.34l.04-.04 2 2-.04.04A1.7 1.7 0 0 0 18.2 12H20v3h-.6Z"/></svg>
              </summary>
              <div className="sn-backdrop-popover">
                <label htmlFor="sn-backdrop-range">Poster background <strong>{backgroundDim}%</strong></label>
                <input id="sn-backdrop-range" type="range" min={50} max={95} step={5} value={backgroundDim} aria-label="Poster background darkness" onChange={e => setBackgroundDim(Number(e.target.value))}/>
                <small>Adjust movie poster visibility</small>
              </div>
            </details>
            <div className="sn-language"><span>English</span><span aria-hidden="true">→</span><span lang="si">සිංහල</span></div>
          </div>
        </div>

        {help && <section className="sn-guide" aria-label="Quick guide">
          <h2>Your subtitle workflow</h2>
          <ol>
            <li>Choose a UTF-8 English .srt file (up to 2 MB), then preview it.</li>
            <li>Pick a Sinhala style, SRT or ASS output, and optional opening credit.</li>
            <li>Add glossary rules if you want to preserve special names or terms.</li>
            <li>Follow live progress, then compare, search or edit Sinhala subtitles before downloading.</li>
            <li>Click Download manually; your edits stay in the SRT/ASS file.</li>
          </ol>
          <p>To resume after interruption, translate the same file with the same settings and glossary.</p>
          <button type="button" className="sn-quiet" onClick={() => setHelp(false)}>Close guide</button>
        </section>}

        <div className="sn-workspace">
          <section className="sn-panel sn-setup" aria-labelledby="source-title">
            <div className="sn-section-head"><h2 id="source-title">Source subtitle</h2><span className="sn-meta">.srt</span></div>
            <button type="button" className={`sn-dropzone ${dragging ? "is-dragging" : ""}`}
              disabled={loading} onClick={() => fileInput.current?.click()}
              onDragOver={e => { e.preventDefault(); if (!loading) setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0] || null); }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M12 16V3m0 0L7 8m5-5 5 5M4 15v5h16v-5"/></svg>
              <strong>{file ? file.name : "Drop your subtitle here"}</strong>
              <span>{file ? `${(file.size / 1024).toFixed(1)} KB · Choose another file` : "or browse files"}</span>
              <small>English SRT · Up to 2 MB</small>
            </button>
            <input ref={fileInput} type="file" accept=".srt" className="sn-hidden" aria-label="Choose subtitle file"
              disabled={loading} onChange={e => { pickFile(e.target.files?.[0] || null); e.target.value = ""; }} />
            <button type="button" className="sn-secondary sn-preview-button" onClick={handleUpload} disabled={loading || !file}>
              {loading && !translating ? "Loading source…" : "Preview source"}<span aria-hidden="true">↗</span>
            </button>

            <fieldset className="sn-styles" disabled={loading}>
              <legend>Translation style</legend>
              {STYLES.map(s => <label key={s.value} className={`sn-style ${style === s.value ? "is-selected" : ""}`}>
                <input type="radio" name="style" checked={style === s.value} onChange={() => { setStyle(s.value); resetTranslationResult(); }} />
                <span><strong>{s.title}</strong><small>{s.desc}</small></span>
              </label>)}
            </fieldset>

            <div className="sn-setting-group">
              <div className="sn-field-title">Output format</div>
              <div className="sn-format-switch" role="radiogroup" aria-label="Output format">
                {(["srt", "ass"] as ExportFormat[]).map(fmt =>
                  <button type="button" role="radio" aria-checked={exportFormat === fmt} key={fmt}
                    className={`sn-format-option ${exportFormat === fmt ? "is-selected" : ""}`}
                    disabled={loading} onClick={() => { setExportFormat(fmt); resetTranslationResult(); }}>.{fmt.toUpperCase()}</button>)}
              </div>
              <p className="sn-setting-note">ASS can display red/white opening credits on compatible players. SRT uses plain text.</p>
              <label className="sn-check-option">
                <input type="checkbox" checked={openingCredit} disabled={loading}
                  onChange={e => { setOpeningCredit(e.target.checked); resetTranslationResult(); }} />
                <span><strong>Opening SubNexa AI credit</strong><small>Only added if there is a free 5-second opening gap; dialogue times stay unchanged.</small></span>
              </label>
            </div>

            <button type="button" className="sn-primary" onClick={handleTranslate} disabled={loading || !file}>
              {translating ? "Translating…" : "Translate to Sinhala"}<span aria-hidden="true">→</span>
            </button>
            <p className="sn-hint">{!file ? "Choose a file to begin." : `${glossaryRules.length} glossary rule(s) active · Timings protected`}</p>
            {message && <p role={isError ? "alert" : "status"} className={`sn-message ${isError ? "is-error" : ""}`}>{message}</p>}
          </section>

          <div className="sn-results">
            <section className="sn-panel sn-preview" aria-labelledby="preview-title">
              <div className="sn-section-head"><h2 id="preview-title">Subtitle studio <span className="sn-studio-tag">COMPARE · EDIT</span></h2><span className="sn-meta" title={file?.name || ""}>{file?.name || "No file selected"}</span></div>
              <div className="sn-preview-toolbar">
                <div className="sn-tabs" role="tablist" aria-label="Preview mode">
                  {([ ["source", "English source"], ["translated", "Sinhala output"], ["compare", "Side by side"] ] as const).map(([mode,label]) =>
                    <button type="button" role="tab" key={mode} id={`${mode}-tab`} aria-selected={tab === mode} tabIndex={tab === mode ? 0 : -1} aria-controls="subtitle-pane" onClick={() => { setTab(mode); setEditingCue(null); setSceneIndex(0); }}>{label}</button>)}
                </div>
                {readyDownload && <button type="button" className="sn-quiet sn-toolbar-download" onClick={downloadTranslatedFile}>Download .{readyDownload.format.toUpperCase()} ↓</button>}
              </div>
              <div className="sn-search-bar">
                <label className="sn-search-box"><span aria-hidden="true">⌕</span><input type="search" aria-label="Search subtitles" placeholder="Search English or Sinhala dialogue…" value={cueSearch} onChange={e => { setCueSearch(e.target.value); setEditingCue(null); }} /></label>
                <div className="sn-jump"><label htmlFor="sn-jump-number">Go to #</label><input id="sn-jump-number" type="number" min={1} step={1} placeholder="100" value={jumpNumber} onChange={e => setJumpNumber(e.target.value)} onKeyDown={e => { if (e.key === "Enter") jumpToCue(); }}/><button type="button" className="sn-outline-small" onClick={jumpToCue}>Go</button></div>
              </div>
              {previewNotice && <p role="status" className="sn-preview-notice">{previewNotice}</p>}
              <div id="subtitle-pane" ref={previewViewport} role="tabpanel" aria-labelledby={`${tab}-tab`} className={`sn-cue-area ${tab === "compare" ? "sn-cue-area-compare" : ""}`}>
                {cues.length && visibleIndices.length ? <div className="sn-cues">
                  {visibleIndices.map(i => {
                    const cue = cues[i];
                    const english = tab === "source" ? cue : matchedSource(cue);
                    const isCredit = tab !== "source" && readyDownload?.creditAdded && !english;
                    const canEdit = tab !== "source" && !!readyDownload && !isCredit && !translating;
                    const isEditing = editingCue === i;
                    return <div className={`sn-cue ${isEditing ? "sn-cue-editing" : ""}`} key={`${tab}-${i}`} data-cue-index={i}>
                      <div className="sn-cue-timing"><span>#{cue.number}</span><time>{cue.time}</time>{editedIndices.includes(i) && <span className="sn-edited-mark">Edited</span>}{isCredit && <span className="sn-credit-mark">Credit</span>}</div>
                      {tab === "compare" ? <div className="sn-dual-row">
                        <div className="sn-dual-source"><span className="sn-dual-label">ENGLISH</span><p lang="en">{english?.text || (isCredit ? "Opening SubNexa AI credit" : "Original line unavailable")}</p></div>
                        <div className="sn-dual-translation"><span className="sn-dual-label">සිංහල</span><p lang="si">{cue.text}</p></div>
                      </div> : <p lang={tab === "source" ? "en" : "si"} className="sn-cue-text">{cue.text}</p>}
                      {isEditing && <div className="sn-edit-area"><label htmlFor={`sn-edit-${i}`}>Edit Sinhala subtitle #{cue.number}</label><textarea id={`sn-edit-${i}`} lang="si" rows={3} maxLength={600} value={editDraft} onChange={e => setEditDraft(e.target.value)} />{editError && <p role="alert" className="sn-edit-error">{editError}</p>}<div className="sn-edit-actions"><button type="button" className="sn-accent-button" onClick={() => saveEditedCue(i)}>Save line</button><button type="button" className="sn-outline-small" onClick={() => { setEditingCue(null); setEditError(""); }}>Cancel</button></div><small>Only dialogue text changes. Timings and ASS styling stay intact.</small></div>}
                      <div className="sn-cue-actions"><button type="button" onClick={() => { setSceneIndex(i); setCinemaOpen(true); }}>◉ Cinema preview</button>{canEdit && !isEditing && <button type="button" onClick={() => startEditing(i)}>✎ Edit Sinhala</button>}</div>
                    </div>;
                  })}
                </div> : <div className="sn-empty">
                  <svg width="50" height="40" viewBox="0 0 50 40" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><rect x="3" y="3" width="44" height="29" rx="5"/><path d="M11 15h12m4 0h17M18 37h14"/></svg>
                  <h3>{cueSearch ? "No matching subtitles" : tab === "source" ? "Every line. The same moment." : "Your Sinhala version belongs here"}</h3>
                  <p>{cueSearch ? "Try a different search or clear the filter." : tab === "source" ? "Choose Preview source or translate the selected English SRT." : "Translate a file to compare and edit Sinhala subtitles."}</p>
                </div>}
              </div>
              <div className="sn-preview-footer"><span>{visibleIndices.length} of {cues.length} subtitles {cueSearch ? "matched" : "shown"}</span><span>UTF-8 · {tab === "source" ? "SRT" : (readyDownload?.format || "SRT").toUpperCase()}</span></div>
              {readyDownload && <div className="sn-editor-footer"><span>✎ {editedIndices.length} manual edit(s)</span>{editedIndices.length > 0 && <button type="button" className="sn-outline-small" onClick={restoreAiOutput}>Restore original AI output</button>}</div>}
              <details className="sn-cinema-details" open={cinemaOpen} onToggle={e => setCinemaOpen(e.currentTarget.open)}>
                <summary>Cinematic subtitle preview <span>Simulated screen · no video</span></summary>
                <div className="sn-cinema-screen" aria-label="Simulated movie subtitle appearance">
                  {sceneIsCredit && readyDownload?.format === "ass" ? <div className="sn-cinema-credit"><span>Sinhala Sub</span><strong>Generated by SubNexa AI</strong></div> : <p lang={tab === "source" ? "en" : "si"}>{sceneCue?.text || "Choose a subtitle line using Cinema preview."}</p>}
                </div>
                <p className="sn-setting-note">This is a visual approximation. Actual subtitle colors depend on the video player.</p>
              </details>
            </section>

            <section className="sn-panel sn-status" aria-labelledby="status-title">
              <div className="sn-section-head">
                <h2 id="status-title">{statusTitle}</h2>
                <span className="sn-status-label"><span className={translating ? "sn-dot is-active" : "sn-dot"}/>{translating ? "In progress" : done ? "Complete" : isError ? "Stopped" : "Standby"}</span>
              </div>
              <div className="sn-progress-info"><span>{showProgress ? `${translatedCount} of ${totalCount || "—"} subtitles` : "Progress will appear when translation begins."}</span><strong>{progress}%</strong></div>
              <div role="progressbar" aria-label="Translation progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="sn-track"><div style={{ width: `${progress}%` }} /></div>
              <details className="sn-activity" open={translating || activity.length > 0}>
                <summary>Live translation activity <span>{activity.length ? `${activity.length} events` : "Waiting for your file"}</span></summary>
                <div className="sn-log" role="log" aria-live="polite" aria-relevant="additions">
                  {activity.length ? activity.map(item => <div className="sn-log-row" key={item.id}>
                    <span className={`sn-event-dot ${item.tone}`}/><div><strong>{item.label}</strong><p>{item.detail}</p></div>
                  </div>) : <p>Translation and review stages appear here as they happen.</p>}
                  <div ref={activityEnd}/>
                </div>
              </details>
            </section>

            {readyDownload && !translating && !isError && <section className="sn-panel sn-ready" aria-labelledby="ready-title" ref={readyCardRef}>
              <div className="sn-ready-head"><span className="sn-ready-mark" aria-hidden="true">✓</span><div><h2 id="ready-title">Your File Is Ready!</h2><p>Translation finished. Your file downloads only when you click.</p></div></div>
              <p className="sn-ready-filename">{readyDownload.filename}</p>
              <p className="sn-setting-note">{editedIndices.length > 0 ? `${editedIndices.length} manually edited line(s) included · ` : ""}{readyDownload.creditRequested
                ? readyDownload.creditAdded ? "Opening credit included" : "Opening credit skipped — no 5-second opening gap"
                : "Opening credit disabled"} · {readyDownload.format.toUpperCase()}</p>
              <button type="button" className="sn-primary sn-ready-download" onClick={downloadTranslatedFile}>Download subtitles <span aria-hidden="true">↓</span></button>
            </section>}
          </div>
        </div>

        <section className="sn-panel sn-glossary" aria-labelledby="glossary-title">
          <button type="button" className="sn-glossary-toggle" aria-expanded={glossaryOpen} aria-controls="glossary-body" onClick={() => setGlossaryOpen(!glossaryOpen)}>
            <span><strong id="glossary-title">Glossary protection</strong><small>{glossaryRules.length} rules · Optional naming consistency</small></span>
            <span aria-hidden="true" className="sn-glossary-chevron">{glossaryOpen ? "−" : "+"}</span>
          </button>
          {glossaryOpen && <div className="sn-glossary-body" id="glossary-body">
            <p className="sn-subtitle">Control how character names, fictional items and places survive the AI translation.</p>
            <div className="sn-glossary-row">
              <span className="sn-field-title">Quick presets</span>
              <div className="sn-inline-actions">
                {Object.entries(GLOSSARY_PRESETS).map(([name, preset]) => <button type="button" key={name} className="sn-outline-small" disabled={loading} onClick={() => {
                  try {
                    const known = new Set(glossaryRules.map(x => x.source.toLowerCase()));
                    const additions = preset.filter(x => !known.has(x.source.toLowerCase()));
                    setGlossaryRules(validateGlossaryRules([...glossaryRules, ...additions]));
                    setPlaygroundResult(null); resetTranslationResult();
                    setGlossaryNotice(`Added ${additions.length} terms from ${name}.`);
                  } catch (err) { setGlossaryNotice(err instanceof Error ? err.message : "Preset failed."); }
                }}>+ {name}</button>)}
              </div>
            </div>
            <div className="sn-glossary-form">
              <label>English term<input value={glossaryDraft.source} disabled={loading} maxLength={100} placeholder="Tony Stark" onChange={e => setGlossaryDraft({ ...glossaryDraft, source: e.target.value })} /></label>
              <label>Rule<select disabled={loading} value={glossaryDraft.mode} onChange={e => setGlossaryDraft({ ...glossaryDraft, mode: e.target.value as GlossaryMode })}>
                <option value="never_translate">Never translate</option><option value="custom_translation">Custom Sinhala translation</option>
              </select></label>
              {glossaryDraft.mode === "custom_translation" && <label>Sinhala replacement<input lang="si" value={glossaryDraft.target} disabled={loading} maxLength={120} placeholder="ටෝනි ස්ටාර්ක්" onChange={e => setGlossaryDraft({ ...glossaryDraft, target: e.target.value })} /></label>}
              <label className="sn-check-option sn-case"><input type="checkbox" disabled={loading} checked={glossaryDraft.case_sensitive} onChange={e => setGlossaryDraft({ ...glossaryDraft, case_sensitive: e.target.checked })}/><span>Case-sensitive match</span></label>
            </div>
            <div className="sn-inline-actions">
              <button type="button" className="sn-accent-button" disabled={loading} onClick={() => { saveGlossaryRule(); resetTranslationResult(); }}>{editing ? "Save changes" : "Add glossary rule"}</button>
              {editing && <button type="button" className="sn-outline-small" onClick={() => { setEditingRule(null); setGlossaryDraft({ source: "", target: "", mode: "never_translate", case_sensitive: false }); }}>Cancel edit</button>}
              <button type="button" className="sn-outline-small" onClick={() => exportGlossary("json")}>Export JSON</button>
              <button type="button" className="sn-outline-small" onClick={() => exportGlossary("csv")}>Export CSV</button>
              <label className="sn-import-label">Import JSON / CSV<input type="file" disabled={loading} accept=".json,.csv" onChange={e => { void importGlossary(e.target.files?.[0] || null).then(() => resetTranslationResult()); e.target.value = ""; }}/></label>
            </div>
            {glossaryNotice && <p role="status" className="sn-glossary-notice">{glossaryNotice}</p>}

            <div className="sn-glossary-list-head">
              <h3>Saved terms <span>{glossaryRules.length}</span></h3>
              <input aria-label="Search glossary" type="search" placeholder="Search names or replacements" value={glossarySearch} onChange={e => setGlossarySearch(e.target.value)} />
            </div>
            <div className="sn-glossary-terms">
              {visibleGlossary.length ? visibleGlossary.map(({rule:r,index:i}) => <div className="sn-term" key={`${r.source}:${i}`}>
                <div className="sn-term-info"><strong>{r.source}</strong><span aria-hidden="true">→</span><span lang="si">{r.mode === "never_translate" ? "Keep original" : r.target}</span>{r.case_sensitive && <small>Case sensitive</small>}</div>
                <div className="sn-term-actions"><button type="button" disabled={loading} onClick={() => { setEditingRule(i); setGlossaryDraft({ ...r }); }}>Edit</button><button type="button" disabled={loading} onClick={() => { setGlossaryRules(glossaryRules.filter((_, index) => index !== i)); setPlaygroundResult(null); setEditingRule(null); resetTranslationResult(); }}>Remove</button></div>
              </div>) : <p className="sn-setting-note">{glossaryRules.length ? "No matching terms." : "No glossary rules yet. Add a term or select a preset."}</p>}
            </div>

            <div className="sn-playground">
              <h3>Glossary playground</h3>
              <p className="sn-subtitle">Preview protected tokens and restored names without consuming Gemini quota.</p>
              <textarea rows={3} value={playgroundInput} maxLength={10000} aria-label="Glossary playground text" onChange={e => setPlaygroundInput(e.target.value)} />
              <div className="sn-inline-actions">
                <button type="button" className="sn-secondary" disabled={playgroundLoading} onClick={() => void runGlossaryPreview()}>{playgroundLoading ? "Checking…" : "Preview protection"}</button>
                <button type="button" className="sn-outline-small" onClick={() => {
                  const snippet = `import json\nfrom glossary_engine import parse_glossary, mask_batch, restore_line\n\nrules = parse_glossary(json.loads(${JSON.stringify(JSON.stringify(glossaryRules))}))\nenglish = ["Tony Stark activated the Arc Reactor."]\nmasked, token_maps = mask_batch(english, rules)\n# Send masked text through the existing translation and review pipeline.\n# result = [translated_text]\n# final = [restore_line(text, mapping) for text, mapping in zip(result, token_maps)]`;
                  void navigator.clipboard.writeText(snippet).then(() => setGlossaryNotice("Python integration example copied.")).catch(() => setGlossaryNotice("Clipboard unavailable."));
                }}>Copy Python snippet</button>
                <button type="button" className="sn-outline-small" onClick={() => {
                  const snippet = `const glossary = ${JSON.stringify(glossaryRules, null, 2)};\nconst form = new FormData();\nform.append("file", selectedSrtFile);\nform.append("style", "natural");\nform.append("glossary", JSON.stringify(glossary));\nform.append("output_format", "srt");\nform.append("opening_credit", "true");\nconst response = await fetch("${API}/translate-srt-stream", { method: "POST", body: form });`;
                  void navigator.clipboard.writeText(snippet).then(() => setGlossaryNotice("JavaScript API example copied.")).catch(() => setGlossaryNotice("Clipboard unavailable."));
                }}>Copy JS snippet</button>
              </div>
              {playgroundResult && <div className="sn-playground-results">
                <p>Masked before Gemini</p><code>{playgroundResult.masked}</code>
                <p>Restored demonstration (not AI translated)</p><code>{playgroundResult.restored_example}</code>
                {playgroundResult.replacements.map((r,i) => <small key={i}>{r.placeholder} → {r.restored}</small>)}
              </div>}
            </div>
          </div>}
        </section>
        {readyDownload && !readyCardVisible && !translating && !isError && <aside className="sn-floating-ready" aria-label="File ready for download"><div><strong>✓ Your File Is Ready!</strong><small>{editedIndices.length ? `${editedIndices.length} edited · ` : ""}{readyDownload.filename}</small></div><button type="button" onClick={downloadTranslatedFile}>Download ↓</button></aside>}
        <footer className="sn-footer"><span>SubNexa <span className="sn-footer-sep">/</span> Made for the story.</span><span>Developed by E Unity Movie Family LK</span></footer>
      </main>
    </div>
  );
}



// SubNexa V4.0 subtitle helpers included here to avoid missing-module errors.
/** Pure subtitle preview/editing utilities. No AI calls and no timestamp rewriting. */
type StudioFormat = "srt" | "ass";
type StudioCue = {
  number: string;
  start: string;
  end: string;
  time: string;
  text: string;
};

const SRT_BREAK = /\r?\n[\t ]*\r?\n/;

function parseSrtStudio(text: string): StudioCue[] {
  if (!text.trim()) return [];
  return text.replace(/^\uFEFF/, "").split(SRT_BREAK).flatMap(block => {
    const lines = block.split(/\r?\n/);
    const idx = lines.findIndex(line => line.includes("-->"));
    if (idx < 0 || idx >= lines.length - 1) return [];
    const times = lines[idx].split(/\s*-->\s*/);
    if (times.length !== 2) return [];
    const number = idx ? lines[0].trim() : String(1);
    return [{ number, start: times[0], end: times[1], time: `${times[0]} → ${times[1]}`, text: lines.slice(idx + 1).join("\n").trimEnd() }];
  });
}

function splitAssFields(value: string, fields: number): string[] {
  const output: string[] = [];
  let rest = value;
  for (let i = 0; i < fields - 1; i++) {
    const cut = rest.indexOf(",");
    if (cut < 0) return [];
    output.push(rest.slice(0, cut));
    rest = rest.slice(cut + 1);
  }
  output.push(rest);
  return output;
}

function parseAssStudio(text: string): StudioCue[] {
  const cues: StudioCue[] = [];
  let inEvents = false;
  let fields = ["Layer", "Start", "End", "Style", "Name", "MarginL", "MarginR", "MarginV", "Effect", "Text"];
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*\[/.test(line)) inEvents = /^\s*\[Events\]/i.test(line);
    if (!inEvents) continue;
    if (/^Format:\s*/i.test(line)) fields = line.replace(/^Format:\s*/i, "").split(",").map(x => x.trim());
    if (!/^Dialogue:\s*/i.test(line)) continue;
    const parts = splitAssFields(line.replace(/^Dialogue:\s*/i, ""), fields.length);
    if (parts.length !== fields.length) continue;
    const start = parts[fields.indexOf("Start")]?.trim() ?? "";
    const end = parts[fields.indexOf("End")]?.trim() ?? "";
    const raw = parts[fields.indexOf("Text")] ?? "";
    if (!start || !end) continue;
    cues.push({ number: String(cues.length + 1), start, end, time: `${start} → ${end}`,
      text: raw.replace(/\{[^}]*\}/g, "").replace(/\\[Nn]/g, "\n").replace(/\\h/g, " ") });
  }
  return cues;
}

function parseStudioCues(text: string, format: StudioFormat): StudioCue[] {
  return format === "ass" ? parseAssStudio(text) : parseSrtStudio(text);
}

/** A formatted timestamp key for matching source cues to translated cues. */
function timeKey(time: string): number | null {
  const match = time.trim().match(/^(\d+):(\d\d):(\d\d)[.,](\d{1,3})$/);
  if (!match) return null;
  const [, h, m, s, frac] = match;
  return ((Number(h) * 60 + Number(m)) * 60 + Number(s)) * 1000 + Number(frac.padEnd(3, "0"));
}

function findSourceMatch(cue: StudioCue, sources: StudioCue[]): StudioCue | undefined {
  const start = timeKey(cue.start);
  const end = timeKey(cue.end);
  if (start === null || end === null) return undefined;
  return sources.find(src => {
    const srcStart = timeKey(src.start);
    const srcEnd = timeKey(src.end);
    return srcStart !== null && srcEnd !== null && Math.abs(srcStart - start) <= 10 && Math.abs(srcEnd - end) <= 10;
  });
}

function replaceStudioCue(content: string, format: StudioFormat, cueIndex: number, replacement: string): string {
  if (!Number.isInteger(cueIndex) || cueIndex < 0) throw new Error("Invalid subtitle number.");
  const edited = replacement.replace(/\r\n?/g, "\n").trim();
  if (!edited || edited.length > 600 || /\n\s*\n|-->/.test(edited)) {
    throw new Error("Enter subtitle text (up to 600 characters) without blank lines or timestamps.");
  }
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  if (format === "srt") {
    const separator = /\r?\n[\t ]*\r?\n/;
    const blocks = content.split(separator);
    let ordinal = 0;
    let found = false;
    const output = blocks.map(block => {
      const lines = block.split(/\r?\n/);
      const t = lines.findIndex(line => line.includes("-->"));
      if (t < 0 || t === lines.length - 1) return block;
      if (ordinal++ !== cueIndex) return block;
      found = true;
      return [...lines.slice(0, t + 1), ...edited.split("\n")].join(newline);
    });
    if (!found) throw new Error("Subtitle line was not found.");
    return output.join(newline + newline);
  }
  let inEvents = false;
  let ordinal = 0;
  let found = false;
  let fields = ["Layer", "Start", "End", "Style", "Name", "MarginL", "MarginR", "MarginV", "Effect", "Text"];
  const output = content.split(/\r?\n/).map(line => {
    if (/^\s*\[/.test(line)) inEvents = /^\s*\[Events\]/i.test(line);
    if (!inEvents) return line;
    if (/^Format:\s*/i.test(line)) {
      fields = line.replace(/^Format:\s*/i, "").split(",").map(x => x.trim());
      return line;
    }
    if (!/^Dialogue:\s*/i.test(line)) return line;
    const prefix = line.match(/^Dialogue:\s*/i)?.[0] ?? "Dialogue: ";
    const parts = splitAssFields(line.slice(prefix.length), fields.length);
    if (parts.length !== fields.length) return line;
    if (ordinal++ !== cueIndex) return line;
    const textIndex = fields.indexOf("Text");
    if (textIndex < 0) throw new Error("ASS text field was not found.");
    found = true;
    // Edited dialogue is plain text; preserve existing styles and every other event line.
    parts[textIndex] = edited.replace(/[{}]/g, "").replace(/\\[Nnh]/g, " ").replace(/\n/g, "\\N");
    return prefix + parts.join(",");
  });
  if (!found) throw new Error("Subtitle line was not found.");
  return output.join(newline);
}

function studioSearch(text: string, cues: StudioCue[], sources: StudioCue[], format: StudioFormat): number[] {
  const q = text.trim().toLocaleLowerCase();
  return cues.flatMap((cue, index) => {
    if (!q) return [index];
    const source = format === "srt" || format === "ass" ? findSourceMatch(cue, sources) : undefined;
    const combined = `${cue.number} ${cue.time} ${cue.text} ${source?.text ?? ""}`.toLocaleLowerCase();
    return combined.includes(q) ? [index] : [];
  });
}

