import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { DonutChart } from "../components/DonutChart";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { markComplete, type PendingSplit } from "../lib/keeper";
import { convertUsdcToXlm, signAndSubmitXdr, EXPLORER_TX, formatError } from "../lib/stellar";
import { getXlmUsdRate } from "../lib/rates";
import { fmtUsdc, useShunt } from "../store";

/**
 * F4: one-tap approval of a keeper-prepared split. Also reachable via the
 * manual trigger (demo fallback) with a synthetic amount.
 */
export function AutoSplitConfirm() {
  const nav = useNavigate();
  const { state } = useLocation();
  const pending = state as PendingSplit | null;
  const { address, buckets, applySplit, applyInvestConversion, showToast } = useShunt();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [doneHash, setDoneHash] = useState<string | null>(null);

  const amount = pending ? Number(pending.amount) : 500;
  const investAmt = useMemo(() => {
    const pct = buckets.find((b) => b.id === "invest")?.pct ?? 0;
    return (amount * pct) / 100;
  }, [amount, buckets]);
  const rows = useMemo(() => {
    const pct = (id: string) => buckets.find((b) => b.id === id)?.pct ?? 0;
    const savings = (amount * pct("savings")) / 100;
    const buffer = (amount * pct("buffer")) / 100;
    const invest = (amount * pct("invest")) / 100;
    const out = [
      { id: "needs", label: "Needs → wallet", amt: amount - savings - buffer - invest },
      { id: "savings", label: "Savings → vault (timelock)", amt: savings },
      { id: "buffer", label: "Buffer → wallet", amt: buffer },
    ];
    if (invest > 0) out.push({ id: "invest", label: "Invest → XLM (DCA)", amt: invest });
    return out;
  }, [amount, buckets]);

  /**
   * F12: convert the invest slice after the split. A Soroban tx is
   * single-operation, so this is a separate classic path payment (2nd tap
   * on-chain); when no wallet/liquidity is available it falls back to a
   * *labeled* simulated conversion — same honesty pattern as the IDR rate.
   */
  async function runInvestConversion(splitWasOnChain: boolean) {
    if (investAmt <= 0) return;
    const { rate, stale } = await getXlmUsdRate();
    const estXlm = investAmt / rate;
    if (splitWasOnChain && address) {
      try {
        const minXlm = (estXlm * 0.95).toFixed(7); // 5% slippage floor
        const hash = await convertUsdcToXlm(address, investAmt.toFixed(7), minXlm);
        applyInvestConversion(investAmt, estXlm, hash, false);
        showToast("Invest slice converted to XLM");
        return;
      } catch {
        showToast(`DEX conversion unavailable — recorded at ${stale ? "fallback" : "market"} rate`);
      }
    }
    applyInvestConversion(investAmt, estXlm, undefined, true);
  }

  async function onApprove() {
    setBusy(true);
    setErr(null);
    try {
      if (!pending?.xdr) {
        throw new Error("Missing prepared XDR from Keeper. Ensure Vault contract is deployed and Keeper is running.");
      }
      const hash = await signAndSubmitXdr(pending.xdr);
      await markComplete(pending.txHash);
      
      applySplit(amount, hash);
      await runInvestConversion(true);
      setDoneHash(hash);
      showToast("Income landed — auto-split complete");
    } catch (e) {
      const formatted = formatError(e);
      if (formatted) setErr(formatted);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen" style={{ justifyContent: "center", minHeight: "100dvh", textAlign: "center" }}>
      <h2 style={{ margin: 0 }}>Income landed</h2>
      <motion.div
        className="numeric"
        style={{ fontSize: 36, fontWeight: 700 }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
      >
        <AnimatedNumber value={amount} decimals={2} /> <span style={{ fontSize: 18 }}>USDC</span>
      </motion.div>

      <div className="card" style={{ padding: "16px 0", display: "flex", justifyContent: "center" }}>
        <DonutChart buckets={buckets} size={150} strokeWidth={20} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((r, i) => {
          const bucket = buckets.find((b) => b.id === r.id)!;
          return (
            <motion.div
              key={r.id}
              className="card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15 + i * 0.07 }}
              style={{ display: "flex", justifyContent: "space-between", padding: 12 }}
            >
              <span style={{ color: bucket.color, fontWeight: 600, fontSize: 14 }}>{r.label}</span>
              <span className="numeric"><AnimatedNumber value={r.amt} decimals={2} /> USDC</span>
            </motion.div>
          );
        })}
      </div>

      <p className="muted" style={{ fontSize: 13, margin: 0 }}>
        Atomic split in a single transaction · sub-cent network fee
        {investAmt > 0 && " · invest slice converts via a follow-up path payment"}
      </p>

      {doneHash ? (
        <>
          <a
            href={EXPLORER_TX(doneHash)}
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--color-accent-secondary)" }}
          >
            View on explorer ↗
          </a>
          <button className="btn-primary" onClick={() => nav("/home")}>
            Done
          </button>
        </>
      ) : (
        <button className="btn-primary" disabled={busy} onClick={onApprove}>
          {busy ? "Processing…" : "Approve split (1 tap)"}
        </button>
      )}
      <button className="btn-ghost" onClick={() => nav("/home")}>
        Later
      </button>
      {err && (
        <p role="alert" style={{ color: "#ffb4ab", fontSize: 13 }}>
          {err}
        </p>
      )}
    </div>
  );
}
