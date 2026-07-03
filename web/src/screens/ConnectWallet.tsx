import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { connectFreighter } from "../lib/stellar";
import { useShunt } from "../store";
import { StrKey } from "@stellar/stellar-sdk";

export function ConnectWallet() {
  const nav = useNavigate();
  const setAddress = useShunt((s) => s.setAddress);
  const [manual, setManual] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFreighter() {
    setBusy(true);
    setErr(null);
    try {
      const addr = await connectFreighter();
      setAddress(addr);
      nav("/shunt");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
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
    <div className="screen" style={{ justifyContent: "center", minHeight: "100dvh" }}>
      <h1 style={{ fontSize: 26, textAlign: "center" }}>Connect your wallet</h1>
      <p className="muted" style={{ textAlign: "center", marginTop: -8 }}>
        Non-custodial — your keys stay yours.
      </p>

      <button className="btn-primary" onClick={onFreighter} disabled={busy}>
        {busy ? "Connecting…" : "Connect Freighter"}
      </button>

      {!showManual ? (
        <button className="btn-ghost" onClick={() => setShowManual(true)}>
          Enter address manually
        </button>
      ) : (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            type="text"
            placeholder="G… Stellar address"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            aria-label="Stellar address"
          />
          <button className="btn-secondary" onClick={onManual}>
            Use this address (view mode)
          </button>
        </div>
      )}

      {err && (
        <p role="alert" style={{ color: "#ffb4ab", textAlign: "center" }}>
          {err}
        </p>
      )}

      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 12 }}>
        <span className="chip">✶ Stellar</span>
        <span className="chip">◎ USDC</span>
        <span className="chip">🔒 Non-custodial</span>
      </div>
    </div>
  );
}
