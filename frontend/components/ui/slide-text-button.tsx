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
      ? "border border-border text-ink hover:border-ink/25 hover:bg-ink/5"
      : "bg-primary text-primary-foreground shadow-[0_10px_30px_-14px_color-mix(in_oklab,var(--primary)_70%,transparent)] hover:bg-primary/90";

  return (
    <Link
      className={cn(
        "group relative inline-flex h-11 items-center justify-center overflow-hidden rounded-[5px] px-7 font-medium text-[15px] tracking-[-0.01em] transition-[background-color,border-color,scale,box-shadow] duration-150 ease-[cubic-bezier(0.23,0.88,0.26,0.92)] focus-visible:outline-2 focus-visible:outline-[var(--focus-color)] focus-visible:outline-offset-2 active:scale-[0.97] motion-reduce:active:scale-100 md:min-w-56",
        animateIn && "motion-safe:animate-[inc-fade-in_0.5s_ease-out_both]",
        variantStyles,
        className
      )}
      href={href}
      {...props}
    >
      <span className="grid justify-items-center">
        <span className="col-start-1 row-start-1 flex items-center gap-2 opacity-100 group-hover:opacity-0 group-focus-visible:opacity-0">
          <span className="font-medium">{text}</span>
        </span>
        <span
          aria-hidden="true"
          className="col-start-1 row-start-1 flex items-center gap-2 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <span className="font-medium">{slideText}</span>
        </span>
      </span>
    </Link>
  );
}
