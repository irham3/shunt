import { useEffect, useMemo, useState } from "react";
import { getIdrRate } from "../lib/rates";
import { vaultWithdrawSavings } from "../lib/vault";
import { fmtIdr, fmtUsdc, useShunt } from "../store";
import { formatError } from "../lib/stellar";

const PENALTY_PCT = 10; // must match PENALTY_BPS in the contract

/** Desktop layout: balance + growth chart left, lock status + withdraw right. */
export function SavingsVault() {
  const { address, balances, lockUntil, activity, withdrawSavings, showToast } = useShunt();
  const [ccy, setCcy] = useState<"USD" | "IDR">("USD");
  const [idr, setIdr] = useState(18000);
  const [stale, setStale] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getIdrRate().then((r) => {
      setIdr(r.rate);
      setStale(r.stale);
    });
  }, []);

  const locked = lockUntil * 1000 > Date.now();
  const balance = balances.savings;

  const chart = useMemo(() => {
    // savings growth series derived from split/deposit activity
    const pts = activity
      .filter((a) => a.kind === "split" || a.kind === "deposit")
      .slice()
      .reverse()
      .reduce<number[]>((acc, a) => {
        const savingsPart = a.kind === "split" ? a.amountUsdc * 0.25 : a.amountUsdc;
        acc.push((acc[acc.length - 1] ?? 0) + savingsPart);
        return acc;
      }, []);
    return pts.length >= 2 ? pts : [0, balance];
  }, [activity, balance]);

  const path = useMemo(() => {
    const max = Math.max(...chart, 1);
    const pts = chart.map((v, i) => `${(i / (chart.length - 1)) * 300},${90 - (v / max) * 80}`);
    return { line: `M ${pts.join(" L ")}`, area: `M 0,90 L ${pts.join(" L ")} L 300,90 Z` };
  }, [chart]);

  async function onWithdraw() {
    const usdc = Number(amount);
    if (!usdc || usdc <= 0 || usdc > balance) {
      setErr("Invalid amount or exceeds balance.");
      return;
    }
    setBusy(true);
    setErr(null);
    const penalty = locked ? (usdc * PENALTY_PCT) / 100 : 0;
    try {
      if (address) await vaultWithdrawSavings(address, usdc);
      withdrawSavings(usdc, penalty);
      showToast(penalty > 0 ? `Withdrawn — ${fmtUsdc(penalty)} USDC penalty → Buffer` : "Savings withdrawn");
      setAmount("");
    } catch (e) {
      const formatted = formatError(e);
      if (formatted) setErr(`On-chain call failed (${formatted})`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <header>
        <h2 style={{ margin: 0 }}>Savings Vault</h2>
        <p className="muted" style={{ margin: "2px 0 0", fontSize: 14 }}>
          Held in hard value — resistant to rupiah depreciation.
        </p>
      </header>

      <div className="split-cols">
        <div className="col-main">
          <div style={{ display: "flex", gap: 8 }}>
            {(["USD", "IDR"] as const).map((c) => (
              <button key={c} className={`chip${ccy === c ? " active" : ""}`} onClick={() => setCcy(c)}>
                {c}
              </button>
            ))}
            <button className="chip" disabled title="Gold lane coming later (P2)" style={{ opacity: 0.4 }}>
              Gold 🔜
            </button>
          </div>

          <div>
            <div className="numeric" style={{ fontSize: "clamp(34px, 4.5vw, 44px)", fontWeight: 700, lineHeight: 1.1 }}>
              {ccy === "USD" ? `$${fmtUsdc(balance)}` : fmtIdr(balance * idr)}
            </div>
            {ccy === "IDR" && (
              <div className="muted" style={{ fontSize: 12 }}>
                Display rate {stale ? "(fallback, may be outdated)" : "real-time"} — funds stay in USDC.
              </div>
            )}
          </div>

          <div className="card">
            <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Savings growth</div>
            <svg viewBox="0 0 300 100" width="100%" height="130" preserveAspectRatio="none" aria-label="Savings growth chart">
              <path d={path.area} fill="var(--color-accent-primary)" opacity="0.12" />
              <path d={path.line} fill="none" stroke="var(--color-accent-primary)" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        <div className="col-side">
          <div
            className="card"
            style={{ display: "flex", alignItems: "center", gap: 10, borderLeft: `3px solid ${locked ? "var(--color-bucket-needs)" : "var(--color-accent-primary)"}` }}
          >
            <span style={{ fontSize: 22 }}>{locked ? "🔒" : "🔓"}</span>
            <span style={{ fontSize: 14 }}>
              {locked ? (
                <>
                  Locked until <strong>{new Date(lockUntil * 1000).toLocaleDateString("en-US")}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>
                    Early withdrawal costs a {PENALTY_PCT}% penalty — it goes to Buffer, not lost.
                  </div>
                </>
              ) : (
                "Unlocked — withdraw freely without penalty."
              )}
            </span>
          </div>

          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              type="number"
              placeholder="Amount in USDC"
              value={amount}
              min={0}
              onChange={(e) => setAmount(e.target.value)}
              aria-label="Withdrawal amount"
            />
            <button className="btn-secondary" disabled={busy || balance <= 0} onClick={onWithdraw}>
              {busy ? "Processing…" : "Withdraw"}
            </button>
            <button className="btn-ghost">Change goal</button>
          </div>
          {err && (
            <p role="alert" className="muted" style={{ fontSize: 13, margin: 0 }}>
              {err}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
