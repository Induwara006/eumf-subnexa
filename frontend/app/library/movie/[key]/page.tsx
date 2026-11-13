// SUBNEXA_MOVIE_SEO_V2
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import FilmDownloadPage from "@/components/FilmDownloadPage";
import MovieDetails from "@/components/MovieDetails";
import { getPublicFilm } from "@/lib/library-film-server";
import { filmIdFromKey, filmPath } from "@/lib/library-slug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ORIGIN = "https://subnexa.lk";
type Props = { params: Promise<{ key: string }> };

async function resolveFilm(key: string) {
  // Next already decodes route parameters; do not decode them a second time.
  const id = filmIdFromKey(key);
  if (!id) notFound();
  const item = await getPublicFilm(id);
  if (!item) notFound();
  const path = filmPath(item);
  if (`/library/movie/${key}` !== path) permanentRedirect(path);
  return { item, canonical: ORIGIN + path };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { item, canonical } = await resolveFilm((await params).key);
  const name = `${item.title}${item.year ? ` (${item.year})` : ""}`;
  const title = `${name} Sinhala Subtitles | සිංහල උපසිරැසි | SubNexa`;
  const description = `Download ${name} Sinhala subtitles (${item.format.toUpperCase()}) from SubNexa. සිංහල උපසිරැසි. Free download, no sign-in required.`;
  const image = item.poster_url ? `${ORIGIN}/api${item.poster_url}` : undefined;
  return {
    title: { absolute: title }, description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "website", siteName: "SubNexa",
      ...(image ? { images: [{ url: image, alt: `${name} poster` }] } : {}) },
    twitter: { card: image ? "summary_large_image" : "summary", title, description,
      ...(image ? { images: [image] } : {}) },
  };
}

export default async function Page({ params }: Props) {
  const { item } = await resolveFilm((await params).key);
  return (
    <FilmDownloadPage key={item.id} id={item.id} initialItem={item}
      details={<MovieDetails title={item.title} year={item.year} synopsisSi={item.synopsis_si} />} />
  );
}
