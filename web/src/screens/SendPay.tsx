import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { ArrowDownUp } from "lucide-react";
import { authenticate, startWithdraw, ANCHOR_HOME_DOMAIN, ANCHOR_MIN_AMOUNT, ANCHOR_MAX_AMOUNT } from "../lib/anchor";
import { getIdrRate } from "../lib/rates";
import {
  sendXlmPayment,
  sendUsdcPayment,
  fetchXlmBalance,
  convertXlmToUsdc,
  convertUsdcToXlm,
  quoteConversion,
  addUsdcTrustline,
  type ConvertDirection,
  EXPLORER_TX,
  NETWORK,
  formatError,
} from "../lib/stellar";
import { fmtIdr, fmtUsdc, useShunt } from "../store";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { StrKey } from "@stellar/stellar-sdk";

const FEE_PCT = 0.4; // off-ramp fee (PRD §7b: 0.3–0.5%)

const DESTS = [
  { id: "bank", label: "Bank transfer", icon: "🏦" },
  { id: "ewallet", label: "E-wallet", icon: "📱" },
  { id: "bill", label: "Bills", icon: "🧾" },
];

type Tab = "usdc" | "xlm" | "convert";

/** Slippage floor for in-app conversions — quote minus 2%. */
const SLIPPAGE_PCT = 2;

/** F8/F10: off-ramp via SEP-24 anchor + XLM transfer (Level 1) + XLM ⇄ USDC convert. */
export function SendPay() {
  const {
    address, balances, xlmBalance, usdcBalance, usdcTrustline, refreshWallet,
    setXlmBalance, offramp, showToast, activity, recordXlmPayment, recordUsdcPayment, recordConversion,
  } = useShunt();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState<Tab>(
    initialTab === "convert" ? "convert" : initialTab === "usdc" ? "usdc" : "xlm",
  );
  const [dest, setDest] = useState("bank");
  const [amount, setAmount] = useState("");
  const [idr, setIdr] = useState(18000);
  const [submitted, setSubmitted] = useState<"anchor" | "local" | null>(null);
  const [anchorUrl, setAnchorUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Transfer state — user picks which asset (XLM or USDC) to send.
  const [sendAsset, setSendAsset] = useState<"XLM" | "USDC">("XLM");
  const [xlmDest, setXlmDest] = useState("");
  const [xlmAmount, setXlmAmount] = useState("");
  const [xlmResult, setXlmResult] = useState<{ hash: string; asset: string; amount: string; dest: string } | null>(null);
  const [xlmErr, setXlmErr] = useState<string | null>(null);
  const [xlmBusy, setXlmBusy] = useState(false);

  // Convert (XLM ⇄ USDC) state
  const [cvDirection, setCvDirection] = useState<ConvertDirection>("xlm-usdc");
  const [cvAmount, setCvAmount] = useState("");
  const [cvQuote, setCvQuote] = useState<number | null>(null);
  const [cvQuoting, setCvQuoting] = useState(false);
  const [cvBusy, setCvBusy] = useState(false);
  const [cvErr, setCvErr] = useState<string | null>(null);
  const [cvResult, setCvResult] = useState<{ hash: string; received: number } | null>(null);
  const [enablingUsdc, setEnablingUsdc] = useState(false);

  useEffect(() => {
    getIdrRate().then((r) => setIdr(r.rate));
  }, []);

  useEffect(() => {
    if (address) refreshWallet(address);
  }, [address, refreshWallet]);

  const usdc = Number(amount) || 0;
  const fee = (usdc * FEE_PCT) / 100;
  const receiveIdr = (usdc - fee) * idr;
  const walletUsdc = Number(usdcBalance ?? 0);

  // --- USDC off-ramp submit ---
  async function onSubmitUsdc() {
    // Validate against the real on-chain USDC balance — the Needs lane is
    // bookkeeping guidance, but the wallet is what actually pays the anchor.
    if (usdc <= 0 || usdc > walletUsdc) {
      setErr(`Invalid amount or exceeds your wallet USDC (${fmtUsdc(walletUsdc)} USDC on-chain).`);
      return;
    }
    if (usdc < ANCHOR_MIN_AMOUNT || usdc > ANCHOR_MAX_AMOUNT) {
      setErr(`The test anchor accepts ${ANCHOR_MIN_AMOUNT}–${ANCHOR_MAX_AMOUNT} USDC per transaction.`);
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      if (!address) throw new Error("No wallet connected.");
      const jwt = await authenticate(address);
      const session = await startWithdraw(address, jwt, "USDC", String(usdc));
      setAnchorUrl(session.url);
      window.open(session.url, "_blank", "noopener");
      offramp(usdc);
      setSubmitted("anchor");
      showToast("Withdrawal started at the anchor");
    } catch (e) {
      offramp(usdc);
      setSubmitted("local");
      const formatted = formatError(e);
      if (formatted) setErr(`Anchor flow unavailable (${formatted}) — recorded as a sketched request.`);
      showToast("Cash-out request submitted");
    } finally {
      setBusy(false);
    }
  }

  const transferBalance = sendAsset === "XLM" ? Number(xlmBalance ?? 0) : Number(usdcBalance ?? 0);

  // --- Transfer submit (XLM or USDC, user's choice) ---
  async function onSubmitTransfer() {
    setXlmErr(null);
    if (!address) { setXlmErr("No wallet connected."); return; }
    if (!StrKey.isValidEd25519PublicKey(xlmDest.trim())) {
      setXlmErr("Invalid destination address (must start with G…).");
      return;
    }
    const amt = Number(xlmAmount);
    if (isNaN(amt) || amt <= 0) { setXlmErr("Enter a valid amount."); return; }
    if (amt > transferBalance) { setXlmErr(`Exceeds your ${sendAsset} balance (${transferBalance.toLocaleString("en-US", { maximumFractionDigits: 2 })}).`); return; }
    if (sendAsset === "USDC" && !usdcTrustline) { setXlmErr("Enable USDC on your wallet first (add the trustline)."); return; }

    setXlmBusy(true);
    try {
      const dest = xlmDest.trim();
      const amountStr = xlmAmount.trim();
      const hash = sendAsset === "XLM"
        ? await sendXlmPayment(address, dest, amountStr)
        : await sendUsdcPayment(address, dest, amountStr);
      setXlmResult({ hash, asset: sendAsset, amount: amountStr, dest });
      if (sendAsset === "XLM") recordXlmPayment(dest, amountStr, hash);
      else recordUsdcPayment(dest, amountStr, hash);
      await refreshWallet(address);
      const bal = await fetchXlmBalance(address);
      setXlmBalance(bal);
      showToast(`${sendAsset} transaction confirmed!`);
    } catch (e) {
      const formatted = formatError(e);
      if (formatted) setXlmErr(sendAsset === "USDC" && /trustline|no.?trust|op_no_trust/i.test(formatted)
        ? "Recipient can't receive USDC — their wallet has no USDC trustline."
        : formatted);
    } finally {
      setXlmBusy(false);
    }
  }

  // --- Convert: live quote from Horizon strict-send pathfinding ---
  const cvFrom = cvDirection === "xlm-usdc" ? "XLM" : "USDC";
  const cvTo = cvDirection === "xlm-usdc" ? "USDC" : "XLM";
  const cvFromBalance = cvDirection === "xlm-usdc" ? Number(xlmBalance ?? 0) : walletUsdc;

  useEffect(() => {
    const amt = Number(cvAmount);
    if (!amt || amt <= 0) {
      setCvQuote(null);
      return;
    }
    setCvQuoting(true);
    const t = setTimeout(async () => {
      const q = await quoteConversion(cvDirection, amt.toFixed(7));
      setCvQuote(q);
      setCvQuoting(false);
    }, 400); // debounce typing before hitting Horizon
    return () => clearTimeout(t);
  }, [cvAmount, cvDirection]);

  async function onEnableUsdcForConvert() {
    if (!address) return;
    setEnablingUsdc(true);
    setCvErr(null);
    try {
      await addUsdcTrustline(address);
      await refreshWallet(address);
      showToast("USDC enabled — this wallet can now hold USDC");
    } catch (e) {
      const formatted = formatError(e);
      if (formatted) setCvErr(formatted);
    } finally {
      setEnablingUsdc(false);
    }
  }

  async function onSubmitConvert() {
    setCvErr(null);
    if (!address) { setCvErr("No wallet connected."); return; }
    const amt = Number(cvAmount);
    if (!amt || amt <= 0) { setCvErr("Enter a valid amount."); return; }
    if (amt > cvFromBalance) { setCvErr(`Exceeds your ${cvFrom} balance.`); return; }
    if (cvQuote === null) { setCvErr("No conversion path available right now — try again shortly."); return; }

    setCvBusy(true);
    try {
      const destMin = (cvQuote * (1 - SLIPPAGE_PCT / 100)).toFixed(7);
      const hash =
        cvDirection === "xlm-usdc"
          ? await convertXlmToUsdc(address, amt.toFixed(7), destMin)
          : await convertUsdcToXlm(address, amt.toFixed(7), destMin);
      recordConversion(cvFrom, amt, cvTo, cvQuote, hash);
      setCvResult({ hash, received: cvQuote });
      showToast(`Converted ${cvFrom} → ${cvTo} on the DEX`);
    } catch (e) {
      const formatted = formatError(e);
      if (formatted) setCvErr(formatted);
    } finally {
      setCvBusy(false);
    }
  }

  // --- Convert result ---
  if (cvResult) {
    return (
      <div className="screen" style={{ justifyContent: "center", textAlign: "center" }}>
        <div style={{ fontSize: 48 }}>⇄</div>
        <h2>Conversion Successful</h2>
        <p className="muted">
          Converted {cvAmount} {cvFrom} → ≈{" "}
          {cvResult.received.toLocaleString("en-US", { maximumFractionDigits: 2 })} {cvTo} via the
          Stellar DEX — no third party, settled on-chain.
        </p>
        <div className="card" style={{ textAlign: "left", wordBreak: "break-all" }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Transaction Hash</div>
          <div className="numeric" style={{ fontSize: 13 }}>{cvResult.hash}</div>
        </div>
        <a
          href={EXPLORER_TX(cvResult.hash)}
          target="_blank"
          rel="noreferrer"
          style={{ color: "var(--color-accent-secondary)" }}
        >
          View on Stellar Expert ↗
        </a>
        <button
          className="btn-primary"
          onClick={() => { setCvResult(null); setCvAmount(""); setCvQuote(null); }}
          data-testid="convert-again"
        >
          Convert another
        </button>
      </div>
    );
  }

  // --- USDC off-ramp result ---
  if (submitted) {
    return (
      <div className="screen" style={{ justifyContent: "center", textAlign: "center" }}>
        <div style={{ fontSize: 48 }}>⏳</div>
        <h2>Cash-out in progress</h2>
        <p className="muted">
          Request for {fmtUsdc(usdc)} USDC → {fmtIdr(receiveIdr)} sent to the anchor (
          {ANCHOR_HOME_DOMAIN}). Settlement time depends on the anchor & KYC — it is not
          instant, and that's normal.
        </p>
        {anchorUrl && (
          <a href={anchorUrl} target="_blank" rel="noreferrer" style={{ color: "var(--color-accent-secondary)" }}>
            Reopen the anchor's hosted flow ↗
          </a>
        )}
        <button className="btn-primary" onClick={() => { setSubmitted(null); setAnchorUrl(null); }}>
          Back
        </button>
      </div>
    );
  }

  // --- Transfer result ---
  if (xlmResult) {
    return (
      <div className="screen" style={{ justifyContent: "center", textAlign: "center" }}>
        <div style={{ fontSize: 48 }}>✅</div>
        <h2>Transaction Successful</h2>
        <p className="muted">
          Sent {xlmResult.amount} {xlmResult.asset} to {xlmResult.dest.slice(0, 8)}…{xlmResult.dest.slice(-6)}
        </p>
        <div className="card" style={{ textAlign: "left", wordBreak: "break-all" }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Transaction Hash</div>
          <div className="numeric" style={{ fontSize: 13 }}>{xlmResult.hash}</div>
        </div>
        <a
          href={EXPLORER_TX(xlmResult.hash)}
          target="_blank"
          rel="noreferrer"
          style={{ color: "var(--color-accent-secondary)" }}
        >
          View on Stellar Expert ↗
        </a>
        <button
          className="btn-primary"
          onClick={() => { setXlmResult(null); setXlmAmount(""); setXlmDest(""); }}
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <div className="screen">
      <h2 style={{ margin: 0 }}>Send & Pay</h2>

      {/* Tab switcher */}
      <div style={{ display: "flex", gap: 0, borderRadius: 12, overflow: "hidden", border: "1px solid #1f2732" }}>
        <button
          onClick={() => setTab("xlm")}
          style={{
            flex: 1, padding: "10px 0", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600,
            background: tab === "xlm" ? "var(--color-accent-secondary)" : "var(--color-bg-elevated)",
            color: tab === "xlm" ? "var(--color-text-on-accent)" : "var(--color-text-secondary)",
          }}
        >
          Transfer
        </button>
        <button
          onClick={() => setTab("convert")}
          data-testid="tab-convert"
          style={{
            flex: 1, padding: "10px 0", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600,
            background: tab === "convert" ? "var(--color-accent-primary)" : "var(--color-bg-elevated)",
            color: tab === "convert" ? "var(--color-text-on-accent)" : "var(--color-text-secondary)",
          }}
        >
          Convert
        </button>
        <button
          onClick={() => setTab("usdc")}
          style={{
            flex: 1, padding: "10px 0", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600,
            background: tab === "usdc" ? "var(--color-bucket-needs)" : "var(--color-bg-elevated)",
            color: tab === "usdc" ? "var(--color-text-on-accent)" : "var(--color-text-secondary)",
          }}
        >
          USDC Off-Ramp
        </button>
      </div>

      <AnimatePresence mode="wait">
      {/* ─── XLM Transfer Tab ─── */}
      {tab === "xlm" && (
        <motion.div key="xlm" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
          <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
            Send to another Stellar wallet on {NETWORK}. Choose which asset to pay with.
          </p>

          {/* Which money to send */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }} role="tablist" aria-label="Asset to send">
            {(["XLM", "USDC"] as const).map((a) => (
              <button
                key={a}
                className={`chip${sendAsset === a ? " active" : ""}`}
                style={{ flex: 1, justifyContent: "center", display: "flex" }}
                onClick={() => { setSendAsset(a); setXlmErr(null); }}
                data-testid={`send-asset-${a.toLowerCase()}`}
              >
                {a}
              </button>
            ))}
          </div>

          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span className="muted">Your {sendAsset} balance</span>
              <span className="numeric">{transferBalance.toLocaleString("en-US", { maximumFractionDigits: 2 })} {sendAsset}</span>
            </div>
            <label className="muted" style={{ fontSize: 13 }}>
              Destination (G…)
              <input
                type="text"
                placeholder="GABC…XYZ"
                value={xlmDest}
                onChange={(e) => setXlmDest(e.target.value)}
                style={{ marginTop: 6 }}
              />
            </label>
            <label className="muted" style={{ fontSize: 13 }}>
              Amount ({sendAsset})
              <input
                type="number"
                placeholder="0"
                min={0}
                step="any"
                value={xlmAmount}
                onChange={(e) => setXlmAmount(e.target.value)}
                style={{ marginTop: 6 }}
                data-testid="send-amount"
              />
            </label>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span className="muted">Network fee</span>
              <span className="numeric">~0.00001 XLM</span>
            </div>
            {sendAsset === "USDC" && (
              <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                The recipient needs a USDC trustline to receive it.
              </p>
            )}
          </div>

          <button className="btn-primary" disabled={xlmBusy || !xlmAmount || !xlmDest} onClick={onSubmitTransfer}>
            {xlmBusy ? "Signing & submitting…" : `Send ${sendAsset}`}
          </button>
          {xlmErr && (
            <p role="alert" style={{ color: "#ffb4ab", fontSize: 13 }}>
              {xlmErr}
            </p>
          )}
        </motion.div>
      )}

      {/* ─── Convert Tab: XLM ⇄ USDC via the DEX, no third party ─── */}
      {tab === "convert" && (
        <motion.div key="convert" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
          <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
            Swap between XLM and USDC directly on the Stellar DEX — one signature, settled in
            seconds, sub-cent fee. No third party.
          </p>

          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label className="muted" style={{ fontSize: 13 }}>
              You pay ({cvFrom}) — balance:{" "}
              <span className="numeric">
                {cvFromBalance.toLocaleString("en-US", { maximumFractionDigits: 2 })} {cvFrom}
              </span>
              <input
                type="number"
                placeholder="0"
                min={0}
                step="any"
                value={cvAmount}
                onChange={(e) => setCvAmount(e.target.value)}
                style={{ marginTop: 6 }}
                aria-label={`Amount in ${cvFrom}`}
                data-testid="convert-amount"
              />
            </label>

            <button
              className="chip"
              onClick={() => { setCvDirection(cvDirection === "xlm-usdc" ? "usdc-xlm" : "xlm-usdc"); setCvQuote(null); }}
              aria-label="Switch conversion direction"
              data-testid="convert-switch"
              style={{ alignSelf: "center", display: "flex", alignItems: "center", gap: 6 }}
            >
              <ArrowDownUp size={14} /> {cvFrom} → {cvTo}
            </button>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span className="muted">You receive (est.)</span>
              <span className="numeric" data-testid="convert-quote">
                {cvQuoting
                  ? "Fetching quote…"
                  : cvQuote !== null
                    ? `≈ ${cvQuote.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${cvTo}`
                    : Number(cvAmount) > 0
                      ? "No path available"
                      : "—"}
              </span>
            </div>
            {cvQuote !== null && Number(cvAmount) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span className="muted">Rate · min. received ({SLIPPAGE_PCT}% slippage)</span>
                <span className="numeric">
                  1 {cvFrom} ≈ {(cvQuote / Number(cvAmount)).toLocaleString("en-US", { maximumFractionDigits: 4 })} {cvTo} ·{" "}
                  {(cvQuote * (1 - SLIPPAGE_PCT / 100)).toLocaleString("en-US", { maximumFractionDigits: 4 })}
                </span>
              </div>
            )}
          </div>

          {cvDirection === "xlm-usdc" && !usdcTrustline ? (
            <button className="btn-secondary" disabled={enablingUsdc} onClick={onEnableUsdcForConvert} style={{ marginTop: 12 }}>
              {enablingUsdc ? "Confirm in wallet…" : "Enable USDC first (add trustline)"}
            </button>
          ) : (
            <button
              className="btn-primary"
              style={{ marginTop: 12 }}
              disabled={cvBusy || cvQuoting || !cvAmount || cvQuote === null}
              onClick={onSubmitConvert}
              data-testid="convert-submit"
            >
              {cvBusy ? "Signing & submitting…" : `Convert ${cvFrom} → ${cvTo}`}
            </button>
          )}
          <p className="muted" style={{ fontSize: 12, margin: "8px 0 0" }}>
            Executed as a path payment through the on-chain orderbook/AMM. The rate above is a live
            quote — the transaction is protected by the minimum-received floor.
          </p>
          {cvErr && (
            <p role="alert" style={{ color: "#ffb4ab", fontSize: 13 }}>
              {cvErr}
            </p>
          )}
        </motion.div>
      )}

      {/* ─── USDC Off-Ramp Tab ─── */}
      {tab === "usdc" && (
        <motion.div key="usdc" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
          <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
            Cash out to your bank — wallet holds{" "}
            <AnimatedNumber value={walletUsdc} decimals={2} /> USDC on-chain
            (Needs lane: {fmtUsdc(balances.needs)} USDC).
          </p>

          <div style={{ display: "flex", gap: 8 }}>
            {DESTS.map((d) => (
              <button
                key={d.id}
                className="card"
                onClick={() => setDest(d.id)}
                style={{
                  flex: 1,
                  textAlign: "center",
                  border: dest === d.id ? "1px solid var(--color-accent-primary)" : "1px solid transparent",
                }}
              >
                <div style={{ fontSize: 26 }}>{d.icon}</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>{d.label}</div>
              </button>
            ))}
          </div>

          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label className="muted" style={{ fontSize: 13 }}>
              Amount (USDC)
              <input
                type="number"
                placeholder="0"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ marginTop: 6 }}
              />
            </label>
            <span className="muted" style={{ fontSize: 12 }}>
              Test anchor accepts {ANCHOR_MIN_AMOUNT}–{ANCHOR_MAX_AMOUNT} USDC per transaction.
            </span>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span className="muted">Rate</span>
              <span className="numeric">1 USDC ≈ {fmtIdr(idr)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span className="muted">Off-ramp fee ({FEE_PCT}%)</span>
              <span className="numeric"><AnimatedNumber value={fee} decimals={4} /> USDC</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
              <span>You receive</span>
              <span className="numeric" style={{ color: "var(--color-accent-primary)" }}>{fmtIdr(receiveIdr)}</span>
            </div>
          </div>

          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            Sent via anchor — rate & fees shown before you confirm. Bank details are entered in the
            anchor's hosted flow (KYC); the anchor address itself is locked by the on-chain allowlist.
          </p>

          {/* Gate on the balance actually being loaded — clicking against a
              not-yet-fetched balance would reject honest amounts as "exceeds". */}
          <button className="btn-primary" disabled={usdc <= 0 || busy || usdcBalance === null} onClick={onSubmitUsdc}>
            {busy ? "Contacting anchor…" : usdcBalance === null ? "Loading balance…" : "Continue"}
          </button>
          {err && (
            <p role="alert" style={{ color: "#ffb4ab", fontSize: 13 }}>
              {err}
            </p>
          )}
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}

