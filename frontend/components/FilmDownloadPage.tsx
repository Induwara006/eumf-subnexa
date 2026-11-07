"use client";
// SUBNEXA_FILM_PAGE_V1
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Download, Film, Loader2 } from "lucide-react";

import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { filmPath } from "@/lib/library-slug";

export type FilmItem = {
  id: string;
  title: string;
  year: string;
  language: string;
  genre?: string | null;
  format: "srt" | "ass";
  downloads: number;
  poster_url: string | null;
  download_url: string;
  translated_by?: string | null;
};

export default function FilmDownloadPage({ id, initialItem }: { id: string; initialItem?: FilmItem }) {
  const [fetchedItem, setItem] = useState<FilmItem | null>(null);
  const item = initialItem ?? fetchedItem;
  const [error, setError] = useState("");
  const [posterFailed, setPosterFailed] = useState(false);

  useEffect(() => {
    // Server-rendered movie pages already have their public data and metadata.
    if (initialItem) return;
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(`/api/library/items/${id}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.item) throw new Error(typeof data?.detail === "string" ? data.detail : "Subtitle not found.");
        const found: FilmItem = data.item;
        setItem(found);
        document.title = `${found.title}${found.year ? ` (${found.year})` : ""} Sinhala subtitles — SubNexa`;
        const canonical = filmPath(found);
        if (decodeURIComponent(window.location.pathname) !== canonical) window.history.replaceState(null, "", canonical);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load this subtitle.");
      }
    })();
    return () => controller.abort();
  }, [id, initialItem]);

  return (
    <div className="dark framer-landing relative isolate min-h-screen overflow-hidden bg-background text-ink">
      <Header overlay showThemeToggle={false} />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[900px] bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(232,232,238,0.12),transparent_70%)]" />

      <main className="relative mx-auto w-full max-w-[1200px] px-5 pb-24 pt-36 sm:px-8 sm:pt-44">
        <nav className="mb-8 flex items-center justify-between text-sm">
          <Link href="/library" className="inline-flex items-center gap-1.5 text-body transition-colors hover:text-ink">
            <ArrowLeft className="size-4" />Subtitle library
          </Link>
          <span className="text-xs text-content-tertiary">Free download · No sign-in</span>
        </nav>

        {!item && !error && (
          <div className="flex items-center gap-2 py-16 text-sm text-body">
            <Loader2 className="size-4 animate-spin" />Loading…
          </div>
        )}

        {error && (
          <div className="rounded-[5px] border border-border bg-[var(--next-gray-200)] px-6 py-16 text-center">
            <p role="alert" className="text-sm text-destructive">{error}</p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/library">Back to the library</Link>
            </Button>
          </div>
        )}

        {item && (
          <article className="grid gap-8 rounded-[5px] border border-border bg-[var(--next-gray-200)] p-5 sm:grid-cols-[240px_1fr] sm:p-8">
            <div className="relative mx-auto aspect-[2/3] w-full max-w-[240px] overflow-hidden rounded-[5px] border border-border bg-[var(--next-gray-300)]">
              {item.poster_url && !posterFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api${item.poster_url}`} alt={`${item.title} poster`} onError={() => setPosterFailed(true)} className="absolute inset-0 size-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-xs text-body">
                  <Film className="size-8 text-content-tertiary" />{item.title}
                </div>
              )}
            </div>

            <div className="min-w-0 space-y-6">
              <div>
                <p className="text-[12px] font-medium uppercase tracking-[0.2em] text-content-tertiary">Sinhala subtitle</p>
                <h1 className="mt-3 text-[clamp(2rem,4vw,3.2rem)] font-bold leading-[1.02]">
                  {item.title}
                  {item.year ? <span className="font-normal text-body"> ({item.year})</span> : null}
                </h1>
                <p className="mt-3 text-[15px] text-body">{[item.language, item.genre].filter(Boolean).join(" · ")} subtitles · <span lang="si">සිංහල උපසිරැසි</span></p>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-body">
                <Badge className="rounded-[5px] bg-black/80 uppercase text-white">{item.format}</Badge>
                <span>{item.downloads} downloads</span>
                {item.translated_by && <span>· Translated by {item.translated_by}</span>}
              </div>

              <Button asChild size="lg" className="gap-2 rounded-[5px]">
                <a href={`/api${item.download_url}`} download>
                  <Download className="size-4" />Download {item.format.toUpperCase()}
                </a>
              </Button>

              <p className="max-w-lg text-xs leading-relaxed text-content-tertiary">
                Free to download, no sign-in needed. Subtitles are reviewed before they are added to the library. Original cue timing is preserved.
              </p>
            </div>
          </article>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

