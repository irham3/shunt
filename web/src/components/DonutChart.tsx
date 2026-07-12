import { motion } from "framer-motion";
import type { Bucket } from "../store";

export function DonutChart({
  buckets,
  size = 200,
  strokeWidth = 24,
  centerContent,
}: {
  buckets: Bucket[];
  size?: number;
  strokeWidth?: number;
  /** Optional custom center content (e.g. total balance) replacing the % readout. */
  centerContent?: React.ReactNode;
}) {
  const center = size / 2;
  const radius = center - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;

  // Calculate offsets for each slice so they stack correctly.
  let currentOffset = 0;
  const slices = buckets.map((b) => {
    const fraction = b.pct / 100;
    const dashLength = fraction * circumference;
    // We want a small gap between segments if there are multiple segments, unless a segment is 100%.
    // To keep it simple and smooth for now, we just draw the exact lengths.
    const slice = {
      ...b,
      dashLength,
      offset: currentOffset,
    };
    currentOffset += dashLength;
    return slice;
  });

  const total = buckets.reduce((s, b) => s + b.pct, 0);
  const isComplete = total === 100;

  return (
    <div style={{ position: "relative", width: size, height: size, margin: "0 auto" }}>
      {/* 
        We rotate the SVG by -90 degrees so the first slice starts at the top (12 o'clock).
      */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg)", overflow: "visible" }}
      >
        {/* Background track (empty state / unallocated) */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--color-bg-elevated)"
          strokeWidth={strokeWidth}
        />
        
        {/* The slices */}
        {slices.map((slice) => {
          if (slice.pct === 0) return null;
          return (
            <motion.circle
              key={slice.id}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              initial={false}
              animate={{
                // dasharray: length of segment, length of gap (rest of the circle)
                strokeDasharray: `${slice.dashLength} ${circumference - slice.dashLength}`,
                // offset: move the dash start point backwards to stack it
                strokeDashoffset: -slice.offset,
              }}
              transition={{ type: "spring", stiffness: 100, damping: 20 }}
            />
          );
        })}
      </svg>
      
      {/* Center content */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        {centerContent ?? (
          <>
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 2 }}>
              {isComplete ? "Total" : "Allocated"}
            </div>
            <div
              className="numeric"
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: isComplete ? "var(--color-accent-primary)" : "var(--color-text-primary)",
                lineHeight: 1,
              }}
            >
              {total}%
            </div>
          </>
        )}
      </div>
    </div>
  );
}
