"use client";

import { motion, MotionConfig } from "motion/react";
import { Download, FileText, Sparkles } from "lucide-react";
import SlideTextButton from "@/components/ui/slide-text-button";
import { CanvasText } from "@/components/ui/canvas-text";
import DriftWall from "./DriftWall";
import FeaturesAlternating from "./FeaturesAlternating";
import Header from "./Header";
import SiteFooter from "./SiteFooter";
import Reveal from "./Reveal";
import { openAuthPopup } from "@/lib/auth-popup";

const API = (process.env.NEXT_PUBLIC_SUBNEXA_API_URL || (process.env.NODE_ENV === "production" ? "/subnexa-api" : "http://localhost:8000")).replace(/\/$/, "");
const loginUrl = `${API}/subnexa-auth/login`;

const stats = [
  { value: "99.9%", label: "timing preserved" },
  { value: "12k+", label: "cues translated" },
  { value: "6", label: "AI models" },
  { value: "3", label: "export formats" },
];

const steps = [
  {
    icon: FileText,
    title: "Upload your SRT",
    copy: "Drop in an English subtitle file. SubNexa reads every cue without touching the timing.",
  },
  {
    icon: Sparkles,
    title: "Translate to Sinhala",
    copy: "Pick a model and a style. Natural, casual or formal Sinhala, with your glossary applied.",
  },
  {
    icon: Download,
    title: "Review and export",
    copy: "Edit any line, then download SRT, ASS or a bilingual file with your changes included.",
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
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[5px]">
            <DriftWall
              grayscale
              dim={0.32}
              overlayColor="#0a0a0c"
              fade={0.75}
              className="h-full w-full"
              style={{}}
            />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
          </div>
          <div className="relative z-10 max-w-3xl text-left">
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.05, ease: "easeOut" }}
              className="mt-7 text-[clamp(3.4rem,9vw,7.5rem)] font-medium leading-[0.84] tracking-[-0.02em]"
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
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
              className="mt-6 max-w-xl text-[17px] leading-relaxed text-body"
            >
              Drop in an English SRT and let SubNexa rewrite the dialogue in natural Sinhala.
              Every timestamp stays exactly where it belongs, and every line stays yours to review.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.25, ease: "easeOut" }}
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
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-4 text-[12px] text-content-tertiary"
            >
              No credit card. Google sign-in. Your timing stays untouched.
            </motion.p>
          </div>

        </section>

        <section className="mx-auto w-full max-w-[1200px] px-5 pb-24 sm:px-8">
          <Reveal>
            <div className="grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-[5px] border border-border bg-[var(--next-gray-200)] sm:grid-cols-4 sm:divide-y-0">
              {stats.map((stat) => (
                <div key={stat.label} className="px-6 py-7 text-left">
                  <p className="text-3xl font-semibold tracking-tight text-ink">{stat.value}</p>
                  <p className="mt-1 text-[13px] text-content-tertiary">{stat.label}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        <section className="mx-auto w-full max-w-[1200px] px-5 pb-24 sm:px-8">
          <Reveal className="max-w-2xl">
            <h2 className="mt-3 text-[clamp(2rem,4vw,3.2rem)] font-bold leading-[1.05]">
              From English SRT to Sinhala in three steps.
            </h2>
            <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-body">
              Upload, translate, review. The studio handles the busywork while you keep the final say on every line.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <Reveal key={step.title} delay={index * 0.08}>
                  <div className="group h-full rounded-[5px] border border-border bg-[var(--next-gray-200)] p-6">
                    <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                      <Icon className="size-5" strokeWidth={1.5} />
                    </span>
                    <span className="mt-6 block font-mono text-[12px] text-content-tertiary">0{index + 1}</span>
                    <h3 className="mt-2 text-xl font-semibold">{step.title}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-body">{step.copy}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </section>

        <FeaturesAlternating />

        <section className="relative mx-auto w-full max-w-[1200px] px-5 pb-24 sm:px-8">
          <div className="pointer-events-none absolute left-1/2 top-1/4 -z-10 h-[460px] w-[820px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
          <Reveal>
            <div className="grid gap-10 rounded-[5px] border border-border bg-[var(--next-gray-200)] p-6 sm:p-10">
              <div className="max-w-lg">
                <h2 className="mt-3 text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.05]">
                  Watch now. Subtitles already there.
                </h2>
                <p className="mt-4 text-[16px] leading-relaxed text-body">
                  Browse ready-made Sinhala subtitles for films and series. Search by title and download instantly, no sign-in needed.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <SlideTextButton text="Browse subtitles" hoverText="Open library" href="/library" />
                  <SlideTextButton text="Read the guide" hoverText="How it works" href="/guide" variant="ghost" />
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        <section className="mx-auto w-full max-w-[1200px] px-5 pb-24 sm:px-8">
          <Reveal>
            <div className="relative overflow-hidden rounded-[5px] border border-border bg-[var(--next-gray-200)] px-6 py-16 sm:px-12 sm:py-20">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(232,232,238,0.16),transparent_65%)]" />
              <div className="relative">
                <h2 className="max-w-2xl text-[clamp(2.4rem,5vw,4rem)] font-bold leading-[1.02]">
                  Bring the next story home in Sinhala.
                </h2>
                <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-body">
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
