"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { springs } from "@/lib/motion";

export default function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
      whileInView={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={reduceMotion ? { duration: 0.2, delay } : { ...springs.gentle, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
