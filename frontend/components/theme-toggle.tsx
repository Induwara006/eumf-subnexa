"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "cn";

export default function ThemeToggle({ className }: { className?: string }) {
  function toggle() {
    const root = document.documentElement;
    const next = !root.classList.contains("dark");
    root.classList.toggle("dark", next);
    try {
      localStorage.setItem("subnexa-theme", next ? "dark" : "light");
    } catch {
      /* storage can be unavailable in private mode */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      className={cn(
        "grid size-9 place-items-center rounded-lg border border-border bg-transparent text-body transition-colors hover:border-ink/30 hover:bg-ink/[0.05] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
    >
      <Moon className="size-4 dark:hidden" />
      <Sun className="hidden size-4 dark:block" />
    </button>
  );
}
