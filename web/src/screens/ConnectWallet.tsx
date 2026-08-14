import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { connectWithAuthModal, formatError } from "../lib/stellar";
import { useShunt } from "../store";
import { StrKey } from "@stellar/stellar-sdk";
import { Loader2 } from "lucide-react";
import { Logo } from "../components/Logo";

const MARQUEE_LOGOS = [
  { name: "Stellar", src: "/images/marquee/stellar.png" },
  { name: "Soroban", src: "/images/marquee/soroban.png" },
  { name: "Settle Network", src: "/images/marquee/settle.png" },
  { name: "Freighter", src: "/images/marquee/freighter.png" },
  { name: "Albedo", src: "/images/marquee/albedo.png" },
  { name: "WalletConnect", src: "/images/marquee/walletconnect.png" },
  { name: "MoneyGram", src: "/images/marquee/moneygram.png" },
  { name: "USDC", src: "/images/marquee/usdc.png" },
  { name: "Rust", src: "/images/marquee/rust.png" },
];

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
    <div
      className="landing-hero-wrapper"
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "40px 20px",
        boxSizing: "border-box",
      }}
    >
      {/* Outer Glass Frame Container matching reference image */}
      <div style={{ width: "100%", maxWidth: 1240, position: "relative", zIndex: 10, boxSizing: "border-box" }}>
        {/* Subtle particle glow behind top of frame */}
        <div className="hero-particles-glow" style={{ top: -20, height: 40 }} />

        {/* Outer Glass Frame */}
        <motion.div {...rise(0)} className="cw-glass-frame">
          {/* 2-Column Split Grid */}
          <div className="cw-split-grid">
            {/* LEFT SECTION (Mesh Gradient Background) */}
            <div className="cw-left-section">
              {/* Logo restored at top of left section */}
              <div className="lp-brand" style={{ cursor: "pointer", zIndex: 2, position: "relative" }} onClick={() => nav("/")}>
                <Logo size={28} />
                <span>Shunt</span>
              </div>

              {/* Body inside left card */}
              <div className="cw-left-body">
                {/* Trust / Network Badge */}
                <div
                  className="lp-hero-badge"
                  style={{
                    marginBottom: 18,
                    background: "rgba(0, 0, 0, 0.4)",
                    borderColor: "rgba(255, 255, 255, 0.16)",
                    backdropFilter: "blur(12px)",
                  }}
                >
                  <span className="lp-badge-tag">Soroban Smart Contract</span>
                  <span>Non-Custodial Protocol</span>
                </div>

                {/* H1 Title */}
                <h1
                  style={{
                    fontFamily: "'Inter Tight', var(--font-heading)",
                    fontSize: "clamp(28px, 3vw, 40px)",
                    fontWeight: 400,
                    color: "#ffffff",
                    margin: "0 0 14px",
                    lineHeight: 1.14,
                    letterSpacing: "-0.02em",
                  }}
                >
                  Automated cashflow,<br />on-chain precision.
                </h1>

                {/* Paragraph */}
                <p
                  style={{
                    fontFamily: "'Inter', var(--font-body)",
                    fontSize: 14.5,
                    color: "rgba(255, 255, 255, 0.78)",
                    margin: 0,
                    lineHeight: 1.6,
                    maxWidth: 420,
                  }}
                >
                  Shunt automatically routes your incoming salary into spendable, savings, and investments the moment it hits your wallet. Never lose control.
                </p>
              </div>
            </div>

            {/* RIGHT SECTION (Connect Wallet Form Card - Bottom Aligned with Top Space) */}
            <div className="cw-right-section">
              {/* Form Block Pushed Down (leaving top space above title, rapat ke bawah) */}
              <div style={{ marginTop: "auto", display: "flex", flexDirection: "column" }}>
                {/* H2 Title */}
                <h2
                  style={{
                    fontFamily: "'Inter Tight', var(--font-heading)",
                    fontSize: "clamp(25px, 2.2vw, 30px)",
                    fontWeight: 500,
                    color: "#ffffff",
                    margin: "0 0 6px",
                    letterSpacing: "-0.02em",
                  }}
                >
                  Connect your wallet
                </h2>

                <p className="hero-subtitle" style={{ fontSize: 13.5, marginBottom: 18, color: "rgba(255, 255, 255, 0.7)", lineHeight: 1.55 }}>
                  Connect your Stellar wallet to start routing your income automatically. You always retain full control of your funds.
                </p>

                {/* Primary Connect Button */}
                <motion.button
                  className="lp-btn-olive"
                  onClick={onConnect}
                  disabled={busy}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    width: "100%",
                    padding: "14px 24px",
                    fontSize: 15.5,
                    fontWeight: 500,
                    borderRadius: 9999,
                    justifyContent: "center",
                    height: "auto",
                    boxSizing: "border-box",
                  }}
                >
                  {busy ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      <span>Confirm in extension…</span>
                    </>
                  ) : (
                    <>
                      <span>Connect Wallet</span>
                      <i className="ph ph-arrow-right" style={{ fontSize: 17 }} />
                    </>
                  )}
                </motion.button>

                <p className="hero-microcopy" style={{ textAlign: "center", marginTop: 8, marginBottom: 14 }}>
                  Freighter · Albedo · xBull supported
                </p>

                {/* Manual Address Action Block & Error Container — tightly placed */}
                <motion.div layout transition={{ type: "spring", stiffness: 350, damping: 32 }} style={{ width: "100%" }}>
                  <AnimatePresence mode="wait">
                    {!showManual ? (
                      <motion.button
                        key="btn-toggle"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.18 }}
                        className="cw-glass-btn"
                        style={{ width: "100%", padding: "12px 20px" }}
                        onClick={() => setShowManual(true)}
                      >
                        <i className="ph ph-key" style={{ fontSize: 16 }} />
                        <span>Enter address manually (view-only)</span>
                      </motion.button>
                    ) : (
                      <motion.div
                        key="form-manual"
                        initial={{ opacity: 0, height: 0, y: 8 }}
                        animate={{ opacity: 1, height: "auto", y: 0 }}
                        exit={{ opacity: 0, height: 0, y: 8 }}
                        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                        style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", overflow: "hidden" }}
                      >
                        <input
                          type="text"
                          placeholder="G… Stellar public address"
                          value={manual}
                          onChange={(e) => setManual(e.target.value)}
                          className="cw-input-glass"
                          aria-label="Stellar address"
                        />
                        <button className="lp-btn-cta" style={{ width: "100%", justifyContent: "center", padding: "11px 20px" }} onClick={onManual}>
                          <span>Use this address (view mode)</span>
                          <i className="ph ph-arrow-right" style={{ fontSize: 16 }} />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Error banner smoothly expanding upwards */}
                  <AnimatePresence>
                    {err && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, y: 6 }}
                        animate={{ opacity: 1, height: "auto", y: 0 }}
                        exit={{ opacity: 0, height: 0, y: 6 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: "hidden", marginTop: 8 }}
                      >
                        <p
                          role="alert"
                          style={{
                            color: "#f87171",
                            textAlign: "center",
                            fontSize: 13,
                            margin: 0,
                            width: "100%",
                            background: "rgba(239, 68, 68, 0.1)",
                            border: "1px solid rgba(239, 68, 68, 0.25)",
                            borderRadius: 10,
                            padding: "8px 12px",
                            boxSizing: "border-box",
                          }}
                        >
                          {err}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>

              {/* Bottom Ecosystem Marquee Logos Row — rapat di bawah */}
              <div style={{ paddingTop: 14, borderTop: "1px solid rgba(255, 255, 255, 0.08)", marginTop: 18 }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255, 255, 255, 0.45)", fontWeight: 600, marginBottom: 10 }}>
                  Supported Ecosystem
                </div>
                <div className="cw-marquee-container">
                  <div className="cw-marquee-track">
                    {[...MARQUEE_LOGOS, ...MARQUEE_LOGOS].map((logo, idx) => (
                      <img key={`${idx}-${logo.name}`} src={logo.src} alt={logo.name} className="cw-ecosystem-logo" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
