import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { DonutChart } from "../components/DonutChart";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { markComplete, type PendingSplit } from "../lib/keeper";
import { convertUsdcToXlm, signAndSubmitXdr, EXPLORER_TX, formatError } from "../lib/stellar";
import { getXlmUsdRate, getGoldUsdRate } from "../lib/rates";
import { fmtUsdc, useShunt } from "../store";

/**
 * F4: one-tap approval of keeper-prepared splits. Supports both single income
 * and batch "Split All" (array of PendingSplits processed sequentially).
 */
export function AutoSplitConfirm() {
  const nav = useNavigate();
  const { state } = useLocation();

  // Normalize: single PendingSplit or PendingSplit[]
  const allPending: PendingSplit[] = useMemo(() => {
    if (!state) return [];
    if (Array.isArray(state)) return state as PendingSplit[];
    return [state as PendingSplit];
  }, [state]);

  const isBatch = allPending.length > 1;
  const totalAmount = useMemo(
    () => allPending.reduce((s, p) => s + Number(p.amount), 0),
    [allPending],
  );

  const { address, buckets, investAsset, applySplit, applyInvestConversion, showToast } = useShunt();
  const investLabel = investAsset === "GOLD" ? "Invest → Gold (XAUm)" : "Invest → XLM (DCA)";
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [doneHashes, setDoneHashes] = useState<string[]>([]);
  const [progress, setProgress] = useState(0); // 0-based index during batch

  const investAmt = useMemo(() => {
    const pct = buckets.find((b) => b.id === "invest")?.pct ?? 0;
    return (totalAmount * pct) / 100;
  }, [totalAmount, buckets]);

  const rows = useMemo(() => {
    const pct = (id: string) => buckets.find((b) => b.id === id)?.pct ?? 0;
    const savings = (totalAmount * pct("savings")) / 100;
    const buffer = (totalAmount * pct("buffer")) / 100;
    const invest = (totalAmount * pct("invest")) / 100;
    const out = [
      { id: "needs", label: "Needs → wallet", amt: totalAmount - savings - buffer - invest },
      { id: "savings", label: "Savings → vault (timelock)", amt: savings },
      { id: "buffer", label: "Buffer → wallet", amt: buffer },
    ];
    if (invest > 0) out.push({ id: "invest", label: investLabel, amt: invest });
    return out;
  }, [totalAmount, buckets, investLabel]);

  /**
   * F12: convert the invest slice after the split.
   */
  async function runInvestConversion(splitAmount: number, splitWasOnChain: boolean) {
    const pct = buckets.find((b) => b.id === "invest")?.pct ?? 0;
    const thisInvestAmt = (splitAmount * pct) / 100;
    if (thisInvestAmt <= 0) return;

    if (investAsset === "GOLD") {
      const { rate } = await getGoldUsdRate();
      const grams = thisInvestAmt / rate;
      applyInvestConversion(thisInvestAmt, grams, undefined, true);
      return;
    }

    const { rate, stale } = await getXlmUsdRate();
    const estXlm = thisInvestAmt / rate;
    if (splitWasOnChain && address) {
      try {
        const minXlm = (estXlm * 0.95).toFixed(7);
        const hash = await convertUsdcToXlm(address, thisInvestAmt.toFixed(7), minXlm);
        applyInvestConversion(thisInvestAmt, estXlm, hash, false);
        return;
      } catch {
        // fall through to simulation
      }
    }
    applyInvestConversion(thisInvestAmt, estXlm, undefined, true);
  }

  async function onApprove() {
    setBusy(true);
    setErr(null);
    const hashes: string[] = [];

    try {
      for (let i = 0; i < allPending.length; i++) {
        setProgress(i);
        const p = allPending[i];
        const amt = Number(p.amount);

        if (!p.xdr) {
          throw new Error(`Missing prepared XDR for split #${i + 1}. Ensure Vault contract is deployed and Keeper is running.`);
        }

        const hash = await signAndSubmitXdr(p.xdr);
        await markComplete(p.txHash);
        applySplit(amt, hash);
        await runInvestConversion(amt, true);
        hashes.push(hash);
      }

      setDoneHashes(hashes);
      showToast(
        isBatch
          ? `All ${allPending.length} incomes split — ${fmtUsdc(totalAmount)} USDC routed`
          : "Income landed — auto-split complete",
      );
    } catch (e) {
      const formatted = formatError(e);
      if (formatted) setErr(formatted);
      // Still save any hashes that succeeded
      if (hashes.length > 0) setDoneHashes(hashes);
    } finally {
      setBusy(false);
    }
  }

  const done = doneHashes.length > 0;

  return (
    <div className="screen" style={{ justifyContent: "center", minHeight: "100dvh", textAlign: "center" }}>
      <h2 style={{ margin: 0 }}>
        {done
          ? (doneHashes.length === allPending.length ? "All splits complete" : `${doneHashes.length}/${allPending.length} splits complete`)
          : isBatch
            ? `${allPending.length} incomes landed`
            : "Income landed"}
      </h2>
      <motion.div
        className="numeric"
        style={{ fontSize: 36, fontWeight: 700 }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
      >
        <AnimatedNumber value={totalAmount} decimals={2} /> <span style={{ fontSize: 18 }}>USDC</span>
      </motion.div>

      {isBatch && (
        <div className="muted" style={{ fontSize: 13 }}>
          {allPending.length} transactions combined · one approval flow
        </div>
      )}

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
        {isBatch ? `${allPending.length} atomic splits · ` : "Atomic split in a single transaction · "}
        sub-cent network fee
        {investAmt > 0 && (investAsset === "GOLD"
          ? " · invest slice earmarked for Gold (XAUm)"
          : " · invest slice converts via a follow-up path payment")}
      </p>

      {done ? (
        <>
          {doneHashes.map((h, i) => (
            <a
              key={h}
              href={EXPLORER_TX(h)}
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--color-accent-secondary)", fontSize: 13 }}
            >
              {isBatch ? `Split #${i + 1} ` : ""}View on explorer ↗
            </a>
          ))}
          <button className="btn-primary" onClick={() => nav("/home")}>
            Done
          </button>
        </>
      ) : (
        <button className="btn-primary" disabled={busy} onClick={onApprove}>
          {busy
            ? isBatch
              ? `Processing ${progress + 1} of ${allPending.length}…`
              : "Processing…"
            : isBatch
              ? `Approve all ${allPending.length} splits (1 flow)`
              : "Approve split (1 tap)"}
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

