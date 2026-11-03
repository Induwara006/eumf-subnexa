"use client";
// SUBNEXA_ADMIN_DASHBOARD_V1
// SUBNEXA_ADMIN_DASHBOARD_V2 (rename)
// SUBNEXA_ADMIN_DASHBOARD_V3 (poster picker: TMDB, drag & drop, paste, link)
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Check, Eye, ImagePlus, Loader2, Lock, Pencil, Search, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminProofHeaders, clearAdminSession, ensureAdminSession } from "@/lib/admin-proof";

type Tab = "approvals" | "requests" | "library";
type Submission = { id: string; title: string; year: string; format: string; status: string; created_at: string; admin_note: string | null };
type Ticket = { id: string; title: string; details: string; status: string; admin_note: string | null; created_at: string; kind: string | null };
type LibItem = { id: string | number; title: string; year: string; format: string; downloads: number; poster_url: string | null };
type Notice = { ok: boolean; text: string };
type PosterMatch = { id: number; type: string; title: string; year: string; poster_url: string };

const TABS: { id: Tab; label: string }[] = [
  { id: "approvals", label: "Subtitle approvals" },
  { id: "requests", label: "Subtitle requests" },
  { id: "library", label: "Library management" },
];

function statusClass(status: string) {
  if (status === "approved" || status === "resolved") return "bg-success/15 text-green-700";
  if (status === "rejected") return "bg-destructive/10 text-destructive";
  if (status === "in_progress") return "bg-blue-500/10 text-blue-700";
  return "bg-amber-500/20 text-warning";
}

async function readError(response: Response, fallback: string) {
  const data = await response.json().catch(() => ({}));
  return typeof data?.detail === "string" ? data.detail : fallback;
}

export default function AdminDashboard() {
  const [key, setKey] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState("");
  const [tab, setTab] = useState<Tab>("approvals");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [subs, setSubs] = useState<Submission[]>([]);
  const [showReviewed, setShowReviewed] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{ title: string; format: string; text: string } | null>(null);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketFilter, setTicketFilter] = useState<"request" | "report" | "all">("request");

  const [libQuery, setLibQuery] = useState("");
  const [libItems, setLibItems] = useState<LibItem[]>([]);
  const [posterV, setPosterV] = useState<Record<string, number>>({});
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [posterFor, setPosterFor] = useState<LibItem | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerResults, setPickerResults] = useState<PosterMatch[]>([]);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [pickerError, setPickerError] = useState("");
  const [dragging, setDragging] = useState(false);

  function lock(message = "") {
    clearAdminSession();
    void fetch("/api/library/admin/logout", { method: "POST", cache: "no-store" }).catch(() => {});
    setUnlocked(false);
    setKey("");
    setNotice(null);
    setUnlockError(message);
  }

  function fail(error: unknown) {
    setNotice({ ok: false, text: error instanceof Error ? error.message : "Something went wrong." });
  }

  // Every privileged request carries the admin password header; the server also checks the
  // Google-verified admin session cookie. A 401/403 locks the dashboard again.
  async function call(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    for (const [name, value] of Object.entries(adminProofHeaders(key))) headers.set(name, value);
    const response = await fetch(path, { ...init, headers, cache: "no-store" });
    if (response.status === 401 || response.status === 403) {
      lock(await readError(response, "Admin session ended. Unlock again."));
      throw new Error("Admin session ended. Unlock again.");
    }
    return response;
  }

  async function loadApprovals() {
    setBusy(true); setNotice(null);
    try {
      const response = await call("/api/library/community/queue");
      if (!response.ok) throw new Error(await readError(response, "Could not load submissions."));
      const data = await response.json();
      setSubs(Array.isArray(data.items) ? data.items : []);
    } catch (error) { fail(error); } finally { setBusy(false); }
  }

  async function loadTickets() {
    setBusy(true); setNotice(null);
    try {
      const response = await call("/api/library/admin/requests");
      if (!response.ok) throw new Error(await readError(response, "Could not load requests."));
      const data = await response.json();
      setTickets(Array.isArray(data.items) ? data.items : []);
    } catch (error) { fail(error); } finally { setBusy(false); }
  }

  async function loadLibrary(query = libQuery) {
    setBusy(true); setNotice(null);
    try {
      const response = await call(`/api/library/items?q=${encodeURIComponent(query.trim())}&limit=100`);
      if (!response.ok) throw new Error(await readError(response, "Could not load the library."));
      const data = await response.json();
      setLibItems(Array.isArray(data.items) ? data.items : []);
    } catch (error) { fail(error); } finally { setBusy(false); }
  }

  function loadTab(next: Tab) {
    if (next === "approvals") return loadApprovals();
    if (next === "requests") return loadTickets();
    return loadLibrary();
  }

  function switchTab(next: Tab) {
    setTab(next);
    void loadTab(next);
  }

  async function unlock() {
    if (!key || unlocking) return;
    setUnlocking(true); setUnlockError("");
    try {
      // Opens the Google admin popup (must start from this click), checks the password and
      // creates the short-lived server-side admin session.
      await ensureAdminSession(key);
      setUnlocked(true);
      await loadApprovals();
    } catch (error) {
      setUnlockError(error instanceof Error ? error.message : "Admin verification failed.");
    } finally { setUnlocking(false); }
  }

  async function previewSubmission(item: Submission) {
    setBusy(true); setNotice(null);
    try {
      const response = await call(`/api/library/community/preview/${item.id}`);
      if (!response.ok) throw new Error(await readError(response, "Could not open the subtitle preview."));
      setPreview({ title: item.title, format: item.format, text: await response.text() });
    } catch (error) { fail(error); } finally { setBusy(false); }
  }

  function downloadPreview() {
    if (!preview) return;
    const url = URL.createObjectURL(new Blob([preview.text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `review.${preview.format}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }

  async function review(item: Submission, status: "approved" | "rejected") {
    const note = (notes[item.id] ?? "").trim();
    if (note.length > 500) { setNotice({ ok: false, text: "Admin note must be 500 characters or fewer." }); return; }
    if (status === "approved" && !window.confirm(`Publish "${item.title}" to the public library?`)) return;
    if (status === "rejected" && !window.confirm(`Decline "${item.title}"?`)) return;
    setBusy(true); setNotice(null);
    try {
      const response = await call(`/api/library/community/review/${item.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, note }),
      });
      if (!response.ok) throw new Error(await readError(response, "Review failed."));
      setNotice({ ok: true, text: status === "approved" ? `Approved and published: ${item.title}` : `Declined: ${item.title}` });
      await loadApprovals();
      window.dispatchEvent(new Event("subnexa-library-updated"));
    } catch (error) { fail(error); setBusy(false); }
  }

  async function updateTicket(item: Ticket, status: string) {
    const note = item.admin_note ?? "";
    if (note.length > 1000) { setNotice({ ok: false, text: "Note must be 1000 characters or fewer." }); return; }
    setBusy(true); setNotice(null);
    try {
      const response = await call(`/api/library/admin/reports/${item.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, admin_note: note }),
      });
      if (!response.ok) throw new Error(await readError(response, "Could not update."));
      setTickets(list => list.map(x => (x.id === item.id ? { ...x, status } : x)));
      setNotice({ ok: true, text: `Saved: ${item.title}` });
    } catch (error) { fail(error); } finally { setBusy(false); }
  }

  async function deleteItem(item: LibItem) {
    if (!window.confirm(`Delete "${item.title}" from the library? This cannot be undone.`)) return;
    setBusy(true); setNotice(null);
    try {
      const response = await call(`/api/library/items/${item.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await readError(response, "Delete failed."));
      setNotice({ ok: true, text: `Deleted ${item.title}.` });
      await loadLibrary();
      window.dispatchEvent(new Event("subnexa-library-updated"));
    } catch (error) { fail(error); setBusy(false); }
  }

  async function renameItem(item: LibItem, value: string) {
    const title = value.trim();
    if (!title || title.length > 120) { setNotice({ ok: false, text: "Title must be 1–120 characters." }); return; }
    if (title === item.title) { setRenaming(null); return; }
    setBusy(true); setNotice(null);
    try {
      const response = await call(`/api/library/items/${item.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }),
      });
      if (!response.ok) throw new Error(await readError(response, "Rename failed."));
      setRenaming(null);
      setNotice({ ok: true, text: `Renamed to "${title}".` });
      await loadLibrary();
      window.dispatchEvent(new Event("subnexa-library-updated"));
    } catch (error) { fail(error); setBusy(false); }
  }

  function openPicker(item: LibItem) {
    setPosterFor(item);
    setPickerQuery(item.title.replace(/[ ._-]+s\d{1,2}[ ._-]*e\d{1,3}.*$/i, "").trim());
    setPickerResults([]); setPickerError(""); setDragging(false);
  }

  async function searchPicker() {
    const q = pickerQuery.trim();
    if (q.length < 2) { setPickerError("Enter at least two characters."); return; }
    setPickerBusy(true); setPickerError(""); setPickerResults([]);
    try {
      const response = await call(`/api/library/posters/search?q=${encodeURIComponent(q)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data?.detail === "string" ? data.detail : "TMDB search failed.");
      const results: PosterMatch[] = Array.isArray(data.results) ? data.results : [];
      setPickerResults(results);
      if (!results.length) setPickerError("No matching poster found. Try another title or add an image.");
    } catch (error) { setPickerError(error instanceof Error ? error.message : "TMDB search failed."); }
    finally { setPickerBusy(false); }
  }

  async function applyPoster(item: LibItem, file: File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size < 1 || file.size > 2 * 1024 * 1024) {
      setPickerError("Choose a JPG, PNG or WebP poster up to 2 MB."); return;
    }
    setPickerBusy(true); setPickerError("");
    try {
      const form = new FormData();
      form.append("poster_image", file);
      const response = await call(`/api/library/items/${item.id}/poster`, { method: "PATCH", body: form });
      if (!response.ok) throw new Error(await readError(response, "Poster update failed."));
      setPosterV(map => ({ ...map, [String(item.id)]: Date.now() }));
      setPosterFor(null);
      setNotice({ ok: true, text: `Poster updated for ${item.title}.` });
      window.dispatchEvent(new Event("subnexa-library-updated"));
      setPickerBusy(false);
      await loadLibrary();
    } catch (error) {
      setPickerError(error instanceof Error ? error.message : "Poster update failed.");
      setPickerBusy(false);
    }
  }

  // TMDB result, dropped image link or pasted link: the server fetches it safely, then it is saved like an upload.
  async function importAndApply(item: LibItem, url: string) {
    setPickerBusy(true); setPickerError("");
    try {
      const response = await call("/api/library/poster/import", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.trim() }),
      });
      if (!response.ok) throw new Error(await readError(response, "Could not import the image."));
      const blob = await response.blob();
      const mime = blob.type.split(";")[0];
      const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
      setPickerBusy(false);
      await applyPoster(item, new File([blob], `poster.${ext}`, { type: mime }));
    } catch (error) {
      setPickerError(error instanceof Error ? error.message : "Could not import the image.");
      setPickerBusy(false);
    }
  }

  const pending = subs.filter(x => x.status === "pending");
  const visibleSubs = showReviewed ? subs : pending;
  const hasKinds = tickets.some(x => x.kind);
  const visibleTickets = hasKinds && ticketFilter !== "all" ? tickets.filter(x => x.kind === ticketFilter) : tickets;

  return (
    <main className="min-h-screen bg-background text-ink">
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-body hover:text-ink"><ArrowLeft className="size-3.5" />Back to SubNexa</Link>
            <h1 className="mt-2 text-2xl font-semibold">Admin dashboard</h1>
          </div>
          {unlocked && <Button variant="outline" size="sm" className="gap-1.5" onClick={() => lock()}><Lock className="size-3.5" />Lock</Button>}
        </div>

        {!unlocked ? (
          <div className="max-w-md space-y-3 rounded-xl border border-border bg-ink/[0.03] p-5">
            <p className="text-sm text-body">Admins only. Unlocking opens a Google sign-in popup to verify your admin account, then checks the admin password.</p>
            <div className="flex gap-2">
              <Input aria-label="Admin password" type="password" autoComplete="off" placeholder="Admin password" value={key}
                onChange={e => { setKey(e.target.value); setUnlockError(""); }}
                onKeyDown={e => { if (e.key === "Enter") void unlock(); }} />
              <Button onClick={() => void unlock()} disabled={unlocking || !key} className="shrink-0 gap-2">
                {unlocking ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}Unlock
              </Button>
            </div>
            {unlockError && <p role="alert" className="text-xs text-destructive">{unlockError}</p>}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2" role="tablist">
              {TABS.map(t => (
                <button key={t.id} role="tab" aria-selected={tab === t.id} disabled={busy} onClick={() => switchTab(t.id)}
                  className={`rounded-md border px-3 py-1.5 text-sm ${tab === t.id ? "border-primary bg-primary/15 text-ink" : "border-border text-body hover:text-ink"}`}>
                  {t.label}{t.id === "approvals" && pending.length > 0 ? ` (${pending.length})` : ""}
                </button>
              ))}
              {busy && <Loader2 className="size-4 animate-spin self-center text-body" />}
            </div>
            {notice && <p role="status" className={`text-sm ${notice.ok ? "text-success" : "text-destructive"}`}>{notice.text}</p>}

            {tab === "approvals" && (
              <section className="space-y-3">
                <label className="flex items-center gap-2 text-xs text-body">
                  <input type="checkbox" checked={showReviewed} onChange={e => setShowReviewed(e.target.checked)} />Show already reviewed submissions
                </label>
                {visibleSubs.length === 0 && !busy && <p className="text-sm text-body">No submissions waiting for review.</p>}
                {visibleSubs.map(item => (
                  <article key={item.id} className="space-y-3 rounded-xl border border-border bg-ink/[0.03] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{item.title}{item.year ? ` (${item.year})` : ""}</h2>
                      <Badge className="uppercase">{item.format}</Badge>
                      <Badge className={statusClass(item.status)}>{item.status}</Badge>
                      <span className="text-xs text-content-tertiary">{new Date(item.created_at).toLocaleString()}</span>
                    </div>
                    {item.status === "pending" ? (
                      <>
                        <textarea aria-label="Admin note" maxLength={500} rows={2} placeholder="Admin note (optional, max 500 characters)"
                          value={notes[item.id] ?? ""} onChange={e => setNotes(map => ({ ...map, [item.id]: e.target.value }))}
                          className="w-full rounded-md border border-border bg-ink/[0.04] p-2 text-sm" />
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" disabled={busy} className="gap-1.5" onClick={() => void previewSubmission(item)}><Eye className="size-3.5" />Preview</Button>
                          <Button size="sm" disabled={busy} className="gap-1.5" onClick={() => void review(item, "approved")}><Check className="size-3.5" />Approve</Button>
                          <Button size="sm" variant="outline" disabled={busy} className="gap-1.5" onClick={() => void review(item, "rejected")}><X className="size-3.5" />Decline</Button>
                        </div>
                      </>
                    ) : item.admin_note ? <p className="text-xs text-body">Note: {item.admin_note}</p> : null}
                  </article>
                ))}
              </section>
            )}

            {tab === "requests" && (
              <section className="space-y-3">
                {hasKinds ? (
                  <select aria-label="Show" value={ticketFilter} onChange={e => setTicketFilter(e.target.value as "request" | "report" | "all")}
                    className="rounded-md border border-input bg-surface-primary p-2 text-sm">
                    <option value="request">Subtitle requests</option>
                    <option value="report">Translation issue reports</option>
                    <option value="all">Everything</option>
                  </select>
                ) : tickets.length > 0 && <p className="text-xs text-warning">The table has no request/report type column, so everything is listed together.</p>}
                {visibleTickets.length === 0 && !busy && <p className="text-sm text-body">Nothing here yet.</p>}
                {visibleTickets.map(item => (
                  <article key={item.id} className="space-y-3 rounded-xl border border-border bg-ink/[0.03] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{item.title}</h2>
                      {item.kind && <Badge className="uppercase">{item.kind}</Badge>}
                      <Badge className={statusClass(item.status)}>{item.status}</Badge>
                      <span className="text-xs text-content-tertiary">{new Date(item.created_at).toLocaleString()}</span>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm text-ink/80">{item.details}</p>
                    <textarea aria-label="Internal note" maxLength={1000} rows={2} placeholder="Internal note"
                      value={item.admin_note ?? ""}
                      onChange={e => setTickets(list => list.map(x => (x.id === item.id ? { ...x, admin_note: e.target.value } : x)))}
                      className="w-full rounded-md border border-border bg-ink/[0.04] p-2 text-sm" />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => void updateTicket(item, "in_progress")}>In progress</Button>
                      <Button size="sm" disabled={busy} className="gap-1.5" onClick={() => void updateTicket(item, "resolved")}><Check className="size-3.5" />Approve / done</Button>
                      <Button size="sm" variant="outline" disabled={busy} className="gap-1.5" onClick={() => void updateTicket(item, "rejected")}><X className="size-3.5" />Decline</Button>
                    </div>
                  </article>
                ))}
              </section>
            )}

            {tab === "library" && (
              <section className="space-y-3">
                <form className="flex gap-2" onSubmit={e => { e.preventDefault(); void loadLibrary(); }}>
                  <Input aria-label="Search library" placeholder="Search by title or year" maxLength={80} value={libQuery} onChange={e => setLibQuery(e.target.value)} />
                  <Button type="submit" disabled={busy} className="shrink-0 gap-1.5"><Search className="size-4" />Search</Button>
                </form>
                {libItems.length === 0 && !busy && <p className="text-sm text-body">No subtitles found. Try searching by title.</p>}
                {libItems.map(item => (
                  <article key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-ink/[0.03] p-3">
                    {item.poster_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api${item.poster_url}?v=${posterV[String(item.id)] ?? 0}`} alt="" loading="lazy" className="h-16 w-11 shrink-0 rounded object-cover" />
                    ) : <div className="grid h-16 w-11 shrink-0 place-items-center rounded bg-sand text-[9px] text-content-tertiary">No poster</div>}
                    <div className="min-w-0 flex-1 basis-48">
                      {renaming?.id === String(item.id) ? (
                        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); void renameItem(item, renaming.value); }}>
                          <Input aria-label="New title" autoFocus maxLength={120} value={renaming.value}
                            onChange={e => setRenaming({ id: renaming.id, value: e.target.value })}
                            onKeyDown={e => { if (e.key === "Escape") setRenaming(null); }} />
                          <Button type="submit" size="sm" disabled={busy}>Save</Button>
                          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setRenaming(null)}>Cancel</Button>
                        </form>
                      ) : <p className="truncate text-sm font-semibold" title={item.title}>{item.title}</p>}
                      <p className="text-xs text-body">{[item.year, item.format.toUpperCase(), `${item.downloads} downloads`].filter(Boolean).join(" · ")}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={busy} className="gap-1.5" onClick={() => setRenaming({ id: String(item.id), value: item.title })}><Pencil className="size-3.5" />Rename</Button>
                      <Button size="sm" variant="outline" disabled={busy} className="gap-1.5" onClick={() => openPicker(item)}><ImagePlus className="size-3.5" />{item.poster_url ? "Change poster" : "Add poster"}</Button>
                      <Button size="icon" variant="outline" disabled={busy} className="size-8 shrink-0" aria-label={`Delete ${item.title}`} onClick={() => void deleteItem(item)}><Trash2 className="size-3.5" /></Button>
                    </div>
                  </article>
                ))}
              </section>
            )}
          </>
        )}
      </div>

      {unlocked && posterFor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/40 p-4" role="presentation">
          <div tabIndex={0} role="dialog" aria-modal="true" aria-label="Change poster"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-input bg-surface-primary p-5 shadow-2xl focus:outline-none"
            onPaste={e => {
              if (pickerBusy) return;
              const file = Array.from(e.clipboardData.items).find(x => x.type.startsWith("image/"))?.getAsFile();
              if (file) { e.preventDefault(); void applyPoster(posterFor, file); }
            }}>
            <h2 className="mb-1 text-base font-semibold">{posterFor.poster_url ? "Change" : "Add"} poster: {posterFor.title}</h2>
            <p className="mb-3 text-xs text-body">Search TMDB, drop an image here, paste with Ctrl+V, use an image link, or choose a JPG/PNG/WebP file (max 2 MB).</p>
            <form className="mb-3 flex gap-2" onSubmit={e => { e.preventDefault(); void searchPicker(); }}>
              <Input aria-label="Search TMDB posters" value={pickerQuery} onChange={e => setPickerQuery(e.target.value)} placeholder="Movie or TV series title" />
              <Button type="submit" disabled={pickerBusy} className="shrink-0">{pickerBusy ? "Working…" : "TMDB Search"}</Button>
            </form>
            {pickerResults.length > 0 && (
              <div className="mb-3 grid max-h-60 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
                {pickerResults.map(match => (
                  <button type="button" key={`${match.type}-${match.id}`} disabled={pickerBusy} onClick={() => void importAndApply(posterFor, match.poster_url)}
                    className="rounded border border-input p-1 text-left hover:border-primary disabled:opacity-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={match.poster_url} alt={match.title} referrerPolicy="no-referrer" className="aspect-[2/3] w-full rounded object-cover" />
                    <span className="block truncate text-[10px]">{match.title} {match.year}</span>
                  </button>
                ))}
              </div>
            )}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => {
                e.preventDefault(); setDragging(false);
                if (pickerBusy) return;
                const file = e.dataTransfer.files[0];
                if (file) { void applyPoster(posterFor, file); return; }
                const url = (e.dataTransfer.getData("text/uri-list").split("\n").find(x => x && !x.startsWith("#")) || e.dataTransfer.getData("text/plain")).trim();
                if (url) void importAndApply(posterFor, url);
              }}
              className={`rounded-lg border border-dashed p-4 text-center text-xs text-body ${dragging ? "border-primary bg-primary/10" : "border-input"}`}>
              Drag & drop an image or an image link here
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose poster file" disabled={pickerBusy}
                className="max-w-[14rem] text-xs"
                onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void applyPoster(posterFor, file); }} />
              <Button type="button" size="sm" variant="outline" disabled={pickerBusy}
                onClick={() => { const url = window.prompt("Direct image link (JPG/PNG/WebP):"); if (url?.trim()) void importAndApply(posterFor, url); }}>Use image link</Button>
              <Button type="button" size="sm" variant="ghost" disabled={pickerBusy} className="ml-auto" onClick={() => setPosterFor(null)}>Close</Button>
            </div>
            {pickerBusy && <p role="status" className="mt-2 text-xs text-ink/75">Working on poster…</p>}
            {pickerError && <p role="alert" className="mt-2 text-xs text-destructive">{pickerError}</p>}
            <p className="mt-3 text-[10px] text-content-tertiary">This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/40 p-4" role="presentation">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-3 rounded-xl border border-input bg-surface-primary p-5" role="dialog" aria-modal="true" aria-label="Subtitle preview">
            <h2 className="text-base font-semibold">Preview: {preview.title}</h2>
            <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words rounded-md bg-sand p-3 text-xs text-ink/85">{preview.text.slice(0, 30000)}{preview.text.length > 30000 ? "\n\n… (preview truncated — use Download for the full file)" : ""}</pre>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={downloadPreview}>Download full file</Button>
              <Button size="sm" variant="ghost" onClick={() => setPreview(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
