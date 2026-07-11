import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { manualTrigger } from "../lib/keeper";
import { NETWORK, disconnectWalletKit, connectWithAuthModal, fetchXlmBalance, fetchUsdcBalance, addUsdcTrustline, hasUsdcTrustline, formatError } from "../lib/stellar";
import { useShunt } from "../store";

export function Settings() {
  const nav = useNavigate();
  const { address, setAddress, showToast } = useShunt();
  const [xlmBal, setXlmBal] = useState("0");
  const [usdcBal, setUsdcBal] = useState("0");
  const [hasUsdcLine, setHasUsdcLine] = useState(true);
  const [enablingUsdc, setEnablingUsdc] = useState(false);

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

  /** Manual trigger (F4 demo fallback): simulate a detected 500 USDC inflow. */
  async function onSimulate() {
    const fakeHash = [...crypto.getRandomValues(new Uint8Array(32))]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const p = address ? await manualTrigger(address, "500.0000000", fakeHash) : null;
    nav("/confirm", { state: p ?? { account: address, amount: "500.0000000", txHash: fakeHash, xdr: null } });
  }

  async function onDisconnect() {
    await disconnectWalletKit();
    setAddress(null);
    nav("/connect");
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

      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
              {parseFloat(xlmBal).toFixed(2)}
            </div>
          </div>
          <div style={{ flex: 1, background: "rgba(255,255,255,0.03)", padding: 12, borderRadius: 12 }}>
            <div className="muted" style={{ fontSize: 12 }}>USDC Balance</div>
            <div className="numeric" style={{ fontSize: 16, fontWeight: 500, marginTop: 4, color: "var(--color-accent-secondary)" }}>
              {parseFloat(usdcBal).toFixed(2)}
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
            onClick={onDisconnect}
          >
            Sign Out
          </button>
        </div>
      </section>

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
          Simulate a detected 500 USDC income (manual trigger F4).
        </p>
        <button className="btn-secondary" onClick={onSimulate}>
          Simulate incoming income
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
    </div>
  );
}
