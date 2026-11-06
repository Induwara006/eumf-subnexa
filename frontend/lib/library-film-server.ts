import "server-only";
import { cache } from "react";
import type { FilmItem } from "@/components/FilmDownloadPage";

// Read the same published table as the existing public item endpoint.
// Never read the pending community queue or serialize raw database rows.
export const getPublicFilm = cache(async (id: string): Promise<FilmItem | null> => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(base) || !secret) {
    throw new Error("Subtitle library server configuration unavailable.");
  }
  let rows: unknown;
  try {
    const response = await fetch(`${base}/rest/v1/subnexa_library_items?id=eq.${id}&select=*&limit=1`, {
      headers: { apikey: secret, Authorization: `Bearer ${secret}` },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("Database request failed");
    rows = await response.json();
  } catch {
    // Temporary failures must not become a cached missing-subtitle result.
    throw new Error("Subtitle library temporarily unavailable. Please retry.");
  }
  if (!Array.isArray(rows)) throw new Error("Invalid subtitle library response.");
  if (rows.length === 0) return null;
  const row = rows[0] as Record<string, unknown> | null;
  if (!row || typeof row !== "object" || row.id !== id ||
      typeof row.title !== "string" || !row.title.trim() ||
      (row.format !== "srt" && row.format !== "ass")) {
    throw new Error("Invalid subtitle library response.");
  }
  return {
    id, title: row.title,
    year: typeof row.year === "string" ? row.year : "",
    language: typeof row.language === "string" ? row.language : "Sinhala",
    genre: typeof row.genre === "string" ? row.genre : null,
    format: row.format,
    downloads: typeof row.downloads === "number" ? row.downloads : 0,
    poster_url: row.poster_type ? `/library/items/${id}/poster` : null,
    download_url: `/library/items/${id}/download`,
    translated_by: typeof row.translated_by === "string" ? row.translated_by : null,
  };
});
