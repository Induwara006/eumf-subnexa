import type { Metadata } from "next";
import Link from "next/link";
import { LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LibraryBrowser } from "../../components/SubtitleLibrary";

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
    <div className="min-h-screen bg-[#141414] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#141414]/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1480px] items-center justify-between gap-3 px-4 sm:px-8">
          <Link href="/" className="netflix-logo text-2xl" aria-label="SubNexa home">SubNexa</Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="text-white/70 hover:text-white">
              <Link href="/">Home</Link>
            </Button>
            <Button asChild className="gap-2">
              <a href={`${API}/subnexa-auth/login`}><LogIn className="size-4" />Sign in to translate</a>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1480px] px-4 pb-20 pt-8 sm:px-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Discover your Subtitles</p>
        <h1 className="mt-1 text-3xl font-bold sm:text-4xl">sub library</h1>
        <p className="mb-6 mt-2 max-w-xl text-sm text-white/65">
          Ready-made Sinhala subtitles. Search by movie or series name and download. No sign-in needed.
        </p>
        <LibraryBrowser api={API} autoFocus />
      </main>
    </div>
  );
}
