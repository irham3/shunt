import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import QRCode from "qrcode";
import { buildSep7Uri, parsePayQuery } from "../lib/sep7";
import { USDC_CODE } from "../lib/stellar";

/**
 * F13 (payer side): public landing for a Shunt payment request — no wallet
 * connection or Shunt account required to view it. Crypto-holding payers
 * open their SEP-7 wallet or scan the QR; card checkout is a labeled
 * roadmap item until an on-ramp partner integration is live.
 */
export function PayRequest() {
  const { search } = useLocation();
  const req = parsePayQuery(search);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const sep7 = req ? buildSep7Uri(req) : "";

  useEffect(() => {
    if (!sep7) return;
    QRCode.toDataURL(sep7, { margin: 1, width: 220, color: { dark: "#0B0F14", light: "#F5F7FA" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [sep7]);

  if (!req) {
    return (
      <div className="screen" style={{ justifyContent: "center", textAlign: "center" }}>
        <div style={{ fontSize: 48 }}>🔗</div>
        <h2>Invalid payment link</h2>
        <p className="muted">This link is missing its destination. Ask the sender for a fresh one.</p>
      </div>
    );
  }

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(req!.to);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // manual copy from the visible address below
    }
  }

  return (
    <div className="screen" style={{ justifyContent: "center", textAlign: "center" }}>
      <div style={{ fontFamily: "var(--font-heading)", fontSize: 22, fontWeight: 700 }}>⑃ Shunt</div>
      <h2 style={{ margin: 0 }}>Payment request</h2>

      <div className="card">
        {req.amount ? (
          <div className="numeric" style={{ fontSize: 36, fontWeight: 700 }}>
            {req.amount} <span style={{ fontSize: 18 }}>{USDC_CODE}</span>
          </div>
        ) : (
          <div className="muted">Amount: up to you</div>
        )}
        {req.note && <p className="muted" style={{ margin: "8px 0 0", fontSize: 14 }}>“{req.note}”</p>}
        <p className="muted" style={{ fontSize: 12, margin: "10px 0 0", wordBreak: "break-all" }}>
          To: <span className="numeric">{req.to}</span>
        </p>
      </div>

      {qr && (
        <div className="card" style={{ textAlign: "center" }}>
          <img src={qr} alt="SEP-7 payment QR" width={180} height={180} style={{ borderRadius: 12 }} />
          <p className="muted" style={{ fontSize: 12, margin: "8px 0 0" }}>
            Scan with any Stellar wallet
          </p>
        </div>
      )}

      <a className="btn-primary" style={{ textDecoration: "none", textAlign: "center" }} href={sep7}>
        Open in Stellar wallet
      </a>
      <button className="btn-secondary" onClick={copyAddress}>
        {copied ? "Address copied ✓" : "Copy address"}
      </button>
      <button className="btn-ghost" disabled title="On-ramp partner integration in progress">
        Pay with card — coming soon
      </button>

      <p className="muted" style={{ fontSize: 12, margin: 0 }}>
        Pay {USDC_CODE} on the Stellar network. The recipient's Shunt auto-splits it on arrival —
        savings locked, structure applied, one tap.
      </p>
    </div>
  );
}
