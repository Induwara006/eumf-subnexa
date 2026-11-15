import type { Transition } from "motion/react";

export const springs = {
  gentle: { type: "spring", bounce: 0, duration: 0.5 },
  settle: { type: "spring", bounce: 0.08, duration: 0.38 },
  momentum: { type: "spring", bounce: 0.18, duration: 0.4 },
} satisfies Record<string, Transition>;

export const springEase = [0.23, 0.88, 0.26, 0.92] as const;
