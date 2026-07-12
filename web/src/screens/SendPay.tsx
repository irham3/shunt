import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { authenticate, startWithdraw, ANCHOR_HOME_DOMAIN, ANCHOR_MIN_AMOUNT, ANCHOR_MAX_AMOUNT } from "../lib/anchor";
import { getIdrRate } from "../lib/rates";
import { sendXlmPayment, fetchXlmBalance, EXPLORER_TX, NETWORK, formatError } from "../lib/stellar";
import { fmtIdr, fmtUsdc, useShunt } from "../store";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { StrKey } from "@stellar/stellar-sdk";

const FEE_PCT = 0.4; // off-ramp fee (PRD §7b: 0.3–0.5%)

const DESTS = [
  { id: "bank", label: "Bank transfer", icon: "🏦" },
  { id: "ewallet", label: "E-wallet", icon: "📱" },
  { id: "bill", label: "Bills", icon: "🧾" },
];

type Tab = "usdc" | "xlm";

/** F8/F10: off-ramp from the Needs lane via a SEP-24 anchor + XLM transfer (Level 1). */
export function SendPay() {
  const { address, balances, xlmBalance, setXlmBalance, offramp, showToast, activity, recordXlmPayment } = useShunt();
  const [tab, setTab] = useState<Tab>("xlm");
  const [dest, setDest] = useState("bank");
  const [amount, setAmount] = useState("");
  const [idr, setIdr] = useState(18000);
  const [submitted, setSubmitted] = useState<"anchor" | "local" | null>(null);
  const [anchorUrl, setAnchorUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // XLM send state
  const [xlmDest, setXlmDest] = useState("");
  const [xlmAmount, setXlmAmount] = useState("");
  const [xlmResult, setXlmResult] = useState<{ hash: string } | null>(null);
  const [xlmErr, setXlmErr] = useState<string | null>(null);
  const [xlmBusy, setXlmBusy] = useState(false);

  useEffect(() => {
    getIdrRate().then((r) => setIdr(r.rate));
  }, []);

  const usdc = Number(amount) || 0;
  const fee = (usdc * FEE_PCT) / 100;
  const receiveIdr = (usdc - fee) * idr;

  // --- USDC off-ramp submit ---
  async function onSubmitUsdc() {
    if (usdc <= 0 || usdc > balances.needs) {
      setErr("Invalid amount or exceeds Needs balance.");
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

  // --- XLM send submit ---
  async function onSubmitXlm() {
    setXlmErr(null);
    if (!address) { setXlmErr("No wallet connected."); return; }
    if (!StrKey.isValidEd25519PublicKey(xlmDest.trim())) {
      setXlmErr("Invalid destination address (must start with G…).");
      return;
    }
    const amt = Number(xlmAmount);
    if (isNaN(amt) || amt <= 0) { setXlmErr("Enter a valid amount."); return; }

    setXlmBusy(true);
    try {
      const hash = await sendXlmPayment(address, xlmDest.trim(), xlmAmount.trim());
      setXlmResult({ hash });
      recordXlmPayment(xlmDest.trim(), xlmAmount.trim(), hash);
      // Refresh XLM balance
      const bal = await fetchXlmBalance(address);
      setXlmBalance(bal);
      showToast("XLM transaction confirmed!");
    } catch (e) {
      const formatted = formatError(e);
      if (formatted) setXlmErr(formatted);
    } finally {
      setXlmBusy(false);
    }
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

  // --- XLM send result ---
  if (xlmResult) {
    return (
      <div className="screen" style={{ justifyContent: "center", textAlign: "center" }}>
        <div style={{ fontSize: 48 }}>✅</div>
        <h2>Transaction Successful</h2>
        <p className="muted">
          Sent {xlmAmount} XLM to {xlmDest.slice(0, 8)}…{xlmDest.slice(-6)}
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
          XLM Transfer
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
            Send native XLM on {NETWORK} — balance: {xlmBalance !== null ? `${Number(xlmBalance).toLocaleString("en-US", { maximumFractionDigits: 2 })} XLM` : "…"}
          </p>

          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
              Amount (XLM)
              <input
                type="number"
                placeholder="0"
                min={0}
                step="any"
                value={xlmAmount}
                onChange={(e) => setXlmAmount(e.target.value)}
                style={{ marginTop: 6 }}
              />
            </label>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span className="muted">Network fee</span>
              <span className="numeric">0.00001 XLM</span>
            </div>
          </div>

          <button className="btn-primary" disabled={xlmBusy || !xlmAmount || !xlmDest} onClick={onSubmitXlm}>
            {xlmBusy ? "Signing & submitting…" : "Send XLM"}
          </button>
          {xlmErr && (
            <p role="alert" style={{ color: "#ffb4ab", fontSize: 13 }}>
              {xlmErr}
            </p>
          )}
        </motion.div>
      )}

      {/* ─── USDC Off-Ramp Tab ─── */}
      {tab === "usdc" && (
        <motion.div key="usdc" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
          <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
            Cash out from the Needs bucket — balance $<AnimatedNumber value={balances.needs} decimals={2} />.
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

          <button className="btn-primary" disabled={usdc <= 0 || busy} onClick={onSubmitUsdc}>
            {busy ? "Contacting anchor…" : "Continue"}
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

