import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, Link } from "react-router-dom";
import { Lock, Wallet, ArrowUpRight, Plus, CheckCircle2, Wand2, Zap } from "lucide-react";
import { DonutChart } from "../components/DonutChart";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { vaultSetRules } from "../lib/vault";
import { manualTrigger } from "../lib/keeper";
import { formatError } from "../lib/stellar";
import { CORE_BUCKET_IDS, fmtUsdc, totalPct, useShunt } from "../store";

const LOCK_OPTIONS = [
  { label: "30 days", secs: 30 * 86400 },
  { label: "90 days", secs: 90 * 86400 },
  { label: "180 days", secs: 180 * 86400 },
];

/**
 * Core screen (F3). Validation decision (DESIGN.md §5.2): while total ≠ 100%,
 * the save button is disabled AND an inline message shows the difference.
 * No silent auto-adjust — but sliders keep a FIXED 0–100 scale (a moving max
 * makes the same % land at different track positions, which reads as broken);
 * over-allocation is clamped with an inline hint instead.
 * Desktop layout: split diagram sticky on the left, sliders on the right.
 */
export function ConfigureShunt() {
  const nav = useNavigate();
  const {
    address,
    buckets,
    balances,
    usdcBalance,
    bufferCredit,
    setBucketPct,
    addBucket,
    removeBucket,
    markRulesSaved,
    refreshWallet,
    showToast,
    lockSecs: storedLockSecs,
    setLockSecs: persistLockSecs,
    investAsset,
    setInvestAsset,
    rulesSavedOnChain,
  } = useShunt();
  const [lockSecs, setLockSecs] = useState(storedLockSecs);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(!rulesSavedOnChain);
  const [simBusy, setSimBusy] = useState(false);
  const [reallocBusy, setReallocBusy] = useState(false);
  /** bucket id whose last adjustment got clamped (over-allocation feedback) */
  const [clampHint, setClampHint] = useState<string | null>(null);
  const clampTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<"needs" | "savings" | "buffer" | "invest">("savings");

  useEffect(() => {
    if (address) refreshWallet(address);
  }, [address, refreshWallet]);

  const getKindIcon = (kind: string, size = 16) => {
    switch (kind) {
      case "savings": return <Lock size={size} />;
      case "invest": return <ArrowUpRight size={size} />;
      default: return <Wallet size={size} />; // needs and buffer
    }
  };

  const total = totalPct(buckets);
  const remaining = 100 - total;
  const valid = total === 100;

  // Everything the user actually holds, on-chain: wallet USDC + vault.
  const totalBalance = Number(usdcBalance ?? 0) + balances.savings + bufferCredit;
  // Nominal preview basis: real balance when there is one, else a typical income.
  const [previewAmt, setPreviewAmt] = useState<string | null>(null);
  const previewBase = previewAmt !== null ? Number(previewAmt) || 0 : totalBalance > 0 ? totalBalance : 500;

  function onSliderChange(id: string, requested: number, current: number) {
    const room = current + Math.max(0, remaining);
    setBucketPct(id, requested);
    if (requested > room) {
      // The store clamped it — tell the user why the thumb snapped back.
      setClampHint(id);
      if (clampTimer.current) clearTimeout(clampTimer.current);
      clampTimer.current = setTimeout(() => setClampHint(null), 2600);
    }
  }

  function onAllocateRemaining() {
    const needs = buckets.find((b) => b.id === "needs");
    if (!needs || remaining <= 0) return;
    setBucketPct("needs", needs.pct + remaining);
  }

  async function onSave() {
    setBusy(true);
    setErr(null);
    try {
      if (address) {
        const pctKind = (kind: string) => buckets.filter(b => b.kind === kind).reduce((sum, b) => sum + b.pct, 0);
        // The deployed contract splits three ways; Needs and Invest both stay
        // wallet-side, so the contract receives their sum as the wallet-tier
        // share. The invest slice is then DCA-converted by a follow-up path
        // payment (F12) — the vault contract stays frozen (11 tests intact).
        await vaultSetRules(address, pctKind("needs") + pctKind("invest"), pctKind("savings"), pctKind("buffer"), lockSecs);
      }
      markRulesSaved();
      persistLockSecs(lockSecs);
      setIsEditing(false);
      setSaved(true);
      showToast("Shunt rules saved on-chain");
    } catch (e) {
      const formatted = formatError(e);
      if (formatted) setErr(`On-chain save failed (${formatted})`);
    } finally {
      setBusy(false);
    }
  }

  /** Demo fallback lives here too: rules just saved → try the loop right away. */
  async function onSimulate() {
    if (!address) return;
    if (!rulesSavedOnChain) {
      showToast("Please save your allocation rules first.");
      return;
    }
    const walletUsdc = Number(usdcBalance ?? 0);
    if (walletUsdc < 1) {
      showToast("Not enough USDC in wallet to simulate — fund your wallet first");
      return;
    }
    // Use the actual wallet USDC balance (capped at a sane demo max)
    const simAmount = Math.min(walletUsdc, 500).toFixed(7);
    setSimBusy(true);
    try {
      const fakeHash = [...crypto.getRandomValues(new Uint8Array(32))]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const p = await manualTrigger(address, simAmount, fakeHash, true);
      if (p && !p.xdr && p.error) {
        if (p.error.includes("#3") || p.error.includes("RulesNotSet")) {
          useShunt.setState({ rulesSavedOnChain: false });
          setIsEditing(true);
          showToast("Rules expired on-chain (testnet may have reset). Please save again.");
        } else {
          showToast(`Keeper error: ${p.error.slice(0, 120)}`);
        }
        return;
      }
      nav("/confirm", { state: p ?? { account: address, amount: simAmount, txHash: fakeHash, xdr: null } });
    } finally {
      setSimBusy(false);
    }
  }

  /** Reallocate existing wallet USDC using the newly saved rules. */
  async function onReallocate() {
    if (!address) return;
    if (!rulesSavedOnChain) {
      showToast("Please save your allocation rules first.");
      return;
    }
    const walletUsdc = Number(usdcBalance ?? 0);
    if (walletUsdc < 0.01) {
      showToast("No USDC in wallet to reallocate.");
      return;
    }
    setReallocBusy(true);
    try {
      const fakeHash = [...crypto.getRandomValues(new Uint8Array(32))]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const p = await manualTrigger(address, walletUsdc.toFixed(7), fakeHash, true);
      if (p && !p.xdr && p.error) {
        if (p.error.includes("#3") || p.error.includes("RulesNotSet")) {
          useShunt.setState({ rulesSavedOnChain: false });
          setIsEditing(true);
          showToast("Rules expired on-chain (testnet may have reset). Please save again.");
        } else {
          showToast(`Keeper error: ${p.error.slice(0, 120)}`);
        }
        return;
      }
      nav("/confirm", { state: p ?? { account: address, amount: walletUsdc.toFixed(7), txHash: fakeHash, xdr: null } });
    } finally {
      setReallocBusy(false);
    }
  }

  return (
    <div className="screen screen-wide">
      <header>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div>
            <h2 style={{ margin: 0 }}>Configure Shunt</h2>
            <p className="muted" style={{ margin: "2px 0 0", fontSize: 14 }}>
              Every incoming income is automatically split by these rules.
            </p>
          </div>
          {rulesSavedOnChain && !isEditing ? (
            <div className="chip" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--color-bucket-savings)", border: "1px solid var(--color-bucket-savings)" }}>
              <span className="lp-live-dot" style={{ backgroundColor: "var(--color-bucket-savings)" }} /> Active on-chain
            </div>
          ) : (
            <div className="chip" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--color-text-secondary)", border: "1px solid var(--color-border)" }}>
              <span className="lp-live-dot" style={{ backgroundColor: "var(--color-text-secondary)" }} /> Unsaved setup
            </div>
          )}
        </div>
      </header>

      <div className="split-cols reverse-mobile">
        {/* Diagram + total — sticky preview on desktop */}
        <div className="col-side sticky-col">
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Split preview</div>
            <div style={{ padding: "16px 0", display: "flex", justifyContent: "center" }}>
              <DonutChart
                buckets={buckets}
                size={180}
                strokeWidth={24}
                centerContent={
                  <>
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 2 }}>
                      {valid ? "Allocated" : "Allocated so far"}
                    </div>
                    <div
                      className="numeric"
                      style={{
                        fontSize: 26,
                        fontWeight: 700,
                        color: valid ? "var(--color-accent-primary)" : "var(--color-text-primary)",
                        lineHeight: 1,
                      }}
                      data-testid="donut-total-pct"
                    >
                      {total}%
                    </div>
                    <div className="numeric muted" style={{ fontSize: 11, marginTop: 4 }}>
                      of {fmtUsdc(previewBase)} USDC
                    </div>
                  </>
                }
              />
            </div>

            {/* Total balance + preview basis (real, on-chain) */}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
              <span className="muted">Your total balance</span>
              <span className="numeric" data-testid="config-total-balance">
                <AnimatedNumber value={totalBalance} decimals={2} /> USDC
              </span>
            </div>
            <label className="muted" style={{ fontSize: 12, display: "block" }}>
              Preview amounts for an income of
              <input
                type="number"
                min={0}
                value={previewAmt ?? String(Math.round(previewBase * 100) / 100)}
                onChange={(e) => setPreviewAmt(e.target.value)}
                style={{ marginTop: 6 }}
                aria-label="Preview income amount"
                data-testid="preview-amount-input"
              />
            </label>

            <div
              role="status"
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontWeight: 600,
                marginTop: 14,
                paddingTop: 12,
                borderTop: "1px solid #1f2732",
                color: valid ? "var(--color-accent-primary)" : "var(--color-bucket-needs)",
              }}
              data-testid="allocation-status"
            >
              <span>{valid ? "Fully allocated" : `${remaining}% left to allocate`}</span>
              <span className="numeric">
                <AnimatedNumber value={total} suffix="%" /> {valid && "✓"}
              </span>
            </div>
            {isEditing && !valid && remaining > 0 && (
              <button
                className="btn-ghost"
                style={{ marginTop: 10, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                onClick={onAllocateRemaining}
                data-testid="allocate-remaining-button"
              >
                <Wand2 size={14} /> Add the remaining {remaining}% to Needs
              </button>
            )}
          </div>
        </div>

        {/* Sliders + timelock + save */}
        <div className="col-main">
          {!isEditing && rulesSavedOnChain && (
            <>
              <section
                className="card"
                style={{
                  border: "1px solid var(--color-accent-secondary)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  marginBottom: 4,
                }}
                data-testid="simulate-section"
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Zap size={18} style={{ color: "var(--color-accent-secondary)" }} />
                  <span style={{ fontWeight: 600, fontSize: 14 }}>Test your rules</span>
                </div>
                <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                  Simulate a detected income using your wallet USDC balance to see how it splits.
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    className="btn-primary"
                    style={{ flex: 1, minWidth: 160 }}
                    disabled={simBusy}
                    onClick={onSimulate}
                    data-testid="simulate-income-button"
                  >
                    {simBusy ? "Preparing…" : "Simulate incoming income"}
                  </button>
                  {Number(usdcBalance ?? 0) >= 0.01 && (
                    <button
                      className="btn-secondary"
                      style={{ flex: 1, minWidth: 160 }}
                      disabled={reallocBusy}
                      onClick={onReallocate}
                      data-testid="reallocate-balance"
                    >
                      {reallocBusy ? "Preparing…" : `Reallocate ${fmtUsdc(Number(usdcBalance ?? 0))} USDC`}
                    </button>
                  )}
                </div>
              </section>
              <button className="btn-secondary" style={{ width: "100%", marginBottom: 4 }} onClick={() => setIsEditing(true)}>
                Edit configuration
              </button>
            </>
          )}
          {buckets.map((b, i) => {
            const nominal = (previewBase * b.pct) / 100;
            return (
              <motion.div
                key={b.id}
                className="card"
                style={{ display: "flex", flexDirection: "column", gap: 6 }}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                data-testid={`lane-${b.id}`}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, color: b.color, display: "flex", alignItems: "center", gap: 6 }}>
                    {getKindIcon(b.kind)} {b.name}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      className="chip"
                      aria-label={`Decrease ${b.name}`}
                      disabled={!isEditing}
                      onClick={() => setBucketPct(b.id, b.pct - 5)}
                    >
                      −
                    </button>
                    <span className="numeric" style={{ width: 48, textAlign: "center", fontWeight: 700 }} data-testid={`lane-pct-${b.id}`}>
                      <AnimatedNumber value={b.pct} suffix="%" />
                    </span>
                    <button
                      className="chip"
                      aria-label={`Increase ${b.name}`}
                      disabled={remaining <= 0 || !isEditing}
                      onClick={() => onSliderChange(b.id, b.pct + 5, b.pct)}
                    >
                      +
                    </button>
                    {!CORE_BUCKET_IDS.includes(b.id) && isEditing && (
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
                  onChange={(e) => onSliderChange(b.id, Number(e.target.value), b.pct)}
                  disabled={!isEditing}
                  style={{
                    background: `linear-gradient(to right, ${b.color} ${b.pct}%, var(--color-surface-sunken) ${b.pct}%)`,
                  }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <span className="numeric muted" style={{ fontSize: 12 }} data-testid={`lane-nominal-${b.id}`}>
                    ≈ {fmtUsdc(nominal)} USDC {b.kind === "savings" ? "→ vault" : b.kind === "invest" ? (investAsset === "GOLD" ? "→ Gold (XAUm)" : "→ XLM (DCA)") : "stays in wallet"}
                  </span>
                  <AnimatePresence>
                    {clampHint === b.id && (
                      <motion.span
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        style={{ fontSize: 12, color: "var(--color-bucket-needs)", fontWeight: 600 }}
                        data-testid="clamp-hint"
                      >
                        Total can't exceed 100% — lower another lane first
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                {b.id === "invest" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 2 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span className="muted" style={{ fontSize: 12 }}>Invest into</span>
                      <button
                        className={`chip${investAsset === "XLM" ? " active" : ""}`}
                        onClick={() => setInvestAsset("XLM")}
                        disabled={!isEditing}
                        data-testid="invest-asset-xlm"
                      >
                        XLM
                      </button>
                      <button
                        className={`chip${investAsset === "GOLD" ? " active" : ""}`}
                        onClick={() => setInvestAsset("GOLD")}
                        disabled={!isEditing}
                        data-testid="invest-asset-gold"
                      >
                        Gold · XAUm
                      </button>
                    </div>
                    <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                      {investAsset === "GOLD"
                        ? "XAUm = 1g LBMA gold (Matrixdock, on Stellar) — a value-holding growth asset. Spot purchase, not a yield product. Testnet has no XAUm liquidity yet, so it records at a labeled reference rate."
                        : "Spot-converted to XLM (DCA) right after each split — an asset purchase, not a yield product. Live DEX liquidity on testnet."}
                    </p>
                  </div>
                )}
              </motion.div>
            );
          })}

          {isEditing && (
            <>
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
            </>
          )}

          <div className="card" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 14 }}>Savings timelock</span>
            <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {LOCK_OPTIONS.map((o) => (
                <button
                  key={o.secs}
                  className={`chip${lockSecs === o.secs ? " active" : ""}`}
                  disabled={!isEditing}
                  onClick={() => setLockSecs(o.secs)}
                >
                  {o.label}
                </button>
              ))}
            </span>
          </div>

          {isEditing && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
              <button className="btn-primary" style={{ width: "100%" }} disabled={!valid || busy} onClick={onSave} data-testid="save-rules-button">
                {busy ? "Saving…" : valid ? (rulesSavedOnChain ? "Update on-chain rules" : "Save to blockchain") : `Allocate ${remaining}% more to save`}
              </button>
              {rulesSavedOnChain && (
                <button className="btn-secondary" style={{ width: "100%" }} disabled={busy} onClick={() => setIsEditing(false)}>
                  Cancel
                </button>
              )}
            </div>
          )}
          {err && (
            <p role="alert" className="muted" style={{ fontSize: 13, margin: 0 }}>
              {err}
            </p>
          )}

          {/* Post-save guidance — the "saved… now what?" gap */}
          <AnimatePresence>
            {saved && !busy && (
              <motion.section
                className="card"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{ border: "1px solid var(--color-accent-primary)" }}
                data-testid="post-save-panel"
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                  <CheckCircle2 size={18} style={{ color: "var(--color-accent-primary)" }} />
                  Rules saved — here's what happens next
                </div>
                <ol className="muted" style={{ fontSize: 13, margin: "10px 0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
                  <li>USDC lands in your wallet — via a payment link, Top Up, or any direct transfer.</li>
                  <li>Shunt detects it within seconds and shows the exact breakdown.</li>
                  <li>You approve with one tap — savings lock in the vault, the rest stays liquid.</li>
                </ol>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "10px" }}>
                  {Number(usdcBalance ?? 0) >= 0.01 && (
                    <button
                      className="btn-primary"
                      style={{ flex: 1, minWidth: 180 }}
                      disabled={reallocBusy}
                      onClick={onReallocate}
                      data-testid="reallocate-balance"
                    >
                      {reallocBusy ? "Preparing…" : `Reallocate ${fmtUsdc(Number(usdcBalance ?? 0))} USDC with new rules`}
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link to="/topup" className="btn-secondary" style={{ flex: 1, minWidth: 120, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    Top Up
                  </Link>
                  <Link to="/request" className="btn-secondary" style={{ flex: 1, minWidth: 120, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    Payment link
                  </Link>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
