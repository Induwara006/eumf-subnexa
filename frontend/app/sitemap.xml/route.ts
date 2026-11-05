import { filmPath } from "@/lib/library-slug";

// SUBNEXA_DYNAMIC_SITEMAP_V1
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const ORIGIN = "https://subnexa.lk";
type Item = { id: string; title: string; year?: string | null; kind?: string;
  season_slug?: string | null; season_key?: string | null };
const escapeXml = (s: string) => s.replace(/[<>&"']/g, c =>
  ({"<":"&lt;", ">":"&gt;", "&":"&amp;", '"':"&quot;", "'":"&apos;"}[c]!));

export async function GET() {
  try {
    const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!base || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(base) || !key)
      throw new Error("Sitemap database configuration missing");
    const urls = new Set<string>([ORIGIN + "/", ORIGIN + "/library"]);
    const signal = AbortSignal.timeout(45000);
    let offset = 0;
    let expectedTotal: number | undefined;
    // The same public-library RPC used by the browse page excludes pending uploads
    // and returns movies and grouped seasons. Read every page, not only the first 60.
    while (true) {
      const res = await fetch(base + "/rest/v1/rpc/subnexa_library_browse_filtered_v2", {
        method: "POST", cache: "no-store", signal,
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_query: "", p_year: "", p_genre: "", p_language: "",
          p_sort: "oldest", p_offset: offset, p_limit: 60 })
      });
      if (!res.ok) throw new Error("Sitemap database request failed");
      const data = await res.json();
      if (!data || !Array.isArray(data.items) || !Number.isSafeInteger(data.total) ||
          data.total < 0 || data.total > 49998)
        throw new Error("Invalid or oversized sitemap source");
      if (expectedTotal !== undefined && data.total !== expectedTotal)
        throw new Error("Library changed during pagination; retry");
      expectedTotal = data.total;
      if (data.items.length > 60 || offset + data.items.length > data.total)
        throw new Error("Invalid sitemap pagination");
      for (const item of data.items as Item[]) {
        if (!item || typeof item.title !== "string") throw new Error("Invalid sitemap item");
        let path: string;
        if (item.kind === "season") {
          const slug = item.season_slug || item.season_key;
          if (typeof slug !== "string" || !/^[a-z0-9][a-z0-9-]{0,199}$/.test(slug))
            throw new Error("Invalid season URL");
          path = `/library/tv-series/${slug}`;
        } else {
          if (item.kind && item.kind !== "movie") throw new Error("Unknown library item kind");
          if (typeof item.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id))
            throw new Error("Invalid movie ID");
          path = filmPath(item);
        }
        urls.add(ORIGIN + path);
      }
      offset += data.items.length;
      if (offset === data.total) break;
      if (!data.items.length) throw new Error("Incomplete library pagination");
    }
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      [...urls].map(url => `  <url><loc>${escapeXml(url)}</loc></url>`).join("\n") + '\n</urlset>\n';
    return new Response(xml, { headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=900",
      "X-Content-Type-Options": "nosniff"
    }});
  } catch {
    // Never publish an incomplete homepage-only sitemap as a successful refresh.
    console.error("Dynamic sitemap unavailable; check database configuration/RPC and retry.");
    return new Response("Sitemap temporarily unavailable. Please retry.", { status: 503,
      headers: { "Cache-Control": "no-store", "Retry-After": "300" } });
  }
}
