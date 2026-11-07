import type { Metadata } from "next";
import { LibraryBrowser } from "../../components/SubtitleLibrary";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import Reveal from "@/components/Reveal";
import SlideTextButton from "@/components/ui/slide-text-button";

export const metadata: Metadata = {
  title: "Subtitle library — SubNexa",
  description: "Search and download ready-made Sinhala subtitles.",
};

const API = (
  process.env.NEXT_PUBLIC_SUBNEXA_API_URL ||
  (process.env.NODE_ENV === "production" ? "/subnexa-api" : "http://localhost:8000")
).replace(/\/$/, "");

export default function LibraryPage() {
  return (
    <div className="dark framer-landing relative isolate min-h-screen overflow-hidden bg-background text-ink">
      <Header overlay showThemeToggle={false} />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[900px] bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(232,232,238,0.12),transparent_70%)]" />

      <main className="relative mx-auto w-full max-w-[1200px] px-5 pb-24 pt-36 sm:px-8 sm:pt-44">
        <Reveal className="max-w-3xl">
          <p className="text-[12px] font-medium uppercase tracking-[0.2em] text-content-tertiary">The library</p>
          <h1 className="mt-4 text-[clamp(2.6rem,6vw,4.5rem)] font-bold leading-[0.96] tracking-[-0.045em]">
            Sinhala subtitles,
            <br />
            <span className="text-body">ready when you are.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-body">
            Ready-made Sinhala subtitles for films and series. Search by title and download instantly. No sign-in needed.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <SlideTextButton text="Browse all titles" hoverText="Search now" href="#library" />
            <SlideTextButton text="Read the guide" hoverText="How it works" href="/guide" variant="ghost" />
          </div>
        </Reveal>

        <Reveal className="mt-12" delay={0.1}>
          <div id="library" className="rounded-[5px] border border-border bg-[var(--next-gray-200)] p-4 sm:p-6">
            <LibraryBrowser api={API} autoFocus />
          </div>
        </Reveal>
      </main>

      <SiteFooter />
    </div>
  );
}
