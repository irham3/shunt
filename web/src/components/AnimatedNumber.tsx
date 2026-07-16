import { useEffect, useRef } from "react";
import { useSpring } from "framer-motion";

interface Props {
  value: number;
  /** Decimal places to display. Default 0 (percentages, integers). */
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Locale for formatting numbers (e.g. "en-US" or "id-ID"). Defaults to "en-US". */
  locale?: string;
}

/**
 * Spring-animated numeric counter — money and percentage figures glide to
 * their new value instead of jump-cutting. Respects prefers-reduced-motion
 * by snapping instantly (no spring) when the user has that set.
 *
 * Implementation note: the spring writes into the span via an explicit
 * `on("change")` subscription instead of rendering a MotionValue as a child —
 * MotionValue children silently stop updating under React 19 + framer-motion
 * v12, which froze every number in the app at its first-mount value.
 */
export function AnimatedNumber({ value, decimals = 0, prefix = "", suffix = "", className, style, locale = "en-US" }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduceMotion = useRef(
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  ).current;
  const spring = useSpring(value, reduceMotion ? { stiffness: 1000, damping: 100 } : { stiffness: 120, damping: 20 });

  const fmt = (v: number) =>
    `${prefix}${v.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;

  useEffect(() => {
    const unsubscribe = spring.on("change", (v) => {
      if (ref.current) ref.current.textContent = fmt(v);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spring, decimals, prefix, suffix, locale]);

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return (
    <span ref={ref} className={className} style={style}>
      {fmt(value)}
    </span>
  );
}
