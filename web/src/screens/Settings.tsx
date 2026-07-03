import { useNavigate, Link } from "react-router-dom";
import { manualTrigger } from "../lib/keeper";
import { NETWORK } from "../lib/stellar";
import { useShunt } from "../store";

export function Settings() {
  const nav = useNavigate();
  const { address, setAddress, showToast } = useShunt();

  const short = address ? `${address.slice(0, 6)}…${address.slice(-6)}` : "—";

  /** Manual trigger (F4 demo fallback): simulate a detected 500 USDC inflow. */
  async function onSimulate() {
    const fakeHash = [...crypto.getRandomValues(new Uint8Array(32))]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const p = address ? await manualTrigger(address, "500.0000000", fakeHash) : null;
    nav("/confirm", { state: p ?? { account: address, amount: "500.0000000", txHash: fakeHash, xdr: null } });
  }

  return (
    <div className="screen">
      <h2 style={{ margin: 0 }}>Settings</h2>

      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="muted" style={{ fontSize: 12 }}>Wallet</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="numeric" style={{ fontSize: 14 }}>{short}</span>
          <span className="chip">{NETWORK}</span>
        </div>
        <button
          className="btn-ghost"
          onClick={() => {
            setAddress(null);
            nav("/connect");
          }}
        >
          Disconnect wallet
        </button>
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
        Shunt v0.1.0 — APAC Stellar Hackathon 2026
      </div>
    </div>
  );
}
