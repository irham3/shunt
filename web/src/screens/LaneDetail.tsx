import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Wallet, ArrowUpRight, SlidersHorizontal, Clock, X } from "lucide-react";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { fmtUsdc, useShunt } from "../store";
import { vaultWithdrawBuffer } from "../lib/vault";
import {
  formatError, convertUsdcToXlm, quoteConversion, convertUsdcToAsset, quoteUsdcToAsset, DEMO_ASSETS,
  createScheduledPayment, cancelScheduledPayment, fetchScheduledPayments, type ScheduledPayment,
  USDC_CODE, USDC_ISSUER, hasTrustline, addTrustline,
} from "../lib/stellar";
import { Asset, StrKey } from "@stellar/stellar-sdk";
import { getGoldUsdRate } from "../lib/rates";

const TXAUM = DEMO_ASSETS.find((a) => a.code === "TXAUM");

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
        // Real testnet gold: if Shunt's own TXAUM demo asset has live
        // orderbook liquidity (scripts/issue-demo-assets.mjs), execute a
        // genuine path payment — same honesty pattern as XLM. Falls back to
        // the labeled reference-rate simulation only if that liquidity is
        // unavailable, never silently.
        const txaumQuote = TXAUM ? await quoteUsdcToAsset(new Asset(TXAUM.code, TXAUM.issuer), amount.toFixed(7)) : null;
        if (TXAUM && txaumQuote) {
          const txaumAsset = new Asset(TXAUM.code, TXAUM.issuer);
          // A path payment to self can't deliver an asset the account has
          // never held before — Stellar requires the trustline to already
          // exist. One extra signature, first time only (same two-step
          // honesty pattern as everywhere else a new trustline is needed).
          if (!(await hasTrustline(address, txaumAsset))) {
            await addTrustline(address, txaumAsset);
          }
          const minGold = (txaumQuote.amount * 0.98).toFixed(7);
          const hash = await convertUsdcToAsset(address, txaumAsset, amount.toFixed(7), minGold, txaumQuote.path);
          manualInvestBuy(amount, txaumQuote.amount, hash, false);
          showToast(`Bought ${txaumQuote.amount.toFixed(4)} TXAUM (testnet demo gold) for ${fmtUsdc(amount)} USDC`);
        } else {
          const { rate } = await getGoldUsdRate();
          const goldAmt = amount / rate;
          // Simulated purchase (no on-chain tx) — record without a tx hash so
          // Activity doesn't link to a nonexistent explorer page.
          manualInvestBuy(amount, goldAmt, undefined, true);
          showToast(`Bought ${goldAmt.toFixed(4)} g XAUm for ${fmtUsdc(amount)} USDC`);
        }
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
                {/* No lane-local shortcut here on purpose — the single
                    "Adjust allocation split" button at the bottom of this
                    page already goes to /shunt for every lane, including
                    this one's asset/% picker. A second button to the same
                    destination read as two unrelated actions. */}
              </div>

              <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8, opacity: 0.75 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Yield boost via Blend — not enabled</div>
                <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                  Blend Capital is a real lending protocol on Stellar (Soroban), and it's technically
                  possible to lend part of this lane's holdings there for interest. We're deliberately
                  <strong> not</strong> wiring it in: lending yield is interest (riba), which conflicts with
                  Shunt's sharia-conscious positioning (service fees only, everywhere else in the app) —
                  and it stacks smart-contract risk on top of an already-unaudited vault. If this ever
                  ships, it would be an explicit opt-in here in Invest, with its own disclaimer, never
                  silently blended into your default allocation, and never in Savings.
                </p>
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
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {/* Same off-ramp/convert as the Needs lane — Buffer is
                    wallet-side USDC too, no separate custody — but framed for
                    the "I need cash NOW" moment this lane exists for. */}
                <Link to="/send?tab=usdc" className="btn-primary" style={{ flex: 1, minWidth: 150, display: "inline-flex", alignItems: "center", justifyContent: "center" }} data-testid="buffer-emergency-offramp">
                  Emergency cash-out
                </Link>
                <Link to="/send?tab=convert" className="btn-secondary" style={{ flex: 1, minWidth: 150, display: "inline-flex", alignItems: "center", justifyContent: "center" }} data-testid="buffer-quick-convert">
                  Quick-convert
                </Link>
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

          {bucket.id === "needs" && address && <ScheduledBillPay address={address} showToast={showToast} />}

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

// ---------------------------------------------------------------------------
// Scheduled bill-pay — a native Stellar claimable balance with a future
// unlock date, standing in for "rent due the 1st" / "cicilan due the 15th".
// Honest framing: this still needs your signature right now (the funds leave
// the wallet today, into escrow); nothing signs itself later. What's
// scheduled is WHEN the recipient can claim, not an unattended payment.
// ---------------------------------------------------------------------------

function ScheduledBillPay({ address, showToast }: { address: string; showToast: (msg: string) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [asset, setAsset] = useState<"XLM" | "USDC">("USDC");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [payments, setPayments] = useState<ScheduledPayment[]>([]);
  const [loaded, setLoaded] = useState(false);

  function refresh() {
    fetchScheduledPayments(address).then((p) => {
      setPayments(p);
      setLoaded(true);
    });
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  async function onCreate() {
    setErr(null);
    if (!StrKey.isValidEd25519PublicKey(recipient.trim())) {
      setErr("Invalid destination address (must start with G…).");
      return;
    }
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setErr("Enter a valid amount.");
      return;
    }
    if (!dueDate) {
      setErr("Pick a due date.");
      return;
    }
    const unlockAt = Math.floor(new Date(dueDate).getTime() / 1000);
    if (unlockAt <= Date.now() / 1000) {
      setErr("Pick a date in the future.");
      return;
    }
    setBusy(true);
    try {
      const assetObj = asset === "XLM" ? Asset.native() : new Asset(USDC_CODE, USDC_ISSUER);
      await createScheduledPayment(address, recipient.trim(), assetObj, amt.toFixed(7), unlockAt);
      showToast(`Scheduled ${fmtUsdc(amt)} ${asset} for ${new Date(unlockAt * 1000).toLocaleDateString("en-US")}`);
      setRecipient("");
      setAmount("");
      setDueDate("");
      setShowForm(false);
      refresh();
    } catch (e) {
      const f = formatError(e);
      if (f) setErr(f);
    } finally {
      setBusy(false);
    }
  }

  async function onCancel(id: string) {
    try {
      await cancelScheduledPayment(address, id);
      showToast("Scheduled payment cancelled — funds returned to your wallet");
      refresh();
    } catch (e) {
      const f = formatError(e);
      if (f) showToast(f);
    }
  }

  const mine = payments.filter((p) => p.isSponsor);

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }} data-testid="scheduled-bill-pay">
      <div>
        <div style={{ fontWeight: 600, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
          <Clock size={16} /> Schedule a payment
        </div>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          Rent, cicilan — set money aside now for a bill due later. This still signs today (a native
          Stellar claimable balance, no custom contract): funds leave your wallet into escrow
          immediately, and your recipient can claim them only once the due date arrives. You can
          cancel and reclaim anytime before they do.
        </p>
      </div>

      {mine.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {mine.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 0", borderTop: "1px solid #1f2732" }}>
              <span style={{ fontSize: 13 }}>
                <span className="numeric">{Number(p.amount).toLocaleString("en-US", { maximumFractionDigits: 2 })} {p.asset}</span>
                {p.claimableAfter && (
                  <span className="muted"> · claimable {new Date(p.claimableAfter * 1000).toLocaleDateString("en-US")}</span>
                )}
              </span>
              <button className="chip" aria-label="Cancel scheduled payment" onClick={() => onCancel(p.id)} data-testid="cancel-scheduled-payment">
                <X size={13} /> Cancel
              </button>
            </div>
          ))}
        </div>
      )}
      {loaded && mine.length === 0 && !showForm && (
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>No scheduled payments yet.</p>
      )}

      {!showForm ? (
        <button className="btn-ghost" onClick={() => setShowForm(true)} data-testid="new-scheduled-payment">
          + Schedule a payment
        </button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, border: "1px solid var(--color-accent-primary)", borderRadius: 12, padding: 12 }}>
          <label className="muted" style={{ fontSize: 12 }}>
            Recipient (G…)
            <input type="text" placeholder="GABC…XYZ" value={recipient} onChange={(e) => setRecipient(e.target.value)} style={{ marginTop: 4 }} data-testid="schedule-recipient" />
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {(["USDC", "XLM"] as const).map((a) => (
              <button key={a} className={`chip${asset === a ? " active" : ""}`} onClick={() => setAsset(a)} style={{ flex: 1, justifyContent: "center", display: "flex" }}>
                {a}
              </button>
            ))}
          </div>
          <label className="muted" style={{ fontSize: 12 }}>
            Amount ({asset})
            <input type="number" min={0} step="any" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ marginTop: 4 }} data-testid="schedule-amount" />
          </label>
          <label className="muted" style={{ fontSize: 12 }}>
            Due date
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ marginTop: 4 }} data-testid="schedule-date" />
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-secondary" onClick={() => { setShowForm(false); setErr(null); }}>Cancel</button>
            <button className="btn-primary" disabled={busy} onClick={onCreate} data-testid="schedule-submit">
              {busy ? "Signing & submitting…" : "Schedule"}
            </button>
          </div>
        </div>
      )}
      {err && (
        <p role="alert" className="muted" style={{ fontSize: 12, margin: 0 }}>
          {err}
        </p>
      )}
    </div>
  );
}

