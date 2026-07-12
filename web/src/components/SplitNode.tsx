import { motion } from "framer-motion";
import type { Bucket } from "../store";

/**
 * Circuit-trace split-node motif (DESIGN.md §2.3): one input line branching
 * into one lane per bucket, stroke width proportional to allocation.
 * Branches reflow with a spring as allocations change.
 */
export function SplitNode({ buckets, height = 140 }: { buckets: Bucket[]; height?: number }) {
  const w = 340;
  const cx = 110;
  const cy = height / 2;
  const laneX = w - 20;
  const n = buckets.length;
  const spring = { type: "spring" as const, stiffness: 140, damping: 22 };

  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" role="img" aria-label="Diagram split">
      <line x1="10" y1={cy} x2={cx - 8} y2={cy} stroke="var(--color-text-primary)" strokeWidth="2" />
      <circle cx={cx} cy={cy} r="6" fill="var(--color-accent-primary)">
        <animate attributeName="r" values="5;7;5" dur="2s" repeatCount="indefinite" />
      </circle>
      {buckets.map((b, i) => {
        const ly = 18 + (i * (height - 36)) / Math.max(n - 1, 1);
        const sw = Math.max(1.5, (b.pct / 100) * 8);
        const midX = cx + (laneX - cx) * 0.55;
        return (
          <g key={b.id}>
            <motion.path
              fill="none"
              stroke={b.color}
              strokeLinecap="round"
              opacity="0.9"
              initial={false}
              animate={{
                d: `M ${cx + 8} ${cy} C ${midX} ${cy}, ${midX} ${ly}, ${laneX - 60} ${ly}`,
                strokeWidth: sw,
              }}
              transition={spring}
            />
            <motion.text
              x={laneX - 52}
              fill={b.color}
              fontSize="12"
              fontFamily="var(--font-body)"
              initial={false}
              animate={{ y: ly + 4 }}
              transition={spring}
            >
              {b.name} {b.pct}%
            </motion.text>
          </g>
        );
      })}
    </svg>
  );
}
