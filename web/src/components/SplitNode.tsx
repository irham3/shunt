import type { Bucket } from "../store";

/**
 * Circuit-trace split-node motif (DESIGN.md §2.3): one input line branching
 * into one lane per bucket, stroke width proportional to allocation.
 */
export function SplitNode({ buckets, height = 140 }: { buckets: Bucket[]; height?: number }) {
  const w = 340;
  const cx = 110;
  const cy = height / 2;
  const laneX = w - 20;
  const n = buckets.length;

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
            <path
              d={`M ${cx + 8} ${cy} C ${midX} ${cy}, ${midX} ${ly}, ${laneX - 60} ${ly}`}
              fill="none"
              stroke={b.color}
              strokeWidth={sw}
              strokeLinecap="round"
              opacity="0.9"
            />
            <text x={laneX - 52} y={ly + 4} fill={b.color} fontSize="12" fontFamily="var(--font-body)">
              {b.name} {b.pct}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}
