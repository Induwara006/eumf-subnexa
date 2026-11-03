import type { Metadata } from "next";
import { LibraryBrowser } from "../../components/SubtitleLibrary";
import Header from "@/components/Header";

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
    <div className="min-h-screen bg-background text-ink">
      <Header />

      <main className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[360px]">
          <div className="absolute inset-0 inc-grid-lines opacity-50" />
          <div className="absolute -right-20 -top-24 size-[460px] rounded-full bg-[radial-gradient(circle_at_center,#fddfd9_0%,transparent_70%)] dark:bg-[radial-gradient(circle_at_center,rgba(255,106,69,0.14)_0%,transparent_70%)] blur-2xl" />
        </div>
        <div className="mx-auto w-full max-w-[1240px] px-5 pb-20 pt-14 sm:px-8 sm:pt-20">
          <p className="text-[12px] font-medium uppercase tracking-[0.2em] text-alarmalade">The library</p>
          <h1 className="mt-4 max-w-3xl text-[clamp(2.5rem,5vw,4.2rem)] leading-[0.98]">
            Sinhala subtitles,<br /><span className="text-body">ready when you are.</span>
          </h1>
          <p className="mb-10 mt-6 max-w-xl text-[17px] leading-relaxed text-body">
            Ready-made Sinhala subtitles for films and series. Search by title and download instantly. No sign-in needed.
          </p>
          <div className="rounded-3xl border border-border bg-cream/60 p-4 sm:p-6">
            <LibraryBrowser api={API} autoFocus />
          </div>
        </div>
      </main>
    </div>
  );
}
