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

  // eslint-disable-next-line react-hooks/set-state-in-effect
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
    <main className="min-h-screen bg-[#141414] text-white">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <nav className="flex items-center justify-between text-sm">
          <Link href="/library" className="inline-flex items-center gap-1.5 text-white/70 hover:text-white"><ArrowLeft className="size-4" />Subtitle library</Link>
          <Link href="/" className="font-semibold">SubNexa</Link>
        </nav>

        {!item && !error && <div className="flex items-center gap-2 py-16 text-sm text-white/60"><Loader2 className="size-4 animate-spin" />Loading…</div>}

        {error && (
          <div className="space-y-3 py-16 text-center">
            <p role="alert" className="text-sm text-red-400">{error}</p>
            <Button asChild variant="outline"><Link href="/library">Back to the library</Link></Button>
          </div>
        )}

        {item && (
          <article className="flex flex-col gap-6 sm:flex-row">
            <div className="relative aspect-[2/3] w-44 shrink-0 self-center overflow-hidden rounded-xl border border-white/10 bg-black/40 sm:self-start">
              {item.poster_url && !posterFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api${item.poster_url}`} alt={`${item.title} poster`} onError={() => setPosterFailed(true)} className="absolute inset-0 size-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center text-xs text-white/60"><Film className="size-8 text-white/40" />{item.title}</div>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <h1 className="text-2xl font-semibold">{item.title}{item.year ? <span className="font-normal text-white/60"> ({item.year})</span> : null}</h1>
                <p className="mt-1 text-sm text-white/60">{[item.language, item.genre].filter(Boolean).join(" · ")} subtitles</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
                <Badge className="uppercase">{item.format}</Badge>
                <span>{item.downloads} downloads</span>
                {item.translated_by && <span>· Translated by {item.translated_by}</span>}
              </div>
              <Button asChild size="lg" className="h-11 gap-2">
                <a href={`/api${item.download_url}`} download><Download className="size-4" />Download {item.format.toUpperCase()}</a>
              </Button>
              <p className="text-xs text-white/50">Free to download, no sign-in needed. Subtitles are reviewed before they are added to the library.</p>
            </div>
          </article>
        )}
      </div>
    </main>
  );
}
