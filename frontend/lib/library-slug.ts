// SUBNEXA_FILM_PAGE_V1
// Film page URLs look like /library/movie/the-matrix-1999-<id>. The id (a UUID) is what the
// page really uses; the readable part only names the page and can be rewritten after a rename.
export function filmSlug(title: string, year?: string | null) {
  const base = `${title} ${year ?? ""}`
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return base || "subtitle";
}

export function filmPath(item: { id: string | number; title: string; year?: string | null }) {
  return `/library/movie/${filmSlug(item.title, item.year)}-${item.id}`;
}

export function filmIdFromKey(key: string) {
  const match = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(key);
  return match ? match[1].toLowerCase() : null;
}
