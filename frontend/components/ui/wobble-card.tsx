"use client";
import React, { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export const WobbleCard = ({
  children,
  containerClassName,
  className,
}: {
  children: React.ReactNode;
  containerClassName?: string;
  className?: string;
}) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const reduceMotion = useReducedMotion();

  const handleMouseMove = (event: React.MouseEvent<HTMLElement>) => {
    if (reduceMotion) return;
    const { clientX, clientY } = event;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (clientX - (rect.left + rect.width / 2)) / 20;
    const y = (clientY - (rect.top + rect.height / 2)) / 20;
    setMousePosition({ x, y });
  };
  return (
    <motion.section
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => {
        setIsHovering(false);
        setMousePosition({ x: 0, y: 0 });
      }}
      style={{
        transform:
          isHovering && !reduceMotion
            ? `translate3d(${mousePosition.x}px, ${mousePosition.y}px, 0) scale3d(1, 1, 1)`
            : "translate3d(0px, 0px, 0) scale3d(1, 1, 1)",
        transition: "transform 0.1s ease-out",
      }}
      className={cn(
        "relative mx-auto w-full overflow-hidden rounded-2xl bg-indigo-800 shadow-[0_30px_70px_-46px_rgb(0_0_0/0.85)] ring-1 ring-white/10",
        containerClassName,
      )}
    >
      <div className="inc-noise relative h-full overflow-hidden [background-image:radial-gradient(88%_100%_at_top,rgba(255,255,255,0.14),rgba(255,255,255,0))] sm:mx-0 sm:rounded-2xl">
        <motion.div
          style={{
            transform:
              isHovering && !reduceMotion
                ? `translate3d(${-mousePosition.x}px, ${-mousePosition.y}px, 0) scale3d(1.03, 1.03, 1)`
                : "translate3d(0px, 0px, 0) scale3d(1, 1, 1)",
            transition: "transform 0.1s ease-out",
          }}
          className={cn("h-full px-4 py-20 sm:px-10", className)}
        >
          {children}
        </motion.div>
      </div>
    </motion.section>
  );
};
