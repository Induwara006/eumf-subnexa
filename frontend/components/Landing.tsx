"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  CircleHelp,
  Clock3,
  Download,
  Film,
  Globe2,
  Languages,
  ListChecks,
  LogIn,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import QuickGuide from "./QuickGuide";
import Header from "./Header";
import { openAuthPopup } from "@/lib/auth-popup";

const API = (process.env.NEXT_PUBLIC_SUBNEXA_API_URL || (process.env.NODE_ENV === "production" ? "/subnexa-api" : "http://localhost:8000")).replace(/\/$/, "");

const steps = [
  { icon: Upload, step: "01", title: "Upload your SRT", detail: "Drop an English subtitle file up to 2 MB and preview every cue before you commit." },
  { icon: Sparkles, step: "02", title: "Choose the voice", detail: "Natural, casual or formal Sinhala, with SRT or ASS output and smart model routing." },
  { icon: ShieldCheck, step: "03", title: "Protect the names", detail: "Glossary groups keep characters, places and recurring terms exactly where they belong." },
  { icon: Download, step: "04", title: "Review & download", detail: "Compare line by line, edit any cue, then export your finished Sinhala subtitles." },
];

const marquee = ["SRT", "ASS", "Glossary-aware", "Timestamps protected", "Natural Sinhala", "Formal voice", "Model routing", "Fair-use limits", "Community library", "Review tools"];

const features = [
  { icon: Clock3, title: "Timing never moves", copy: "Every timestamp is preserved byte for byte. Only the dialogue is rewritten." },
  { icon: Languages, title: "Sinhala first", copy: "Tuned prompts and a Sinhala-aware review panel, not a generic translation pass." },
  { icon: ListChecks, title: "Glossary control", copy: "Group rules for names, places and fandom terms, with per-line overrides when you need them." },
  { icon: Zap, title: "Resumable runs", copy: "Pause, close the tab and come back. Your progress stays attached to the same file." },
  { icon: Globe2, title: "Public library", copy: "Publish finished subtitles to the community library, or download ready-made ones instantly." },
  { icon: BadgeCheck, title: "Human reviewed", copy: "Editor changes are saved into your export, so the final read is always yours." },
];

export default function Landing() {
  const [help, setHelp] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nodes = root.current?.querySelectorAll<HTMLElement>(".inc-reveal");
    if (!nodes?.length) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) {
      nodes.forEach((node) => node.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -8% 0px" });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  const signIn = () => openAuthPopup(`${API}/subnexa-auth/login`);

  return (
    <div ref={root} className="relative isolate min-h-screen overflow-x-clip bg-background text-ink">
      <QuickGuide open={help} onOpenChange={setHelp} />
      <Header onGuide={() => setHelp(true)} overlay />

      <section id="top" className="relative isolate overflow-hidden pb-16 pt-32 sm:pt-40">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 inc-grid-lines opacity-60" />
          <div className="absolute -left-32 top-24 size-[520px] rounded-full bg-[radial-gradient(circle_at_center,#fddfd9_0%,transparent_68%)] dark:bg-[radial-gradient(circle_at_center,rgba(255,106,69,0.14)_0%,transparent_68%)] blur-2xl" />
          <div className="absolute -right-24 top-0 size-[560px] rounded-full bg-[radial-gradient(circle_at_center,#f1ebe2_0%,transparent_70%)] dark:bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_70%)]" />
        </div>

        <div className="mx-auto grid w-full max-w-[1240px] items-center gap-14 px-5 sm:px-8 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10">
          <div className="relative z-10">
            <div className="inc-fade-up mb-7 inline-flex items-center gap-2.5 rounded-full border border-ink/10 bg-background/70 py-1.5 pl-2.5 pr-4 text-[12px] font-medium tracking-[0.02em] text-body backdrop-blur">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full rounded-full bg-alarmalade opacity-75" style={{ animation: "inc-pulse-ring 2.4s ease-out infinite" }} />
                <span className="relative inline-flex size-2 rounded-full bg-alarmalade" />
              </span>
              AI subtitles, built for Sinhala
            </div>

            <h1 className="inc-fade-up inc-delay-1 text-[clamp(3.1rem,6.4vw,5.6rem)] font-normal leading-[0.96] tracking-[-0.03em] text-ink">
              Every story,
              <br />
              in <span className="relative inline-block text-alarmalade">
                Sinhala
                <svg className="absolute -bottom-2 left-0 w-full" height="14" viewBox="0 0 220 14" fill="none" preserveAspectRatio="none" aria-hidden>
                  <path d="M2 10.5C44 4.5 96 2.5 218 6.5" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
                </svg>
              </span>
              .
            </h1>

            <p className="inc-fade-up inc-delay-2 mt-7 max-w-[34rem] text-[18px] leading-[1.55] text-body">
              Drop in an English SRT and let SubNexa rewrite the dialogue in natural Sinhala.
              Every timestamp stays exactly where it belongs, and every line stays yours to review.
            </p>

            <div className="inc-fade-up inc-delay-3 mt-9 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="group">
                <a href={`${API}/subnexa-auth/login`} onClick={(event) => { event.preventDefault(); signIn(); }}>
                  <LogIn className="size-4" />
                  Sign in to translate
                  <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/library"><Download className="size-4" />Browse the library</Link>
              </Button>
              <button type="button" onClick={() => setHelp(true)} className="group inline-flex items-center gap-2 px-2 text-[15px] font-medium text-body transition-colors hover:text-ink">
                <span className="grid size-8 place-items-center rounded-full border border-ink/15 transition-colors group-hover:border-ink/35">
                  <Play className="size-3.5 translate-x-px" />
                </span>
                How it works
              </button>
            </div>

            <div className="inc-fade-up inc-delay-4 mt-9 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-body">
              <span className="flex items-center gap-1.5"><Check className="size-3.5 text-success" />Timing protected</span>
              <span className="flex items-center gap-1.5"><Check className="size-3.5 text-success" />Glossary-aware</span>
              <span className="flex items-center gap-1.5"><Check className="size-3.5 text-success" />SRT &amp; ASS export</span>
            </div>
          </div>

          <div className="inc-fade-up inc-delay-2 relative mx-auto w-full max-w-[540px] lg:max-w-none">
            <div className="inc-float relative rounded-[24px] border border-ink/10 bg-cream p-3 shadow-[0_40px_80px_-40px_rgba(22,22,24,0.4)]">
              <div className="overflow-hidden rounded-2xl border border-ink/10 bg-card">
                <div className="flex items-center gap-1.5 border-b border-ink/10 bg-cream/70 px-4 py-3">
                  <span className="size-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="size-2.5 rounded-full bg-[#febc2e]" />
                  <span className="size-2.5 rounded-full bg-[#28c840]" />
                  <span className="ml-3 flex-1 truncate rounded-md bg-background px-2.5 py-1 font-mono text-[10px] text-content-tertiary">studio.subnexa.app / translate</span>
                </div>
                <div className="grid gap-0 sm:grid-cols-[1.15fr_1fr]">
                  <div className="border-b border-ink/10 p-5 sm:border-b-0 sm:border-r">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-content-tertiary">Source · English</span>
                      <span className="rounded-full bg-cream px-2 py-0.5 font-mono text-[10px] text-content-tertiary">SRT</span>
                    </div>
                    <div className="mt-4 space-y-3 text-[12px] leading-relaxed text-body">
                      <p><span className="mr-2 font-mono text-[10px] text-alarmalade">00:01</span>We need to leave before the storm hits.</p>
                      <p><span className="mr-2 font-mono text-[10px] text-alarmalade">00:04</span>Then we go through the old harbour road.</p>
                      <p><span className="mr-2 font-mono text-[10px] text-alarmalade">00:08</span>Promise me you won&apos;t look back.</p>
                    </div>
                    <div className="mt-5 flex items-center gap-2 rounded-lg border border-ink/10 bg-cream/60 px-3 py-2">
                      <Sparkles className="size-3.5 text-alarmalade" />
                      <span className="text-[11px] text-body">Natural Sinhala · glossary on</span>
                      <span className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] text-success"><span className="size-1.5 rounded-full bg-success inc-blink" />live</span>
                    </div>
                  </div>
                  <div className="relative bg-[#161618] p-5 text-[#f7f7f8]">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/45">Target · සිංහල</span>
                      <Badge className="h-5 bg-alarmalade/15 px-2 text-[9px] text-alarmalade" variant="outline">AI</Badge>
                    </div>
                    <div className="mt-4 space-y-3 text-[12px] leading-relaxed text-white/85" lang="si">
                      <p><span className="mr-2 font-mono text-[10px] text-alarmalade/80">00:01</span>කුණාටුව එන්න කලින් අපි පිටත් වෙන්න ඕනේ.</p>
                      <p><span className="mr-2 font-mono text-[10px] text-alarmalade/80">00:04</span>එහෙනම් අපි පරණ වරාය පාරෙන් යමු.</p>
                      <p className="rounded-md bg-white/5 px-2 py-1 ring-1 ring-white/15"><span className="mr-2 font-mono text-[10px] text-alarmalade/80">00:08</span>ආයෙ හැරිලා බලන්නෙ නැති බවට මට පොරොන්දු වෙන්න.</p>
                    </div>
                    <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-alarmalade to-[#f1cd98]" />
                    </div>
                    <p className="mt-2 font-mono text-[10px] text-white/40">72% · 184 / 256 lines</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -left-4 top-[38%] hidden items-center gap-2 rounded-xl border border-ink/10 bg-card px-3.5 py-2.5 shadow-[0_18px_40px_-24px_rgba(22,22,24,0.55)] sm:flex" style={{ animation: "inc-float 7s ease-in-out infinite", animationDelay: "1.2s" }}>
              <ShieldCheck className="size-4 text-success" />
              <div className="leading-tight">
                <p className="text-[11px] font-medium text-ink">Timestamps intact</p>
                <p className="font-mono text-[10px] text-content-tertiary">0 changes</p>
              </div>
            </div>
            <div className="absolute -right-3 bottom-10 hidden items-center gap-2 rounded-xl border border-ink/10 bg-card px-3.5 py-2.5 shadow-[0_18px_40px_-24px_rgba(22,22,24,0.55)] sm:flex" style={{ animation: "inc-float 8s ease-in-out infinite", animationDelay: "0.6s" }}>
              <Globe2 className="size-4 text-alarmalade" />
              <div className="leading-tight">
                <p className="text-[11px] font-medium text-ink">12,400+ cues</p>
                <p className="font-mono text-[10px] text-content-tertiary">translated today</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-cream py-7" aria-label="Capabilities">
        <div className="mx-auto flex w-full max-w-[1240px] items-center gap-8 px-5 sm:px-8">
          <span className="hidden shrink-0 text-[11px] font-medium uppercase tracking-[0.18em] text-content-tertiary md:block">Made for</span>
          <div className="relative flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
            <div className="inc-marquee flex w-max items-center gap-8">
              {[...marquee, ...marquee].map((item, index) => (
                <span key={`${item}-${index}`} className="flex items-center gap-8 text-[14px] font-medium text-body">
                  {item}
                  <span className="size-1 rounded-full bg-ink/25" />
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="sn-features" className="mx-auto w-full max-w-[1240px] scroll-mt-28 px-5 py-24 sm:px-8 sm:py-32">
        <div className="inc-reveal flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-[12px] font-medium uppercase tracking-[0.2em] text-alarmalade">How it works</p>
            <h2 className="mt-4 max-w-2xl text-[clamp(2.2rem,4.2vw,3.6rem)] leading-[1.02] tracking-[-0.025em]">
              Four steps.<br /><span className="text-body">Zero timing changes.</span>
            </h2>
          </div>
          <p className="max-w-sm text-[16px] leading-relaxed text-body">
            A focused workspace from upload to export. No spreadsheets, no manual re-timing, no lost context.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((item, index) => (
            <article key={item.step} className="inc-reveal group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-cream p-6 transition-all duration-500 hover:-translate-y-1 hover:border-ink/25 hover:shadow-[0_24px_50px_-32px_rgba(22,22,24,0.4)]" style={{ transitionDelay: `${index * 70}ms` }}>
              <div className="flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-xl bg-card text-ink ring-1 ring-ink/10 transition-colors duration-300 group-hover:bg-alarmalade group-hover:text-white">
                  <item.icon className="size-5" />
                </span>
                <span className="font-mono text-[11px] tracking-[0.2em] text-content-tertiary">{item.step}</span>
              </div>
              <h3 className="mt-6 text-[22px] leading-tight text-ink">{item.title}</h3>
              <p className="mt-2.5 text-[14px] leading-relaxed text-body">{item.detail}</p>
              <span className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-alarmalade transition-transform duration-500 group-hover:scale-x-100" />
            </article>
          ))}
        </div>
      </section>

      <section id="sn-platform" className="inc-dark relative overflow-hidden py-24 sm:py-32">
        <div className="pointer-events-none absolute inset-0 opacity-40">
          <div className="absolute inset-0 inc-dot-grid opacity-[0.18]" />
          <div className="absolute left-1/2 top-0 size-[640px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(242,85,51,0.22),transparent_65%)]" />
        </div>
        <div className="relative mx-auto grid w-full max-w-[1240px] items-center gap-16 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-[12px] font-medium uppercase tracking-[0.2em] text-alarmalade">The studio</p>
            <h2 className="mt-4 text-[clamp(2.2rem,4.2vw,3.6rem)] leading-[1.02] text-white">
              A studio that keeps<br /><span className="text-white/60">every cue in place.</span>
            </h2>
            <p className="mt-6 max-w-md text-[16px] leading-relaxed text-white/60">
              Translate, compare and edit in one view. The timeline is read-only by design, so the only thing that changes is the language.
            </p>
            <ul className="mt-8 space-y-4">
              {["Line-by-line source and target comparison", "Pause and resume without losing progress", "Glossary groups applied across the whole file", "Export SRT, ASS or bilingual subtitles"].map((item) => (
                <li key={item} className="flex items-start gap-3 text-[15px] text-white/75">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-alarmalade/15 text-alarmalade"><Check className="size-3" /></span>
                  {item}
                </li>
              ))}
            </ul>
            <Button asChild size="lg" className="group mt-9">
              <a href={`${API}/subnexa-auth/login`} onClick={(event) => { event.preventDefault(); signIn(); }}>
                Open the studio
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </a>
            </Button>
          </div>

          <div className="inc-reveal relative">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#212126] shadow-[0_40px_100px_-40px_rgba(0,0,0,0.8)]">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
                <div className="flex items-center gap-2 text-[12px] text-white/50">
                  <Film className="size-3.5" /> episode-04.srt
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-success/15 px-2 py-0.5 font-mono text-[10px] text-success">timing locked</span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] text-white/60">184 cues</span>
                </div>
              </div>
              <div className="space-y-1 p-3">
                {[
                  { t: "00:00:12", en: "The train leaves at midnight.", si: "දුම්රිය මධ්‍යම රාත්‍රියේ පිටත් වෙනවා." },
                  { t: "00:00:16", en: "You still have time to change your mind.", si: "ඔයාට තවමත් හිත වෙනස් කරන්න වෙලාව තියෙනවා." },
                  { t: "00:00:21", en: "I made my choice a long time ago.", si: "මම ගිහින් ගොඩක් කලින් මගේ තීරණය ගත්තා." },
                  { t: "00:00:26", en: "Then there is nothing left to say.", si: "එහෙනම් කියන්න ඉතුරු වෙච්ච දෙයක් නැහැ." },
                ].map((cue, index) => (
                  <div key={cue.t} className={`group grid grid-cols-[auto_1fr_1fr] items-start gap-4 rounded-lg px-3 py-3 transition-colors ${index === 1 ? "bg-white/[0.06] ring-1 ring-white/10" : "hover:bg-white/[0.04]"}`}>
                    <span className="pt-0.5 font-mono text-[10px] text-alarmalade/80">{cue.t}</span>
                    <p className="text-[12.5px] leading-relaxed text-white/60">{cue.en}</p>
                    <p className="text-[12.5px] leading-relaxed text-white/90" lang="si">{cue.si}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 border-t border-white/10 px-5 py-3.5">
                <span className="flex items-center gap-1.5 text-[11px] text-white/45"><span className="size-1.5 rounded-full bg-alarmalade inc-blink" />Translating</span>
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-alarmalade to-[#f1cd98]" />
                </div>
                <span className="font-mono text-[10px] text-white/40">68%</span>
              </div>
            </div>
            <div className="absolute -right-4 -top-5 hidden rotate-3 rounded-xl border border-white/15 bg-white px-3 py-2 text-[11px] font-medium text-ink shadow-xl md:block" style={{ animation: "inc-wobble 6s ease-in-out infinite" }}>
              Glossary matched
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1240px] px-5 py-24 sm:px-8 sm:py-32">
        <div className="inc-reveal max-w-2xl">
          <p className="text-[12px] font-medium uppercase tracking-[0.2em] text-alarmalade">Built for the details</p>
          <h2 className="mt-4 text-[clamp(2.2rem,4.2vw,3.6rem)] leading-[1.02]">
            Everything a subtitle<br /><span className="text-body">actually needs.</span>
          </h2>
        </div>
        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {features.map((item) => (
            <article key={item.title} className="inc-reveal group relative bg-card p-7 transition-colors duration-300 hover:bg-cream">
              <span className="grid size-10 place-items-center rounded-xl bg-cream text-ink ring-1 ring-ink/10 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:bg-alarmalade group-hover:text-white">
                <item.icon className="size-[18px]" />
              </span>
              <h3 className="mt-5 text-[20px] leading-tight text-ink">{item.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-body">{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-cream py-24 sm:py-28">
        <div className="mx-auto grid w-full max-w-[1240px] items-center gap-14 px-5 sm:px-8 lg:grid-cols-2">
          <div className="inc-reveal">
            <p className="text-[12px] font-medium uppercase tracking-[0.2em] text-alarmalade">The library</p>
            <h2 className="mt-4 text-[clamp(2.2rem,4vw,3.4rem)] leading-[1.02]">
              Watch now.<br /><span className="text-body">Subtitles already there.</span>
            </h2>
            <p className="mt-6 max-w-md text-[16px] leading-relaxed text-body">
              Browse ready-made Sinhala subtitles for films and series. Search by title and download instantly, no sign-in needed.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="group">
                <Link href="/library">
                  <Search className="size-4" />
                  Browse subtitles
                  <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" onClick={() => setHelp(true)}>
                <CircleHelp className="size-4" />Read the guide
              </Button>
            </div>
          </div>
          <div className="inc-reveal grid grid-cols-3 gap-3" style={{ transitionDelay: "80ms" }}>
            {[
              { title: "Nightfall", year: "2024", tone: "from-[#3a1c1a] to-[#0d0a09]", accent: "#f25533" },
              { title: "The Harbour", year: "2023", tone: "from-[#1f2a2c] to-[#0a0f10]", accent: "#76e5c9" },
              { title: "Paper Moon", year: "2022", tone: "from-[#2b2438] to-[#0b0910]", accent: "#f1cd98" },
            ].map((film, index) => (
              <Link key={film.title} href="/library" className={`group relative overflow-hidden rounded-xl border border-ink/10 bg-gradient-to-b ${film.tone} shadow-lg transition-transform duration-500 hover:-translate-y-1.5 ${index === 1 ? "translate-y-5" : ""}`}>
                <div className="flex aspect-[2/3] flex-col justify-between p-4 text-white">
                  <div className="flex items-center justify-between">
                    <Film className="size-4 text-white/50" />
                    <span className="font-mono text-[9px] text-white/40">{film.year}</span>
                  </div>
                  <div>
                    <span className="mb-2 block h-px w-6" style={{ background: film.accent }} />
                    <p className="font-medium text-[17px] leading-tight">{film.title}</p>
                    <p className="mt-1 text-[10px] text-white/45">සිංහල උපසිරැසි</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1240px] px-5 py-24 sm:px-8 sm:py-28">
        <div className="inc-reveal relative overflow-hidden rounded-[28px] bg-alarmalade px-8 py-14 sm:px-14 sm:py-20">
          <div className="pointer-events-none absolute inset-0 inc-noise" />
          <div className="pointer-events-none absolute -right-24 -top-24 size-[420px] rounded-full border-[40px] border-white/10" />
          <div className="pointer-events-none absolute -bottom-32 right-10 size-[280px] rounded-full bg-[#f1cd98]/30 blur-2xl" />
          <div className="relative max-w-2xl">
            <Badge className="bg-white/15 text-white" variant="outline">Start in under a minute</Badge>
            <h2 className="mt-6 text-[clamp(2.4rem,5vw,4.2rem)] leading-[0.98] text-white">
              Bring the next story home<br /><span className="text-white/80">in Sinhala.</span>
            </h2>
            <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-white/85">
              Sign in with Google, upload a subtitle file, and let the studio do the rest. Your timing, names and review notes stay untouched.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg" className="group bg-[#161618] text-white hover:bg-black">
                <a href={`${API}/subnexa-auth/login`} onClick={(event) => { event.preventDefault(); signIn(); }}>
                  <LogIn className="size-4" />
                  Get started free
                  <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/40 text-white hover:border-white hover:bg-white/10">
                <Link href="/library"><Download className="size-4" />Download subtitles</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-background">
        <div className="mx-auto w-full max-w-[1240px] px-5 py-14 sm:px-8">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-sm">
              <span className="flex items-baseline gap-1.5 text-[24px] font-medium tracking-[-0.03em] text-ink">SubNexa<span className="size-1.5 rounded-full bg-alarmalade" /></span>
              <p className="mt-4 text-[14px] leading-relaxed text-body">
                Every story, in Sinhala. Timestamps protected, dialogue reviewed by you.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-14 gap-y-8 text-[14px] sm:grid-cols-3">
              <div className="space-y-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-content-tertiary">Product</p>
                <a href="#sn-features" className="block text-body transition-colors hover:text-ink">How it works</a>
                <a href="#sn-platform" className="block text-body transition-colors hover:text-ink">Studio</a>
                <Link href="/library" className="block text-body transition-colors hover:text-ink">Library</Link>
              </div>
              <div className="space-y-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-content-tertiary">Account</p>
                <a href={`${API}/subnexa-auth/login`} onClick={(event) => { event.preventDefault(); signIn(); }} className="block text-body transition-colors hover:text-ink">Sign in</a>
                <button type="button" onClick={() => setHelp(true)} className="block text-body transition-colors hover:text-ink">Guide</button>
              </div>
              <div className="space-y-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-content-tertiary">More</p>
                <a href="#top" className="block text-body transition-colors hover:text-ink">Back to top</a>
                <a href="https://zagan.space" target="_blank" rel="noreferrer" className="block text-body transition-colors hover:text-ink">Design by Zagan</a>
              </div>
            </div>
          </div>
          <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 text-[12px] text-content-tertiary sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} SubNexa. Built for Sinhala subtitles.</p>
            <p className="font-mono text-[11px]">SRT · ASS · සිංහල</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
