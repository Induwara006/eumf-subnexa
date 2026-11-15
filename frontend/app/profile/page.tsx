"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CalendarClock, FileText, Loader2, ShieldCheck } from "lucide-react";

import ThemeToggle from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

const API = (
  process.env.NEXT_PUBLIC_SUBNEXA_API_URL ||
  (process.env.NODE_ENV === "production" ? "/subnexa-api" : "http://localhost:8000")
).replace(/\/$/, "");
const PAGE_SIZE = 50;

type FileRow = { filename: string; format: "srt" | "ass"; cues: number | null; completed_at: string | null };
type Summary = {
  name: string;
  email: string;
  is_admin: boolean;
  completed_files: number;
  tracking_since: string;
  today: { files: number | null; file_limit: number | null; reset_at: string | null; unlimited: boolean } | null;
  files: FileRow[];
  files_total: number;
  files_unavailable: boolean;
  earlier_unnamed: number;
};

function formatDate(iso: string | null, withTime = false): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit", hour12: true } : {}),
  }).format(date);
}

export default function ProfilePage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "signed-out" | "error">("loading");
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (offset: number, signal?: AbortSignal) => {
    const response = await fetch(`${API}/profile/summary?limit=${PAGE_SIZE}&offset=${offset}`, {
      credentials: "include",
      cache: "no-store",
      signal,
    });
    if (response.status === 401) return "signed-out" as const;
    if (!response.ok) throw new Error("profile unavailable");
    const data = (await response.json()) as Summary;
    setSummary(data);
    setFiles((current) => (offset === 0 ? data.files : [...current, ...data.files]));
    return "ready" as const;
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    load(0, controller.signal)
      .then((next) => { if (!controller.signal.aborted) setStatus(next); })
      .catch(() => { if (!controller.signal.aborted) setStatus("error"); });
    return () => controller.abort();
  }, [load]);

  async function showMore() {
    setLoadingMore(true);
    try { await load(files.length); } catch { /* keep what is already shown */ } finally { setLoadingMore(false); }
  }

  const today = summary?.today;
  const used = today?.files ?? 0;
  const limit = today?.file_limit ?? 0;
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const hasMore = summary ? files.length < summary.files_total : false;

  return (
    <main className="min-h-screen bg-background text-ink">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-body hover:text-ink">
          <ArrowLeft className="size-4" />Back to Studio
        </Link>
        <ThemeToggle />
      </header>

      <div className="mx-auto max-w-3xl space-y-6 px-4 pb-16">
        {status === "loading" && (
          <p className="flex items-center gap-2 text-sm text-body" role="status">
            <Loader2 className="size-4 animate-spin" />Loading your profile…
          </p>
        )}

        {status === "signed-out" && (
          <div className="rounded-lg border border-border bg-card p-6 text-sm">
            <p className="font-medium">Sign in to see your profile.</p>
            <Button asChild size="sm" className="mt-4"><Link href="/">Go to sign in</Link></Button>
          </div>
        )}

        {status === "error" && (
          <div className="rounded-lg border border-border bg-card p-6 text-sm" role="alert">
            <p className="font-medium">Your profile is temporarily unavailable.</p>
            <Button size="sm" variant="outline" className="mt-4" onClick={() => window.location.reload()}>Try again</Button>
          </div>
        )}

        {status === "ready" && summary && (
          <>
            <section>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-content-tertiary">Profile</p>
              <h1 className="mt-1 text-2xl font-semibold">{summary.name || "SubNexa user"}</h1>
              {summary.email && <p className="text-sm text-body">{summary.email}</p>}
              {summary.is_admin && (
                <Link href="/admin" className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-body hover:text-ink">
                  <ShieldCheck className="size-3.5" />Open the admin dashboard
                </Link>
              )}
            </section>

            <section className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs text-body">Files today</p>
                {today ? (
                  today.unlimited ? (
                    <p className="mt-2 text-2xl font-semibold">Unlimited</p>
                  ) : (
                    <>
                      <p className="mt-2 text-2xl font-semibold tabular-nums">{used}<span className="text-base text-body"> / {limit}</span></p>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/10" aria-hidden>
                        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                      </div>
                    </>
                  )
                ) : (
                  <p className="mt-2 text-sm text-body">Not available right now</p>
                )}
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs text-body">Files translated (total)</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">{summary.completed_files}</p>
                <p className="mt-1 text-[11px] text-content-tertiary">since {formatDate(summary.tracking_since)}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="flex items-center gap-1.5 text-xs text-body"><CalendarClock className="size-3.5" />Daily reset</p>
                <p className="mt-2 text-sm font-medium">
                  {today?.reset_at ? formatDate(today.reset_at, true) : "—"}
                </p>
                <p className="mt-1 text-[11px] text-content-tertiary">Sri Lanka time</p>
              </div>
            </section>

            <section className="rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold">Files you translated</h2>
                {summary.files_total > 0 && <span className="text-xs text-body">{summary.files_total}</span>}
              </div>

              {summary.files_unavailable ? (
                <p className="px-4 py-6 text-sm text-body">The file list is not available yet.</p>
              ) : files.length === 0 ? (
                <p className="px-4 py-6 text-sm text-body">
                  Files you finish translating will be listed here.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {files.map((file, index) => (
                    <li key={`${file.completed_at}-${index}`} className="flex items-center gap-3 px-4 py-2.5">
                      <FileText className="size-4 shrink-0 text-content-tertiary" />
                      <span className="min-w-0 flex-1 truncate text-sm" title={file.filename}>{file.filename}</span>
                      <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase text-body">{file.format}</span>
                      <span className="hidden shrink-0 text-xs text-content-tertiary sm:inline">{formatDate(file.completed_at)}</span>
                    </li>
                  ))}
                </ul>
              )}

              {hasMore && (
                <div className="border-t border-border p-3 text-center">
                  <Button size="sm" variant="outline" onClick={showMore} disabled={loadingMore}>
                    {loadingMore ? "Loading…" : "Show more"}
                  </Button>
                </div>
              )}
              {summary.earlier_unnamed > 0 && !summary.files_unavailable && (
                <p className="border-t border-border px-4 py-3 text-[11px] text-content-tertiary">
                  {summary.earlier_unnamed} earlier {summary.earlier_unnamed === 1 ? "file was" : "files were"} translated before file names were recorded, so they are counted above but not listed.
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
