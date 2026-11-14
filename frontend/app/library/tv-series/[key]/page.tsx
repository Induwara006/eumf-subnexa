import { notFound } from "next/navigation";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import Reveal from "@/components/Reveal";
import type { Metadata } from "next";
import { LibraryBrowser } from "@/components/SubtitleLibrary";
import { getSeason } from "@/lib/library-public-server";

export const revalidate = 600;

const KEY_RE = /^[a-z0-9][a-z0-9-]{0,199}$/;

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params;
  const details = KEY_RE.test(key) ? await getSeason(key) : null;
  const title = details?.series_title
    ? `${details.series_title} Season ${details.season_number || 1}${details.year ? ` (${details.year})` : ""} Sinhala Subtitles — SubNexa`
    : "TV Series Sinhala Subtitles — SubNexa";
  const description = details?.series_title
    ? `Download Sinhala subtitles for ${details.series_title} season ${details.season_number || 1}. Browse episodes and available versions on SubNexa.`
    : "Browse Sinhala subtitles by episode on SubNexa.";
  const canonical = `https://subnexa.lk/library/tv-series/${encodeURIComponent(key)}`;
  const poster = details?.items?.find((item) => item.poster_type);
  const image = poster ? `https://subnexa.lk/api/library/items/${poster.id}/poster` : undefined;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      ...(image ? { images: [{ url: image, alt: `${details?.series_title || "TV Series"} poster` }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function SeasonPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!KEY_RE.test(key)) notFound();

  const season = await getSeason(key);
  // null means a temporary database problem: still render the page.
  if (season && !season.total) notFound();

  const heading = season?.series_title
    ? `${season.series_title} Season ${season.season_number || 1}`
    : "TV series";

  return (
    <div className="dark framer-landing relative isolate min-h-screen overflow-hidden bg-background text-ink">
      <Header overlay showThemeToggle={false} />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[900px] bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(232,232,238,0.12),transparent_70%)]" />

      <main className="relative mx-auto w-full max-w-[1200px] px-5 pb-24 pt-36 sm:px-8 sm:pt-44">
        <Reveal className="max-w-3xl">
          <p className="text-[12px] font-medium uppercase tracking-[0.2em] text-content-tertiary">TV series</p>
          <h1 className="mt-4 text-[clamp(2.4rem,5.5vw,4rem)] font-bold leading-[0.98] tracking-[-0.045em]">
            {heading}
            <br />
            <span className="text-body">Sinhala subtitles by episode.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-body">
            Pick an episode and download the Sinhala subtitle file. Every cue keeps its original timing.
          </p>
        </Reveal>

        <Reveal className="mt-12" delay={0.1}>
          <div className="rounded-[5px] border border-border bg-[var(--next-gray-200)] p-4 sm:p-6">
            <LibraryBrowser key={key} api="" seasonKey={key} />
          </div>
        </Reveal>

        {season?.items?.length ? (
          <section className="mt-12" aria-label="Episodes">
            <h2 className="text-xl font-semibold">{heading} episodes with Sinhala subtitles</h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {season.items.map((i) => (
                <li key={i.id} className="text-body">
                  {i.title} Sinhala subtitles
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>

      <SiteFooter />
    </div>
  );
}
