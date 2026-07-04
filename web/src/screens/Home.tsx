import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AllocationBar } from "../components/AllocationBar";
import { getIdrRate } from "../lib/rates";
import { fetchPending, type PendingSplit } from "../lib/keeper";
import { fmtIdr, fmtUsdc, useShunt } from "../store";

export function Home() {
  const nav = useNavigate();
  const { address, buckets, balances, activity } = useShunt();
  const [idr, setIdr] = useState<number | null>(null);
  const [pending, setPending] = useState<PendingSplit[]>([]);

  const total = balances.needs + balances.savings + balances.buffer;

  useEffect(() => {
    getIdrRate().then((r) => setIdr(r.rate));
  }, []);

  // poll keeper for detected inflows awaiting one-tap approval
  useEffect(() => {
    if (!address) return;
    const tick = () => fetchPending(address).then(setPending);
    tick();
    const t = setInterval(tick, 8000);
    return () => clearInterval(t);
  }, [address]);

  const bucketBalance = (id: string) =>
    id === "needs" ? balances.needs : id === "savings" ? balances.savings : id === "buffer" ? balances.buffer : 0;

  return (
    <div className="screen">
      <header>
        <div className="muted" style={{ fontSize: 13 }}>Total value</div>
        <div className="numeric" style={{ fontSize: "clamp(36px, 5vw, 48px)", fontWeight: 700, lineHeight: 1.1 }}>
          ${fmtUsdc(total)}
        </div>
        <div className="muted" style={{ fontSize: 14 }}>
          {idr ? `≈ ${fmtIdr(total * idr)}` : "…"}
        </div>
      </header>

      {pending.length > 0 && (
        <button
          className="card"
          onClick={() => nav("/confirm", { state: pending[0] })}
          style={{ border: "1px solid var(--color-accent-primary)", textAlign: "left", display: "block" }}
        >
          <strong style={{ color: "var(--color-accent-primary)" }}>Income detected!</strong>
          <div className="muted" style={{ fontSize: 13 }}>
            {pending[0].amount} USDC landed — tap to approve the split.
          </div>
        </button>
      )}

      {/* Desktop: allocation + buckets left, activity right. Mobile: stacked. */}
      <div className="split-cols">
        <div className="col-main">
          <section className="card">
            <AllocationBar buckets={buckets} />
          </section>

          <section className="bucket-grid">
            {buckets.map((b) => (
              <Link
                key={b.id}
                to={b.id === "savings" ? "/savings" : b.id === "needs" ? "/send" : "/shunt"}
                className="card"
                style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10, textDecoration: "none", color: "inherit" }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    background: b.color,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--color-text-on-accent)",
                    fontWeight: 700,
                  }}
                >
                  {b.name[0]}
                </span>
                <span>
                  <div style={{ fontWeight: 600 }}>{b.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{b.pct}% of each income</div>
                </span>
                <span className="numeric" style={{ fontWeight: 600, fontSize: 20 }}>${fmtUsdc(bucketBalance(b.id))}</span>
              </Link>
            ))}
          </section>
        </div>

        <section className="col-side card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Recent activity</h3>
            <Link to="/activity" className="muted" style={{ fontSize: 13 }}>All →</Link>
          </div>
          {activity.length === 0 ? (
            <p className="muted" style={{ fontSize: 14, margin: 0 }}>
              No activity yet. Your first USDC income will show up here.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {activity.slice(0, 5).map((a) => (
                <div key={a.id} style={{ padding: "11px 0", borderBottom: "1px solid #1f2732", display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</span>
                  <span className="numeric muted">${fmtUsdc(a.amountUsdc)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
