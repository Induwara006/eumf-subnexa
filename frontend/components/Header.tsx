"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  CircleHelp,
  Film,
  Languages,
  Library,
  LogIn,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/theme-toggle";
import { openAuthPopup } from "@/lib/auth-popup";

const API = (process.env.NEXT_PUBLIC_SUBNEXA_API_URL ||
  (process.env.NODE_ENV === "production" ? "/subnexa-api" : "http://localhost:8000")).replace(/\/$/, "");

const loginUrl = `${API}/subnexa-auth/login`;

type HeaderProps = {
  onGuide?: () => void;
  overlay?: boolean;
};

const groups = [
  {
    label: "Product",
    items: [
      { title: "Translation studio", description: "Upload an SRT and review every cue.", href: "/#sn-platform", icon: Sparkles },
      { title: "Subtitle library", description: "Ready-made Sinhala subtitles.", href: "/library", icon: Library },
      { title: "How it works", description: "Four steps, zero timing changes.", href: "/#sn-features", icon: Film },
      { title: "Sinhala glossary", description: "Keep names and places intact.", href: "/#sn-features", icon: Languages },
    ],
  },
  {
    label: "Learn",
    items: [
      { title: "Guide", description: "A quick tour of the workflow.", guide: true, icon: BookOpen },
      { title: "Fair use", description: "What you can translate and share.", guide: true, icon: ShieldCheck },
      { title: "Community library", description: "Browse films and series.", href: "/library", icon: Search },
      { title: "Request a subtitle", description: "Ask the community for a title.", href: "/library", icon: Plus },
    ],
  },
] as const;

export default function Header({ onGuide, overlay = false }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 12);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    if (!openGroup) return;
    const close = (event: MouseEvent) => {
      if (!navRef.current?.contains(event.target as Node)) setOpenGroup(null);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpenGroup(null); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [openGroup]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileOpen(false); };
    document.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", escape);
    };
  }, [mobileOpen]);

  function signIn() {
    setMobileOpen(false);
    openAuthPopup(loginUrl);
  }

  function runGuide() {
    setMobileOpen(false);
    setOpenGroup(null);
    onGuide?.();
  }

  const solid = !overlay || scrolled || mobileOpen;

  return (
    <>
      <header
        className={`${overlay ? "fixed" : "sticky"} inset-x-0 top-0 z-50 transition-all duration-300 ${
          solid ? "border-b border-border bg-background/85 backdrop-blur-xl" : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-[72px] w-full max-w-[1240px] items-center gap-6 px-5 sm:px-8">
          <Link href="/" className="group flex items-center gap-2.5" aria-label="SubNexa home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/SubNexa_Logo_Transparent.png" alt="SubNexa" className="h-6 w-auto" />
          </Link>

          <div ref={navRef} className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
            {groups.map((group) => (
              <div
                key={group.label}
                className="relative"
                onMouseEnter={() => setOpenGroup(group.label)}
                onMouseLeave={() => setOpenGroup((current) => (current === group.label ? null : current))}
              >
                <button
                  type="button"
                  aria-expanded={openGroup === group.label}
                  onClick={() => setOpenGroup((current) => (current === group.label ? null : group.label))}
                  className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[14px] font-medium text-body transition-colors hover:bg-ink/[0.05] hover:text-ink"
                >
                  {group.label}
                  <ChevronDown className={`size-3.5 transition-transform duration-300 ${openGroup === group.label ? "rotate-180" : ""}`} />
                </button>
                {openGroup === group.label && (
                  <div className="absolute left-0 top-full z-50 w-[540px] pt-2">
                    <div className="overflow-hidden rounded-2xl border border-border bg-popover p-2 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.35)]">
                    <div className="grid grid-cols-2 gap-1">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const content = (
                          <>
                            <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-ink/[0.03] text-primary">
                              <Icon className="size-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[13px] font-medium text-ink">{item.title}</span>
                              <span className="mt-0.5 block text-[12px] leading-snug text-body">{item.description}</span>
                            </span>
                          </>
                        );
                        return "href" in item ? (
                          <Link
                            key={item.title}
                            href={item.href}
                            onClick={() => setOpenGroup(null)}
                            className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-ink/[0.04]"
                          >
                            {content}
                          </Link>
                        ) : (
                          <button
                            key={item.title}
                            type="button"
                            onClick={runGuide}
                            className="flex items-start gap-3 rounded-xl p-3 text-left transition-colors hover:bg-ink/[0.04]"
                          >
                            {content}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-2 flex items-center justify-between rounded-xl border border-border bg-ink/[0.03] px-3 py-2.5">
                      <p className="text-[12px] text-body">Every timestamp stays exactly where it belongs.</p>
                      <Link href="/library" className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline">
                        Browse <ArrowRight className="size-3" />
                      </Link>
                    </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <Link href="/library" className="flex h-9 items-center rounded-lg px-3 text-[14px] font-medium text-body transition-colors hover:bg-ink/[0.05] hover:text-ink">
              Library
            </Link>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            {onGuide && (
              <Button variant="ghost" size="sm" className="hidden gap-2 text-body hover:text-ink sm:inline-flex" onClick={onGuide}>
                <CircleHelp className="size-4" />
                <span>Guide</span>
              </Button>
            )}
            <Button variant="ghost" size="sm" className="hidden gap-2 text-body hover:text-ink sm:inline-flex" onClick={signIn}>
              <LogIn className="size-4" />
              Sign in
            </Button>
            <Button size="sm" className="hidden gap-2 sm:inline-flex" onClick={signIn}>
              Get started
              <ArrowRight className="size-4" />
            </Button>
            <button
              type="button"
              onClick={() => setMobileOpen((value) => !value)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              className="grid size-9 place-items-center rounded-lg border border-border text-ink transition-colors hover:bg-ink/[0.05] lg:hidden"
            >
              {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>
      </header>

      {mobileOpen &&
        createPortal(
          <div className="fixed inset-0 z-[60] lg:hidden">
            <button type="button" aria-label="Close menu" className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <div className="absolute inset-y-0 right-0 flex w-[min(88vw,380px)] flex-col border-l border-border bg-background p-5 shadow-2xl">
              <div className="flex items-center justify-between">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/SubNexa_Logo_Transparent.png" alt="SubNexa" className="h-5 w-auto" />
                <button type="button" onClick={() => setMobileOpen(false)} className="grid size-9 place-items-center rounded-lg border border-border text-ink" aria-label="Close menu">
                  <X className="size-4" />
                </button>
              </div>
              <div className="mt-8 flex-1 space-y-7 overflow-y-auto">
                {groups.map((group) => (
                  <div key={group.label}>
                    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-content-tertiary">{group.label}</p>
                    <div className="mt-2 space-y-1">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const body = (
                          <>
                            <Icon className="size-4 text-primary" />
                            <span>{item.title}</span>
                          </>
                        );
                        return "href" in item ? (
                          <Link key={item.title} href={item.href} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-[15px] text-body hover:bg-ink/[0.04] hover:text-ink">
                            {body}
                          </Link>
                        ) : (
                          <button key={item.title} type="button" onClick={runGuide} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-[15px] text-body hover:bg-ink/[0.04] hover:text-ink">
                            {body}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 grid gap-2 border-t border-border pt-5">
                <Button variant="outline" size="lg" className="w-full gap-2" onClick={signIn}>
                  <LogIn className="size-4" />Sign in
                </Button>
                <Button size="lg" className="w-full gap-2" onClick={signIn}>
                  Get started <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
