import type { Bucket } from "../store";

/** Home allocation bar — renders from the same store as the split-node diagram (single source of truth, DESIGN.md §5.1). */
export function AllocationBar({ buckets }: { buckets: Bucket[] }) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          height: 14,
          borderRadius: "var(--radius-pill)",
          overflow: "hidden",
          gap: 2,
        }}
        role="img"
        aria-label={buckets.map((b) => `${b.name} ${b.pct}%`).join(", ")}
      >
        {buckets.map((b) => (
          <div key={b.id} style={{ width: `${b.pct}%`, background: b.color, transition: "width .3s" }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
        {buckets.map((b) => (
          <span key={b.id} className="muted" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: b.color, display: "inline-block" }} />
            {b.name} {b.pct}%
          </span>
        ))}
      </div>
    </div>
  );
}
