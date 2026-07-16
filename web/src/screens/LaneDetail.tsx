import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Wallet, ArrowUpRight, SlidersHorizontal } from "lucide-react";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { fmtUsdc, useShunt } from "../store";
import { vaultWithdrawBuffer } from "../lib/vault";
import { formatError, convertUsdcToXlm, quoteConversion } from "../lib/stellar";
import { getGoldUsdRate } from "../lib/rates";

/**
 * Per-lane detail (`/lane/:id`). Full-page layout matching SavingsVault —
 * two-column on desktop, stacked on mobile. Shows holdings, lane-specific
 * actions, and this lane's activity. Savings redirects to `/savings`.
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
    usdcBalance, activity, showToast, syncFromChain, refreshWallet,
    manualInvestBuy, withdrawBufferCredit,
  } = useShunt();
  const [busy, setBusy] = useState(false);
  const [buyAmount, setBuyAmount] = useState("");
  const [buying, setBuying] = useState(false);

  const bucket = buckets.find((b) => b.id === id);

  // Sync from chain on mount
  useEffect(() => {
    if (address) {
      syncFromChain(address);
      refreshWallet(address);
    }
  }, [address, syncFromChain, refreshWallet]);

  const kindTotal = bucket ? balances[bucket.kind as keyof typeof balances] || 0 : 0;
  const kindPct = buckets.filter((x) => x.kind === bucket?.kind).reduce((s, x) => s + x.pct, 0);
  const balance = kindPct > 0 && bucket ? kindTotal * (bucket.pct / kindPct) : 0;

  const laneActivity = useMemo(
    () => activity.filter((a) => a.bucket === id || (id === "invest" && a.kind === "invest")).slice(0, 10),
    [activity, id],
  );

  async function onWithdrawBuffer() {
    if (!address || bufferCredit <= 0) return;
    setBusy(true);
    try {
      await vaultWithdrawBuffer(address, bufferCredit);
      // Records activity, credits the Buffer lane bookkeeping, re-syncs.
      withdrawBufferCredit(bufferCredit);
      showToast("Buffer credit withdrawn to your wallet");
    } catch (e) {
      const f = formatError(e);
      if (f) showToast(f);
    } finally {
      setBusy(false);
    }
  }

  // The wallet is what actually pays — validate against the on-chain USDC
  // balance, not the Needs-lane bookkeeping (stale/zero on a fresh device,
  // which left the Buy button dead even with a funded wallet).
  const walletUsdc = Number(usdcBalance ?? 0);

  async function onManualBuy() {
    const amount = Number(buyAmount);
    if (!address || amount <= 0 || amount > walletUsdc) return;
    setBuying(true);
    try {
      if (investAsset === "GOLD") {
        const { rate } = await getGoldUsdRate();
        const goldAmt = amount / rate;
        // Simulated purchase (no on-chain tx) — record without a tx hash so
        // Activity doesn't link to a nonexistent explorer page.
        manualInvestBuy(amount, goldAmt, undefined, true);
        showToast(`Bought ${goldAmt.toFixed(4)} g XAUm for ${fmtUsdc(amount)} USDC`);
      } else {
        // Size the slippage floor from a LIVE DEX quote — the CoinGecko
        // display rate reflects mainnet and can sit far above the testnet
        // book, which made every real purchase fail with op_under_dest_min.
        const quote = await quoteConversion("usdc-xlm", amount.toFixed(7));
        if (!quote) throw new Error("No USDC → XLM path on the DEX right now — try again later.");
        const minXlm = (quote.amount * 0.98).toFixed(7);
        const hash = await convertUsdcToXlm(address, amount.toFixed(7), minXlm, quote.path);
        manualInvestBuy(amount, quote.amount, hash, false);
        showToast(`Bought ≈${quote.amount.toLocaleString("en-US", { maximumFractionDigits: 2 })} XLM for ${fmtUsdc(amount)} USDC`);
      }
      setBuyAmount("");
    } catch (e) {
      const f = formatError(e);
      if (f) showToast(`Purchase failed: ${f}`);
    } finally {
      setBuying(false);
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
    <div className="screen screen-wide">
      <header>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ width: 48, height: 48, borderRadius: 14, background: bucket.color, display: "grid", placeItems: "center", color: "var(--color-text-on-accent)", flexShrink: 0 }}>
            {icon}
          </span>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 24 }}>{bucket.name}</h2>
            <p className="muted" style={{ margin: "2px 0 0", fontSize: 14 }}>
              {bucket.pct}% of each income · {laneNote(bucket.kind)}
            </p>
          </div>
        </div>
      </header>

      <div className="split-cols">
        <div className="col-main">
          {/* Holdings card */}
          <motion.div className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>Lane balance</div>
            <div className="numeric" style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.1 }}>
              <AnimatedNumber value={balance} decimals={2} /> <span style={{ fontSize: 18, color: "var(--color-text-secondary)" }}>USDC</span>
            </div>
            {bucket.kind === "invest" && investXlm > 0 && (
              <div className="muted" style={{ fontSize: 14, marginTop: 8 }}>
                ≈ <span className="numeric">{investXlm.toLocaleString("en-US", { maximumFractionDigits: 4 })}</span> {investAsset === "GOLD" ? "grams of gold (XAUm)" : "XLM"} held
                {balance > 0 && <> · avg cost <span className="numeric">{fmtUsdc(balance / investXlm)}</span> USDC/{investAsset === "GOLD" ? "g" : "XLM"}</>}
              </div>
            )}
            {bucket.kind === "buffer" && bufferCredit > 0 && (
              <div style={{ marginTop: 12, borderTop: "1px solid #1f2732", paddingTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 8 }}>
                  <span className="muted">Buffer credit in vault</span>
                  <span className="numeric"><AnimatedNumber value={bufferCredit} decimals={2} /> USDC</span>
                </div>
                <button className="btn-primary" disabled={busy} onClick={onWithdrawBuffer} data-testid="lane-withdraw-buffer">
                  {busy ? "Confirm in wallet…" : `Withdraw ${fmtUsdc(bufferCredit)} USDC to wallet`}
                </button>
              </div>
            )}
          </motion.div>

          {/* Kind-specific explainer + actions */}
          {bucket.kind === "invest" && (
            <>
              <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Buy {investAsset === "GOLD" ? "Gold (XAUm)" : "XLM"} Manually</div>
                  <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
                    Spend your wallet USDC ({fmtUsdc(walletUsdc)} available) to buy more {investAsset === "GOLD" ? "gold" : "XLM"} right now.
                  </p>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <div style={{ flex: 1 }}>
                      <label className="muted" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Amount (USDC)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        max={walletUsdc}
                        value={buyAmount}
                        onChange={(e) => setBuyAmount(e.target.value)}
                        placeholder="0.00"
                        data-testid="lane-buy-amount"
                      />
                    </div>
                    <button
                      className="btn-primary"
                      style={{ width: "auto", flexShrink: 0 }}
                      disabled={buying || !buyAmount || Number(buyAmount) <= 0 || Number(buyAmount) > walletUsdc || usdcBalance === null}
                      onClick={onManualBuy}
                      data-testid="lane-buy-submit"
                    >
                      {buying ? "Processing…" : "Buy"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Your growth slice (Auto-DCA)</div>
                  <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                    {investXlm > 0
                      ? `Spot-purchased into ${investAsset === "GOLD" ? "gold (XAUm — 1 token = 1g LBMA gold)" : "XLM"} after each split. This is an asset purchase, not a yield product — and it's separate from your value-preserving Savings.`
                      : "Nothing invested yet. Turn on the Invest lane (set a %) in your rules and pick XLM or gold — the slice buys in automatically after each split."}
                  </p>
                </div>
                <Link to="/shunt" className="btn-secondary" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  Change auto-invest asset or %
                </Link>
              </div>
            </>
          )}

          {bucket.kind === "buffer" && (
            <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Emergency fund — instant access</div>
                <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                  No lock, no penalty. It also collects the 10% penalty from any early Savings withdrawal as <strong>buffer credit</strong> held in the vault.
                </p>
              </div>
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
                {/* Deep-link straight to the Off-Ramp tab — plain /send lands
                    on the Transfer tab, which is not what this button promises. */}
                <Link to="/send?tab=usdc" className="btn-primary" style={{ flex: 1, minWidth: 130, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
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

          {/* Re-allocation shortcut */}
          <Link to="/shunt" className="btn-ghost" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <SlidersHorizontal size={15} /> Adjust allocation split
          </Link>
        </div>

        {/* Activity sidebar */}
        <section className="col-side card">
          <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>{bucket.name} activity</h3>
          {laneActivity.length === 0 ? (
            <p className="muted" style={{ fontSize: 14, margin: 0 }}>
              Nothing here yet. Movements tied to this lane will show up after you split income.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {laneActivity.map((a, i) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  style={{ padding: "11px 0", borderBottom: i < laneActivity.length - 1 ? "1px solid var(--color-border-subtle)" : "none", display: "flex", justifyContent: "space-between", gap: 12 }}
                >
                  <span style={{ fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</span>
                  <span className="numeric muted" style={{ flexShrink: 0 }}>
                    {a.amountXlm !== undefined
                      ? `${a.amountXlm.toLocaleString("en-US", { maximumFractionDigits: 2 })} XLM`
                      : `${fmtUsdc(a.amountUsdc ?? 0)} USDC`}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

