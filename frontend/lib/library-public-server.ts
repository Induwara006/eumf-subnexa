import { cache } from "react";

export type PublicRow = {
  id: string;
  title: string;
  year?: string | null;
  kind?: string;
  season_slug?: string | null;
  season_key?: string | null;
  episode_number?: number | null;
  poster_type?: string | null;
};

export type SeasonData = {
  total?: number;
  series_title?: string;
  season_number?: number;
  year?: string;
  items?: PublicRow[];
};

// Calls a Supabase RPC from the server. Returns null on any failure so pages
// can still render. Failures are printed to the terminal with [library-public].
async function rpc(name: string, body: object) {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) {
    console.error("[library-public] missing env", { hasUrl: !!base, hasKey: !!key });
    return null;
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(base)) {
    console.error("[library-public] SUPABASE_URL format not accepted");
    return null;
  }
  try {
    const res = await fetch(`${base}/rest/v1/rpc/${name}`, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error("[library-public] rpc failed", name, res.status);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error("[library-public] rpc error", name, e instanceof Error ? e.message : e);
    return null;
  }
}

// One season (first 60 episodes). cache() makes generateMetadata and the page
// share a single request.
export const getSeason = cache(
  async (key: string): Promise<SeasonData | null> =>
    rpc("subnexa_library_season_url_v1", { p_key: key, p_offset: 0, p_limit: 60 })
);

// Newest 24 library items (movies and grouped seasons).
export const getLatest = cache(async (): Promise<PublicRow[]> => {
  const data = await rpc("subnexa_library_browse_filtered_v2", {
    p_query: "",
    p_year: "",
    p_genre: "",
    p_language: "",
    p_sort: "newest",
    p_offset: 0,
    p_limit: 24,
  });
  return Array.isArray(data?.items) ? data.items : [];
});
