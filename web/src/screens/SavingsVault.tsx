import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, Target } from "lucide-react";
import { getIdrRate } from "../lib/rates";
import { vaultWithdrawSavings, vaultWithdrawBuffer, vaultCreateGoal, vaultWithdrawFromGoal, vaultRenameGoal, vaultDeleteGoal } from "../lib/vault";
import { fmtIdr, fmtUsdc, totalPct, useShunt, type SavingsGoal } from "../store";
import { formatError } from "../lib/stellar";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { ProgressRing } from "../components/ProgressRing";

const PENALTY_PCT = 10; // must match PENALTY_BPS in the contract

/** Desktop layout: balance + growth chart left, lock status + withdraw right. */
export function SavingsVault() {
  const {
    address,
    balances,
    buckets,
    bufferCredit,
    lockUntil,
    activity,
    withdrawSavings,
    withdrawBufferCredit,
    showToast,
    goals,
    unallocatedSavings,
    setGoalTarget,
    syncFromChain,
  } = useShunt();
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

  useEffect(() => {
    if (address) syncFromChain(address);
  }, [address, syncFromChain]);

  const locked = lockUntil * 1000 > Date.now();
  const balance = balances.savings;

  // Share of each past split that went to Savings — from the actual rules,
  // not a hardcoded 25%.
  const savingsShare = useMemo(() => {
    const pct = buckets.filter((b) => b.kind === "savings").reduce((s, b) => s + b.pct, 0);
    return totalPct(buckets) > 0 ? pct / 100 : 0.25;
  }, [buckets]);

  const chart = useMemo(() => {
    // savings growth series derived from split/deposit activity
    const pts = activity
      .filter((a) => a.kind === "split" || a.kind === "deposit")
      .slice()
      .reverse()
      .reduce<number[]>((acc, a) => {
        const amt = a.amountUsdc ?? 0;
        const savingsPart = a.kind === "split" ? amt * savingsShare : amt;
        acc.push((acc[acc.length - 1] ?? 0) + savingsPart);
        return acc;
      }, []);
    return pts.length >= 2 ? pts : [0, balance];
  }, [activity, balance, savingsShare]);

  const path = useMemo(() => {
    const max = Math.max(...chart, 1);
    const pts = chart.map((v, i) => `${(i / (chart.length - 1)) * 300},${90 - (v / max) * 80}`);
    return { line: `M ${pts.join(" L ")}`, area: `M 0,90 L ${pts.join(" L ")} L 300,90 Z` };
  }, [chart]);

  async function onWithdraw() {
    const usdc = Number(amount);
    // Cap at UNALLOCATED, not the total vault balance: `withdraw_savings`
    // on-chain only checks against the aggregate, not against what's
    // earmarked in goals — so a withdrawal here could otherwise silently
    // drain funds a goal is counting on, leaving get_unallocated_savings
    // negative and a later withdraw_from_goal failing with
    // InsufficientSavings out of nowhere. Move earmarked money via each
    // goal's own Withdraw instead.
    if (!usdc || usdc <= 0 || usdc > unallocatedSavings) {
      setErr(
        unallocatedSavings < balance
          ? `Invalid amount or exceeds unallocated (${fmtUsdc(unallocatedSavings)} USDC) — the rest is earmarked in goals below.`
          : "Invalid amount or exceeds balance.",
      );
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
    <div className="screen screen-wide">
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
            {/* This toggle would show the Savings balance re-denominated in
                grams of gold (a display conversion, like USD/IDR above) — it
                is NOT the same feature as the Invest lane's XLM/Gold picker
                (Configure Shunt), which is already live. Worded to avoid
                implying gold itself is unavailable in Shunt. */}
            <button className="chip" disabled title="Gold-denominated display coming later — invest into gold today via the Invest lane (Configure Shunt)" style={{ opacity: 0.4 }}>
              Gold display 🔜
            </button>
          </div>

          <div>
            <div className="numeric" style={{ fontSize: "clamp(34px, 4.5vw, 44px)", fontWeight: 700, lineHeight: 1.1 }} data-testid="vault-balance">
              {ccy === "USD" ? (
                <>
                  <AnimatedNumber value={balance} decimals={2} />{" "}
                  <span style={{ fontSize: 20, color: "var(--color-text-secondary)" }}>USDC</span>
                </>
              ) : (
                fmtIdr(balance * idr)
              )}
            </div>
            {ccy === "IDR" && (
              <div className="muted" style={{ fontSize: 12 }}>
                Display rate {stale ? "(fallback, may be outdated)" : "real-time"} — funds stay in USDC.
              </div>
            )}
          </div>

          <SavingsGoals
            address={address}
            goals={goals}
            unallocated={unallocatedSavings}
            locked={locked}
            onSetGoalTarget={setGoalTarget}
            onRefresh={() => address && syncFromChain(address)}
            onWithdrawn={withdrawSavings}
            showToast={showToast}
          />

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
              placeholder={`Amount in USDC (up to ${fmtUsdc(unallocatedSavings)} unallocated)`}
              value={amount}
              min={0}
              max={unallocatedSavings}
              onChange={(e) => setAmount(e.target.value)}
              aria-label="Withdrawal amount"
            />
            {unallocatedSavings < balance && (
              <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                {fmtUsdc(balance - unallocatedSavings)} USDC is earmarked in goals below — withdraw that from the goal itself.
              </p>
            )}
            <button className="btn-secondary" disabled={busy || unallocatedSavings <= 0} onClick={onWithdraw}>
              {busy ? "Processing…" : "Withdraw"}
            </button>
          </div>
          {err && (
            <p role="alert" className="muted" style={{ fontSize: 13, margin: 0 }}>
              {err}
            </p>
          )}

          {bufferCredit > 0 && (
            <BufferCreditCard
              address={address}
              credit={bufferCredit}
              onWithdrawn={withdrawBufferCredit}
              showToast={showToast}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Buffer credit — 10% early-exit penalties, parked in the vault, never locked.
// ---------------------------------------------------------------------------

function BufferCreditCard({
  address,
  credit,
  onWithdrawn,
  showToast,
}: {
  address: string | null;
  credit: number;
  /** Records the payout in lane bookkeeping + activity and re-syncs from chain. */
  onWithdrawn: (amount: number) => void;
  showToast: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onWithdrawCredit() {
    if (!address) return;
    setBusy(true);
    setErr(null);
    try {
      await vaultWithdrawBuffer(address, credit);
      onWithdrawn(credit);
      showToast("Buffer credit withdrawn to your wallet");
    } catch (e) {
      const formatted = formatError(e);
      if (formatted) setErr(`On-chain call failed (${formatted})`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="card"
      style={{ display: "flex", flexDirection: "column", gap: 8, borderLeft: "3px solid var(--color-bucket-buffer)" }}
      data-testid="buffer-credit-card"
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>Buffer credit</span>
        <span className="numeric" style={{ fontWeight: 700 }}>
          <AnimatedNumber value={credit} decimals={2} /> USDC
        </span>
      </div>
      <p className="muted" style={{ fontSize: 12, margin: 0 }}>
        Early-withdrawal penalties land here — yours, in the vault, never locked.
      </p>
      <button className="btn-secondary" disabled={busy} onClick={onWithdrawCredit} data-testid="withdraw-buffer-credit">
        {busy ? "Processing…" : "Withdraw to wallet"}
      </button>
      {err && (
        <p role="alert" className="muted" style={{ fontSize: 12, margin: 0 }}>
          {err}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Savings goals — named sub-allocations of the balance above.
// ---------------------------------------------------------------------------

function SavingsGoals({
  address,
  goals,
  unallocated,
  locked,
  onSetGoalTarget,
  onRefresh,
  onWithdrawn,
  showToast,
}: {
  address: string | null;
  goals: SavingsGoal[];
  unallocated: number;
  locked: boolean;
  onSetGoalTarget: (id: number, target: number | undefined) => void;
  onRefresh: () => void;
  /** Records a goal withdrawal in lane bookkeeping + activity (store.withdrawSavings). */
  onWithdrawn: (amount: number, penalty: number) => void;
  showToast: (msg: string) => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onCreate() {
    if (!address) return;
    const usdc = Number(newAmount);
    if (!newLabel.trim()) {
      setErr("Give the goal a name.");
      return;
    }
    if (!usdc || usdc <= 0 || usdc > unallocated) {
      setErr(`Invalid amount or exceeds unallocated (${fmtUsdc(unallocated)} USDC).`);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await vaultCreateGoal(address, newLabel.trim(), usdc);
      showToast(`Goal "${newLabel.trim()}" created`);
      setNewLabel("");
      setNewAmount("");
      setShowCreate(false);
      onRefresh();
    } catch (e) {
      const formatted = formatError(e);
      if (formatted) setErr(`On-chain call failed (${formatted})`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }} data-testid="savings-goals-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Labeled sub-vaults</div>
          <div className="muted" style={{ fontSize: 12 }}>
            Name slices of your savings for what they're for — stored on-chain.
          </div>
        </div>
        <span className="muted numeric" style={{ fontSize: 13, whiteSpace: "nowrap" }} data-testid="unallocated-savings">
          <AnimatedNumber value={unallocated} decimals={2} /> USDC free
        </span>
      </div>

      <AnimatePresence initial={false}>
        {goals.map((g) => (
          <GoalRow
            key={g.id}
            address={address}
            goal={g}
            locked={locked}
            onSetTarget={(t) => onSetGoalTarget(g.id, t)}
            onRefresh={onRefresh}
            onWithdrawn={onWithdrawn}
            showToast={showToast}
          />
        ))}
      </AnimatePresence>

      {!showCreate ? (
        <button
          className="btn-ghost"
          onClick={() => setShowCreate(true)}
          style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}
          data-testid="new-goal-button"
        >
          <Plus size={16} /> New label — e.g. Dana darurat, Umroh, Laptop
        </button>
      ) : (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10, border: "1px solid var(--color-accent-primary)" }}>
          <input
            type="text"
            placeholder="Label (e.g. Emergency fund, Umroh, Laptop)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            maxLength={64}
            data-testid="goal-name-input"
          />
          <input
            type="number"
            placeholder={`Amount (up to ${fmtUsdc(unallocated)} USDC unallocated)`}
            value={newAmount}
            min={0}
            onChange={(e) => setNewAmount(e.target.value)}
            data-testid="goal-amount-input"
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-secondary" onClick={() => { setShowCreate(false); setErr(null); }}>
              Cancel
            </button>
            <button className="btn-primary" disabled={busy} onClick={onCreate} data-testid="create-goal-button">
              {busy ? "Creating…" : "Create label"}
            </button>
          </div>
        </div>
      )}
      {err && (
        <p role="alert" className="muted" style={{ fontSize: 13, margin: 0 }}>
          {err}
        </p>
      )}
    </div>
  );
}

function GoalRow({
  address,
  goal,
  locked,
  onSetTarget,
  onRefresh,
  onWithdrawn,
  showToast,
}: {
  address: string | null;
  goal: SavingsGoal;
  locked: boolean;
  onSetTarget: (target: number | undefined) => void;
  onRefresh: () => void;
  onWithdrawn: (amount: number, penalty: number) => void;
  showToast: (msg: string) => void;
}) {
  const [mode, setMode] = useState<"idle" | "withdraw" | "rename" | "target">("idle");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState(goal.label);
  const [target, setTarget] = useState(goal.target ? String(goal.target) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const progress = goal.target && goal.target > 0 ? goal.amountUsdc / goal.target : undefined;

  async function onWithdraw() {
    if (!address) return;
    const usdc = Number(amount);
    if (!usdc || usdc <= 0 || usdc > goal.amountUsdc) {
      setErr("Invalid amount or exceeds this goal's balance.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await vaultWithdrawFromGoal(address, goal.id, usdc);
      // Record it like any savings withdrawal: activity entry + the payout
      // credited to spendable bookkeeping (also re-syncs from chain).
      onWithdrawn(usdc, locked ? (usdc * PENALTY_PCT) / 100 : 0);
      showToast(locked ? `Withdrawn — ${PENALTY_PCT}% penalty → Buffer` : "Withdrawn from goal");
      setMode("idle");
      setAmount("");
    } catch (e) {
      const formatted = formatError(e);
      if (formatted) setErr(`On-chain call failed (${formatted})`);
    } finally {
      setBusy(false);
    }
  }

  async function onRename() {
    if (!address || !label.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await vaultRenameGoal(address, goal.id, label.trim());
      showToast("Goal renamed");
      setMode("idle");
      onRefresh();
    } catch (e) {
      const formatted = formatError(e);
      if (formatted) setErr(`On-chain call failed (${formatted})`);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!address) return;
    setBusy(true);
    setErr(null);
    try {
      await vaultDeleteGoal(address, goal.id);
      showToast(`"${goal.label}" deleted — funds released to unallocated`);
      onRefresh();
    } catch (e) {
      const formatted = formatError(e);
      if (formatted) setErr(`On-chain call failed (${formatted})`);
    } finally {
      setBusy(false);
    }
  }

  function onSaveTarget() {
    const t = Number(target);
    onSetTarget(t > 0 ? t : undefined);
    setMode("idle");
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25 }}
      style={{ overflow: "hidden" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 0",
          borderTop: "1px solid #1f2732",
        }}
      >
        {progress !== undefined ? (
          <ProgressRing progress={progress} size={44} strokeWidth={4}>
            <span style={{ fontSize: 10, fontWeight: 700 }}>{Math.round(progress * 100)}%</span>
          </ProgressRing>
        ) : (
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "var(--color-bg-elevated)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Target size={18} className="muted" />
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {goal.label}
          </div>
          <div className="numeric muted" style={{ fontSize: 13 }}>
            <AnimatedNumber value={goal.amountUsdc} decimals={2} /> USDC
            {goal.target ? ` of ${fmtUsdc(goal.target)}` : ""}
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button className="chip" aria-label={`Rename ${goal.label}`} onClick={() => setMode(mode === "rename" ? "idle" : "rename")}>
            <Pencil size={14} />
          </button>
          <button className="chip" aria-label={`Set target for ${goal.label}`} onClick={() => setMode(mode === "target" ? "idle" : "target")}>
            <Target size={14} />
          </button>
          <button className="chip" aria-label={`Withdraw from ${goal.label}`} onClick={() => setMode(mode === "withdraw" ? "idle" : "withdraw")}>
            Withdraw
          </button>
          <button className="chip" aria-label={`Delete ${goal.label}`} onClick={onDelete} disabled={busy}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {mode === "withdraw" && (
        <div style={{ display: "flex", gap: 8, paddingBottom: 10 }}>
          <input
            type="number"
            placeholder="Amount in USDC"
            value={amount}
            min={0}
            onChange={(e) => setAmount(e.target.value)}
            aria-label={`${goal.label} withdrawal amount`}
          />
          <button className="btn-secondary" disabled={busy} onClick={onWithdraw} style={{ width: "auto", padding: "0 20px" }}>
            {busy ? "…" : "Go"}
          </button>
        </div>
      )}
      {mode === "rename" && (
        <div style={{ display: "flex", gap: 8, paddingBottom: 10 }}>
          <input
            type="text"
            value={label}
            maxLength={64}
            onChange={(e) => setLabel(e.target.value)}
            aria-label="New goal name"
          />
          <button className="btn-secondary" disabled={busy} onClick={onRename} style={{ width: "auto", padding: "0 20px" }}>
            {busy ? "…" : "Save"}
          </button>
        </div>
      )}
      {mode === "target" && (
        <div style={{ display: "flex", gap: 8, paddingBottom: 10 }}>
          <input
            type="number"
            placeholder="Target amount (display only, not enforced)"
            value={target}
            min={0}
            onChange={(e) => setTarget(e.target.value)}
            aria-label={`Target for ${goal.label}`}
          />
          <button className="btn-secondary" onClick={onSaveTarget} style={{ width: "auto", padding: "0 20px" }}>
            Save
          </button>
        </div>
      )}
      {err && (
        <p role="alert" className="muted" style={{ fontSize: 12, margin: "0 0 10px" }}>
          {err}
        </p>
      )}
    </motion.div>
  );
}
