import { notFound } from "next/navigation";
import Header from "@/components/Header";
import type { Metadata } from "next";
import { LibraryBrowser } from "@/components/SubtitleLibrary";
type SeasonData = {series_title?: string; season_number?: number; year?: string; items?: {poster_url?: string | null; title?: string}[]};
async function seasonDetails(key: string): Promise<SeasonData | null> {
  if (!/^[a-z0-9][a-z0-9-]{0,199}$/.test(key)) return null;
  try {
    const { origin } = new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://subnexa.lk");
    const response = await fetch(`${origin}/api/library/seasons/${encodeURIComponent(key)}?offset=0`, {next: {revalidate: 300}});
    if (!response.ok) return null;
    return await response.json();
  } catch { return null; }
}
export async function generateMetadata({params}: {params: Promise<{key: string}>}): Promise<Metadata> {
  const {key} = await params;
  const details = await seasonDetails(key);
  const title = details?.series_title ? `${details.series_title} Season ${details.season_number || 1}${details.year ? ` (${details.year})` : ""} Sinhala Subtitles — SubNexa` : "TV Series Sinhala Subtitles — SubNexa";
  const description = details?.series_title ? `Download Sinhala subtitles for ${details.series_title} season ${details.season_number || 1}. Browse episodes and available versions on SubNexa.` : "Browse Sinhala subtitles by episode on SubNexa.";
  const canonical = `https://subnexa.lk/library/tv-series/${encodeURIComponent(key)}`;
  const poster = details?.items?.find(item=>item.poster_url)?.poster_url;
  const image = poster ? `https://subnexa.lk/api${poster}` : undefined;
  return {title, description, alternates:{canonical}, openGraph:{title,description,url:canonical,type:"website",...(image?{images:[{url:image,alt:`${details?.series_title || "TV Series"} poster`}]}:{})}, twitter:{card:image?"summary_large_image":"summary",title,description,...(image?{images:[image]}:{})}};
}
export default async function SeasonPage({params}: {params: Promise<{key: string}>}) {
  const {key} = await params;
  if (!/^[a-z0-9][a-z0-9-]{0,199}$/.test(key)) notFound();
  return <div className="min-h-screen bg-background text-ink">
    <Header />
    <main className="mx-auto max-w-[1240px] px-5 py-10 sm:px-8"><LibraryBrowser key={key} api="" seasonKey={key} /></main>
  </div>;
}
