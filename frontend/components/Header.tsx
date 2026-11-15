"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, Menu, X } from "lucide-react";

import SlideTextButton from "@/components/ui/slide-text-button";
import {
  FrioDropdown,
  FrioDropdownMenu,
  FrioDropdownTrigger,
} from "@/components/ui/frio-dropdown";
import ThemeToggle from "@/components/theme-toggle";
import { springs } from "@/lib/motion";
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
      { title: "Request a subtitle", description: "Ask the community for a title.", href: "/library#community-request" },
    ],
  },
] as const;

export default function Header({ overlay = false, showThemeToggle = true }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 12);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

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
        className={`${overlay ? "fixed" : "sticky"} inset-x-0 top-0 z-50 transition-[background-color,border-color] duration-300 ${
          solid ? "material-bar border-b border-border/70" : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-[72px] w-full max-w-[1200px] items-center gap-6 px-5 sm:px-8">
          <Link href="/" className="group flex items-center gap-2.5" aria-label="SubNexa home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/SubNexa_Logo_Transparent.png" alt="SubNexa" className="h-6 w-auto" />
          </Link>

          <div className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
            {groups.map((group) => (
              <FrioDropdown
                key={group.label}
                open={openGroup === group.label}
                onOpenChange={(next) => setOpenGroup(next ? group.label : (current) => (current === group.label ? null : current))}
                className="relative"
                onMouseEnter={() => setOpenGroup(group.label)}
                onMouseLeave={() => setOpenGroup((current) => (current === group.label ? null : current))}
              >
                <FrioDropdownTrigger
                  variant="plain"
                  chevron={false}
                  className="h-10 px-3 text-[14px] font-semibold text-body hover:text-ink"
                >
                  {group.label}
                  <ChevronDown className={`size-3.5 transition-transform duration-300 ${openGroup === group.label ? "rotate-180" : ""}`} />
                </FrioDropdownTrigger>
                <FrioDropdownMenu
                  aria-label={group.label}
                  className="frio-menu--bare w-[540px]"
                >
                  <div className="material-panel overflow-hidden rounded-2xl p-2">
                    <div className="grid grid-cols-2 gap-1">
                      {group.items.map((item) => (
                        <Link
                          key={item.title}
                          href={item.href}
                          role="menuitem"
                          onClick={() => setOpenGroup(null)}
                          className="flex items-start gap-3 rounded-xl p-3 transition-colors duration-150 hover:bg-ink/[0.05]"
                        >
                          <span className="min-w-0">
                            <span className="block text-[13px] font-semibold text-ink">{item.title}</span>
                            <span className="mt-0.5 block text-[12px] leading-snug text-body">{item.description}</span>
                          </span>
                        </Link>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center justify-between rounded-xl bg-ink/[0.04] px-3 py-2.5">
                      <p className="text-[12px] text-body">Every timestamp stays exactly where it belongs.</p>
                      <Link href="/library" className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline">
                        Browse
                      </Link>
                    </div>
                  </div>
                </FrioDropdownMenu>
              </FrioDropdown>
            ))}
            <Link href="/library" className="flex h-10 items-center rounded-xl px-3 text-[14px] font-semibold text-body transition-[background-color,color,scale] duration-150 hover:bg-ink/[0.05] hover:text-ink active:scale-[0.97]">
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
              className="hidden px-5 text-sm md:min-w-0 sm:inline-flex"
            />
            <button
              type="button"
              onClick={() => setMobileOpen((value) => !value)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              className="grid size-11 place-items-center rounded-xl border border-border text-ink transition-[background-color,scale] duration-150 hover:bg-ink/[0.05] active:scale-[0.97] lg:hidden"
            >
              {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>
      </header>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {mobileOpen && (
              <motion.div
                key="mobile-menu"
                className="fixed inset-0 z-[60] lg:hidden"
                initial={false}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <motion.button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setMobileOpen(false)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 bg-ink/50 backdrop-blur-md"
                />
                <motion.div
                  initial={reduceMotion ? { opacity: 0 } : { x: "100%" }}
                  animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { x: "100%" }}
                  transition={reduceMotion ? { duration: 0.15 } : springs.settle}
                  className="absolute inset-y-0 right-0 flex w-[min(88vw,380px)] flex-col bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl"
                >
                  <div className="flex items-center justify-between">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/SubNexa_Logo_Transparent.png" alt="SubNexa" className="h-5 w-auto" />
                    <button type="button" onClick={() => setMobileOpen(false)} className="grid size-11 place-items-center rounded-xl border border-border text-ink transition-[background-color,scale] duration-150 hover:bg-ink/[0.05] active:scale-[0.97]" aria-label="Close menu">
                      <X className="size-4" />
                    </button>
                  </div>
                  <div className="mt-8 flex-1 space-y-7 overflow-y-auto">
                    {groups.map((group) => (
                      <div key={group.label}>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-content-tertiary">{group.label}</p>
                        <div className="mt-2 space-y-1">
                          {group.items.map((item) => (
                            <Link key={item.title} href={item.href} onClick={() => setMobileOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-2 text-[15px] text-body transition-colors duration-150 hover:bg-ink/[0.05] hover:text-ink">
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
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
