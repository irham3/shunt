import { useState } from "react";
import { SplitNode } from "../components/SplitNode";
import { vaultSetRules } from "../lib/vault";
import { CORE_BUCKET_IDS, totalPct, useShunt } from "../store";

const LOCK_OPTIONS = [
  { label: "30 days", secs: 30 * 86400 },
  { label: "90 days", secs: 90 * 86400 },
  { label: "180 days", secs: 180 * 86400 },
];

/**
 * Core screen (F3). Validation decision (DESIGN.md §5.2): while total ≠ 100%,
 * the save button is disabled AND an inline message shows the difference.
 * No silent auto-adjust.
 * Desktop layout: split diagram sticky on the left, sliders on the right.
 */
export function ConfigureShunt() {
  const {
    address,
    buckets,
    setBucketPct,
    addBucket,
    removeBucket,
    markRulesSaved,
    showToast,
    lockSecs: storedLockSecs,
    setLockSecs: persistLockSecs,
  } = useShunt();
  const [lockSecs, setLockSecs] = useState(storedLockSecs);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const total = totalPct(buckets);
  const valid = total === 100;

  async function onSave() {
    setBusy(true);
    setErr(null);
    try {
      if (address) {
        const pct = (id: string) => buckets.find((b) => b.id === id)?.pct ?? 0;
        // The deployed contract splits three ways; Needs and Invest both stay
        // wallet-side, so the contract receives their sum as the wallet-tier
        // share. The invest slice is then DCA-converted by a follow-up path
        // payment (F12) — the vault contract stays frozen (11 tests intact).
        await vaultSetRules(address, pct("needs") + pct("invest"), pct("savings"), pct("buffer"), lockSecs);
      }
      markRulesSaved();
      persistLockSecs(lockSecs);
      showToast("Shunt rules saved on-chain");
    } catch (e) {
      // contract not deployed yet -> still persist locally for the demo flow
      markRulesSaved();
      persistLockSecs(lockSecs);
      setErr(`On-chain save failed (${e instanceof Error ? e.message : e}) — rules saved locally.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <header>
        <h2 style={{ margin: 0 }}>Configure Shunt</h2>
        <p className="muted" style={{ margin: "2px 0 0", fontSize: 14 }}>
          Every incoming income is automatically split by these rules.
        </p>
      </header>

      <div className="split-cols">
        {/* Diagram + total — sticky preview on desktop */}
        <div className="col-side sticky-col">
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Split preview</div>
            <SplitNode buckets={buckets} height={40 + buckets.length * 36} />
            <div
              role="status"
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontWeight: 600,
                marginTop: 14,
                paddingTop: 12,
                borderTop: "1px solid #1f2732",
                color: valid ? "var(--color-accent-primary)" : "#ffb4ab",
              }}
            >
              <span>Total allocation</span>
              <span className="numeric">
                {total}% {valid ? "✓" : total > 100 ? `(${total - 100}% over)` : `(${100 - total}% short)`}
              </span>
            </div>
          </div>
        </div>

        {/* Sliders + timelock + save */}
        <div className="col-main">
          {buckets.map((b) => (
            <div key={b.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600, color: b.color }}>{b.name}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    className="chip"
                    aria-label={`Decrease ${b.name}`}
                    onClick={() => setBucketPct(b.id, b.pct - 5)}
                  >
                    −
                  </button>
                  <span className="numeric" style={{ width: 48, textAlign: "center", fontWeight: 700 }}>
                    {b.pct}%
                  </span>
                  <button
                    className="chip"
                    aria-label={`Increase ${b.name}`}
                    onClick={() => setBucketPct(b.id, b.pct + 5)}
                  >
                    +
                  </button>
                  {!CORE_BUCKET_IDS.includes(b.id) && (
                    <button className="chip" aria-label={`Remove ${b.name}`} onClick={() => removeBucket(b.id)}>
                      ✕
                    </button>
                  )}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={b.pct}
                aria-label={`${b.name} percent`}
                onChange={(e) => setBucketPct(b.id, Number(e.target.value))}
              />
              {b.id === "invest" && (
                <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                  Spot-converted to XLM (DCA) right after each split — an asset purchase, not a yield product.
                </p>
              )}
            </div>
          ))}

          <button className="btn-ghost" onClick={addBucket}>
            + Add lane
          </button>

          <div className="card" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 14 }}>Savings timelock</span>
            <span style={{ display: "flex", gap: 6 }}>
              {LOCK_OPTIONS.map((o) => (
                <button
                  key={o.secs}
                  className={`chip${lockSecs === o.secs ? " active" : ""}`}
                  onClick={() => setLockSecs(o.secs)}
                >
                  {o.label}
                </button>
              ))}
            </span>
          </div>

          <button className="btn-primary" disabled={!valid || busy} onClick={onSave}>
            {busy ? "Saving…" : "Save rules"}
          </button>
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
