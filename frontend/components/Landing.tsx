"use client";

import Image from "next/image";
import { motion, MotionConfig } from "motion/react";
import SlideTextButton from "@/components/ui/slide-text-button";
import { CanvasText } from "@/components/ui/canvas-text";
import DriftWall from "./DriftWall";
import FeaturesAlternating from "./FeaturesAlternating";
import Header from "./Header";
import SiteFooter from "./SiteFooter";
import Reveal from "./Reveal";
import { springs } from "@/lib/motion";
import { openAuthPopup } from "@/lib/auth-popup";

const API = (process.env.NEXT_PUBLIC_SUBNEXA_API_URL || (process.env.NODE_ENV === "production" ? "/subnexa-api" : "http://localhost:8000")).replace(/\/$/, "");
const loginUrl = `${API}/subnexa-auth/login`;

const posterTitles = [
  "Dune: Part Two",
  "Interstellar",
  "Blade Runner 2049",
  "The Batman",
  "Oppenheimer",
  "Inception",
  "The Dark Knight",
  "Mad Max: Fury Road",
  "Arrival",
  "John Wick",
  "Spider-Man: Across the Spider-Verse",
  "Everything Everywhere All at Once",
  "Parasite",
  "Joker",
  "The Grand Budapest Hotel",
  "La La Land",
  "Whiplash",
  "The Matrix",
  "Jurassic Park",
  "The Lord of the Rings: The Fellowship of the Ring",
  "Harry Potter and the Philosopher's Stone",
  "Avatar",
  "Top Gun: Maverick",
  "Gladiator",
];

const posters = posterTitles.map((title, index) => ({
  image: `/posters/poster-${String(index + 1).padStart(2, "0")}.webp`,
  title,
  href: undefined,
}));

const steps = [
  {
    title: "Upload your SRT",
    copy: "Drop in an English subtitle file. SubNexa reads every cue without touching the timing.",
    card: "bg-sky-400",
  },
  {
    title: "Translate to Sinhala",
    copy: "Pick a model and a style. Natural, casual or formal Sinhala, with your glossary applied.",
    card: "bg-amber-400",
  },
  {
    title: "Review and export",
    copy: "Edit any line, then download SRT, ASS or a bilingual file with your changes included.",
    card: "bg-emerald-400",
  },
];

export default function Landing() {
  const signIn = () => openAuthPopup(loginUrl);

  return (
    <MotionConfig reducedMotion="user">
      <div className="dark framer-landing relative isolate min-h-screen overflow-hidden bg-background text-ink">
        <Header overlay showThemeToggle={false} />
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[900px] bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(232,232,238,0.12),transparent_70%)]" />

        <section id="top" className="relative mx-auto w-full max-w-[1200px] px-5 pb-20 pt-36 sm:px-8 sm:pt-44">
          <span id="sn-platform" className="absolute left-0 top-0 scroll-mt-24" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[5px]">
            <DriftWall
              items={posters}
              columns={6}
              tileWidth={170}
              tileHeight={255}
              gap={16}
              radius={5}
              speed={34}
              grayscale={false}
              dim={0.95}
              overlayColor="rgba(10,10,12,0.25)"
              fade={0.35}
              className="h-full w-full"
              style={{}}
            />
            <div className="absolute inset-0 bg-background/45" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_60%_at_24%_46%,rgba(10,10,12,0.92),transparent_72%)]" />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
          </div>
          <div className="relative z-10 max-w-3xl text-left">
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springs.gentle, delay: 0.08 }}
              className="font-display mt-0 text-balance text-[clamp(3rem,8vw,6.75rem)] font-medium leading-[0.95] tracking-[-0.02em]"
            >
              Every story,
              <br />
              in{" "}
              <CanvasText
                text="Sinhala"
                backgroundClassName="bg-[#0091ff]"
                colors={["#0077cc", "#0091ff", "#52a9ff", "#8ecbff", "#b8dcff"]}
                lineGap={4}
                lineWidth={2}
                animationDuration={18}
              />
              .
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springs.gentle, delay: 0.16 }}
              className="mt-6 max-w-xl text-pretty text-[17px] leading-relaxed text-body"
            >
              Drop in an English SRT and let SubNexa rewrite the dialogue in natural Sinhala.
              Every timestamp stays exactly where it belongs, and every line stays yours to review.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springs.gentle, delay: 0.24 }}
              className="mt-9 flex flex-wrap items-center gap-3"
            >
              <SlideTextButton
                text="Get started free"
                hoverText="Sign in"
                href={loginUrl}
                onClick={(event) => { event.preventDefault(); signIn(); }}
              />
              <SlideTextButton text="Browse the library" hoverText="See titles" href="/library" variant="ghost" />
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.38 }}
              className="mt-4 text-[12px] text-content-tertiary"
            >
              No credit card. Google sign-in. Your timing stays untouched.
            </motion.p>
          </div>

        </section>

        <section id="sn-platform" className="mx-auto w-full max-w-[1200px] scroll-mt-28 px-5 pb-24 sm:px-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
            <Reveal className="max-w-2xl">
              <h2 className="font-display mt-3 text-balance text-[clamp(2rem,4vw,3.2rem)] font-semibold leading-[1.02] tracking-[-0.035em]">
                From English SRT to Sinhala in three steps.
              </h2>
              <p className="mt-4 max-w-xl text-pretty text-[16px] leading-relaxed text-body">
                Upload, translate, review. The studio handles the busywork while you keep the final say on every line.
              </p>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-border/70 bg-[var(--next-gray-200)] shadow-[0_24px_60px_-44px_rgba(0,0,0,0.7)]">
                <Image
                  src="/posters/poster-09.webp"
                  alt="Arrival movie poster"
                  fill
                  sizes="(max-width: 1024px) 100vw, 360px"
                  className="object-cover object-top"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/75 via-transparent to-transparent" />
              </div>
            </Reveal>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <Reveal key={step.title} delay={index * 0.08}>
                <div className={`group relative h-full overflow-hidden rounded-2xl p-6 shadow-[0_30px_70px_-46px_rgba(0,0,0,0.85)] ring-1 ring-white/20 transition-transform duration-300 ease-[cubic-bezier(0.23,0.88,0.26,0.92)] hover:-translate-y-0.5 ${step.card}`}>
                  <h3 className="text-2xl font-semibold tracking-[-0.02em] text-slate-950">{step.title}</h3>
                  <p className="mt-3 text-pretty text-[16px] leading-relaxed text-slate-900/80">{step.copy}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <FeaturesAlternating />

        <section className="relative mx-auto w-full max-w-[1200px] px-5 pb-24 sm:px-8">
          <div className="pointer-events-none absolute left-1/2 top-1/4 -z-10 h-[460px] w-[820px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
          <Reveal>
            <div className="sn-card grid gap-10 rounded-2xl p-6 sm:p-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div className="max-w-lg">
                <h2 className="font-display mt-3 text-balance text-[clamp(2rem,4vw,3rem)] font-semibold leading-[1.02] tracking-[-0.035em]">
                  Watch now. Subtitles already there.
                </h2>
                <p className="mt-4 text-pretty text-[16px] leading-relaxed text-body">
                  Browse ready-made Sinhala subtitles for films and series. Search by title and download instantly, no sign-in needed.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <SlideTextButton text="Browse subtitles" hoverText="Open library" href="/library" />
                  <SlideTextButton text="Read the guide" hoverText="How it works" href="/guide" variant="ghost" />
                </div>
              </div>

              <div className="relative hidden aspect-video overflow-hidden rounded-[5px] border border-border/80 bg-[radial-gradient(ellipse_at_30%_20%,#2a0a0c,#0a0a0c_70%)] p-5 sm:block">
                <div className="absolute inset-x-5 top-5 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">
                  <span>Now playing</span>
                  <span className="font-mono tabular-nums">01:42:08</span>
                </div>
                <div className="absolute inset-x-5 bottom-5">
                  <div className="h-1 overflow-hidden rounded-full bg-white/15">
                    <div className="h-full w-[62%] rounded-full bg-primary" />
                  </div>
                  <div className="mt-4 rounded-xl border border-white/10 bg-black/45 px-4 py-3 text-center backdrop-blur-md">
                    <p lang="si" className="text-[15px] leading-snug text-white">
                      හැම කතාවක්ම, සිංහලෙන්.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        <section className="mx-auto w-full max-w-[1200px] px-5 pb-24 sm:px-8">
          <Reveal>
            <div className="sn-card relative overflow-hidden rounded-2xl">
              <div className="cta-scene-fade pointer-events-none absolute inset-y-0 right-0 w-full sm:w-[55%] lg:w-[52%]">
                <Image
                  src="/posters/poster-01.webp"
                  alt="Dune: Part Two movie poster"
                  fill
                  sizes="(max-width: 640px) 100vw, 55vw"
                  className="object-cover object-[center_28%] opacity-80 sm:opacity-95"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-background via-background/15 to-transparent" />
              </div>
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(232,232,238,0.16),transparent_65%)]" />
              <div className="relative max-w-2xl px-6 py-16 sm:px-12 sm:py-20 lg:max-w-[58%]">
                <h2 className="font-display max-w-2xl text-balance text-[clamp(2.4rem,5vw,4rem)] font-semibold leading-[1.02] tracking-[-0.04em]">
                  Bring the next story home in Sinhala.
                </h2>
                <p className="mt-5 max-w-xl text-pretty text-[17px] leading-relaxed text-body">
                  Sign in with Google, upload a subtitle file, and let the studio do the rest. Your timing, names and review notes stay untouched.
                </p>
                <div className="mt-8 flex">
                  <SlideTextButton
                    text="Get started free"
                    hoverText="Sign in"
                    href={loginUrl}
                    onClick={(event) => { event.preventDefault(); signIn(); }}
                  />
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        <SiteFooter />
      </div>
    </MotionConfig>
  );
}
