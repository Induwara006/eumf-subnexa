"use client";

import { cn } from "@/lib/utils";
import React, { useEffect, useRef } from "react";

type MovingCardItem = {
  key?: string;
  content?: React.ReactNode;
  quote?: string;
  name?: string;
  title?: string;
};

const SPEEDS = {
  fast: "22s",
  normal: "45s",
  slow: "90s",
} as const;

export const InfiniteMovingCards = ({
  items,
  direction = "left",
  speed = "normal",
  pauseOnHover = true,
  className,
  cardClassName,
}: {
  items: MovingCardItem[];
  direction?: "left" | "right";
  speed?: keyof typeof SPEEDS;
  pauseOnHover?: boolean;
  className?: string;
  cardClassName?: string;
}) => {
  const scrollerRef = useRef<HTMLUListElement>(null);
  const itemCount = items.length;

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || scroller.dataset.cloned === "true") return;

    const originals = Array.from(scroller.children);
    originals.forEach((item) => {
      const duplicate = item.cloneNode(true) as HTMLElement;
      duplicate.setAttribute("aria-hidden", "true");
      duplicate.setAttribute("data-clone", "true");
      duplicate
        .querySelectorAll<HTMLElement>("a, button, input, select, textarea, [tabindex]")
        .forEach((el) => el.setAttribute("tabindex", "-1"));
      scroller.appendChild(duplicate);
    });

    scroller.dataset.cloned = "true";
    scroller.dataset.animate = "true";
  }, [itemCount]);

  return (
    <div className={cn("moving-cards-scroller", className)}>
      <ul
        ref={scrollerRef}
        className={cn(
          "moving-cards-track",
          pauseOnHover && "hover:[animation-play-state:paused]",
        )}
        style={
          {
            "--moving-cards-duration": SPEEDS[speed],
            "--moving-cards-direction": direction === "left" ? "normal" : "reverse",
          } as React.CSSProperties
        }
      >
        {items.map((item, index) => (
          <li
            key={item.key ?? item.name ?? index}
            className={cn(
              "sn-card relative w-[350px] max-w-full shrink-0 overflow-hidden md:w-[450px]",
              cardClassName,
            )}
          >
            {item.content ?? (
              <blockquote className="flex h-full flex-col px-8 py-6">
                <span className="text-sm leading-[1.6] font-normal text-content-secondary">
                  {item.quote}
                </span>
                <div className="mt-6 flex flex-col gap-1">
                  <span className="text-sm leading-[1.6] font-normal text-content-tertiary">
                    {item.name}
                  </span>
                  <span className="text-sm leading-[1.6] font-normal text-content-tertiary">
                    {item.title}
                  </span>
                </div>
              </blockquote>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
