import { useState } from "react";
import { motion } from "framer-motion";
import { Lock, Wallet, ArrowUpRight, Plus } from "lucide-react";
import { SplitNode } from "../components/SplitNode";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { vaultSetRules } from "../lib/vault";
import { formatError } from "../lib/stellar";
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

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<"needs" | "savings" | "buffer" | "invest">("savings");

  const getKindIcon = (kind: string, size = 16) => {
    switch (kind) {
      case "savings": return <Lock size={size} />;
      case "invest": return <ArrowUpRight size={size} />;
      default: return <Wallet size={size} />; // needs and buffer
    }
  };

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
      const formatted = formatError(e);
      if (formatted) setErr(`On-chain save failed (${formatted})`);
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

      <div className="split-cols reverse-mobile">
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
                color: valid ? "var(--color-accent-primary)" : "var(--color-text-secondary)",
              }}
            >
              <span>{valid ? "Total allocation" : `${100 - total}% left to allocate`}</span>
              <span className="numeric">
                <AnimatedNumber value={total} suffix="%" /> {valid && "✓"}
              </span>
            </div>
          </div>
        </div>

        {/* Sliders + timelock + save */}
        <div className="col-main">
          {buckets.map((b, i) => {
            const roomLeft = 100 - (total - b.pct);
            return (
            <motion.div
              key={b.id}
              className="card"
              style={{ display: "flex", flexDirection: "column", gap: 6 }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600, color: b.color, display: "flex", alignItems: "center", gap: 6 }}>
                  {getKindIcon(b.kind)} {b.name}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    className="chip"
                    aria-label={`Decrease ${b.name}`}
                    onClick={() => setBucketPct(b.id, b.pct - 5)}
                  >
                    −
                  </button>
                  <span className="numeric" style={{ width: 48, textAlign: "center", fontWeight: 700 }}>
                    <AnimatedNumber value={b.pct} suffix="%" />
                  </span>
                  <button
                    className="chip"
                    aria-label={`Increase ${b.name}`}
                    disabled={b.pct >= roomLeft}
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
                max={roomLeft}
                value={b.pct}
                aria-label={`${b.name} percent`}
                onChange={(e) => setBucketPct(b.id, Number(e.target.value))}
              />
              {b.id === "invest" && (
                <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                  Spot-converted to XLM (DCA) right after each split — an asset purchase, not a yield product.
                </p>
              )}
            </motion.div>
            );
          })}

          {!showAdd ? (
            <button className="btn-ghost" onClick={() => setShowAdd(true)} style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
              <Plus size={16} /> Add custom lane
            </button>
          ) : (
            <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12, border: "1px solid var(--color-accent-primary)" }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>New custom lane</div>
              <input type="text" placeholder="Lane name (e.g. Holiday)" value={newName} onChange={e => setNewName(e.target.value)} />
              <div style={{ display: "flex", gap: 8 }}>
                <button className={`chip ${newKind === "savings" ? "active" : ""}`} onClick={() => setNewKind("savings")} style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", gap: 6 }}>
                  <Lock size={14} /> Locked
                </button>
                <button className={`chip ${newKind === "needs" ? "active" : ""}`} onClick={() => setNewKind("needs")} style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", gap: 6 }}>
                  <Wallet size={14} /> Liquid
                </button>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
                <button className="btn-primary" disabled={!newName.trim()} onClick={() => { addBucket(newName.trim(), newKind); setShowAdd(false); setNewName(""); }}>Add Lane</button>
              </div>
            </div>
          )}

          <div className="card" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 14 }}>Savings timelock</span>
            <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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
