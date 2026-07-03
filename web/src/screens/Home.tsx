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
        <div className="numeric" style={{ fontSize: 40, fontWeight: 700 }}>
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

      <section className="card">
        <AllocationBar buckets={buckets} />
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {buckets.map((b) => (
          <Link
            key={b.id}
            to={b.id === "savings" ? "/savings" : b.id === "needs" ? "/send" : "/shunt"}
            className="card"
            style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "inherit" }}
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
            <span style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{b.name}</div>
              <div className="muted" style={{ fontSize: 12 }}>{b.pct}% of each income</div>
            </span>
            <span className="numeric" style={{ fontWeight: 600 }}>${fmtUsdc(bucketBalance(b.id))}</span>
          </Link>
        ))}
      </section>

      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h3 style={{ margin: "4px 0" }}>Recent activity</h3>
          <Link to="/activity" className="muted" style={{ fontSize: 13 }}>All →</Link>
        </div>
        {activity.length === 0 ? (
          <p className="muted" style={{ fontSize: 14 }}>
            No activity yet. Your first USDC income will show up here.
          </p>
        ) : (
          activity.slice(0, 3).map((a) => (
            <div key={a.id} className="card" style={{ marginTop: 8, padding: 12, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 14 }}>{a.title}</span>
              <span className="numeric muted">${fmtUsdc(a.amountUsdc)}</span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
