import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, Link } from "react-router-dom";
import { manualTrigger } from "../lib/keeper";
import { NETWORK, disconnectWalletKit, connectWithAuthModal, fetchXlmBalance, fetchUsdcBalance, addUsdcTrustline, hasUsdcTrustline, formatError } from "../lib/stellar";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { useShunt } from "../store";

export function Settings() {
  const nav = useNavigate();
  const { address, setAddress, showToast } = useShunt();
  const [xlmBal, setXlmBal] = useState("0");
  const [usdcBal, setUsdcBal] = useState("0");
  const [hasUsdcLine, setHasUsdcLine] = useState(true);
  const [enablingUsdc, setEnablingUsdc] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const short = address ? `${address.slice(0, 6)}…${address.slice(-6)}` : "—";

  useEffect(() => {
    if (address) {
      fetchXlmBalance(address).then(setXlmBal).catch(console.error);
      fetchUsdcBalance(address).then(setUsdcBal).catch(console.error);
      hasUsdcTrustline(address).then(setHasUsdcLine).catch(console.error);
    }
  }, [address]);

  /** One-time changeTrust so the wallet can receive USDC (Top Up, pay links). */
  async function onEnableUsdc() {
    if (!address) return;
    setEnablingUsdc(true);
    try {
      await addUsdcTrustline(address);
      setHasUsdcLine(true);
      showToast("USDC enabled — this wallet can now receive USDC");
    } catch (e) {
      const msg = formatError(e);
      if (msg) showToast(msg);
    } finally {
      setEnablingUsdc(false);
    }
  }

  /** Manual trigger (F4 demo fallback): simulate a detected inflow using the
      actual wallet USDC balance (capped at a sane demo max), same logic as
      Configure Shunt's post-save panel. */
  const [simBusy, setSimBusy] = useState(false);
  async function onSimulate() {
    if (!address) return;
    const walletUsdc = parseFloat(usdcBal) || 0;
    if (walletUsdc < 1) {
      showToast("Not enough USDC in wallet to simulate — fund your wallet first");
      return;
    }
    const simAmount = Math.min(walletUsdc, 500).toFixed(7);
    setSimBusy(true);
    try {
      const fakeHash = [...crypto.getRandomValues(new Uint8Array(32))]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const p = await manualTrigger(address, simAmount, fakeHash);
      if (p && !p.xdr && p.error) {
        showToast(`Keeper error: ${p.error.slice(0, 120)}`);
        return;
      }
      nav("/confirm", { state: p ?? { account: address, amount: simAmount, txHash: fakeHash, xdr: null } });
    } finally {
      setSimBusy(false);
    }
  }

  async function onDisconnect() {
    setSigningOut(true);
    try {
      await disconnectWalletKit();
      setAddress(null);
      nav("/connect");
    } finally {
      setSigningOut(false);
      setConfirmingSignOut(false);
    }
  }

  async function onSwitchAccount() {
    try {
      const addr = await connectWithAuthModal();
      setAddress(addr);
      showToast("Switched account");
    } catch {
      // user cancelled — that's fine
    }
  }

  function onCopyAddress() {
    if (address) {
      navigator.clipboard.writeText(address);
      showToast("Address copied");
    }
  }

  return (
    <div className="screen">
      <h2 style={{ margin: 0 }}>Settings</h2>

      <motion.section
        className="card"
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="muted" style={{ fontSize: 12 }}>Connected Wallet</div>
            <div className="numeric" style={{ fontSize: 14 }}>{short}</div>
          </div>
          <span className="chip">{NETWORK}</span>
        </div>

        {address && (
          <div
            onClick={onCopyAddress}
            style={{
              background: "var(--color-bg-base)",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 11,
              fontFamily: "monospace",
              color: "var(--color-text-secondary)",
              wordBreak: "break-all",
              cursor: "pointer",
              border: "1px solid #2a3340",
            }}
            title="Click to copy"
          >
            {address}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <div style={{ flex: 1, background: "rgba(255,255,255,0.03)", padding: 12, borderRadius: 12 }}>
            <div className="muted" style={{ fontSize: 12 }}>XLM Balance</div>
            <div className="numeric" style={{ fontSize: 16, fontWeight: 500, marginTop: 4 }}>
              <AnimatedNumber value={parseFloat(xlmBal) || 0} decimals={2} />
            </div>
          </div>
          <div style={{ flex: 1, background: "rgba(255,255,255,0.03)", padding: 12, borderRadius: 12 }}>
            <div className="muted" style={{ fontSize: 12 }}>USDC Balance</div>
            <div className="numeric" style={{ fontSize: 16, fontWeight: 500, marginTop: 4, color: "var(--color-accent-secondary)" }}>
              <AnimatedNumber value={parseFloat(usdcBal) || 0} decimals={2} />
            </div>
          </div>
        </div>

        {!hasUsdcLine && (
          <button
            className="btn-secondary"
            style={{ marginTop: 4 }}
            onClick={onEnableUsdc}
            disabled={enablingUsdc}
          >
            {enablingUsdc ? "Confirm in wallet…" : "Enable USDC (add trustline)"}
          </button>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
          <button
            className="btn-secondary"
            style={{ flex: "1 1 auto", minWidth: 120 }}
            onClick={onSwitchAccount}
          >
            Switch Account
          </button>
          <button
            className="btn-ghost"
            style={{ flex: "1 1 100%", color: "var(--color-danger)" }}
            onClick={() => setConfirmingSignOut(true)}
          >
            Sign Out
          </button>
        </div>
      </motion.section>

      <Link to="/shunt" className="card" style={{ textDecoration: "none", color: "inherit", display: "flex", justifyContent: "space-between" }}>
        <span>Shunt rules</span>
        <span className="muted">→</span>
      </Link>

      <div className="card" style={{ display: "flex", justifyContent: "space-between" }}>
        <span>Security</span>
        <span className="muted" style={{ fontSize: 13 }}>Keys live in Freighter</span>
      </div>

      <div className="card" style={{ display: "flex", justifyContent: "space-between" }}>
        <span>Display currency</span>
        <span className="muted" style={{ fontSize: 13 }}>USD / IDR</span>
      </div>

      <section className="card" style={{ border: "1px dashed var(--color-accent-secondary)" }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>🧪 Demo fallback</div>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          Simulate a detected income using your actual wallet USDC balance (manual trigger F4).
        </p>
        <button className="btn-secondary" onClick={onSimulate} disabled={simBusy}>
          {simBusy ? "Preparing…" : "Simulate incoming income"}
        </button>
      </section>

      <section
        className="card"
        style={{ background: "linear-gradient(135deg, #141a21, #1a2330)" }}
      >
        <div style={{ fontWeight: 600 }}>📲 Install as an app</div>
        <p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>
          Open your browser menu → "Add to Home Screen" for the full PWA experience.
        </p>
      </section>

      <div className="muted" style={{ textAlign: "center", fontSize: 12 }}>
        Shunt v0.1.0 — non-custodial, built on Stellar
      </div>

      <AnimatePresence>
        {confirmingSignOut && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !signingOut && setConfirmingSignOut(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              zIndex: 200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="card"
              style={{ maxWidth: 340, width: "100%", padding: 24, textAlign: "center" }}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="signout-confirm-title"
            >
              <h3 id="signout-confirm-title" style={{ margin: "0 0 6px", fontSize: 18 }}>
                Sign out of Shunt?
              </h3>
              <p className="muted" style={{ margin: "0 0 20px", fontSize: 13 }}>
                Your wallet stays yours — nothing is deleted on-chain. You'll need to reconnect to see your buckets again.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn-secondary"
                  onClick={() => setConfirmingSignOut(false)}
                  disabled={signingOut}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  style={{ background: "var(--color-danger)", color: "#2a0a06" }}
                  onClick={onDisconnect}
                  disabled={signingOut}
                >
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
