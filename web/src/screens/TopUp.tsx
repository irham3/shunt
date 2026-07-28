import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { authenticate, startDeposit, ANCHOR_HOME_DOMAIN, getAnchorInfo, AnchorAssetInfo } from "../lib/anchor";
import { getIdrRate } from "../lib/rates";
import { fmtIdr, fmtUsdc, useShunt } from "../store";
import { formatError } from "../lib/stellar";
import { AnimatedNumber } from "../components/AnimatedNumber";

const FEE_PCT = 0.35; // on-ramp fee (PRD §7b: 0.3–0.4%)

/** F11: on-ramp (Top Up) — SEP-24 hosted deposit, mirror of the off-ramp flow. */
export function TopUp() {
  const { address, recordTopUp, showToast } = useShunt();
  const [amount, setAmount] = useState("");
  const [idr, setIdr] = useState(18000);
  const [submitted, setSubmitted] = useState<"anchor" | "local" | null>(null);
  const [anchorUrl, setAnchorUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [limits, setLimits] = useState<AnchorAssetInfo | null>(null);

  useEffect(() => {
    getIdrRate().then((r) => setIdr(r.rate));
    getAnchorInfo("USDC").then(setLimits).catch(e => setErr(formatError(e)));
  }, []);

  const usdc = Number(amount) || 0;
  const fee = (usdc * FEE_PCT) / 100;
  const payIdr = (usdc + fee) * idr;

  async function onSubmit() {
    if (usdc <= 0) {
      setErr("Enter a valid amount.");
      return;
    }
    if (limits && (usdc < limits.minAmount || usdc > limits.maxAmount)) {
      setErr(`The test anchor accepts ${limits.minAmount}–${limits.maxAmount} USDC per transaction.`);
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      if (!address) throw new Error("No wallet connected.");
      const jwt = await authenticate(address);
      const session = await startDeposit(address, jwt, "USDC", String(usdc));
      setAnchorUrl(session.url);
      
      const width = 500, height = 700;
      const left = window.innerWidth / 2 - width / 2;
      const top = window.innerHeight / 2 - height / 2;
      const popup = window.open(
        session.url,
        "anchor_popup",
        `width=${width},height=${height},top=${top},left=${left}`
      );

      // Listen for popup close or completion messages
      const onMessage = (e: MessageEvent) => {
        // In a real integration, we'd check e.origin against ANCHOR_HOME_DOMAIN.
        if (e.data?.type === "close" || e.data?.type === "success") {
          window.removeEventListener("message", onMessage);
          if (popup) popup.close();
        }
      };
      window.addEventListener("message", onMessage);

      recordTopUp(usdc);
      setSubmitted("anchor");
      showToast("Top Up started at the anchor");
    } catch (e) {
      recordTopUp(usdc);
      setSubmitted("local");
      const formatted = formatError(e);
      if (formatted) setErr(`Anchor flow unavailable (${formatted}) — recorded as a sketched request.`);
      showToast("Top Up request submitted");
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <div className="screen" style={{ justifyContent: "center", textAlign: "center" }}>
        <div style={{ fontSize: 48 }}>⏳</div>
        <h2>Top Up in progress</h2>
        <p className="muted">
          Deposit request for {fmtUsdc(usdc)} USDC (≈ {fmtIdr(payIdr)}) sent to the anchor (
          {ANCHOR_HOME_DOMAIN}). Complete payment in the anchor's hosted flow — once the USDC
          lands in your wallet, Shunt detects it as income and offers the one-tap split.
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

  return (
    <div className="screen">
      <h2 style={{ margin: 0 }}>Top Up</h2>
      <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
        Fund your wallet with IDR through the anchor — it lands as USDC, without leaving Shunt.
      </p>

      {/* TODO [MoneyGram]: Uncomment MoneyGram disclosure once approved
      <div style={{ padding: "8px 12px", background: "var(--color-bg-elevated)", borderRadius: 6, fontSize: 12, marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
        <span>Powered by <b>MoneyGram</b></span>
      </div>
      */}

      <motion.div
        className="card"
        style={{ display: "flex", flexDirection: "column", gap: 10 }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <label className="muted" style={{ fontSize: 13 }}>
          Amount to receive (USDC)
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
          {limits ? `Test anchor accepts ${limits.minAmount}–${limits.maxAmount} USDC per transaction.` : "Fetching limits..."}
        </span>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <span className="muted">Rate</span>
          <span className="numeric">1 USDC ≈ {fmtIdr(idr)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <span className="muted">On-ramp fee ({FEE_PCT}%)</span>
          <span className="numeric"><AnimatedNumber value={fee} decimals={4} /> USDC</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
          <span>You pay</span>
          <span className="numeric" style={{ color: "var(--color-accent-primary)" }}>{fmtIdr(payIdr)}</span>
        </div>
      </motion.div>

      <p className="muted" style={{ fontSize: 13, margin: 0 }}>
        Payment method and KYC are handled in the anchor's hosted flow. Settlement time is the
        anchor's — the incoming USDC shows up as detected income, ready for your one-tap split.
      </p>

      <button className="btn-primary" disabled={usdc <= 0 || busy} onClick={onSubmit}>
        {busy ? "Contacting anchor…" : "Top up via Anchor"}
      </button>

      <div style={{ marginTop: 16, textAlign: "center", borderTop: "1px solid var(--color-border)", paddingTop: 16 }}>
        <span className="muted" style={{ fontSize: 13, display: "block", marginBottom: 8 }}>
          Need it instantly? Buy with card (Global)
        </span>
        <button 
          className="btn-secondary" 
          disabled={!address}
          style={{ width: "100%" }}
          onClick={() => {
            if (!address) return;
            // Production Transak URL for Stellar USDC
            const url = `https://global.transak.com/?cryptoCurrencyCode=USDC&network=stellar&walletAddress=${address}`;
            window.open(url, "_blank");
          }}
        >
          Buy USDC via Transak ↗
        </button>
      </div>

      {err && (
        <p role="alert" style={{ color: "#ffb4ab", fontSize: 13 }}>
          {err}
        </p>
      )}
    </div>
  );
}
