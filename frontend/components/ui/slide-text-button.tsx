"use client";

/**
 * @author: @kokonut-labs
 * @description: Slide Text Button with animated vertical text transition
 * @version: 1.0.0
 * @date: 2025-11-02
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import Link from "next/link";
import { cn } from "@/lib/utils";

interface SlideTextButtonProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  text?: string;
  hoverText?: string;
  href?: string;
  className?: string;
  variant?: "default" | "ghost";
  /** Fades and slides the button in when it mounts. */
  animateIn?: boolean;
}

export default function SlideTextButton({
  text = "Browse Components",
  hoverText,
  href = "/docs",
  className,
  variant = "default",
  animateIn = true,
  ...props
}: SlideTextButtonProps) {
  const slideText = hoverText ?? text;
  const variantStyles =
    variant === "ghost"
      ? "border border-border text-ink hover:bg-ink/5"
      : "bg-primary text-primary-foreground hover:bg-primary/90";

  return (
    <Link
      className={cn(
        "group relative inline-flex h-10 items-center justify-center overflow-hidden rounded-lg px-8 font-medium text-base tracking-tighter transition-[background-color,scale,opacity,translate] duration-[150ms,150ms,200ms,200ms] ease-[cubic-bezier(0.23,0.88,0.26,0.92)] focus-visible:outline-2 focus-visible:outline-[var(--focus-color)] focus-visible:outline-offset-2 active:scale-[0.97] motion-reduce:active:scale-100 md:min-w-56",
        animateIn && "motion-safe:animate-[inc-fade-in_0.5s_ease-out_both]",
        variantStyles,
        className
      )}
      href={href}
      {...props}
    >
      <span className="grid justify-items-center transition-transform duration-200 ease-[cubic-bezier(0.175,0.885,0.32,1.1)] group-hover:-translate-y-full group-focus-visible:-translate-y-full motion-reduce:transition-none">
        <span className="col-start-1 row-start-1 flex items-center gap-2 opacity-100 transition-opacity duration-200 group-hover:opacity-0 group-focus-visible:opacity-0">
          <span className="font-medium">{text}</span>
        </span>
        <span
          aria-hidden="true"
          className="col-start-1 row-start-1 flex translate-y-full items-center gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <span className="font-medium">{slideText}</span>
        </span>
      </span>
    </Link>
  );
}
