import { useEffect, useRef } from "react";
import { motion, useSpring, useTransform } from "framer-motion";

interface Props {
  value: number;
  /** Decimal places to display. Default 0 (percentages, integers). */
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Spring-animated numeric counter — money and percentage figures glide to
 * their new value instead of jump-cutting. Respects prefers-reduced-motion
 * by snapping instantly (no spring) when the user has that set.
 */
export function AnimatedNumber({ value, decimals = 0, prefix = "", suffix = "", className, style }: Props) {
  const reduceMotion = useRef(
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  ).current;
  const spring = useSpring(value, reduceMotion ? { stiffness: 1000, damping: 100 } : { stiffness: 120, damping: 20 });
  const display = useTransform(spring, (v) => `${prefix}${v.toFixed(decimals)}${suffix}`);

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return (
    <motion.span className={className} style={style}>
      {display}
    </motion.span>
  );
}
