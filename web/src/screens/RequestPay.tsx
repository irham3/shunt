import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "qrcode";
import { buildSep7Uri, buildShareLink } from "../lib/sep7";
import { useShunt } from "../store";

/**
 * F13 (payee side): create a payment request link from inside Shunt.
 * For crypto-capable clients, the SEP-7 link removes the manual wallet-address
 * and asset coordination. Card checkout for non-crypto payers is on the roadmap.
 */
export function RequestPay() {
  const { address, showToast } = useShunt();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [qr, setQr] = useState<string | null>(null);

  const req = address ? { to: address, amount: amount || undefined, note: note || undefined } : null;
  const sep7 = req ? buildSep7Uri(req) : "";
  const link = req ? buildShareLink(req) : "";

  useEffect(() => {
    if (!sep7) return;
    QRCode.toDataURL(sep7, { margin: 1, width: 220, color: { dark: "#0B0F14", light: "#F5F7FA" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [sep7]);

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copied`);
    } catch {
      showToast("Copy failed — long-press the text to copy manually");
    }
  }

  const waText = encodeURIComponent(
    `Hi! You can pay me${amount ? ` ${amount} USDC` : ""} here: ${link}`,
  );

  return (
    <div className="screen">
      <h2 style={{ margin: 0 }}>Request payment</h2>
      <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
        Send this link to your client — they pay in USDC, it lands in your wallet, and Shunt
        offers the one-tap split the moment it arrives.
      </p>

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <label className="muted" style={{ fontSize: 13 }}>
          Amount (USDC, optional)
          <input
            type="number"
            placeholder="500"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ marginTop: 6 }}
          />
        </label>
        <label className="muted" style={{ fontSize: 13 }}>
          Note (optional)
          <input
            type="text"
            placeholder="Invoice #42 — illustration work"
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ marginTop: 6 }}
          />
        </label>
      </div>

      <AnimatePresence>
        {qr && (
          <motion.div
            className="card"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ textAlign: "center" }}
          >
            <img src={qr} alt="SEP-7 payment QR" width={180} height={180} style={{ borderRadius: 12 }} />
            <p className="muted" style={{ fontSize: 12, margin: "8px 0 0" }}>
              Scannable by any SEP-7 Stellar wallet
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="muted" style={{ fontSize: 12 }}>Share link</div>
        <div className="numeric" style={{ fontSize: 12, wordBreak: "break-all" }}>{link}</div>
      </div>

      <button className="btn-primary" onClick={() => copy(link, "Payment link")}>
        Copy link
      </button>
      <div style={{ display: "flex", gap: 8 }}>
        <a
          className="btn-secondary"
          style={{ flex: 1, textAlign: "center", textDecoration: "none" }}
          href={`https://wa.me/?text=${waText}`}
          target="_blank"
          rel="noreferrer"
        >
          Share via WhatsApp
        </a>
        <button className="btn-secondary" style={{ flex: 1 }} onClick={() => copy(sep7, "SEP-7 URI")}>
          Copy wallet URI
        </button>
      </div>

      <p className="muted" style={{ fontSize: 12, margin: 0 }}>
        Your client pays from any Stellar wallet today. Card checkout for non-crypto clients is
        coming via an on-ramp partner — shown on the payer page as "coming soon", honestly.
      </p>
    </div>
  );
}
