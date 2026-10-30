"use client";

import { useState } from "react";
import { Download, Film } from "lucide-react";

import { Button } from "@/components/ui/button";

export type LibraryMatch = {
  source: "supabase" | "local";
  id: string | number;
  title: string;
  year: string;
  format: string;
  translated_by?: string | null;
  poster_url?: string | null;
  /** "exact": same cue timings, safe to use as is. "likely": same film, different timing. */
  confidence: "exact" | "likely";
  score: number;
  offset_ms: number;
  scale: number;
};

type Props = {
  match: LibraryMatch;
  /** Same API base that Studio.tsx uses. */
  api: string;
  /** Exact match: "Translate anyway". Likely match: "Hide". */
  onContinue: () => void;
};

function timingDifference(match: LibraryMatch): string {
  const parts: string[] = [];
  if (Math.abs(match.scale - 1) > 0.001) parts.push("a different frame rate");
  if (Math.abs(match.offset_ms) >= 200) {
    parts.push(`about ${(Math.abs(match.offset_ms) / 1000).toFixed(1)} s ${match.offset_ms > 0 ? "later" : "earlier"}`);
  }
  return parts.join(" and ") || "slightly different timings";
}

/** Supabase library posters are served by the Next.js route (/api), which understands UUID ids.
 *  The translation backend (api) only serves its own local items. */
function posterSrc(match: LibraryMatch, api: string): string | null {
  if (!match.poster_url) return null;
  if (match.source === "supabase") return `/api/library/items/${encodeURIComponent(String(match.id))}/poster`;
  return `${api}${match.poster_url}`;
}

export default function LibraryMatchBanner({ match, api, onContinue }: Props) {
  const [posterFailed, setPosterFailed] = useState(false);
  const poster = posterFailed ? null : posterSrc(match, api);
  const exact = match.confidence === "exact";
  const label = [match.title, match.year].filter(Boolean).join(" · ");
  return (
    <div role="status" className="rounded-[4px] border border-primary/30 bg-primary/10 p-3">
      <div className="flex items-start gap-3">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" onError={() => setPosterFailed(true)} className="h-14 w-10 shrink-0 rounded object-cover" />
        ) : (
          <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded bg-white/10">
            <Film className="size-4 text-white/40" />
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-semibold text-white">
            {exact ? "This subtitle is already in the library" : "A similar subtitle is in the library"}
          </p>
          <p className="truncate text-[11px] text-white/80" title={label}>
            {label}
            {match.translated_by ? ` · translated by ${match.translated_by}` : ""}
          </p>
          <p className="text-[11px] leading-relaxed text-white/60">
            {exact
              ? "Its timings match your file exactly, so you can download it and skip the translation."
              : `Its timing differs from your file (${timingDifference(match)}), so it may not sync with your video. Translate to get timings that match your file.`}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild size="sm" className="h-8 gap-1.5 text-xs">
          <a href={`${api}/library-match/download/${match.source}/${encodeURIComponent(String(match.id))}`} download>
            <Download className="size-3.5" />Download it
          </a>
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onContinue}>
          {exact ? "Translate anyway" : "Hide"}
        </Button>
      </div>
    </div>
  );
}
