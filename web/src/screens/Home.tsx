import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useShunt, fmtUsdc } from "../store";
import { generateRequestId } from "../lib/payment-request";

export function Home() {
  const nav = useNavigate();
  const address = useShunt((s) => s.address);
  const v2Policy = useShunt((s) => s.v2Policy);
  const v2Balances = useShunt((s) => s.v2Balances);
  const v2GoalLots = useShunt((s) => s.v2GoalLots);
  const executeV2Route = useShunt((s) => s.executeV2Route);
  const activity = useShunt((s) => s.activity);

  const [isSimulating, setIsSimulating] = useState(false);

  const totalReserves =
    v2Balances.emergency + v2Balances.obligation + v2Balances.goalTotal + v2Balances.spendable;

  const handleQuickTestPayment = (amount: number) => {
    setIsSimulating(true);
    setTimeout(() => {
      executeV2Route(
        "GA_TEST_INFLOW_CLIENT_WALLET",
        amount,
        generateRequestId(),
        `Demo Inflow of ${amount} USDC`
      );
      setIsSimulating(false);
    }, 400);
  };

  // Find next unlocking lot
  const activeLots = v2GoalLots.filter((l) => !l.claimed);
  const nextUnlock = activeLots.length > 0
    ? new Date(Math.min(...activeLots.map((l) => l.unlockAt))).toLocaleDateString()
    : "No locked lots";

  return (
    <main className="home-v2-screen" style={{ padding: "28px 20px", maxWidth: 1100, margin: "0 auto", paddingBottom: 120 }}>
      {/* Top Banner: Total Net Reserves */}
      <header
        style={{
          background: "#101112",
          border: "1px solid #1c1d20",
          borderRadius: 12,
          padding: "32px 36px",
          marginBottom: 32,
          position: "relative",
          boxShadow: "0 12px 36px rgba(0, 0, 0, 0.4)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 20 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ background: "#191a1e", color: "#cdf14a", fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 99, border: "1px solid #282a2f" }}>
                &bull; Shunt Router v2 Active
              </span>
              <span style={{ fontSize: 13, color: "#8c9099", fontWeight: 600 }}>
                Policy v{v2Policy.version} Deployed
              </span>
            </div>

            <span style={{ fontSize: 13, textTransform: "uppercase", fontWeight: 700, color: "#71757f", letterSpacing: "0.05em" }}>
              Total Programmable Reserve Net Value
            </span>
            <div style={{ fontSize: 44, fontWeight: 900, color: "#f4f5f6", letterSpacing: "-0.03em", fontFamily: "var(--font-heading)", marginTop: 4 }}>
              ${fmtUsdc(totalReserves)} <span style={{ fontSize: 20, fontWeight: 700, color: "#8c9099" }}>USDC</span>
            </div>
            <p style={{ fontSize: 14, color: "#8c9099", marginTop: 8, maxWidth: 540, lineHeight: 1.5 }}>
              Your incoming payments are automatically intercepted and routed into deterministic reserve buckets before reaching your spendable wallet.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#8c9099", textAlign: "right" }}>
              Quick Test Inflows (Simulate Atomic Split)
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              {[500, 1500, 5000].map((amt) => (
                <button
                  key={amt}
                  disabled={isSimulating}
                  onClick={() => handleQuickTestPayment(amt)}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 12,
                    background: isSimulating ? "#191a1e" : "#cdf14a",
                    color: isSimulating ? "#52555e" : "#0a0c07",
                    fontWeight: 700,
                    fontSize: 13,
                    border: "none",
                    cursor: isSimulating ? "not-allowed" : "pointer",
                    transition: "opacity 0.15s ease",
                  }}
                >
                  +{amt} USDC
                </button>
              ))}
            </div>
            <span style={{ fontSize: 11, color: "#626670", textAlign: "right", fontStyle: "normal" }}>
              Watch reserve cards update atomically via waterfall formula
            </span>
          </div>
        </div>
      </header>

      {/* Quick Navigation Action Hub */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 36 }}>
        <Link
          to="/shunt"
          style={{
            background: "#101112",
            border: "1px solid #1c1d20",
            borderRadius: 12,
            padding: "20px",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 14,
            transition: "border-color 0.2s ease",
          }}
        >
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "#191a1e", border: "1px solid #282a2f", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="ph-fill ph-sliders-horizontal" style={{ color: "#f4f5f6", fontSize: 22 }} />
          </div>
          <div>
            <h4 style={{ fontSize: 16, fontWeight: 700, color: "#f4f5f6", margin: 0 }}>Policy Editor</h4>
            <span style={{ fontSize: 12, color: "#8c9099" }}>Configure waterfall rules & ratios</span>
          </div>
        </Link>

        <Link
          to="/pay"
          style={{
            background: "#101112",
            border: "1px solid #1c1d20",
            borderRadius: 12,
            padding: "20px",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 14,
            transition: "border-color 0.2s ease",
          }}
        >
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "#191a1e", border: "1px solid #282a2f", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="ph-fill ph-paper-plane-right" style={{ color: "#f4f5f6", fontSize: 22 }} />
          </div>
          <div>
            <h4 style={{ fontSize: 16, fontWeight: 700, color: "#f4f5f6", margin: 0 }}>Payer Checkout</h4>
            <span style={{ fontSize: 12, color: "#8c9099" }}>Accountless public pay link</span>
          </div>
        </Link>

        <Link
          to="/savings"
          style={{
            background: "#101112",
            border: "1px solid #1c1d20",
            borderRadius: 12,
            padding: "20px",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 14,
            transition: "border-color 0.2s ease",
          }}
        >
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "#191a1e", border: "1px solid #282a2f", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="ph-fill ph-vault" style={{ color: "#f4f5f6", fontSize: 22 }} />
          </div>
          <div>
            <h4 style={{ fontSize: 16, fontWeight: 700, color: "#f4f5f6", margin: 0 }}>Withdrawal Vault</h4>
            <span style={{ fontSize: 12, color: "#8c9099" }}>Claim lots & manage cooldowns</span>
          </div>
        </Link>

        <Link
          to="/receipts"
          style={{
            background: "#101112",
            border: "1px solid #1c1d20",
            borderRadius: 12,
            padding: "20px",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 14,
            transition: "border-color 0.2s ease",
          }}
        >
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "#191a1e", border: "1px solid #282a2f", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="ph-fill ph-shield-check" style={{ color: "#f4f5f6", fontSize: 22 }} />
          </div>
          <div>
            <h4 style={{ fontSize: 16, fontWeight: 700, color: "#f4f5f6", margin: 0 }}>Audit Receipts</h4>
            <span style={{ fontSize: 12, color: "#8c9099" }}>Verify split conservation proof</span>
          </div>
        </Link>
      </section>

      {/* BentoGrid Reserve Breakdown */}
      <h2 style={{ fontSize: 20, fontWeight: 800, color: "#f4f5f6", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
        <i className="ph-fill ph-circles-four" style={{ color: "#cdf14a" }} />
        Programmable Reserve Buckets (Bento Overview)
      </h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, marginBottom: 40 }}>
        {/* Bento 1: Emergency Reserve */}
        <div style={{ background: "#101112", border: "1px solid #1c1d20", borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#8c9099", letterSpacing: "0.05em" }}>
                Tier 1 Reserve
              </span>
              <i className="ph-fill ph-shield-warning" style={{ color: "#8c9099", fontSize: 22 }} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "#f4f5f6", margin: "0 0 6px" }}>Emergency Reserve</h3>
            <div style={{ fontSize: 32, fontWeight: 900, color: "#f4f5f6", fontFamily: "monospace" }}>
              ${fmtUsdc(v2Balances.emergency)}
            </div>
            <p style={{ fontSize: 12, color: "#8c9099", marginTop: 8 }}>
              Target: ${fmtUsdc(v2Policy.emergencyTarget)} &bull; {v2Balances.emergency >= v2Policy.emergencyTarget ? "Fully Stocked" : "Replenishing"}
            </p>
          </div>
          <button
            onClick={() => nav("/savings")}
            style={{ marginTop: 20, padding: "10px 14px", borderRadius: 10, background: "#191a1e", color: "#f4f5f6", border: "1px solid #282a2f", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            Instant Emergency Access
          </button>
        </div>

        {/* Bento 2: Obligation & Tax Reserve */}
        <div style={{ background: "#101112", border: "1px solid #1c1d20", borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#8c9099", letterSpacing: "0.05em" }}>
                Tier 2 Reserve
              </span>
              <i className="ph-fill ph-scales" style={{ color: "#8c9099", fontSize: 22 }} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "#f4f5f6", margin: "0 0 6px" }}>Obligations & Taxes</h3>
            <div style={{ fontSize: 32, fontWeight: 900, color: "#f4f5f6", fontFamily: "monospace" }}>
              ${fmtUsdc(v2Balances.obligation)}
            </div>
            <p style={{ fontSize: 12, color: "#8c9099", marginTop: 8 }}>
              Allocates {v2Policy.obligationBps / 100}% of post-emergency inflows &bull; {Math.round(v2Policy.obligationCooldownSeconds / 86400)}d Cooldown
            </p>
          </div>
          <button
            onClick={() => nav("/savings")}
            style={{ marginTop: 20, padding: "10px 14px", borderRadius: 10, background: "#191a1e", color: "#f4f5f6", border: "1px solid #282a2f", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            Manage Cooldown Withdrawals
          </button>
        </div>

        {/* Bento 3: Timelocked Goal Lots */}
        <div style={{ background: "#101112", border: "1px solid #1c1d20", borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#8c9099", letterSpacing: "0.05em" }}>
                Tier 3 Reserve
              </span>
              <i className="ph-fill ph-lock-key" style={{ color: "#8c9099", fontSize: 22 }} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "#f4f5f6", margin: "0 0 6px" }}>Timelocked Goal Lots</h3>
            <div style={{ fontSize: 32, fontWeight: 900, color: "#f4f5f6", fontFamily: "monospace" }}>
              ${fmtUsdc(v2Balances.goalTotal)}
            </div>
            <p style={{ fontSize: 12, color: "#8c9099", marginTop: 8 }}>
              {activeLots.length} Active Lots &bull; Next unlock: {nextUnlock}
            </p>
          </div>
          <button
            onClick={() => nav("/savings")}
            style={{ marginTop: 20, padding: "10px 14px", borderRadius: 10, background: "#191a1e", color: "#f4f5f6", border: "1px solid #282a2f", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            Claim Matured Goal Lots
          </button>
        </div>

        {/* Bento 4: Spendable Wallet Pool */}
        <div style={{ background: "#101112", border: "1px solid #1c1d20", borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#8c9099", letterSpacing: "0.05em" }}>
                Residual Pool
              </span>
              <i className="ph-fill ph-wallet" style={{ color: "#8c9099", fontSize: 22 }} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "#f4f5f6", margin: "0 0 6px" }}>Spendable Wallet Pool</h3>
            <div style={{ fontSize: 32, fontWeight: 900, color: "#f4f5f6", fontFamily: "monospace" }}>
              ${fmtUsdc(v2Balances.spendable)}
            </div>
            <p style={{ fontSize: 12, color: "#8c9099", marginTop: 8 }}>
              Available immediately in primary wallet ({v2Policy.spendDestination.slice(0, 10)}...)
            </p>
          </div>
          <button
            onClick={() => nav("/send")}
            style={{ marginTop: 20, padding: "10px 14px", borderRadius: 10, background: "#191a1e", color: "#f4f5f6", border: "1px solid #282a2f", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            Send & Pay USDC
          </button>
        </div>
      </div>

      {/* Recent Routing & Split Activity */}
      <section style={{ background: "#101112", border: "1px solid #1c1d20", borderRadius: 12, padding: 26 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#f4f5f6", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <i className="ph-fill ph-pulse" style={{ color: "#cdf14a" }} />
            Recent Automated Router Events
          </h3>
          <Link to="/activity" style={{ color: "#cdf14a", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
            View All History &rarr;
          </Link>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {activity.slice(0, 4).map((item, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 18px",
                background: "#0c0d0f",
                borderRadius: 12,
                border: "1px solid #18191d",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: "#191a1e",
                    border: "1px solid #282a2f",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#f4f5f6",
                    fontSize: 20,
                  }}
                >
                  <i className={`ph-fill ${item.kind === "split" ? "ph-arrows-split" : "ph-arrow-down-left"}`} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#f4f5f6" }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: "#8c9099" }}>{new Date(item.at).toLocaleString()}</div>
                </div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: item.kind === "split" ? "#cdf14a" : "#f4f5f6", fontFamily: "monospace" }}>
                ${item.amountUsdc} USDC
              </div>
            </div>
          ))}

          {activity.length === 0 && (
            <div style={{ textAlign: "center", padding: "24px 0", color: "#8c9099", fontSize: 13 }}>
              No recent automated routing splits yet. Tap a "Quick Test Inflows" button above to test real-time waterfall calculations!
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
