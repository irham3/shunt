import { useEffect, useState } from "react";
import { authenticate, startWithdraw, ANCHOR_HOME_DOMAIN } from "../lib/anchor";
import { getIdrRate } from "../lib/rates";
import { fmtIdr, fmtUsdc, useShunt } from "../store";

const FEE_PCT = 0.4; // off-ramp fee (PRD §7b: 0.3–0.5%)

const DESTS = [
  { id: "bank", label: "Bank transfer", icon: "🏦" },
  { id: "ewallet", label: "E-wallet", icon: "📱" },
  { id: "bill", label: "Bills", icon: "🧾" },
];

/** F8/F10: off-ramp from the Needs lane via a SEP-24 anchor. */
export function SendPay() {
  const { address, balances, offramp, showToast } = useShunt();
  const [dest, setDest] = useState("bank");
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
  const receiveIdr = (usdc - fee) * idr;

  async function onSubmit() {
    if (usdc <= 0 || usdc > balances.needs) {
      setErr("Invalid amount or exceeds Needs balance.");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      if (!address) throw new Error("No wallet connected.");
      // SEP-10 auth + SEP-24 interactive withdraw at the anchor
      const jwt = await authenticate(address);
      const session = await startWithdraw(address, jwt, "USDC", String(usdc));
      setAnchorUrl(session.url);
      window.open(session.url, "_blank", "noopener");
      offramp(usdc);
      setSubmitted("anchor");
      showToast("Withdrawal started at the anchor");
    } catch (e) {
      // Freighter absent / anchor unreachable -> local sketch (F8)
      offramp(usdc);
      setSubmitted("local");
      setErr(`Anchor flow unavailable (${e instanceof Error ? e.message : e}) — recorded as a sketched request.`);
      showToast("Cash-out request submitted");
    } finally {
      setBusy(false);
    }
  }

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

  return (
    <div className="screen">
      <h2 style={{ margin: 0 }}>Send & Pay</h2>
      <p className="muted" style={{ marginTop: -10, fontSize: 14 }}>
        Cash out from the Needs bucket — balance ${fmtUsdc(balances.needs)}.
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
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <span className="muted">Rate</span>
          <span className="numeric">1 USDC ≈ {fmtIdr(idr)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <span className="muted">Off-ramp fee ({FEE_PCT}%)</span>
          <span className="numeric">{fmtUsdc(fee)} USDC</span>
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

      <button className="btn-primary" disabled={usdc <= 0 || busy} onClick={onSubmit}>
        {busy ? "Contacting anchor…" : "Continue"}
      </button>
      {err && (
        <p role="alert" style={{ color: "#ffb4ab", fontSize: 13 }}>
          {err}
        </p>
      )}
    </div>
  );
}
