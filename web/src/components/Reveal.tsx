import { useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { motion, useInView } from "framer-motion";
import type { TargetAndTransition } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

export type RevealVariant = "up" | "left" | "right" | "scale" | "blur";

/** A small library of entrance motions so each section reveals differently
    (up / left / right / scale / blur) instead of one uniform fade. */
const VARIANTS: Record<RevealVariant, { hidden: TargetAndTransition; show: TargetAndTransition }> = {
  up: { hidden: { opacity: 0, y: 44 }, show: { opacity: 1, y: 0 } },
  left: { hidden: { opacity: 0, x: -64 }, show: { opacity: 1, x: 0 } },
  right: { hidden: { opacity: 0, x: 64 }, show: { opacity: 1, x: 0 } },
  scale: { hidden: { opacity: 0, scale: 0.8, y: 40 }, show: { opacity: 1, scale: 1, y: 0 } },
  blur: { hidden: { opacity: 0, y: 28, filter: "blur(12px)" }, show: { opacity: 1, y: 0, filter: "blur(0px)" } },
};

interface RevealProps {
  variant?: RevealVariant;
  delay?: number;
  duration?: number;
  amount?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/**
 * Scroll-reveal wrapper driven by the useInView HOOK, deliberately NOT the
 * `whileInView` prop: in this project's framer-motion 12 + React 19 (dev
 * StrictMode) setup the whileInView gesture fails to hold its `initial` state,
 * so elements render already-visible and never animate in. Hook + explicit
 * `animate` is reliable (verified against the stats count-up, which uses the
 * same hook).
 */
export function Reveal({
  variant = "up",
  delay = 0,
  duration = 0.7,
  amount = 0.25,
  className,
  style,
  children,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount, margin: "-60px 0px" });
  const v = VARIANTS[variant];
  return (
    <motion.div
      ref={ref}
      initial={v.hidden}
      animate={inView ? v.show : v.hidden}
      transition={{ duration, ease: EASE, delay }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}
