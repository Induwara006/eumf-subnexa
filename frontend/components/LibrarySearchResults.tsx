"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Film, Loader2 } from "lucide-react";

type Item = {
  id: string | number;
  title: string;
  year: string;
  language: string;
  format: string;
  poster_url: string | null;
  download_url: string;
  translated_by?: string | null;
};

type Props = {
  /** Text typed in the header search box. */
  query: string;
  /** Same API base that page.tsx uses. */
  api: string;
  /** Opens the full library popup. */
  onBrowse: () => void;
};

function Thumb({ item, api }: { item: Item; api: string }) {
  const [failed, setFailed] = useState(false);
  if (!item.poster_url || failed) {
    return (
      <div className="flex h-[54px] w-9 shrink-0 items-center justify-center rounded bg-white/10">
        <Film className="size-4 text-white/40" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${api}${item.poster_url}`}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-[54px] w-9 shrink-0 rounded object-cover"
    />
  );
}

/**
 * Small dropdown under the header search box. It shows matching library subtitles
 * (poster, name, year, Download). Render it as a child of the search box wrapper,
 * which must be `position: relative`.
 */
export default function LibrarySearchResults({ query, api: translationApi, onBrowse }: Props) {
  // Keep the existing caller prop compatible; library requests use Vercel.
  void translationApi;
  const api = "/api";
  const q = query.trim();
  const markerRef = useRef<HTMLSpanElement>(null);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const open = q.length > 0 && dismissedFor !== q;

  // Close on outside click or Escape; reopen when the search box is focused again.
  useEffect(() => {
    const parent = markerRef.current?.parentElement;
    if (!parent) return;
    const onDown = (event: MouseEvent) => {
      if (!parent.contains(event.target as Node)) setDismissedFor(q);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDismissedFor(q);
    };
    const onFocus = () => setDismissedFor(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    parent.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      parent.removeEventListener("focusin", onFocus);
    };
  }, [q]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setFailed(false);
      try {
        const response = await fetch(`${api}/library/items?q=${encodeURIComponent(q)}&limit=6`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("search failed");
        const data = (await response.json()) as { items: Item[] };
        setItems(data.items);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, q, api]);

  return (
    <>
      <span ref={markerRef} hidden />
      {open ? (
        <div
          role="listbox"
          aria-label="Subtitle library results"
          className="absolute right-0 top-full z-50 mt-2 max-h-[60vh] w-[22rem] overflow-y-auto rounded-lg border border-white/10 bg-[#181818] p-1.5 shadow-2xl"
        >
          <p className="flex items-center gap-2 px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
            Subtitle library
            {loading ? <Loader2 className="size-3 animate-spin" /> : null}
          </p>
          {failed ? (
            <p className="px-2 py-3 text-xs text-red-400">Could not search the library right now.</p>
          ) : items.length === 0 && !loading ? (
            <p className="px-2 py-3 text-xs text-white/55">No subtitles found for &quot;{q}&quot;.</p>
          ) : (
            items.map(item => (
              <div key={item.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-white/5">
                <Thumb item={item} api={api} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-white" title={item.title}>{item.title}</p>
                  <p className="text-[11px] text-white/50">
                    {[item.year, item.language, item.format.toUpperCase()].filter(Boolean).join(" · ")}
                  </p>
                  {item.translated_by && <p className="truncate text-[10px] text-white/60" title={`Translated by ${item.translated_by}`}>Translated by {item.translated_by}</p>}
                </div>
                <a
                  href={`${api}${item.download_url}`}
                  download
                  aria-label={`Download ${item.title}`}
                  className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <Download className="size-4" />
                </a>
              </div>
            ))
          )}
          <button
            type="button"
            onClick={() => {
              setDismissedFor(q);
              onBrowse();
            }}
            className="mt-1 w-full rounded-md border-t border-white/10 px-2 py-2 text-left text-xs text-white/60 transition-colors hover:bg-white/5 hover:text-white"
          >
            Browse the full library
          </button>
        </div>
      ) : null}
    </>
  );
}
