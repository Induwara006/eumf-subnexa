"use client";
// SUBNEXA_FILM_PAGE_V1
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Download, Film, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { filmPath } from "@/lib/library-slug";

type FilmItem = {
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

export default function FilmDownloadPage({ id }: { id: string }) {
  const [item, setItem] = useState<FilmItem | null>(null);
  const [error, setError] = useState("");
  const [posterFailed, setPosterFailed] = useState(false);

  useEffect(() => {
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
  }, [id]);

  return (
    <main className="min-h-screen bg-background text-ink">
      <div className="mx-auto max-w-3xl space-y-6 px-5 py-10 sm:px-8">
        <nav className="flex items-center justify-between text-sm">
          <Link href="/library" className="inline-flex items-center gap-1.5 text-body transition-colors hover:text-ink"><ArrowLeft className="size-4" />Subtitle library</Link>
          <Link href="/" className="flex items-baseline gap-1.5 font-medium tracking-[-0.02em]">SubNexa<span className="size-1.5 rounded-full bg-alarmalade" /></Link>
        </nav>

        {!item && !error && <div className="flex items-center gap-2 py-16 text-sm text-body"><Loader2 className="size-4 animate-spin" />Loading…</div>}

        {error && (
          <div className="space-y-3 py-16 text-center">
            <p role="alert" className="text-sm text-destructive">{error}</p>
            <Button asChild variant="outline"><Link href="/library">Back to the library</Link></Button>
          </div>
        )}

        {item && (
          <article className="flex flex-col gap-8 rounded-3xl border border-border bg-cream p-5 sm:flex-row sm:p-8">
            <div className="relative aspect-[2/3] w-44 shrink-0 self-center overflow-hidden rounded-2xl border border-ink/10 bg-sand sm:self-start">
              {item.poster_url && !posterFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api${item.poster_url}`} alt={`${item.title} poster`} onError={() => setPosterFailed(true)} className="absolute inset-0 size-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center text-xs text-body"><Film className="size-8 text-content-tertiary" />{item.title}</div>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-5">
              <div>
                <h1 className="text-3xl leading-tight">{item.title}{item.year ? <span className="font-normal text-body"> ({item.year})</span> : null}</h1>
                <p className="mt-2 text-sm text-body">{[item.language, item.genre].filter(Boolean).join(" · ")} subtitles</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-body">
                <Badge className="uppercase">{item.format}</Badge>
                <span>{item.downloads} downloads</span>
                {item.translated_by && <span>· Translated by {item.translated_by}</span>}
              </div>
              <Button asChild size="lg" className="gap-2">
                <a href={`/api${item.download_url}`} download><Download className="size-4" />Download {item.format.toUpperCase()}</a>
              </Button>
              <p className="text-xs leading-relaxed text-content-tertiary">Free to download, no sign-in needed. Subtitles are reviewed before they are added to the library.</p>
            </div>
          </article>
        )}
      </div>
    </main>
  );
}
