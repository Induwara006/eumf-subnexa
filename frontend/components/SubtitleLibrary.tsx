"use client";
import Link from "next/link";
import CommunityForm from "./CommunityForm";

import { useEffect, useRef, useState } from "react";
import { Download, Film, Loader2, Lock, Plus, Search, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PosterMatch = { id: number; type: string; title: string; year: string; poster_url: string };

type LibraryItem = {
  id: string | number;
  title: string;
  year: string;
  language: string;
  format: "srt" | "ass";
  downloads: number;
  poster_url: string | null;
  download_url: string;
  translated_by?: string | null;
  kind?: "movie" | "season";
  season_key?: string | null;
  season_slug?: string | null;
  series_title?: string | null;
  season_number?: number | null;
  episode_number?: number | null;
  episode_count?: number;
  file_count?: number;
};

function Poster({ item, api }: { item: LibraryItem; api: string }) {
  const [failed, setFailed] = useState(false);
  if (!item.poster_url || failed) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-white/5 to-black/60 p-3 text-center">
        <Film className="size-8 text-white/40" />
        <span className="text-xs font-semibold text-white/70">{item.title}</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${api}${item.poster_url}`}
      alt={`${item.title} poster`}
      loading="lazy"
      onError={() => setFailed(true)}
      className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-105"
    />
  );
}

/** Search bar + poster grid + owner tools. Used by the popup and by the /library page. */
export function LibraryBrowser({ api: translationApi, autoFocus = false, seasonKey }: { api: string; autoFocus?: boolean; seasonKey?: string }) {
  // Keep the existing caller prop compatible; library requests use Vercel.
  void translationApi;
  const api = "/api";
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [seasonInfo, setSeasonInfo] = useState<{series_title: string; season_number: number; year: string; episode_count: number} | null>(null);
  const [seasonNumber, setSeasonNumber] = useState("");
  const [episodeNumber, setEpisodeNumber] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadTick, setReloadTick] = useState(0);
  useEffect(() => {
    const refresh = () => setReloadTick(tick => tick + 1);
    window.addEventListener("subnexa-library-updated", refresh);
    return () => window.removeEventListener("subnexa-library-updated", refresh);
  }, []);

  // Restricted area (upload / delete). The password is kept only in memory and is
  // checked by the server before any upload tools are shown.
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState("");
  const [ownerKey, setOwnerKey] = useState("");
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [subFile, setSubFile] = useState<File | null>(null);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterLink, setPosterLink] = useState("");
  const [posterPreview, setPosterPreview] = useState("");
  const [posterError, setPosterError] = useState("");
  const [posterBusy, setPosterBusy] = useState(false);
  const [posterMatches, setPosterMatches] = useState<PosterMatch[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [selectedTitle, setSelectedTitle] = useState("");
  const posterRequest = useRef<AbortController | null>(null);
  const posterInput = useRef<HTMLInputElement>(null);
  const subInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!posterFile) { setPosterPreview(""); return; }
    const url = URL.createObjectURL(posterFile);
    setPosterPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [posterFile]);
  useEffect(() => () => posterRequest.current?.abort(), []);
  useEffect(() => {
    setPosterMatches([]); setSearchMessage(""); setSearchBusy(false);
    if (!unlocked || !ownerOpen || title.trim().length < 2 || title === selectedTitle) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearchBusy(true);
      try {
        const response = await fetch(`/api/library/posters/search?q=${encodeURIComponent(title.trim())}`, {
          headers: { "X-Library-Admin-Key": ownerKey }, signal: controller.signal, cache: "no-store"
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Poster search failed.");
        if (!controller.signal.aborted) {
          setPosterMatches(data.results || []);
          if (!data.results?.length) setSearchMessage("No poster matches. Try another title or add an image below.");
        }
      } catch (error) {
        if (!controller.signal.aborted) setSearchMessage(error instanceof Error ? error.message : "Poster search failed.");
      } finally { if (!controller.signal.aborted) setSearchBusy(false); }
    }, 600);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [title, ownerKey, unlocked, ownerOpen, selectedTitle]);

  function choosePoster(file: File | null) {
    if (!file) return;
    posterRequest.current?.abort(); setPosterBusy(false);
    if (!["image/jpeg","image/png","image/webp"].includes(file.type)) { setPosterError("Choose a JPG, PNG or WebP image."); return; }
    if (file.size > 2 * 1024 * 1024) { setPosterError("Poster is larger than 2 MB."); return; }
    setPosterFile(file); setPosterError("");
  }
  async function importPoster(url: string, match?: PosterMatch) {
    posterRequest.current?.abort();
    const controller = new AbortController(); posterRequest.current = controller;
    setPosterBusy(true); setPosterError("");
    try {
      const response = await fetch("/api/library/poster/import", { method: "POST",
        headers: { "Content-Type": "application/json", "X-Library-Admin-Key": ownerKey },
        body: JSON.stringify({ url }), signal: controller.signal });
      if (!response.ok) { const data = await response.json(); throw new Error(data.detail || "Image import failed."); }
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const ext = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg";
      setPosterFile(new File([blob], `poster.${ext}`, { type: blob.type }));
      setPosterLink("");
      if (posterInput.current) posterInput.current.value = "";
      if (match) { setSelectedTitle(match.title); setTitle(match.title.slice(0,120)); setYear(match.year); setPosterMatches([]); }
    } catch (error) {
      if (!controller.signal.aborted) setPosterError(error instanceof Error ? error.message : "Could not import image.");
    } finally { if (!controller.signal.aborted) setPosterBusy(false); }
  }
  function clearPoster() {
    posterRequest.current?.abort(); setPosterBusy(false); setPosterFile(null); setPosterLink(""); setPosterError("");
    if (posterInput.current) posterInput.current.value = "";
  }
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${api}/library/${seasonKey ? `seasons/${seasonKey}` : "browse"}?q=${encodeURIComponent(query.trim())}&offset=${offset}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Could not load the subtitle library.");
        const data = (await response.json()) as { items: LibraryItem[]; total: number; series_title: string; season_number: number; year: string; episode_count: number };
        setItems(data.items);
        setTotal(data.total);
        if (seasonKey) setSeasonInfo(data);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message || "Could not load the subtitle library.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, api, reloadTick, offset, seasonKey]);

  function lockArea() {
    posterRequest.current?.abort(); setPosterBusy(false);
    setUnlocked(false);
    setOwnerKey("");
    setNotice(null);
  }

  async function unlock() {
    if (!ownerKey || unlocking) return;
    setUnlocking(true);
    setUnlockError("");
    try {
      const response = await fetch(`${api}/library/admin/check`, {
        method: "POST",
        headers: { "X-Library-Admin-Key": ownerKey },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Could not verify the password.");
      setUnlocked(true);
      setNotice(null);
    } catch (err) {
      setUnlockError((err as Error).message || "Could not verify the password.");
    } finally {
      setUnlocking(false);
    }
  }

  async function uploadItem() {
    if (posterBusy || uploading) return;
    if (!unlocked || !title.trim() || !subFile) {
      setNotice({ ok: false, text: "A title and a subtitle file are required." });
      return;
    }
    const form = new FormData();
    form.append("title", title.trim());
    form.append("year", year.trim());
    form.append("season_number", seasonNumber.trim());
    form.append("episode_number", episodeNumber.trim());
    form.append("subtitle", subFile);
    if (posterFile) form.append("poster_image", posterFile);
    setUploading(true);
    setNotice(null);
    try {
      const response = await fetch(`${api}/library/items`, {
        method: "POST",
        headers: { "X-Library-Admin-Key": ownerKey },
        body: form,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 403) lockArea();
        throw new Error(data.detail || "Upload failed.");
      }
      setNotice({ ok: true, text: `Added ${data.title}.` });
      setTitle("");
      setYear("");
      setSeasonNumber(""); setEpisodeNumber("");
      setSubFile(null);
      clearPoster();
      setSelectedTitle("");
      if (subInput.current) subInput.current.value = "";
      setReloadTick(n => n + 1);
    } catch (err) {
      setNotice({ ok: false, text: (err as Error).message || "Upload failed." });
    } finally {
      setUploading(false);
    }
  }

  async function deleteItem(item: LibraryItem) {
    if (!unlocked) {
      setNotice({ ok: false, text: "Unlock the restricted area first." });
      return;
    }
    if (!window.confirm(`Delete "${item.title}" from the library?`)) return;
    try {
      const response = await fetch(`${api}/library/items/${item.id}`, {
        method: "DELETE",
        headers: { "X-Library-Admin-Key": ownerKey },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 403) lockArea();
        throw new Error(data.detail || "Delete failed.");
      }
      setNotice({ ok: true, text: `Deleted ${item.title}.` });
      setReloadTick(n => n + 1);
    } catch (err) {
      setNotice({ ok: false, text: (err as Error).message || "Delete failed." });
    }
  }

  return (
    <div className="space-y-4">
      <CommunityForm kind="request" />
      {seasonKey && seasonInfo && <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <p className="text-xs uppercase tracking-widest text-primary">TV Series {seasonInfo.year && `· ${seasonInfo.year}`}</p>
        <h1 className="mt-2 text-2xl font-bold">{seasonInfo.series_title} · Season {seasonInfo.season_number}</h1>
        <p className="mt-2 text-sm text-white/60">{seasonInfo.episode_count} episodes · {total} subtitle files. Choose an episode below.</p>
      </div>}
      {!seasonKey && <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/50" />
        <Input
          value={query}
          onChange={event => { setQuery(event.target.value); setOffset(0); }}
          maxLength={80}
          placeholder="Search movies and series…"
          aria-label="Search subtitle library"
          className="h-11 pl-9"
          autoFocus={autoFocus}
        />
      </div>}

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : loading && items.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-white/60">
          <Loader2 className="size-4 animate-spin" />Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-white/60">
          <Film className="size-8 text-white/30" />
          {query.trim() ? `No subtitles found for "${query.trim()}".` : "No subtitles have been added yet."}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {items.map(item => (
            <div key={item.id} className="group flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/5">
              <div className="relative aspect-[2/3] overflow-hidden bg-black/40">
                <Poster item={item} api={api} />
                <Badge className="absolute left-2 top-2 h-5 bg-black/70 px-2 text-[10px] font-semibold uppercase text-white">{item.kind === "season" ? `Season ${item.season_number}` : seasonKey ? `Episode ${item.episode_number}` : item.format}</Badge>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white" title={item.title}>{item.kind === "season" ? item.series_title : item.title}</p>
                  <p className="text-[11px] text-white/55">
                    {[item.year, item.language].filter(Boolean).join(" · ")}
                    {item.downloads > 0 ? ` · ${item.downloads} downloads` : ""}
                  </p>
                  {item.kind === "season" && <p className="text-[11px] text-white/70">{item.episode_count} episodes · {item.file_count} files</p>}
                  {item.kind !== "season" && item.translated_by && <p className="truncate text-[11px] text-white/70" title={`Translated by ${item.translated_by}`}>Translated by {item.translated_by}</p>}
                </div>
                <div className="mt-auto flex items-center gap-2">
                  <Button asChild size="sm" className="h-8 flex-1 gap-1.5 text-xs">
                    {item.kind === "season" ? <Link href={`/library/tv-series/${item.season_slug || item.season_key}`}>View episodes</Link> :
                    <a href={`${api}${item.download_url}`} download>
                      <Download className="size-3.5" />Download {seasonKey ? item.format.toUpperCase() : ""}
                    </a>}
                  </Button>
                  {ownerOpen && unlocked && item.kind !== "season" ? (
                    <Button size="icon" variant="outline" className="size-8 shrink-0" onClick={() => deleteItem(item)} aria-label={`Delete ${item.title}`}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > 60 && <nav aria-label="Library pages" className="flex items-center justify-between gap-3">
        <Button variant="outline" disabled={loading || offset === 0} onClick={() => setOffset(Math.max(0,offset-60))}>Previous</Button>
        <span className="text-xs text-white/60">Page {Math.floor(offset/60)+1} of {Math.ceil(total/60)}</span>
        <Button variant="outline" disabled={loading || offset+60 >= total} onClick={() => setOffset(offset+60)}>Next</Button>
      </nav>}
      <details className="text-[10px] text-white/45">
        <summary className="cursor-pointer">Poster credits</summary>
        <p className="mt-1">This product uses the <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer" className="underline">TMDB</a> API but is not endorsed or certified by TMDB.</p>
      </details>
      <div className="border-t border-white/10 pt-3">
        <button
          type="button"
          onClick={() => setOwnerOpen(value => !value)}
          aria-expanded={ownerOpen}
          className="flex items-center gap-1.5 text-xs text-white/45 transition-colors hover:text-white/80"
        >
          <Lock className="size-3" />Restricted area
        </button>

        {ownerOpen && !unlocked ? (
          <div className="mt-3 max-w-sm space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
            <Label htmlFor="lib-owner-key" className="text-xs">Enter the password to continue</Label>
            <div className="flex gap-2">
              <Input
                id="lib-owner-key"
                type="password"
                autoComplete="off"
                value={ownerKey}
                onChange={e => { setOwnerKey(e.target.value); setUnlockError(""); }}
                onKeyDown={e => { if (e.key === "Enter") void unlock(); }}
                placeholder="Password"
                autoFocus
              />
              <Button onClick={unlock} disabled={unlocking || !ownerKey} className="shrink-0 gap-2">
                {unlocking ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}Unlock
              </Button>
            </div>
            {unlockError ? <p className="text-xs text-red-400">{unlockError}</p> : null}
          </div>
        ) : null}

        {ownerOpen && unlocked ? (
          <div className="mt-3 grid gap-3 rounded-lg border border-white/10 bg-white/5 p-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lib-title" className="text-xs">Title</Label>
              <Input id="lib-title" value={title} disabled={uploading || posterBusy} onChange={e => { setTitle(e.target.value); setSelectedTitle(""); }} maxLength={120} placeholder="Movie or series name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lib-year" className="text-xs">Year (optional)</Label>
              <Input id="lib-year" value={year} onChange={e => setYear(e.target.value)} maxLength={4} inputMode="numeric" placeholder="2024" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lib-season" className="text-xs">TV season (optional)</Label>
              <Input id="lib-season" value={seasonNumber} onChange={e => setSeasonNumber(e.target.value)} inputMode="numeric" maxLength={2} placeholder="1" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lib-episode" className="text-xs">TV episode (optional)</Label>
              <Input id="lib-episode" value={episodeNumber} onChange={e => setEpisodeNumber(e.target.value)} inputMode="numeric" maxLength={3} placeholder="4" />
            </div>
            <p className="text-xs text-white/55 sm:col-span-2">For TV, enter both numbers or use a filename containing S01E04. Leave both empty for films.</p>
            <div className="space-y-1.5">
              <Label htmlFor="lib-sub" className="text-xs">Subtitle file (.srt or .ass)</Label>
              <Input ref={subInput} disabled={uploading} id="lib-sub" type="file" accept=".srt,.ass" onChange={e => setSubFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="space-y-3 sm:col-span-2">
              {searchBusy && <p role="status" className="text-xs text-white/60">Searching movie and TV posters…</p>}
              {searchMessage && <p role="status" className="text-xs text-white/60">{searchMessage}</p>}
              {posterMatches.length > 0 && <div>
                <p className="mb-2 text-xs text-white/65">Choose the correct movie or series to fill its poster and year.</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {posterMatches.map(match => <button type="button" key={`${match.type}-${match.id}`} disabled={posterBusy || uploading}
                    onClick={() => void importPoster(match.poster_url, match)} className="flex gap-2 rounded-md border border-white/15 p-2 text-left hover:border-primary disabled:opacity-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={match.poster_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-16 w-11 rounded object-cover" />
                    <span className="min-w-0 text-xs"><span className="block font-semibold">{match.title}</span><span className="text-white/50">{match.year} · {match.type === "tv" ? "TV" : "Movie"}</span></span>
                  </button>)}
                </div>
              </div>}
              <div tabIndex={0} aria-label="Poster: drop an image or focus here and paste with Ctrl+V"
                onDragOver={e => { e.preventDefault(); }}
                onDrop={e => { e.preventDefault(); if (uploading) return; const file = e.dataTransfer.files[0];
                  if (file) choosePoster(file); else { const url = e.dataTransfer.getData("text/uri-list").split("\n").find(x => x && !x.startsWith("#")) || e.dataTransfer.getData("text/plain"); if (url) void importPoster(url); } }}
                onPaste={e => { if (uploading) return; const file = Array.from(e.clipboardData.items).find(x => x.type.startsWith("image/"))?.getAsFile();
                  if (file) { e.preventDefault(); choosePoster(file); } }}
                className="rounded-lg border border-dashed border-white/30 p-4 focus:border-primary focus:outline-none">
                <Label htmlFor="lib-poster" className="text-xs">Poster (JPG, PNG or WebP, max 2 MB)</Label>
                <p className="my-2 text-xs text-white/55">Drop an image here, click this area and press Ctrl+V, or choose a file.</p>
                <Input ref={posterInput} disabled={uploading} id="lib-poster" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => choosePoster(e.target.files?.[0] ?? null)} />
                <div className="mt-3 flex gap-2">
                  <Input aria-label="Direct image link" disabled={uploading || posterBusy} value={posterLink} onChange={e => setPosterLink(e.target.value)} placeholder="https://… direct image link" />
                  <Button type="button" variant="outline" disabled={!posterLink.trim() || posterBusy || uploading} onClick={() => void importPoster(posterLink.trim())}>Use link</Button>
                </div>
                {posterBusy && <p role="status" className="mt-2 text-xs text-white/60">Loading poster…</p>}
                {posterError && <p role="alert" className="mt-2 text-xs text-red-400">{posterError}</p>}
                {posterPreview && <div className="mt-3 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={posterPreview} alt="Selected poster preview" className="h-36 w-24 rounded object-cover" />
                  <div><p className="mb-2 text-xs text-white/60">Poster ready to upload</p><Button type="button" variant="outline" size="sm" disabled={uploading} onClick={clearPoster}>Remove poster</Button></div>
                </div>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <Button onClick={uploadItem} disabled={uploading || posterBusy} className="gap-2">
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}Add to library
              </Button>
              {notice ? <span className={notice.ok ? "text-xs text-green-400" : "text-xs text-red-400"}>{notice.text}</span> : null}
              <Button variant="ghost" size="sm" onClick={lockArea} disabled={uploading} className="ml-auto gap-1.5 text-xs text-white/60 hover:text-white">
                <Lock className="size-3.5" />Lock
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Same API base that page.tsx uses (e.g. "/subnexa-api" or "http://localhost:8000"). */
  api: string;
};

/** The popup used inside the signed-in studio. */
export default function SubtitleLibrary({ open, onOpenChange, api }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Download className="size-5 text-primary" />Subtitle library
          </DialogTitle>
          <DialogDescription>Ready-made Sinhala subtitles. Search by movie or series name and download.</DialogDescription>
        </DialogHeader>
        <LibraryBrowser api={api} autoFocus />
      </DialogContent>
    </Dialog>
  );
}
