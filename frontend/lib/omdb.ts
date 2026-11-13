// Server-only: the OMDb key never reaches the browser. Set OMDB_API_KEY in .env (no NEXT_PUBLIC_ prefix).
import "server-only";
import { unstable_cache } from "next/cache";

export type Omdb = {
  rating: string | null; rated: string | null; runtime: string | null; genre: string | null;
  plot: string | null; director: string | null; actors: string | null; writer: string | null;
  language: string | null; released: string | null; country: string | null;
};

const val = (v?: string) => (v && v !== "N/A" ? v : null);

// Throws on network/HTTP errors (so they are NOT cached); returns null only when OMDb has no such title.
async function fetchOmdb(title: string, year: string): Promise<Omdb | null> {
  const key = process.env.OMDB_API_KEY;
  if (!key) throw new Error("OMDB_API_KEY missing");
  const params = new URLSearchParams({ t: title, plot: "short", apikey: key });
  if (/^\d{4}$/.test(year)) params.set("y", year);
  const res = await fetch(`https://www.omdbapi.com/?${params}`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error("OMDb request failed");
  const d = await res.json();
  if (d.Response !== "True") {
    if (/limit/i.test(String(d.Error ?? ""))) throw new Error("OMDb limit reached");
    return null;
  }
  return {
    rating: val(d.imdbRating), rated: val(d.Rated), runtime: val(d.Runtime), genre: val(d.Genre),
    plot: val(d.Plot), director: val(d.Director), actors: val(d.Actors), writer: val(d.Writer),
    language: val(d.Language), released: val(d.Released), country: val(d.Country),
  };
}

// The movie page is force-dynamic, so a plain fetch cache would be bypassed.
// unstable_cache keeps each title for 7 days, which protects the OMDb daily request limit.
const cached = unstable_cache(fetchOmdb, ["omdb-v1"], { revalidate: 60 * 60 * 24 * 7 });

export async function getOmdb(title: string, year?: string | null): Promise<Omdb | null> {
  const t = title.replace(/[ ._-]+s\d{1,2}[ ._-]*e\d{1,3}.*$/i, "").trim();
  if (!t) return null;
  try { return await cached(t, year ?? ""); } catch { return null; }
}
