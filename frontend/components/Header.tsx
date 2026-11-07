"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { ChevronDown, Menu, X } from "lucide-react";

import SlideTextButton from "@/components/ui/slide-text-button";
import ThemeToggle from "@/components/theme-toggle";
import { openAuthPopup } from "@/lib/auth-popup";

const API = (process.env.NEXT_PUBLIC_SUBNEXA_API_URL ||
  (process.env.NODE_ENV === "production" ? "/subnexa-api" : "http://localhost:8000")).replace(/\/$/, "");

const loginUrl = `${API}/subnexa-auth/login`;

type HeaderProps = {
  overlay?: boolean;
  showThemeToggle?: boolean;
};

const groups = [
  {
    label: "Product",
    items: [
      { title: "Translation studio", description: "Upload an SRT and review every cue.", href: "/#sn-platform" },
      { title: "Subtitle library", description: "Ready-made Sinhala subtitles.", href: "/library" },
      { title: "Sinhala glossary", description: "Keep names and places intact.", href: "/#sn-features" },
    ],
  },
  {
    label: "Learn",
    items: [
      { title: "Guide", description: "A quick tour of the workflow.", href: "/guide" },
      { title: "Fair use", description: "What you can translate and share.", href: "/guide" },
      { title: "Community library", description: "Browse films and series.", href: "/library" },
      { title: "Request a subtitle", description: "Ask the community for a title.", href: "/library" },
    ],
  },
] as const;

export default function Header({ overlay = false, showThemeToggle = true }: HeaderProps) {
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

  const solid = !overlay || scrolled || mobileOpen;

  return (
    <>
      <header
        className={`${overlay ? "fixed" : "sticky"} inset-x-0 top-0 z-50 transition-colors duration-300 ${
          solid ? "border-b border-border bg-background" : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-[72px] w-full max-w-[1200px] items-center gap-6 px-5 sm:px-8">
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
                  className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[14px] font-semibold text-body transition-colors hover:bg-ink/[0.05] hover:text-ink"
                >
                  {group.label}
                  <ChevronDown className={`size-3.5 transition-transform duration-300 ${openGroup === group.label ? "rotate-180" : ""}`} />
                </button>
                {openGroup === group.label && (
                  <div className="absolute left-0 top-full z-50 w-[540px] pt-2">
                    <div className="overflow-hidden rounded-2xl bg-popover p-2 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.35)]">
                    <div className="grid grid-cols-2 gap-1">
                      {group.items.map((item) => (
                        <Link
                          key={item.title}
                          href={item.href}
                          onClick={() => setOpenGroup(null)}
                          className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-ink/[0.04]"
                        >
                          <span className="min-w-0">
                            <span className="block text-[13px] font-semibold text-ink">{item.title}</span>
                            <span className="mt-0.5 block text-[12px] leading-snug text-body">{item.description}</span>
                          </span>
                        </Link>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center justify-between rounded-xl bg-ink/[0.03] px-3 py-2.5">
                      <p className="text-[12px] text-body">Every timestamp stays exactly where it belongs.</p>
                      <Link href="/library" className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline">
                        Browse
                      </Link>
                    </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <Link href="/library" className="flex h-9 items-center rounded-lg px-3 text-[14px] font-semibold text-body transition-colors hover:bg-ink/[0.05] hover:text-ink">
              Library
            </Link>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {showThemeToggle && <ThemeToggle />}
            <SlideTextButton
              text="Get started"
              hoverText="Sign in"
              href={loginUrl}
              onClick={(event) => { event.preventDefault(); signIn(); }}
              className="hidden h-9 px-5 text-sm md:min-w-0 sm:inline-flex"
            />
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
            <div className="absolute inset-y-0 right-0 flex w-[min(88vw,380px)] flex-col bg-background p-5 shadow-2xl">
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
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-content-tertiary">{group.label}</p>
                    <div className="mt-2 space-y-1">
                      {group.items.map((item) => (
                        <Link key={item.title} href={item.href} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-[15px] text-body hover:bg-ink/[0.04] hover:text-ink">
                          {item.title}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6">
                <SlideTextButton
                  text="Get started"
                  hoverText="Sign in"
                  href={loginUrl}
                  onClick={(event) => { event.preventDefault(); signIn(); }}
                  className="w-full"
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
