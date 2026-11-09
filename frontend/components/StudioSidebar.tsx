"use client";

import Link from "next/link";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  Captions,
  ChevronDown,
  ExternalLink,
  Folder,
  Home,
  Languages,
  LogOut,
  MessageCircle,
  PieChart,
  Rows3,
  Settings,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

const API = (
  process.env.NEXT_PUBLIC_SUBNEXA_API_URL ||
  (process.env.NODE_ENV === "production" ? "/subnexa-api" : "http://localhost:8000")
).replace(/\/$/, "");

type NavItem = {
  label: string;
  href?: string;
  icon: LucideIcon;
  badge?: number;
  online?: boolean;
  onClick?: () => void;
};

type StudioSidebarProps = {
  open: boolean;
  onClose: () => void;
  firstName: string;
  name?: string;
  email?: string;
  activeHref?: string;
  counts?: { cues?: number; glossary?: number };
  onOpenLibrary: () => void;
};

function NavRow({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active?: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  const className = cn(
    "group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] font-medium transition-colors",
    active
      ? "bg-primary/10 text-primary"
      : "text-body hover:bg-ink/[0.05] hover:text-ink",
  );

  const content = (
    <>
      {active && (
        <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" aria-hidden />
      )}
      <Icon
        className={cn(
          "size-[18px] shrink-0",
          active ? "text-primary" : "text-content-tertiary group-hover:text-ink",
        )}
        strokeWidth={1.75}
      />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {typeof item.badge === "number" && item.badge > 0 && (
        <span className="shrink-0 rounded-full bg-ink/[0.06] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-content-tertiary">
          {item.badge}
        </span>
      )}
      {item.online && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
          <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden />
          Online
        </span>
      )}
    </>
  );

  if (item.onClick) {
    return (
      <button
        type="button"
        onClick={() => {
          item.onClick?.();
          onNavigate();
        }}
        className={className}
      >
        {content}
      </button>
    );
  }

  return (
    <Link href={item.href || "#"} onClick={onNavigate} className={className}>
      {content}
    </Link>
  );
}

export default function StudioSidebar({
  open,
  onClose,
  firstName,
  name,
  email,
  activeHref = "#sn-overview",
  counts,
  onOpenLibrary,
}: StudioSidebarProps) {
  const [workspaceOpen, setWorkspaceOpen] = useState(true);
  const [busy, setBusy] = useState(false);

  const primary: NavItem[] = [
    { label: "Home", href: "/", icon: Home },
    { label: "Dashboard", href: "#sn-overview", icon: BarChart3 },
    { label: "Projects", href: "#sn-studio", icon: Rows3 },
  ];

  const workspace: NavItem[] = [
    { label: "Upload & settings", href: "#sn-setup", icon: Upload },
    { label: "Translate", href: "#sn-translate-action", icon: Languages, badge: counts?.cues },
    { label: "Glossary", href: "#sn-glossary", icon: BookOpen, badge: counts?.glossary },
    { label: "Subtitles", href: "#sn-studio", icon: Captions, badge: counts?.cues },
  ];

  const secondary: NavItem[] = [
    { label: "Library", icon: PieChart, onClick: onOpenLibrary },
    { label: "Settings", href: "#sn-style", icon: Settings },
    { label: "Support", href: "/guide", icon: MessageCircle, online: true },
    { label: "Open in browser", href: "/library", icon: ExternalLink },
  ];

  const workspaceActive = workspace.some((item) => item.href === activeHref);

  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch(`${API}/subnexa-auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      window.dispatchEvent(new Event("subnexa-session-changed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col border-r border-border bg-sidebar transition-transform duration-300 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Studio navigation"
      >
        <div className="flex h-[64px] shrink-0 items-center gap-2.5 border-b border-border px-4">
          <Link href="/" className="flex items-center gap-2.5" aria-label="SubNexa home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/SubNexa_Logo_Transparent.png" alt="SubNexa" className="h-6 w-auto" />
          </Link>
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-content-tertiary">
            Studio
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="ml-auto grid size-8 place-items-center rounded-md border border-border text-ink lg:hidden"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-0.5">
            {primary.map((item) => (
              <NavRow
                key={item.label}
                item={item}
                active={item.href === activeHref}
                onNavigate={onClose}
              />
            ))}
          </div>

          <div className="my-4 h-px bg-border" role="separator" />

          <div>
            <button
              type="button"
              onClick={() => setWorkspaceOpen((value) => !value)}
              aria-expanded={workspaceOpen}
              className={cn(
                "group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] font-medium transition-colors",
                workspaceActive
                  ? "text-ink"
                  : "text-body hover:bg-ink/[0.05] hover:text-ink",
              )}
            >
              <Folder className="size-[18px] shrink-0 text-content-tertiary group-hover:text-ink" strokeWidth={1.75} />
              <span className="min-w-0 flex-1 truncate">Workspace</span>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-content-tertiary transition-transform duration-200",
                  workspaceOpen && "rotate-180",
                )}
              />
            </button>
            {workspaceOpen && (
              <div className="mt-0.5 ml-[19px] space-y-0.5 border-l border-border pl-2">
                {workspace.map((item) => (
                  <NavRow
                    key={item.label}
                    item={item}
                    active={item.href === activeHref}
                    onNavigate={onClose}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="my-4 h-px bg-border" role="separator" />

          <div className="space-y-0.5">
            {secondary.map((item) => (
              <NavRow
                key={item.label}
                item={item}
                active={item.href === activeHref}
                onNavigate={onClose}
              />
            ))}
          </div>
        </nav>

        <div className="shrink-0 border-t border-border p-3">
          <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/10 text-sm font-semibold text-primary">
              {(firstName || "U").slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-ink">{name || firstName || "SubNexa user"}</p>
              {email && <p className="truncate text-[10px] text-content-tertiary">{email}</p>}
            </div>
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            <Link
              href="/admin"
              onClick={onClose}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-[11px] font-medium text-body transition-colors hover:bg-ink/[0.05] hover:text-ink"
            >
              <ShieldCheck className="size-3.5" />Admin
            </Link>
            <button
              type="button"
              onClick={logout}
              disabled={busy}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-[11px] font-medium text-body transition-colors hover:bg-ink/[0.05] hover:text-ink disabled:opacity-60"
            >
              <LogOut className="size-3.5" />{busy ? "Leaving…" : "Log out"}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
