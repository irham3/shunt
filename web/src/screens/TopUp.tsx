import { useEffect, useState } from "react";
import { authenticate, startDeposit, ANCHOR_HOME_DOMAIN, ANCHOR_MIN_AMOUNT, ANCHOR_MAX_AMOUNT } from "../lib/anchor";
import { getIdrRate } from "../lib/rates";
import { fmtIdr, fmtUsdc, useShunt } from "../store";
import { formatError } from "../lib/stellar";

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

  useEffect(() => {
    getIdrRate().then((r) => setIdr(r.rate));
  }, []);

  const usdc = Number(amount) || 0;
  const fee = (usdc * FEE_PCT) / 100;
  const payIdr = (usdc + fee) * idr;

  async function onSubmit() {
    if (usdc <= 0) {
      setErr("Enter a valid amount.");
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
      const session = await startDeposit(address, jwt, "USDC", String(usdc));
      setAnchorUrl(session.url);
      window.open(session.url, "_blank", "noopener");
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

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
          Test anchor accepts {ANCHOR_MIN_AMOUNT}–{ANCHOR_MAX_AMOUNT} USDC per transaction.
        </span>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <span className="muted">Rate</span>
          <span className="numeric">1 USDC ≈ {fmtIdr(idr)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <span className="muted">On-ramp fee ({FEE_PCT}%)</span>
          <span className="numeric">{fmtUsdc(fee)} USDC</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
          <span>You pay</span>
          <span className="numeric" style={{ color: "var(--color-accent-primary)" }}>{fmtIdr(payIdr)}</span>
        </div>
      </div>

      <p className="muted" style={{ fontSize: 13, margin: 0 }}>
        Payment method and KYC are handled in the anchor's hosted flow. Settlement time is the
        anchor's — the incoming USDC shows up as detected income, ready for your one-tap split.
      </p>

      <button className="btn-primary" disabled={usdc <= 0 || busy} onClick={onSubmit}>
        {busy ? "Contacting anchor…" : "Top up"}
      </button>
      {err && (
        <p role="alert" style={{ color: "#ffb4ab", fontSize: 13 }}>
          {err}
        </p>
      )}
    </div>
  );
}
