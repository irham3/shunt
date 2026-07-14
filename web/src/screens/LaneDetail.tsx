import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Lock, Wallet, ArrowUpRight, SlidersHorizontal } from "lucide-react";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { fmtUsdc, useShunt } from "../store";
import { vaultWithdrawBuffer } from "../lib/vault";
import { formatError } from "../lib/stellar";

/**
 * Per-lane detail (`/lane/:id`). Home used to dump Buffer / Invest / custom
 * lanes into Configure Shunt (re-allocation) — this screen answers "what's
 * actually in this lane, and what can I do with it": holdings (incl. invest
 * asset + units), lane-appropriate actions, and this lane's activity. Savings
 * keeps its own richer vault screen (`/savings`).
 */
function laneNote(kind: string): string {
  switch (kind) {
    case "savings": return "locked in the vault by code";
    case "invest": return "invested — an asset purchase, in your wallet";
    case "buffer": return "instant-access emergency fund, in your wallet";
    default: return "spendable, in your wallet";
  }
}

export function LaneDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const {
    address, buckets, balances, investXlm, investAsset, bufferCredit,
    activity, showToast, syncFromChain,
  } = useShunt();
  const [busy, setBusy] = useState(false);

  const bucket = buckets.find((b) => b.id === id);

  const balance =
    id === "needs" ? balances.needs
    : id === "savings" ? balances.savings
    : id === "buffer" ? balances.buffer
    : id === "invest" ? balances.invest
    : 0;

  const laneActivity = useMemo(
    () => activity.filter((a) => a.bucket === id || (id === "invest" && a.kind === "invest")).slice(0, 8),
    [activity, id],
  );

  async function onWithdrawBuffer() {
    if (!address || bufferCredit <= 0) return;
    setBusy(true);
    try {
      await vaultWithdrawBuffer(address, bufferCredit);
      await syncFromChain(address);
      showToast("Buffer credit withdrawn to your wallet");
    } catch (e) {
      const f = formatError(e);
      if (f) showToast(f);
    } finally {
      setBusy(false);
    }
  }

  if (!bucket) {
    return (
      <div className="screen" style={{ justifyContent: "center", minHeight: "60dvh" }}>
        <p className="muted" style={{ textAlign: "center" }}>That lane doesn't exist.</p>
        <Link to="/home" className="btn-secondary" style={{ maxWidth: 220, margin: "0 auto" }}>Back to Home</Link>
      </div>
    );
  }

  const unit = investAsset === "GOLD" ? "g XAUm" : "XLM";
  const icon =
    bucket.kind === "savings" ? <Lock size={22} />
    : bucket.kind === "invest" ? <ArrowUpRight size={22} />
    : <Wallet size={22} />;

  return (
    <div className="screen">
      <Link to="/home" className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14 }}>
        <ArrowLeft size={16} /> Home
      </Link>

      {/* Header + holdings */}
      <motion.div className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} data-testid={`lane-detail-${id}`}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 44, height: 44, borderRadius: 12, background: bucket.color, display: "grid", placeItems: "center", color: "var(--color-text-on-accent)" }}>
            {icon}
          </span>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 22 }}>{bucket.name}</h2>
            <div className="muted" style={{ fontSize: 13 }}>{bucket.pct}% of each income · {laneNote(bucket.kind)}</div>
          </div>
        </div>
        <div className="numeric" style={{ fontSize: 36, fontWeight: 700, marginTop: 14, lineHeight: 1.1 }}>
          <AnimatedNumber value={balance} decimals={2} /> <span style={{ fontSize: 18, color: "var(--color-text-secondary)" }}>USDC</span>
        </div>
        {bucket.kind === "invest" && investXlm > 0 && (
          <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>
            ≈ <span className="numeric">{investXlm.toLocaleString("en-US", { maximumFractionDigits: 4 })}</span> {investAsset === "GOLD" ? "grams of gold (XAUm)" : "XLM"} held
            {balance > 0 && <> · avg cost <span className="numeric">{fmtUsdc(balance / investXlm)}</span> USDC/{investAsset === "GOLD" ? "g" : "XLM"}</>}
          </div>
        )}
      </motion.div>

      {/* Kind-specific explainer + actions */}
      {bucket.kind === "invest" && (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Your growth slice</div>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              {investXlm > 0
                ? `Spot-purchased into ${investAsset === "GOLD" ? "gold (XAUm — 1 token = 1g LBMA gold)" : "XLM"} after each split. This is an asset purchase, not a yield product — and it's separate from your value-preserving Savings.`
                : "Nothing invested yet. Turn on the Invest lane (set a %) in your rules and pick XLM or gold — the slice buys in automatically after each split."}
            </p>
          </div>
          <Link to="/shunt" className="btn-secondary" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            Choose invest asset (XLM / Gold) & adjust %
          </Link>
        </div>
      )}

      {bucket.kind === "buffer" && (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Emergency fund — instant access</div>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              No lock, no penalty. It also collects the 10% penalty from any early Savings withdrawal as <strong>buffer credit</strong> held in the vault.
            </p>
          </div>
          {bufferCredit > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span className="muted">Buffer credit in vault</span>
                <span className="numeric"><AnimatedNumber value={bufferCredit} decimals={2} /> USDC</span>
              </div>
              <button className="btn-primary" disabled={busy} onClick={onWithdrawBuffer} data-testid="lane-withdraw-buffer">
                {busy ? "Confirm in wallet…" : `Withdraw ${fmtUsdc(bufferCredit)} USDC to wallet`}
              </button>
            </>
          )}
        </div>
      )}

      {(bucket.kind === "needs" || (bucket.kind !== "savings" && bucket.kind !== "invest" && bucket.kind !== "buffer")) && (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Spendable — in your wallet</div>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              Use it, or cash out to IDR/PHP through a licensed anchor when you choose. Rate and fee are shown before you confirm.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link to="/send" className="btn-primary" style={{ flex: 1, minWidth: 130, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              Cash out to fiat
            </Link>
            <Link to="/send?tab=convert" className="btn-secondary" style={{ flex: 1, minWidth: 130, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              Convert
            </Link>
          </div>
        </div>
      )}

      {bucket.kind === "savings" && (
        <Link to="/savings" className="btn-primary" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          Open savings vault (goals, timelock, withdraw)
        </Link>
      )}

      {/* Re-allocation is a secondary action, not the only door */}
      <Link to="/shunt" className="btn-ghost" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <SlidersHorizontal size={15} /> Adjust allocation split
      </Link>

      {/* This lane's activity */}
      <section className="card">
        <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>{bucket.name} activity</h3>
        {laneActivity.length === 0 ? (
          <p className="muted" style={{ fontSize: 14, margin: 0 }}>
            Nothing here yet. Movements tied to this lane will show up as you use it.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {laneActivity.map((a, i) => (
              <div key={a.id} style={{ padding: "11px 0", borderBottom: i < laneActivity.length - 1 ? "1px solid var(--color-border-subtle)" : "none", display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</span>
                <span className="numeric muted" style={{ flexShrink: 0 }}>
                  {a.amountXlm !== undefined
                    ? `${a.amountXlm.toLocaleString("en-US", { maximumFractionDigits: 2 })} XLM`
                    : `${fmtUsdc(a.amountUsdc ?? 0)} USDC`}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
