import { useState } from "react";
import { EXPLORER_TX } from "../lib/stellar";
import { fmtUsdc, useShunt, type ActivityItem } from "../store";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "split", label: "Split" },
  { id: "invest", label: "Invest" },
  { id: "withdraw", label: "Withdraw" },
  { id: "offramp", label: "Off-ramp" },
] as const;

const KIND_ICON: Record<ActivityItem["kind"], string> = {
  split: "⑃",
  withdraw: "↓",
  offramp: "↗",
  deposit: "＋",
  invest: "📈",
};

export function Activity() {
  const activity = useShunt((s) => s.activity);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");

  const items = activity.filter((a) => filter === "all" || a.kind === filter);
  const byDate = items.reduce<Record<string, ActivityItem[]>>((acc, a) => {
    const d = new Date(a.at).toLocaleDateString("en-US", { month: "long", day: "numeric" });
    (acc[d] ??= []).push(a);
    return acc;
  }, {});

  return (
    <div className="screen">
      <h2 style={{ margin: 0 }}>Activity</h2>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <button key={f.id} className={`chip${filter === f.id ? " active" : ""}`} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      {Object.keys(byDate).length === 0 && (
        <p className="muted">No transactions for this filter yet.</p>
      )}

      {Object.entries(byDate).map(([date, list]) => (
        <section key={date}>
          <div className="muted" style={{ fontSize: 12, margin: "4px 0" }}>{date}</div>
          {list.map((a) => (
            <div key={a.id} className="card" style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 12, padding: 12 }}>
              <span style={{ fontSize: 20, width: 28, textAlign: "center" }}>{KIND_ICON[a.kind]}</span>
              <span style={{ flex: 1 }}>
                <div style={{ fontSize: 14 }}>{a.title}</div>
                <div className="muted" style={{ fontSize: 11 }}>
                  {new Date(a.at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  {a.txHash && (
                    <>
                      {" · "}
                      <a href={EXPLORER_TX(a.txHash)} target="_blank" rel="noreferrer" style={{ color: "var(--color-accent-secondary)" }}>
                        on-chain ↗
                      </a>
                    </>
                  )}
                </div>
              </span>
              <span className="numeric" style={{ fontWeight: 600 }}>${fmtUsdc(a.amountUsdc)}</span>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
