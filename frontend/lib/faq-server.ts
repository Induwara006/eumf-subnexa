export type Faq = { id: string; question: string; answer: string };

// Reads the published FAQs straight from Supabase on the server.
// Returns null when the database cannot be reached, so the page can show defaults.
export async function getFaqs(): Promise<Faq[] | null> {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(base)) return null;
  try {
    const res = await fetch(
      `${base}/rest/v1/subnexa_faqs?select=id,question,answer&published=eq.true&order=sort_order.asc,created_at.asc&limit=100`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      }
    );
    if (!res.ok) {
      console.error("[faq] request failed", res.status);
      return null;
    }
    const rows = await res.json();
    return Array.isArray(rows) ? (rows as Faq[]) : null;
  } catch (e) {
    console.error("[faq] error", e instanceof Error ? e.message : e);
    return null;
  }
}
