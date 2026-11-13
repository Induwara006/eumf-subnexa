// Server component (uses the server-only OMDb helper). Passed from the movie page as the `details` prop of <FilmDownloadPage> (renders above the Download button).
import { getOmdb } from "@/lib/omdb";

export default async function MovieDetails({ title, year, synopsisSi }: { title: string; year?: string | null; synopsisSi?: string | null }) {
  const d = await getOmdb(title, year);
  const si = synopsisSi?.trim();
  if (!d && !si) return null;

  const chips = d ? [d.rating && `★ ${d.rating}/10 IMDb`, d.rated, d.runtime, d.genre].filter(Boolean) as string[] : [];
  const facts = d ? ([
    ["Director", d.director], ["Cast", d.actors], ["Writer", d.writer],
    ["Language", d.language], ["Released", d.released], ["Country", d.country],
  ] as const).filter(([, v]) => v) : [];

  return (
    <section className="space-y-5 border-t border-border pt-6" aria-label="Movie details">
      <p className="text-[12px] font-medium uppercase tracking-[0.2em] text-content-tertiary">Movie details</p>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map(c => <span key={c} className="rounded-full border border-border px-3 py-1 text-xs text-body">{c}</span>)}
        </div>
      )}
      {si && (
        <div>
          <h2 className="text-sm font-semibold">කෙටි හැඳින්වීම</h2>
          <p lang="si" className="mt-2 whitespace-pre-line text-[16px] leading-8 text-ink/90">{si}</p>
        </div>
      )}
      {d?.plot && (
        <div>
          <h2 className="text-sm font-semibold">Plot</h2>
          <p className="mt-2 text-sm leading-relaxed text-body">{d.plot}</p>
        </div>
      )}
      {facts.length > 0 && (
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {facts.map(([k, v]) => (
            <div key={k}><dt className="text-xs text-content-tertiary">{k}</dt><dd className="text-sm text-ink/90">{v}</dd></div>
          ))}
        </dl>
      )}
      {d && <p className="text-[10px] text-content-tertiary">Details provided by OMDb.</p>}
    </section>
  );
}
