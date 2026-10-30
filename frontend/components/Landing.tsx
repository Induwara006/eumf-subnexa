"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CircleHelp, Languages, ChevronRight, Download, LogIn, Info, CheckCircle2, Sparkles, Lock, ChevronDown, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import QuickGuide from "./QuickGuide";
const API = (process.env.NEXT_PUBLIC_SUBNEXA_API_URL || (process.env.NODE_ENV === "production" ? "/subnexa-api" : "http://localhost:8000")).replace(/\/$/, "");
export default function Landing() {
 const [help,setHelp] = useState(false);
 const [scrolled,setScrolled] = useState(false);
 const root = useRef<HTMLDivElement>(null);
 useEffect(() => {
   let frame = 0;
   const media = window.matchMedia("(prefers-reduced-motion: reduce)");
   const update = () => {
     frame = 0;
     setScrolled(window.scrollY > 24);
     const amount = media.matches ? 0 : Math.min(1, Math.max(0, window.scrollY) / 480);
     root.current?.style.setProperty("--landing-blur", `${amount * 8}px`);
   };
   const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
   update(); window.addEventListener("scroll", schedule, { passive:true }); media.addEventListener("change",schedule);
   return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll",schedule); media.removeEventListener("change",schedule); };
 }, []);
 return <div ref={root} className="relative isolate min-h-screen bg-[#141414] text-white">
 <QuickGuide open={help} onOpenChange={setHelp} />
<>
      <header className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        scrolled ? "netflix-topbar-scrolled" : "netflix-topbar",
      )}>
        <div className="mx-auto flex h-16 w-full max-w-[1480px] items-center gap-4 px-4 sm:h-[68px] sm:px-8">
          <a href="#top" className="netflix-logo text-2xl sm:text-3xl" aria-label="SubNexa home">SubNexa</a>
          <nav className="hidden items-center gap-5 text-[13px] md:flex" aria-label="Main">
            <a href="#top" className="font-medium text-white transition-colors">Home</a>
            <a href="#sn-features" className="text-white/70 transition-colors hover:text-white">How it works</a>
            <a href={`${API}/subnexa-auth/login`} className="text-white/70 transition-colors hover:text-white">Sign in</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-[3px] border border-white/15 bg-black/30 px-3 py-1.5 text-[11px] sm:flex">
              <Languages className="size-3.5 text-primary" />
              <span className="text-white/70">English</span>
              <ChevronRight className="size-3 text-white/40" />
              <span lang="si" className="text-white">සිංහල</span>
            </div>
            <Button aria-label="Guide" variant="ghost" size="sm" className="h-9 gap-2 px-3 text-white/80 hover:text-white" onClick={() => setHelp(true)}>
              <CircleHelp className="size-4" /><span className="hidden sm:inline">Guide</span>
            </Button>
            <Button asChild><a href={`${API}/subnexa-auth/login`}>Sign in</a></Button>
          </div>
        </div>
      </header>

      <section id="top" className="netflix-hero relative isolate flex min-h-[88vh] items-end overflow-hidden">
        <div className="relative z-10 mx-auto w-full max-w-[1480px] px-4 pb-24 pt-32 sm:px-8 sm:pb-32">
          <div className="max-w-3xl">
            <h1 className="font-geist text-[3.2rem] font-black leading-[0.92] tracking-[-0.04em] text-white drop-shadow-[0_8px_30px_rgba(0,0,0,0.6)] sm:text-7xl lg:text-[5.8rem]">
              Every story.<br />
              <span className="text-white/85">In Sinhala.</span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">
              Drop in an English SRT and let SubNexa AI bring it home in natural Sinhala.
              Dialogue is rewritten, every timestamp stays exactly where it belongs.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-medium text-white/75 sm:text-xs">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-success" />Timing protected</span>
              <span className="flex items-center gap-1.5"><Sparkles className="size-3.5 text-primary" />Natural or formal voice</span>
              <span className="flex items-center gap-1.5"><Lock className="size-3.5 text-white/60" />Glossary-aware</span>
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-12 gap-2 px-7 text-base font-bold">
                <a href={`${API}/subnexa-auth/login`}><LogIn className="size-5" />Sign in to translate</a>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 gap-2 border-white/25 bg-black/30 px-6 text-base text-white hover:bg-white/15">
                <Link href="/library"><Download className="size-5" />Download subtitles</Link>
              </Button>
              <Button size="lg" variant="secondary" className="h-12 gap-2 bg-white/15 px-6 text-base text-white hover:bg-white/25" onClick={() => setHelp(true)}>
                <Info className="size-5" />How it works
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-2 text-[11px] text-white/60">
              <Badge className="h-5 gap-1 bg-primary px-2 text-[10px] font-semibold">New</Badge>
              <span>SubNexa Pro &amp; 0.2 model routing</span>
              <span className="text-white/25">|</span>
              <span>SRT &amp; ASS export</span>
              <span className="text-white/25">|</span>
              <span>Built for Sinhala</span>
            </div>
          </div>
        </div>
        <a href="#sn-features" className="absolute bottom-6 right-4 z-10 hidden items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/50 transition-colors hover:text-white sm:right-8 sm:flex">
          Explore <ChevronDown className="size-4" />
        </a>
      </section>

      <section id="sn-features" className="relative z-20 mx-auto -mt-16 w-full max-w-[1480px] scroll-mt-24 px-4 sm:px-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-bold tracking-tight sm:text-xl">How SubNexa works</h2>
          <span className="text-[11px] text-muted-foreground">4 steps · zero timing changes</span>
        </div>
        <div className="netflix-row grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Upload, step: "01", title: "Upload your SRT", detail: "Drop an English subtitle file up to 2 MB and preview every cue." },
            { icon: Sparkles, step: "02", title: "Choose the voice", detail: "Natural, casual or formal Sinhala, with SRT or ASS output." },
            { icon: Lock, step: "03", title: "Protect the names", detail: "Glossary rules keep characters, places and terms intact." },
            { icon: Download, step: "04", title: "Review & download", detail: "Compare, search and edit, then save your finished subtitles." },
          ].map(item => (
            <div key={item.step} className="netflix-tile group relative overflow-hidden rounded-[6px] border border-white/10 bg-[#181818] p-5">
              <div className="flex items-center justify-between">
                <span className="grid size-9 place-items-center rounded-[4px] bg-primary/15 text-primary ring-1 ring-primary/30">
                  <item.icon className="size-4" />
                </span>
                <span className="font-mono text-[10px] tracking-[0.2em] text-white/30">{item.step}</span>
              </div>
              <h3 className="mt-4 text-sm font-semibold text-white">{item.title}</h3>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{item.detail}</p>
              <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-primary transition-transform duration-300 group-hover:scale-x-100" />
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-20 mx-auto w-full max-w-[1480px] px-4 pb-24 pt-6 sm:px-8">
        <div className="overflow-hidden rounded-[6px] border border-white/10 bg-[#181818] p-7 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-10">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Sign in to open your studio.</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55">
              Upload, translate and review Sinhala subtitles in one private workspace. The studio only appears after you sign in.
            </p>
          </div>
          <div className="mt-6 flex shrink-0 flex-wrap gap-3 sm:mt-0">
            <Button asChild size="lg" className="h-11 gap-2 px-6">
              <a href={`${API}/subnexa-auth/login`}><LogIn className="size-4" />Sign in with Google</a>
            </Button>
            <Button variant="secondary" size="lg" className="h-11 gap-2 bg-white/10 px-6 text-white hover:bg-white/20" onClick={() => setHelp(true)}>
              <Info className="size-4" />Guide
            </Button>
          </div>
        </div>
      </section>

      <footer className="mx-auto w-full max-w-[1480px] border-t border-white/10 px-4 pb-10 pt-8 sm:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="netflix-logo text-lg">SubNexa</span>
            <p className="mt-2 max-w-sm text-[11px] leading-relaxed text-white/45">
              Every story, in Sinhala. Timestamps protected, dialogue reviewed by you.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-white/55">
            <a href="#sn-features" className="transition-colors hover:text-white">How it works</a>
            <a href={`${API}/subnexa-auth/login`} className="transition-colors hover:text-white">Sign in</a>
            <button type="button" onClick={() => setHelp(true)} className="transition-colors hover:text-white">Guide</button>
            <a href="#top" className="transition-colors hover:text-white">Back to top</a>
          </div>
        </div>
        <p className="mt-6 text-right text-[10px] tracking-[0.08em] text-white/25">
          Design by <a href="https://zagan.space" target="_blank" rel="noreferrer" className="text-white/45 transition-colors hover:text-white">Zagan</a>
        </p>
      </footer>
</>


</div>;
}
