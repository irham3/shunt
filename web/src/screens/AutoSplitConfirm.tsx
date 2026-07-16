import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { DonutChart } from "../components/DonutChart";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { markComplete, manualTrigger, type PendingSplit } from "../lib/keeper";
import { convertUsdcToXlm, quoteConversion, signAndSubmitXdr, EXPLORER_TX, formatError, convertUsdcToAsset, quoteUsdcToAsset, DEMO_ASSETS, hasTrustline, addTrustline } from "../lib/stellar";
import { Asset } from "@stellar/stellar-sdk";

const TXAUM = DEMO_ASSETS.find((a) => a.code === "TXAUM");
import { resolveRulesNotSet, vaultSetRules } from "../lib/vault";
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

  const { address, buckets, usdcBalance, investAsset, lockSecs, bufferTarget, refreshWallet, applySplit, applyInvestConversion, showToast } = useShunt();
  const [escalated, setEscalated] = useState<number | null>(null);
  const investLabel = investAsset === "GOLD" ? "Invest → TXAUM (DCA)" : "Invest → XLM (DCA)";

  // Pull a fresh on-chain USDC balance so the insufficient-funds pre-flight is
  // accurate even when the user lands here directly (not via Home's polling).
  useEffect(() => {
    if (address) refreshWallet(address);
  }, [address, refreshWallet]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [doneHashes, setDoneHashes] = useState<string[]>([]);
  const [progress, setProgress] = useState(0); // 0-based index during batch

  // Only the Savings slice actually leaves the wallet (into the vault); Needs,
  // Buffer and Invest stay put. So the wallet must hold at least the summed
  // savings share for the split(s) to succeed — otherwise the USDC contract
  // rejects the transfer (Contract #10). Guard here so we can say so up front
  // instead of letting the user sign a transaction that can't land.
  const walletUsdc = Number(usdcBalance ?? 0);
  const savingsToMove = useMemo(() => {
    const pct = buckets.filter((b) => b.kind === "savings").reduce((s, b) => s + b.pct, 0);
    return (totalAmount * pct) / 100;
  }, [totalAmount, buckets]);
  const insufficientForSavings = usdcBalance !== null && savingsToMove > walletUsdc + 1e-7;

  const investAmt = useMemo(() => {
    const pct = buckets.filter((b) => b.kind === "invest").reduce((s, b) => s + b.pct, 0);
    return (totalAmount * pct) / 100;
  }, [totalAmount, buckets]);

  const rows = useMemo(() => {
    // Show every bucket (including custom lanes) with its individual share.
    // Group label shows where the funds end up.
    const kindDest: Record<string, string> = {
      needs: "→ wallet",
      savings: "→ vault (timelock)",
      buffer: "→ wallet",
      invest: investLabel.replace("Invest ", ""),
    };
    return buckets
      .filter((b) => b.pct > 0)
      .map((b) => ({
        id: b.id,
        label: `${b.name} ${kindDest[b.kind] ?? "→ wallet"}`,
        amt: (totalAmount * b.pct) / 100,
      }));
  }, [totalAmount, buckets, investLabel]);

  /**
   * F12: convert the invest slice after the split.
   */
  async function runInvestConversion(splitAmount: number, splitWasOnChain: boolean) {
    const pct = buckets.filter((b) => b.kind === "invest").reduce((s, b) => s + b.pct, 0);
    const thisInvestAmt = (splitAmount * pct) / 100;
    if (thisInvestAmt <= 0) return;

    if (investAsset === "GOLD") {
      // Real testnet gold via Shunt's own TXAUM demo asset (real liquidity —
      // see scripts/issue-demo-assets.mjs), same honesty pattern as XLM.
      // Falls back to the labeled reference-rate simulation only if that
      // liquidity is unavailable this cycle.
      if (splitWasOnChain && address && TXAUM) {
        try {
          const txaumAsset = new Asset(TXAUM.code, TXAUM.issuer);
          const quote = await quoteUsdcToAsset(txaumAsset, thisInvestAmt.toFixed(7));
          if (quote) {
            // First-time trustline, same as the manual-buy path — a path
            // payment to self can't deliver an asset never held before.
            if (!(await hasTrustline(address, txaumAsset))) {
              await addTrustline(address, txaumAsset);
            }
            const minGold = (quote.amount * 0.95).toFixed(7);
            const hash = await convertUsdcToAsset(address, txaumAsset, thisInvestAmt.toFixed(7), minGold, quote.path);
            applyInvestConversion(thisInvestAmt, quote.amount, hash, false);
            return;
          }
        } catch {
          // fall through to simulation
        }
      }
      const { rate } = await getGoldUsdRate();
      const grams = thisInvestAmt / rate;
      applyInvestConversion(thisInvestAmt, grams, undefined, true);
      return;
    }

    if (splitWasOnChain && address) {
      try {
        // Live DEX quote sizes both the expected amount and the slippage
        // floor — the CoinGecko rate tracks mainnet and made testnet path
        // payments fail with op_under_dest_min every time.
        const quote = await quoteConversion("usdc-xlm", thisInvestAmt.toFixed(7));
        if (quote) {
          const minXlm = (quote.amount * 0.95).toFixed(7);
          const hash = await convertUsdcToXlm(address, thisInvestAmt.toFixed(7), minXlm, quote.path);
          applyInvestConversion(thisInvestAmt, quote.amount, hash, false);
          return;
        }
      } catch {
        // fall through to simulation
      }
    }
    const { rate } = await getXlmUsdRate();
    applyInvestConversion(thisInvestAmt, thisInvestAmt / rate, undefined, true);
  }

  async function onApprove() {
    // Pre-flight: don't prompt the wallet for a split whose savings slice the
    // wallet can't cover — it would fail on-chain anyway (USDC Contract #10).
    if (insufficientForSavings) {
      setErr(
        `This split moves ${fmtUsdc(savingsToMove)} USDC into the savings vault, ` +
        `but your wallet only holds ${fmtUsdc(walletUsdc)} USDC. ` +
        `Split income you actually hold, or top up first.`,
      );
      return;
    }
    setBusy(true);
    setErr(null);
    const hashes: string[] = [];

    try {
      for (let i = 0; i < allPending.length; i++) {
        setProgress(i);
        const p = allPending[i];
        const amt = Number(p.amount);

        // The keeper may have handed us a stale entry with no prepared XDR
        // (e.g. it was detected before rules were saved on-chain, so the
        // simulation failed and got cached). Ask it to rebuild once before
        // giving up — the keeper now retries null-XDR entries.
        let xdr = p.xdr;
        let buildError = p.error;
        if (!xdr) {
          const rebuilt = await manualTrigger(p.account, p.amount, p.txHash);
          if (rebuilt?.xdr) {
            xdr = rebuilt.xdr;
          } else if (rebuilt?.error) {
            buildError = rebuilt.error;
          }
        }

        if (!xdr) {
          // Error #3 = RulesNotSet. Don't trust the keeper's simulation alone —
          // it can transiently read a lagging RPC replica right after a fresh
          // save. Confirm with a direct get_rules read before resetting local
          // state and telling the user their rules are actually gone.
          if (buildError && (buildError.includes("#3") || buildError.includes("RulesNotSet"))) {
            const { reallyMissing, message } = await resolveRulesNotSet(p.account);
            if (reallyMissing) useShunt.setState({ rulesSavedOnChain: false });
            throw new Error(reallyMissing ? `${message} Go to Configure Shunt and save your rules again.` : message);
          }
          const friendly = buildError ? formatError(buildError) : "";
          const reason = friendly
            ? `Couldn't prepare the split: ${friendly}`
            : "Couldn't prepare the split. Save your Shunt rules on-chain, then try again — and make sure the keeper is reachable.";
          throw new Error(reason);
        }

        const hash = await signAndSubmitXdr(xdr);
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

      // Opt-in behavioral nudge: bump Savings % on the configured cadence.
      // This is a REAL follow-up set_rules call, never silent — shown below.
      if (address) {
        const newPct = useShunt.getState().maybeEscalateSavings();
        if (newPct !== null) {
          try {
            const nowBuckets = useShunt.getState().buckets;
            const pctKind = (kind: string) => nowBuckets.filter((b) => b.kind === kind).reduce((s, b) => s + b.pct, 0);
            await vaultSetRules(
              address,
              pctKind("needs") + pctKind("invest"),
              pctKind("savings"),
              pctKind("buffer"),
              lockSecs,
              [],
              bufferTarget,
            );
            setEscalated(newPct);
          } catch {
            // Non-critical nudge — the split itself already succeeded. Roll
            // the local bucket change back so it isn't shown as saved when
            // it isn't, and try again next cycle instead of leaving a
            // client/chain mismatch.
            useShunt.getState().syncFromChain(address);
          }
        }
      }
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
          ? " · invest slice earmarked for TXAUM"
          : " · invest slice converts via a follow-up path payment")}
      </p>

      {!done && insufficientForSavings && (
        <p role="alert" style={{ color: "#ffb4ab", fontSize: 13, margin: 0 }} data-testid="insufficient-usdc-warning">
          Your wallet holds {fmtUsdc(walletUsdc)} USDC, but this split needs to move{" "}
          {fmtUsdc(savingsToMove)} USDC into the savings vault. Split income you actually
          hold, or top up your wallet first.
        </p>
      )}

      {escalated !== null && (
        <p className="muted" style={{ fontSize: 13, margin: 0, color: "var(--color-accent-primary)" }} data-testid="auto-escalate-notice">
          Auto-increase: Savings bumped to {escalated}% — saved on-chain for next time.
        </p>
      )}

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
        <button className="btn-primary" disabled={busy || insufficientForSavings} onClick={onApprove}>
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

