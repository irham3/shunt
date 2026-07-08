import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { connectWithAuthModal, formatError } from "../lib/stellar";
import { useShunt } from "../store";
import { StrKey } from "@stellar/stellar-sdk";
import { Loader2 } from "lucide-react";
import { AnimatedBackground } from "../components/AnimatedBackground";
import { ShinyText } from "../components/ShinyText";

export function ConnectWallet() {
  const nav = useNavigate();
  const setAddress = useShunt((s) => s.setAddress);

  const [manual, setManual] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onConnect() {
    setBusy(true);
    setErr(null);
    try {
      const addr = await connectWithAuthModal();
      setAddress(addr);
      nav("/shunt");
    } catch (e) {
      const formatted = formatError(e);
      if (formatted) setErr(formatted);
    } finally {
      setBusy(false);
    }
  }

  function onManual() {
    if (!StrKey.isValidEd25519PublicKey(manual.trim())) {
      setErr("Invalid Stellar address (must start with G...).");
      return;
    }
    setAddress(manual.trim());
    nav("/shunt");
  }

  return (
    <AnimatedBackground>
      <div className="screen" style={{ justifyContent: "center", minHeight: "100dvh", maxWidth: 420, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, textAlign: "center" }}>
          <ShinyText text="Connect your wallet" speed={3} />
        </h1>
        <p className="muted" style={{ textAlign: "center", marginTop: -8 }}>
          Non-custodial — your keys stay yours.
        </p>

        <button
          className="btn-primary"
          onClick={onConnect}
          disabled={busy}
          style={{ width: "100%", padding: "14px 0", fontSize: 16, display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}
        >
          {busy ? <><Loader2 className="animate-spin" size={18} /> Confirm in extension…</> : "Connect Wallet"}
        </button>
        <p className="muted" style={{ textAlign: "center", fontSize: 13, marginTop: 4 }}>
          Freighter · Albedo · xBull supported
        </p>

        {!showManual ? (
          <button className="btn-ghost" onClick={() => setShowManual(true)}>
            Enter address manually (view-only)
          </button>
        ) : (
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              type="text"
              placeholder="G… Stellar address"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              aria-label="Stellar address"
              style={{ width: "100%", boxSizing: "border-box" }}
            />
            <button className="btn-secondary" onClick={onManual}>
              Use this address (view mode)
            </button>
          </div>
        )}

        {err && (
          <p role="alert" style={{ color: "#ffb4ab", textAlign: "center", fontSize: 14 }}>
            {err}
          </p>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 12 }}>
          <span className="chip">✶ Stellar</span>
          <span className="chip">◎ USDC</span>
          <span className="chip">🔒 Non-custodial</span>
        </div>
      </div>
    </AnimatedBackground>
  );
}
