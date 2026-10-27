"use client";

import { useEffect, useState } from "react";
import { Download, Film, Loader2, Lock, Plus, Search, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LibraryItem = {
  id: number;
  title: string;
  year: string;
  language: string;
  format: "srt" | "ass";
  downloads: number;
  poster_url: string | null;
  download_url: string;
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
export function LibraryBrowser({ api, autoFocus = false }: { api: string; autoFocus?: boolean }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadTick, setReloadTick] = useState(0);

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
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${api}/library/items?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Could not load the subtitle library.");
        const data = (await response.json()) as { items: LibraryItem[] };
        setItems(data.items);
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
  }, [query, api, reloadTick]);

  function lockArea() {
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
    if (!unlocked || !title.trim() || !subFile) {
      setNotice({ ok: false, text: "A title and a subtitle file are required." });
      return;
    }
    const form = new FormData();
    form.append("title", title.trim());
    form.append("year", year.trim());
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
      setSubFile(null);
      setPosterFile(null);
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
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/50" />
        <Input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search movies and series…"
          aria-label="Search subtitle library"
          className="h-11 pl-9"
          autoFocus={autoFocus}
        />
      </div>

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
                <Badge className="absolute left-2 top-2 h-5 bg-black/70 px-2 text-[10px] font-semibold uppercase text-white">{item.format}</Badge>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white" title={item.title}>{item.title}</p>
                  <p className="text-[11px] text-white/55">
                    {[item.year, item.language].filter(Boolean).join(" · ")}
                    {item.downloads > 0 ? ` · ${item.downloads} downloads` : ""}
                  </p>
                </div>
                <div className="mt-auto flex items-center gap-2">
                  <Button asChild size="sm" className="h-8 flex-1 gap-1.5 text-xs">
                    <a href={`${api}${item.download_url}`} download>
                      <Download className="size-3.5" />Download
                    </a>
                  </Button>
                  {ownerOpen && unlocked ? (
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
              <Input id="lib-title" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder="Movie or series name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lib-year" className="text-xs">Year (optional)</Label>
              <Input id="lib-year" value={year} onChange={e => setYear(e.target.value)} maxLength={4} inputMode="numeric" placeholder="2024" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lib-sub" className="text-xs">Subtitle file (.srt or .ass)</Label>
              <Input id="lib-sub" type="file" accept=".srt,.ass" onChange={e => setSubFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lib-poster" className="text-xs">Poster (JPG, PNG or WebP, max 2 MB)</Label>
              <Input id="lib-poster" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setPosterFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <Button onClick={uploadItem} disabled={uploading} className="gap-2">
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}Add to library
              </Button>
              {notice ? <span className={notice.ok ? "text-xs text-green-400" : "text-xs text-red-400"}>{notice.text}</span> : null}
              <Button variant="ghost" size="sm" onClick={lockArea} className="ml-auto gap-1.5 text-xs text-white/60 hover:text-white">
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
