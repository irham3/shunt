import { useState } from "react";
import { motion } from "framer-motion";
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
      nav("/home");
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

  const EASE = [0.22, 1, 0.36, 1] as const;
  const rise = (delay = 0) => ({
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, ease: EASE, delay },
  });

  return (
    <AnimatedBackground aurora threads>
      <div className="screen" style={{ justifyContent: "center", minHeight: "100dvh", maxWidth: 440, margin: "0 auto" }}>
        <motion.div {...rise(0)} className="cw-card">
          <motion.span {...rise(0.05)} className="chip lp-chip-live" style={{ display: "inline-flex", alignItems: "center", gap: 8, alignSelf: "center" }}>
            <span className="lp-live-dot" /> Stellar testnet
          </motion.span>

          <motion.h1 {...rise(0.1)} style={{ fontSize: 30, textAlign: "center", margin: "16px 0 6px" }}>
            <ShinyText text="Connect your wallet" speed={3} />
          </motion.h1>
          <motion.p {...rise(0.14)} className="muted" style={{ textAlign: "center", margin: 0, fontSize: 15 }}>
            Non-custodial — your keys stay yours.
          </motion.p>

          <motion.button
            {...rise(0.2)}
            className="btn-primary lp-btn-primary-glow"
            onClick={onConnect}
            disabled={busy}
            whileTap={{ scale: 0.97 }}
            style={{ width: "100%", padding: "15px 0", fontSize: 16, marginTop: 22, display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}
          >
            {busy ? <><Loader2 className="animate-spin" size={18} /> Confirm in extension…</> : "Connect Wallet"}
          </motion.button>
          <motion.p {...rise(0.24)} className="muted" style={{ textAlign: "center", fontSize: 13, marginTop: 10 }}>
            Freighter · Albedo · xBull supported
          </motion.p>

          <motion.div {...rise(0.28)} style={{ marginTop: 6 }}>
            {!showManual ? (
              <button className="btn-ghost" style={{ width: "100%" }} onClick={() => setShowManual(true)}>
                Enter address manually (view-only)
              </button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
          </motion.div>

          {err && (
            <p role="alert" style={{ color: "var(--color-danger)", textAlign: "center", fontSize: 14, marginTop: 12 }}>
              {err}
            </p>
          )}

          <motion.div {...rise(0.32)} style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20, flexWrap: "wrap" }}>
            {["Stellar", "USDC", "Non-custodial"].map((t) => (
              <span key={t} className="chip" style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                <span className="lp-dot" /> {t}
              </span>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </AnimatedBackground>
  );
}
