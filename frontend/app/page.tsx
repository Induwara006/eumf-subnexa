"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Copy,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Film,
  Loader2,
  Lock,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import SubNexaProviderStatus from "../components/SubNexaProviderStatus";
import SubNexaAccountDock from "../components/SubNexaAccountDock";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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

function StepLink({ href, index, label, state }: {
  href: string;
  index: number;
  label: string;
  state: "todo" | "current" | "done";
}) {
  return (
    <a
      href={href}
      className={cn(
        "group flex flex-1 items-center justify-center gap-2 border-b-2 px-2 py-3 text-xs font-medium transition-colors sm:text-sm",
        state === "current" && "border-primary text-foreground",
        state === "done" && "border-success/50 text-muted-foreground hover:text-foreground",
        state === "todo" && "border-transparent text-muted-foreground/70 hover:text-foreground",
      )}
    >
      <span className={cn(
        "grid size-6 shrink-0 place-items-center rounded-full border text-[11px]",
        state === "current" && "border-primary bg-primary text-primary-foreground",
        state === "done" && "border-success/40 bg-success/15 text-success",
        state === "todo" && "border-border text-muted-foreground",
      )}>
        {state === "done" ? <Check className="size-3.5" /> : index}
      </span>
      <span className="hidden sm:inline">{label}</span>
    </a>
  );
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
  const readyCardRef = useRef<HTMLDivElement>(null);
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
    toast.success("Download started");
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
            case "provider_fallback":
              logActivity("Cloudflare backup activated", "Gemini temporarily unavailable. Continuing from saved subtitle progress.", "warn");
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

  function renderCues() {
    if (!cues.length || !visibleIndices.length) {
      return (
        <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-background/30 p-6 text-center">
          <span className="grid size-12 place-items-center rounded-full border border-border/70 bg-card text-muted-foreground">
            <FileText className="size-5" />
          </span>
          <h3 className="mt-3 text-sm font-medium">
            {cueSearch ? "No matching subtitles" : tab === "source" ? "Every line. The same moment." : "Your Sinhala version belongs here"}
          </h3>
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
            {cueSearch ? "Try a different search or clear the filter." : tab === "source" ? "Choose Preview source or translate the selected English SRT." : "Translate a file to compare and edit Sinhala subtitles."}
          </p>
        </div>
      );
    }

    return (
      <div className="divide-y divide-border/50">
        {visibleIndices.map(i => {
          const cue = cues[i];
          const english = tab === "source" ? cue : matchedSource(cue);
          const isCredit = tab !== "source" && readyDownload?.creditAdded && !english;
          const canEdit = tab !== "source" && !!readyDownload && !isCredit && !translating;
          const isEditing = editingCue === i;
          return (
            <div key={`${tab}-${i}`} data-cue-index={i} className={cn("py-3 first:pt-1 last:pb-1", isEditing && "rounded-lg bg-primary/5 px-3")}>
              <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] tabular-nums text-muted-foreground">
                <span className="text-foreground/70">#{cue.number}</span>
                <time>{cue.time}</time>
                {editedIndices.includes(i) && (
                  <Badge className="h-4 rounded-md bg-primary/15 px-1.5 text-[9px] font-medium text-primary ring-1 ring-primary/30">Edited</Badge>
                )}
                {isCredit && <Badge variant="outline" className="h-4 rounded-md border-border/80 px-1.5 text-[9px]">Credit</Badge>}
              </div>
              {tab === "compare" ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-border/60 bg-background/40 p-2.5">
                    <span className="text-[9px] font-medium tracking-[0.14em] text-muted-foreground">ENGLISH</span>
                    <p lang="en" className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed">
                      {english?.text || (isCredit ? "Opening SubNexa AI credit" : "Original line unavailable")}
                    </p>
                  </div>
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5">
                    <span className="text-[9px] font-medium tracking-[0.14em] text-primary/80">සිංහල</span>
                    <p lang="si" className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{cue.text}</p>
                  </div>
                </div>
              ) : (
                <p lang={tab === "source" ? "en" : "si"} className={cn("mt-1.5 whitespace-pre-wrap break-words leading-relaxed", tab === "source" ? "text-xs" : "text-sm")}>
                  {cue.text}
                </p>
              )}
              {isEditing && (
                <div className="mt-2 space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
                  <Label htmlFor={`sn-edit-${i}`} className="text-[11px]">Edit Sinhala subtitle #{cue.number}</Label>
                  <Textarea id={`sn-edit-${i}`} lang="si" rows={3} maxLength={600} value={editDraft} onChange={e => setEditDraft(e.target.value)} className="min-h-20 text-sm" />
                  {editError && <p role="alert" className="text-[11px] text-destructive">{editError}</p>}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" className="h-7 text-[11px]" onClick={() => saveEditedCue(i)}>Save line</Button>
                    <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => { setEditingCue(null); setEditError(""); }}>Cancel</Button>
                    <span className="text-[10px] leading-relaxed text-muted-foreground">Only dialogue text changes. Timings and ASS styling stay intact.</span>
                  </div>
                </div>
              )}
              <div className="mt-1.5 flex flex-wrap items-center justify-end gap-1">
                <Button variant="ghost" size="xs" className="h-6 gap-1 px-2 text-[10px] text-muted-foreground" onClick={() => { setSceneIndex(i); setCinemaOpen(true); }}>
                  <Play className="size-3" />Cinema preview
                </Button>
                {canEdit && !isEditing && (
                  <Button variant="ghost" size="xs" className="h-6 gap-1 px-2 text-[10px] text-muted-foreground" onClick={() => startEditing(i)}>
                    <Pencil className="size-3" />Edit Sinhala
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="relative isolate flex min-h-screen flex-col" style={{ "--studio-dim": backgroundDim / 100 } as CSSProperties}>
      <div className="studio-backdrop" aria-hidden="true" />

      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
              <Film className="size-4" />
            </span>
            <div className="min-w-0 leading-tight">
              <div className="flex items-baseline gap-2">
                <span className="truncate text-base font-semibold tracking-tight">SubNexa</span>
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">by EUMF</span>
              </div>
              <span className="hidden truncate text-xs text-muted-foreground sm:block">English → Sinhala subtitle studio</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="hidden h-7 gap-1.5 border-border/80 px-2.5 text-[11px] font-normal text-muted-foreground md:inline-flex">
              <span className="size-1.5 rounded-full bg-success" />Subtitle studio
            </Badge>
            <Button variant="ghost" size="sm" className="h-9 gap-2 px-3 text-muted-foreground hover:text-foreground" onClick={() => setHelp(true)}>
              <CircleHelp className="size-4" /><span className="hidden sm:inline">Quick guide</span>
            </Button>
            <SubNexaAccountDock />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 pt-8 sm:px-6 sm:pt-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-[2.1rem]">Translation workspace</h1>
              <Badge className="h-5 rounded-md bg-primary/15 px-2 text-[10px] font-semibold tracking-[0.14em] text-primary ring-1 ring-primary/30">PRO</Badge>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              Bring the story into Sinhala. Every timestamp stays exactly where it belongs.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="size-9 rounded-full border-border/80 bg-card/60" aria-label="Poster background settings">
                  <Settings2 className="size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 space-y-4 border-border/80 bg-popover/95 backdrop-blur">
                <div className="flex items-center justify-between text-xs">
                  <Label className="text-xs text-muted-foreground">Poster background</Label>
                  <span className="font-mono text-foreground">{backgroundDim}%</span>
                </div>
                <Slider value={[backgroundDim]} min={50} max={95} step={5} onValueChange={([value]) => setBackgroundDim(value)} aria-label="Poster background darkness" />
                <p className="text-[11px] leading-relaxed text-muted-foreground">Adjust how strongly the poster wall shows behind the studio.</p>
              </PopoverContent>
            </Popover>
            <div className="flex items-center gap-2 rounded-full border border-border/80 bg-card/60 px-3.5 py-1.5 text-xs">
              <span className="text-muted-foreground">English</span>
              <ArrowRight className="size-3.5 text-primary" />
              <span lang="si" className="text-sm text-foreground">සිංහල</span>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <SubNexaProviderStatus apiBase={API} />
        </div>

        <Dialog open={help} onOpenChange={setHelp}>
          <DialogContent className="border-border/80 bg-card sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <CircleHelp className="size-4 text-primary" />Your subtitle workflow
              </DialogTitle>
              <DialogDescription>Five steps from an English SRT to a reviewed Sinhala subtitle file.</DialogDescription>
            </DialogHeader>
            <ol className="space-y-3 text-sm text-muted-foreground">
              {[
                "Choose a UTF-8 English .srt file (up to 2 MB), then preview it.",
                "Pick a Sinhala style, SRT or ASS output, and optional opening credit.",
                "Add glossary rules if you want to preserve special names or terms.",
                "Follow live progress, then compare, search or edit Sinhala subtitles before downloading.",
                "Click Download manually; your edits stay in the SRT/ASS file.",
              ].map((item, index) => (
                <li key={index} className="flex gap-3">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-border text-[10px] text-foreground">{index + 1}</span>
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ol>
            <Alert className="border-border/70 bg-background/60">
              <AlertCircle className="size-4 text-warning" />
              <AlertDescription className="text-xs">
                To resume after an interruption, translate the same file with the same settings and glossary.
              </AlertDescription>
            </Alert>
          </DialogContent>
        </Dialog>

        <nav className="sticky top-16 z-30 mt-6 flex overflow-hidden rounded-xl border border-border/70 bg-background/80 backdrop-blur-xl" aria-label="Progress">
          <StepLink href="#sn-setup" index={1} label="Upload" state={file ? "done" : "current"} />
          <StepLink href="#sn-style" index={2} label="Style & glossary" state={!file ? "todo" : translating || readyDownload ? "done" : "current"} />
          <StepLink href="#sn-studio" index={3} label="Translate & review" state={readyDownload ? "done" : translating ? "current" : "todo"} />
        </nav>

        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)]">
          <div className="min-w-0 space-y-5">
            <Card id="sn-setup" className="scroll-mt-36 border-border/70 bg-card/85 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm">Source subtitle</CardTitle>
                    <CardDescription className="mt-1 text-xs">English SRT, UTF-8, up to 2 MB.</CardDescription>
                  </div>
                  <Badge variant="outline" className="border-border/80 font-mono text-[10px] text-muted-foreground">.srt</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => fileInput.current?.click()}
                  onDragOver={e => { e.preventDefault(); if (!loading) setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={e => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0] || null); }}
                  className={cn(
                    "group flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background/40 px-4 py-7 text-center transition-colors hover:border-primary/60 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60",
                    dragging && "border-primary bg-primary/10",
                  )}
                >
                  <span className="grid size-10 place-items-center rounded-full border border-border/80 bg-card text-primary transition-transform group-hover:-translate-y-0.5">
                    <Upload className="size-4" />
                  </span>
                  <strong className="max-w-full break-words text-sm font-medium">{file ? file.name : "Drop your subtitle here"}</strong>
                  <span className="text-xs text-muted-foreground">{file ? `${(file.size / 1024).toFixed(1)} KB · Choose another file` : "or browse files"}</span>
                  <span className="text-[11px] text-muted-foreground/70">English SRT · UTF-8</span>
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".srt"
                  className="sr-only"
                  aria-label="Choose subtitle file"
                  disabled={loading}
                  onChange={e => { pickFile(e.target.files?.[0] || null); e.target.value = ""; }}
                />
                <Button variant="outline" className="h-9 w-full justify-between" onClick={handleUpload} disabled={loading || !file}>
                  {loading && !translating
                    ? <><Loader2 className="size-4 animate-spin" />Loading source…</>
                    : <><FileText className="size-4" />Preview source</>}
                  <ArrowRight className="size-4 text-muted-foreground" />
                </Button>
              </CardContent>
            </Card>

            <Card id="sn-style" className="scroll-mt-36 border-border/70 bg-card/85 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-sm">Translation settings</CardTitle>
                <CardDescription className="mt-1 text-xs">Choose how the Sinhala dialogue should read.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2.5">
                  <Label className="text-xs text-muted-foreground">Translation style</Label>
                  <RadioGroup
                    value={style}
                    onValueChange={value => { setStyle(value); resetTranslationResult(); }}
                    disabled={loading}
                    className="gap-2"
                  >
                    {STYLES.map(option => (
                      <Label
                        key={option.value}
                        htmlFor={`style-${option.value}`}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 bg-background/40 p-3 transition-colors hover:border-border",
                          style === option.value && "border-primary/60 bg-primary/10",
                        )}
                      >
                        <RadioGroupItem value={option.value} id={`style-${option.value}`} className="mt-0.5" />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{option.title}</span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{option.desc}</span>
                        </span>
                      </Label>
                    ))}
                  </RadioGroup>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="text-xs text-muted-foreground">Output format</Label>
                  <RadioGroup
                    value={exportFormat}
                    onValueChange={value => { setExportFormat(value as ExportFormat); resetTranslationResult(); }}
                    disabled={loading}
                    className="grid grid-cols-2 gap-2"
                  >
                    {(["srt", "ass"] as ExportFormat[]).map(format => (
                      <Label
                        key={format}
                        htmlFor={`format-${format}`}
                        className={cn(
                          "flex cursor-pointer items-center justify-center rounded-lg border border-border/70 bg-background/40 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:border-border has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                          exportFormat === format && "border-primary/60 bg-primary/10 text-foreground",
                        )}
                      >
                        <RadioGroupItem value={format} id={`format-${format}`} className="sr-only" />
                        .{format}
                      </Label>
                    ))}
                  </RadioGroup>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    ASS can display red/white opening credits on compatible players. SRT uses plain text.
                  </p>
                  <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-background/40 p-3">
                    <Checkbox
                      id="opening-credit"
                      checked={openingCredit}
                      disabled={loading}
                      onCheckedChange={value => { setOpeningCredit(value === true); resetTranslationResult(); }}
                      className="mt-0.5"
                    />
                    <div className="min-w-0">
                      <Label htmlFor="opening-credit" className="text-xs font-medium">Opening SubNexa AI credit</Label>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        Only added if there is a free 5-second opening gap; dialogue times stay unchanged.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Button
                    size="lg"
                    className="h-11 w-full justify-between rounded-lg text-sm font-semibold shadow-lg shadow-primary/20"
                    onClick={handleTranslate}
                    disabled={loading || !file}
                  >
                    <span className="flex items-center gap-2">
                      {translating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                      {translating ? "Translating…" : "Translate to Sinhala"}
                    </span>
                    <ArrowRight className="size-4" />
                  </Button>
                  <p className="text-center text-[11px] text-muted-foreground">
                    {!file ? "Choose a file to begin." : `${glossaryRules.length} glossary rule(s) active · Timings protected`}
                  </p>
                  {message && (
                    <Alert
                      variant={isError ? "destructive" : "default"}
                      className={cn("mt-1", !isError && "border-success/30 bg-success/10 text-foreground")}
                    >
                      {isError ? <AlertCircle className="size-4" /> : <CheckCircle2 className="size-4 text-success" />}
                      <AlertDescription className={cn("text-xs", !isError && "text-foreground/80")} role={isError ? "alert" : "status"}>
                        {message}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="min-w-0 space-y-5">
            <Card className="border-border/70 bg-card/85 backdrop-blur-sm">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className={cn(
                      "size-2 rounded-full",
                      translating ? "animate-pulse bg-primary" : done ? "bg-success" : isError ? "bg-warning" : "bg-muted-foreground/50",
                    )} />
                    <CardTitle className="text-sm">{statusTitle}</CardTitle>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "border-border/80 text-[10px] font-medium",
                      translating && "border-primary/40 text-primary",
                      done && "border-success/40 text-success",
                      isError && "border-warning/40 text-warning",
                    )}
                  >
                    {translating ? "In progress" : done ? "Complete" : isError ? "Stopped" : "Standby"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-end justify-between gap-4">
                  <p className="text-xs text-muted-foreground">
                    {showProgress ? `${translatedCount} of ${totalCount || "—"} subtitles` : "Progress appears when translation begins."}
                  </p>
                  <span className="font-mono text-2xl leading-none text-foreground">{progress}%</span>
                </div>
                <Progress value={progress} className="h-1.5" aria-label="Translation progress" />
                <div className="space-y-2 border-t border-border/60 pt-4">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    <span>Live activity</span>
                    <span className="normal-case tracking-normal">{activity.length ? `${activity.length} events` : "Waiting for your file"}</span>
                  </div>
                  <div className="cue-scroll max-h-44 space-y-3 overflow-y-auto pr-1" role="log" aria-live="polite" aria-relevant="additions">
                    {activity.length ? activity.map(item => (
                      <div className="flex gap-2.5" key={item.id}>
                        <span className={cn(
                          "mt-1.5 size-1.5 shrink-0 rounded-full",
                          item.tone === "success" && "bg-success",
                          item.tone === "warn" && "bg-warning",
                          item.tone === "info" && "bg-muted-foreground/60",
                        )} />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground/90">{item.label}</p>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{item.detail}</p>
                        </div>
                      </div>
                    )) : (
                      <p className="rounded-lg border border-dashed border-border/60 bg-background/30 p-3 text-xs text-muted-foreground">
                        Translation and review stages appear here as they happen.
                      </p>
                    )}
                    <div ref={activityEnd} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card id="sn-studio" className="scroll-mt-36 border-border/70 bg-card/85 backdrop-blur-sm">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-sm">Subtitle studio</CardTitle>
                      <Badge variant="outline" className="border-border/80 text-[9px] tracking-[0.12em] text-muted-foreground">COMPARE · EDIT</Badge>
                    </div>
                    <CardDescription className="mt-1 max-w-[42ch] truncate font-mono text-[11px]" title={file?.name || ""}>
                      {file?.name || "No file selected"}
                    </CardDescription>
                  </div>
                  {readyDownload && (
                    <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={downloadTranslatedFile}>
                      <Download className="size-3.5" />Download .{readyDownload.format.toUpperCase()}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Tabs
                  value={tab}
                  onValueChange={value => { setTab(value as "source" | "translated" | "compare"); setEditingCue(null); setSceneIndex(0); }}
                >
                  <TabsList className="h-9 w-full justify-start gap-1 bg-background/50 p-1 sm:w-auto">
                    <TabsTrigger value="source" className="h-7 flex-1 px-2 text-[11px] sm:flex-none sm:px-3 sm:text-xs">
                      <span className="sm:hidden">English</span>
                      <span className="hidden sm:inline">English source</span>
                    </TabsTrigger>
                    <TabsTrigger value="translated" className="h-7 flex-1 px-2 text-[11px] sm:flex-none sm:px-3 sm:text-xs">
                      <span className="sm:hidden">Sinhala</span>
                      <span className="hidden sm:inline">Sinhala output</span>
                    </TabsTrigger>
                    <TabsTrigger value="compare" className="h-7 flex-1 px-2 text-[11px] sm:flex-none sm:px-3 sm:text-xs">
                      <span className="sm:hidden">Compare</span>
                      <span className="hidden sm:inline">Side by side</span>
                    </TabsTrigger>
                  </TabsList>

                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="search"
                        aria-label="Search subtitles"
                        placeholder="Search English or Sinhala dialogue…"
                        value={cueSearch}
                        onChange={e => { setCueSearch(e.target.value); setEditingCue(null); }}
                        className="h-9 pl-8 text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="sn-jump-number" className="whitespace-nowrap text-[11px] text-muted-foreground">Go to #</Label>
                      <Input
                        id="sn-jump-number"
                        type="number"
                        min={1}
                        step={1}
                        placeholder="100"
                        value={jumpNumber}
                        onChange={e => setJumpNumber(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") jumpToCue(); }}
                        className="h-9 w-20 text-xs"
                      />
                      <Button variant="outline" size="sm" className="h-9" onClick={jumpToCue}>Go</Button>
                    </div>
                  </div>

                  {previewNotice && <p role="status" className="text-[11px] text-muted-foreground">{previewNotice}</p>}

                  {(["source", "translated", "compare"] as const).map(mode => (
                    <TabsContent key={mode} value={mode} className="mt-2">
                      <div
                        ref={mode === tab ? previewViewport : null}
                        className={cn("cue-scroll h-[360px] overflow-y-auto rounded-lg border border-border/60 bg-background/30 p-3", mode === "compare" && "h-[420px]")}
                      >
                        {renderCues()}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span>{visibleIndices.length} of {cues.length} subtitles {cueSearch ? "matched" : "shown"}</span>
                  <span className="font-mono">UTF-8 · {tab === "source" ? "SRT" : (readyDownload?.format || "SRT").toUpperCase()}</span>
                </div>

                {readyDownload && (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
                    <span>{editedIndices.length} manual edit(s)</span>
                    {editedIndices.length > 0 && (
                      <Button variant="outline" size="xs" className="h-6 gap-1 text-[10px]" onClick={restoreAiOutput}>
                        <RotateCcw className="size-3" />Restore original AI output
                      </Button>
                    )}
                  </div>
                )}

                <Collapsible open={cinemaOpen} onOpenChange={setCinemaOpen} className="rounded-lg border border-border/60 bg-background/30">
                  <CollapsibleTrigger asChild>
                    <button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left">
                      <span className="flex items-center gap-2 text-xs font-medium"><Film className="size-3.5 text-primary" />Cinematic subtitle preview</span>
                      <span className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        Simulated screen · no video
                        <ChevronDown className={cn("size-3.5 transition-transform", cinemaOpen && "rotate-180")} />
                      </span>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-2 px-3 pb-3">
                      <div className="cinema-screen flex aspect-video min-h-[170px] flex-col items-center justify-end rounded-lg px-6 pb-5 text-center">
                        {sceneIsCredit && readyDownload?.format === "ass"
                          ? <div className="flex flex-wrap items-center justify-center gap-2 text-base font-semibold text-white sm:text-xl"><span>Sinhala Sub</span><strong className="text-primary">Generated by SubNexa AI</strong></div>
                          : <p lang={tab === "source" ? "en" : "si"} className="max-w-xl whitespace-pre-wrap text-sm font-semibold leading-relaxed text-white sm:text-lg">{sceneCue?.text || "Choose a subtitle line using Cinema preview."}</p>}
                      </div>
                      <p className="text-[10px] leading-relaxed text-muted-foreground">Visual approximation only. Actual subtitle colors depend on the video player.</p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>

            {readyDownload && !translating && !isError && (
              <div ref={readyCardRef}>
                <Card className="border-success/30 bg-linear-to-br from-success/10 via-card to-card backdrop-blur-sm">
                  <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-success/15 text-success ring-1 ring-success/30">
                        <CheckCircle2 className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <CardTitle className="text-sm">Your file is ready</CardTitle>
                        <p className="mt-1 text-xs text-muted-foreground">Translation finished. Nothing downloads until you click.</p>
                        <p className="mt-2 truncate font-mono text-[11px] text-foreground/80">{readyDownload.filename}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {editedIndices.length > 0 ? `${editedIndices.length} manually edited line(s) included · ` : ""}
                          {readyDownload.creditRequested
                            ? readyDownload.creditAdded ? "Opening credit included" : "Opening credit skipped — no 5-second opening gap"
                            : "Opening credit disabled"} · {readyDownload.format.toUpperCase()}
                        </p>
                      </div>
                    </div>
                    <Button size="lg" className="h-10 shrink-0 gap-2 self-start sm:self-auto" onClick={downloadTranslatedFile}>
                      <ArrowDownToLine className="size-4" />Download subtitles
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>

        <Card className="mt-5 border-border/70 bg-card/85 backdrop-blur-sm">
          <Collapsible open={glossaryOpen} onOpenChange={setGlossaryOpen}>
            <CollapsibleTrigger asChild>
              <button type="button" className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border/70 bg-background/50 text-primary">
                    <Lock className="size-4" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Glossary protection</span>
                      <Badge variant="outline" className="h-4 border-border/80 px-1.5 text-[9px] text-muted-foreground">{glossaryRules.length}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">Keep character names, fictional items and places intact.</p>
                  </div>
                </div>
                <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", glossaryOpen && "rotate-180")} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-5 border-t border-border/60 px-5 py-5">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Control how character names, fictional items and places survive the AI translation.
                </p>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Label className="text-xs text-muted-foreground">Quick presets</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(GLOSSARY_PRESETS).map(([name, preset]) => (
                      <Button
                        key={name}
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 text-[11px]"
                        disabled={loading}
                        onClick={() => {
                          try {
                            const known = new Set(glossaryRules.map(x => x.source.toLowerCase()));
                            const additions = preset.filter(x => !known.has(x.source.toLowerCase()));
                            setGlossaryRules(validateGlossaryRules([...glossaryRules, ...additions]));
                            setPlaygroundResult(null); resetTranslationResult();
                            setGlossaryNotice(`Added ${additions.length} terms from ${name}.`);
                          } catch (err) { setGlossaryNotice(err instanceof Error ? err.message : "Preset failed."); }
                        }}
                      >
                        <Plus className="size-3" />{name}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="glossary-source" className="text-[11px]">English term</Label>
                    <Input
                      id="glossary-source"
                      value={glossaryDraft.source}
                      disabled={loading}
                      maxLength={100}
                      placeholder="Tony Stark"
                      onChange={e => setGlossaryDraft({ ...glossaryDraft, source: e.target.value })}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px]">Rule</Label>
                    <Select
                      value={glossaryDraft.mode}
                      disabled={loading}
                      onValueChange={value => setGlossaryDraft({ ...glossaryDraft, mode: value as GlossaryMode })}
                    >
                      <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="never_translate">Never translate</SelectItem>
                        <SelectItem value="custom_translation">Custom Sinhala translation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {glossaryDraft.mode === "custom_translation" && (
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="glossary-target" className="text-[11px]">Sinhala replacement</Label>
                      <Input
                        id="glossary-target"
                        lang="si"
                        value={glossaryDraft.target}
                        disabled={loading}
                        maxLength={120}
                        placeholder="ටෝනි ස්ටාර්ක්"
                        onChange={e => setGlossaryDraft({ ...glossaryDraft, target: e.target.value })}
                        className="h-9"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-2 sm:col-span-2">
                    <Checkbox
                      id="glossary-case"
                      disabled={loading}
                      checked={glossaryDraft.case_sensitive}
                      onCheckedChange={value => setGlossaryDraft({ ...glossaryDraft, case_sensitive: value === true })}
                    />
                    <Label htmlFor="glossary-case" className="text-[11px] font-normal text-muted-foreground">Case-sensitive match</Label>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" className="h-8" disabled={loading} onClick={() => { saveGlossaryRule(); resetTranslationResult(); }}>
                    {editing ? "Save changes" : "Add glossary rule"}
                  </Button>
                  {editing && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => { setEditingRule(null); setGlossaryDraft({ source: "", target: "", mode: "never_translate", case_sensitive: false }); }}
                    >
                      Cancel edit
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => exportGlossary("json")}>
                    <FileJson className="size-3.5" />JSON
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => exportGlossary("csv")}>
                    <FileSpreadsheet className="size-3.5" />CSV
                  </Button>
                  <Label htmlFor="glossary-import" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 cursor-pointer gap-1")}>
                    <Upload className="size-3.5" />Import
                  </Label>
                  <input
                    id="glossary-import"
                    type="file"
                    disabled={loading}
                    accept=".json,.csv"
                    className="sr-only"
                    onChange={e => { void importGlossary(e.target.files?.[0] || null).then(() => resetTranslationResult()); e.target.value = ""; }}
                  />
                </div>

                {glossaryNotice && (
                  <p role="status" className="rounded-lg border border-success/25 bg-success/10 px-3 py-2 text-[11px] text-success">{glossaryNotice}</p>
                )}

                <div className="flex flex-col gap-2 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-xs font-medium">Saved terms <span className="text-muted-foreground">({glossaryRules.length})</span></h3>
                  <div className="relative sm:w-64">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      aria-label="Search glossary"
                      type="search"
                      placeholder="Search names or replacements"
                      value={glossarySearch}
                      onChange={e => setGlossarySearch(e.target.value)}
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                </div>

                <div className="cue-scroll max-h-64 space-y-1.5 overflow-y-auto pr-1">
                  {visibleGlossary.length ? visibleGlossary.map(({ rule: r, index: i }) => (
                    <div key={`${r.source}:${i}`} className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-background/40 px-3 py-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        <strong className="font-medium">{r.source}</strong>
                        <ArrowRight className="size-3 text-muted-foreground" />
                        <span lang="si" className="text-muted-foreground">{r.mode === "never_translate" ? "Keep original" : r.target}</span>
                        {r.case_sensitive && <Badge variant="outline" className="h-4 border-border/70 px-1.5 text-[9px] font-normal text-muted-foreground">Case sensitive</Badge>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button variant="ghost" size="xs" className="h-6 px-2 text-[10px]" disabled={loading} onClick={() => { setEditingRule(i); setGlossaryDraft({ ...r }); }}>Edit</Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          className="h-6 px-2 text-destructive hover:text-destructive"
                          disabled={loading}
                          aria-label={`Remove ${r.source}`}
                          onClick={() => { setGlossaryRules(glossaryRules.filter((_, index) => index !== i)); setPlaygroundResult(null); setEditingRule(null); resetTranslationResult(); }}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>
                  )) : (
                    <p className="rounded-lg border border-dashed border-border/60 bg-background/30 p-3 text-xs text-muted-foreground">
                      {glossaryRules.length ? "No matching terms." : "No glossary rules yet. Add a term or select a preset."}
                    </p>
                  )}
                </div>

                <div className="space-y-3 border-t border-border/60 pt-4">
                  <div>
                    <h3 className="text-xs font-medium">Glossary playground</h3>
                    <p className="mt-1 text-[11px] text-muted-foreground">Preview protected tokens and restored names without consuming Gemini quota.</p>
                  </div>
                  <Textarea
                    rows={3}
                    value={playgroundInput}
                    maxLength={10000}
                    aria-label="Glossary playground text"
                    onChange={e => setPlaygroundInput(e.target.value)}
                    className="text-xs"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" className="h-8 gap-1" disabled={playgroundLoading} onClick={() => void runGlossaryPreview()}>
                      {playgroundLoading ? <><Loader2 className="size-3.5 animate-spin" />Checking…</> : <><Play className="size-3.5" />Preview protection</>}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1"
                      onClick={() => {
                        const snippet = `import json\nfrom glossary_engine import parse_glossary, mask_batch, restore_line\n\nrules = parse_glossary(json.loads(${JSON.stringify(JSON.stringify(glossaryRules))}))\nenglish = ["Tony Stark activated the Arc Reactor."]\nmasked, token_maps = mask_batch(english, rules)\n# Send masked text through the existing translation and review pipeline.\n# result = [translated_text]\n# final = [restore_line(text, mapping) for text, mapping in zip(result, token_maps)]`;
                        void navigator.clipboard.writeText(snippet).then(() => { setGlossaryNotice("Python integration example copied."); toast.success("Python snippet copied"); }).catch(() => setGlossaryNotice("Clipboard unavailable."));
                      }}
                    >
                      <Copy className="size-3.5" />Python snippet
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1"
                      onClick={() => {
                        const snippet = `const glossary = ${JSON.stringify(glossaryRules, null, 2)};\nconst form = new FormData();\nform.append("file", selectedSrtFile);\nform.append("style", "natural");\nform.append("glossary", JSON.stringify(glossary));\nform.append("output_format", "srt");\nform.append("opening_credit", "true");\nconst response = await fetch("${API}/translate-srt-stream", { method: "POST", body: form });`;
                        void navigator.clipboard.writeText(snippet).then(() => { setGlossaryNotice("JavaScript API example copied."); toast.success("JavaScript snippet copied"); }).catch(() => setGlossaryNotice("Clipboard unavailable."));
                      }}
                    >
                      <Copy className="size-3.5" />JS snippet
                    </Button>
                  </div>
                  {playgroundResult && (
                    <div className="space-y-2 rounded-lg border border-border/60 bg-background/40 p-3">
                      <p className="text-[11px] text-muted-foreground">Masked before Gemini</p>
                      <code className="block break-words font-mono text-[11px] text-foreground/90">{playgroundResult.masked}</code>
                      <p className="text-[11px] text-muted-foreground">Restored demonstration (not AI translated)</p>
                      <code className="block break-words font-mono text-[11px] text-foreground/90">{playgroundResult.restored_example}</code>
                      {playgroundResult.replacements.map((replacement, index) => (
                        <small key={index} className="block break-words text-[10px] text-muted-foreground">{replacement.placeholder} → {replacement.restored}</small>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        <footer className="mt-10 flex flex-col gap-2 border-t border-border/60 pt-5 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>SubNexa <span className="mx-2 text-border">/</span> Made for the story.</span>
          <span>Developed by E Unity Movie Family LK</span>
        </footer>
      </main>

      {readyDownload && !readyCardVisible && !translating && !isError && (
        <div className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-between gap-3 rounded-xl border border-success/30 bg-card/95 p-3 shadow-2xl backdrop-blur-xl sm:bottom-5 sm:left-auto sm:right-5 sm:w-[min(460px,calc(100vw-2.5rem))]">
          <div className="flex min-w-0 items-center gap-2.5">
            <CheckCircle2 className="size-4 shrink-0 text-success" />
            <div className="min-w-0">
              <p className="text-xs font-medium">Your file is ready</p>
              <p className="truncate text-[10px] text-muted-foreground">
                {editedIndices.length ? `${editedIndices.length} edited · ` : ""}{readyDownload.filename}
              </p>
            </div>
          </div>
          <Button size="sm" className="h-8 shrink-0 gap-1 text-xs" onClick={downloadTranslatedFile}>
            <Download className="size-3.5" />Download
          </Button>
        </div>
      )}
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

