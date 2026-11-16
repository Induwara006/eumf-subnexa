"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { openAuthPopup } from "@/lib/auth-popup";

const API = (
  process.env.NEXT_PUBLIC_SUBNEXA_API_URL ||
  (process.env.NODE_ENV === "production" ? "/subnexa-api" : "http://localhost:8000")
).replace(/\/$/, "");

type FileRow = { filename: string; format: string; cues: number | null; completed_at: string | null };
type Summary = {
  name: string;
  email: string;
  is_admin: boolean;
  completed_files: number;
  tracking_since: string;
  today: { files?: number | null; file_limit?: number | null; unlimited?: boolean } | null;
  files: FileRow[];
  files_total: number;
  files_unavailable: boolean;
  earlier_unnamed: number;
};
type NameInfo = { display_name: string | null; google_name: string; effective_name: string };

const card = "rounded-[5px] border border-border bg-[var(--next-gray-200)] p-4 sm:p-6";

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function ProfilePanel() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [nameInfo, setNameInfo] = useState<NameInfo | null>(null);
  const [state, setState] = useState<"loading" | "signed-out" | "error" | "ready">("loading");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const [s, n] = await Promise.all([
        fetch(`${API}/profile/summary?limit=50`, { credentials: "include", cache: "no-store" }),
        fetch(`${API}/profile/display-name`, { credentials: "include", cache: "no-store" }),
      ]);
      if (s.status === 401 || n.status === 401) {
        setState("signed-out");
        return;
      }
      if (!s.ok) throw new Error("summary");
      setSummary((await s.json()) as Summary);
      if (n.ok) {
        const info = (await n.json()) as NameInfo;
        setNameInfo(info);
        setDraft(info.display_name || "");
      }
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
    const reload = () => void load();
    window.addEventListener("subnexa-session-changed", reload);
    return () => window.removeEventListener("subnexa-session-changed", reload);
  }, [load]);

  async function saveName(value: string) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`${API}/profile/display-name`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: value }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Could not save. Please try again.");
      setNameInfo(data as NameInfo);
      setDraft((data as NameInfo).display_name || "");
      setMessage({
        kind: "ok",
        text: value.trim() ? "Saved. New translations will use this name." : "Reset. Your Google name will be used.",
      });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Could not save. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") return <p className="text-body" role="status">Loading your profile...</p>;

  if (state === "signed-out") {
    return (
      <div className={card}>
        <p className="text-body">Sign in with Google to see your profile and choose your public name.</p>
        <a
          className="mt-3 inline-block text-sm text-primary underline underline-offset-4"
          href={`${API}/subnexa-auth/login`}
          onClick={(e) => {
            e.preventDefault();
            openAuthPopup(`${API}/subnexa-auth/login`);
          }}
        >
          Sign in with Google
        </a>
      </div>
    );
  }

  if (state === "error" || !summary) {
    return (
      <div className={card}>
        <p className="text-body">Your profile could not be loaded right now.</p>
        <Button type="button" className="mt-3" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    );
  }

  const shownName = nameInfo?.effective_name || summary.name || "your name";
  const today = summary.today;
  const todayText = today?.unlimited
    ? "Unlimited"
    : typeof today?.files === "number" && typeof today?.file_limit === "number"
      ? `${today.files} of ${today.file_limit}`
      : "Not available";
  const changed = draft.trim() !== (nameInfo?.display_name || "");

  return (
    <div className="space-y-6">
      <section className={card} aria-label="Account">
        <p className="text-lg font-semibold text-ink">{summary.name || "SubNexa user"}</p>
        <p className="text-sm text-body">{summary.email}</p>
        <dl className="mt-5 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-content-tertiary">Translations completed</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{summary.completed_files}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-content-tertiary">Files today</dt>
            <dd className="mt-1 text-2xl font-semibold text-ink">{todayText}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-content-tertiary">Counting since</dt>
            <dd className="mt-1 text-2xl font-semibold text-ink">{formatDate(summary.tracking_since) || "-"}</dd>
          </div>
        </dl>
      </section>

      <section className={card} aria-label="Public display name">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-ink">Public display name</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-body">
          When a translation you finish is added to the public library, it shows &quot;Translated by&quot; with this name.
          It applies to translations you finish after saving. Items already in the library keep their old name.
        </p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void saveName(draft);
          }}
        >
          <label className="block text-xs">
            <span className="font-medium text-body">Name</span>
            <input
              value={draft}
              maxLength={40}
              disabled={busy}
              onChange={(e) => {
                setDraft(e.target.value);
                setMessage(null);
              }}
              placeholder={nameInfo?.google_name || "Your name"}
              className="mt-1.5 w-full max-w-md rounded-[5px] border border-input bg-background px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ring disabled:opacity-60"
            />
          </label>
          <p className="text-xs text-content-tertiary">
            Preview: Translated by <span className="text-body">{draft.trim() || nameInfo?.google_name || shownName}</span>
          </p>
          <p className="text-[11px] leading-relaxed text-content-tertiary">
            2 to 40 letters or numbers. Spaces and . - _ &apos; are allowed. No links.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={busy || !changed || !draft.trim()}>
              {busy ? "Saving..." : "Save name"}
            </Button>
            {nameInfo?.display_name && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveName("")}
                className="text-xs text-body underline underline-offset-4 hover:text-ink disabled:opacity-60"
              >
                Use my Google name
              </button>
            )}
            {message && (
              <p role="status" className={`text-xs ${message.kind === "error" ? "text-red-400" : "text-body"}`}>
                {message.text}
              </p>
            )}
          </div>
        </form>
      </section>

      <section className={card} aria-label="Your translated files">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-ink">Your translated files</h2>
        {summary.files.length > 0 ? (
          <ul className="mt-4 divide-y divide-border">
            {summary.files.map((f, i) => (
              <li key={`${f.filename}-${i}`} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm">
                <span className="min-w-0 break-all text-ink">{f.filename}</span>
                <span className="text-xs text-content-tertiary">
                  {f.format.toUpperCase()}
                  {typeof f.cues === "number" ? ` · ${f.cues} lines` : ""}
                  {f.completed_at ? ` · ${formatDate(f.completed_at)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-body">
            {summary.files_unavailable ? "The file list is not available right now." : "No translated files recorded yet."}
          </p>
        )}
        {summary.earlier_unnamed > 0 && (
          <p className="mt-3 text-xs text-content-tertiary">
            Plus {summary.earlier_unnamed} earlier translation{summary.earlier_unnamed === 1 ? "" : "s"} counted before file names were recorded.
          </p>
        )}
      </section>
    </div>
  );
}
