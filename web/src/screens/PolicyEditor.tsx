import React, { useState, useMemo } from "react";
import { useShunt, computeWaterfallAllocation, fmtUsdc, V2Policy } from "../store";

export function PolicyEditor() {
  const v2Policy = useShunt((s) => s.v2Policy);
  const v2Balances = useShunt((s) => s.v2Balances);
  const setV2Policy = useShunt((s) => s.setV2Policy);

  // Local editing state
  const [emergencyTarget, setEmergencyTarget] = useState(v2Policy.emergencyTarget);
  const [emergencyPct, setEmergencyPct] = useState(v2Policy.emergencyTopupBps / 100);
  const [obligationPct, setObligationPct] = useState(v2Policy.obligationBps / 100);
  const [obligationCooldownDays, setObligationCooldownDays] = useState(
    Math.round(v2Policy.obligationCooldownSeconds / 86400)
  );
  const [goalPct, setGoalPct] = useState(v2Policy.goalBps / 100);
  const [goalLockDays, setGoalLockDays] = useState(
    Math.round(v2Policy.goalLockSeconds / 86400)
  );
  const [spendDest, setSpendDest] = useState(v2Policy.spendDestination || "G_WALLET_PRIMARY_DEFAULT");

  // Simulator state
  const [simulatedGross, setSimulatedGross] = useState<number>(2500);

  // Computed allocation preview
  const preview = useMemo(() => {
    return computeWaterfallAllocation(
      simulatedGross,
      v2Balances.emergency,
      emergencyTarget,
      emergencyPct * 100,
      obligationPct * 100,
      goalPct * 100
    );
  }, [simulatedGross, v2Balances.emergency, emergencyTarget, emergencyPct, obligationPct, goalPct]);

  const hasChanges =
    emergencyTarget !== v2Policy.emergencyTarget ||
    emergencyPct !== v2Policy.emergencyTopupBps / 100 ||
    obligationPct !== v2Policy.obligationBps / 100 ||
    obligationCooldownDays !== Math.round(v2Policy.obligationCooldownSeconds / 86400) ||
    goalPct !== v2Policy.goalBps / 100 ||
    goalLockDays !== Math.round(v2Policy.goalLockSeconds / 86400) ||
    spendDest !== v2Policy.spendDestination;

  const handleSave = () => {
    setV2Policy({
      emergencyTarget,
      emergencyTopupBps: emergencyPct * 100,
      obligationBps: obligationPct * 100,
      obligationCooldownSeconds: obligationCooldownDays * 86400,
      goalBps: goalPct * 100,
      goalLockSeconds: goalLockDays * 86400,
      spendDestination: spendDest,
    });
  };

  return (
    <main className="policy-editor-screen" style={{ padding: "24px 20px", maxWidth: 1040, margin: "0 auto", paddingBottom: 100 }}>
      {/* Header Banner */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          background: "#101112",
          border: "1px solid #1c1d20",
          borderRadius: 12,
          padding: "24px 28px",
          marginBottom: 32,
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span
              style={{
                background: "#191a1e",
                border: "1px solid #282a2f",
                padding: "3px 10px",
                borderRadius: 99,
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "#cdf14a",
              }}
            >
              Shunt v2 Router
            </span>
            <span style={{ fontSize: 13, color: "#8c9099", fontWeight: 600 }}>
              Active Policy &bull; v{v2Policy.version}
            </span>
          </div>
          <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 28, fontWeight: 800, color: "#f4f5f6", margin: 0 }}>
            Programmable Income Routing
          </h1>
          <p style={{ fontSize: 14, color: "#8c9099", marginTop: 6, maxWidth: 620, lineHeight: 1.5 }}>
            Define your routing waterfall. Deposits distribute automatically across on-chain reserves before reaching your wallet.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={!hasChanges}
          style={{
            padding: "12px 24px",
            borderRadius: 12,
            fontWeight: 700,
            fontSize: 14,
            cursor: hasChanges ? "pointer" : "not-allowed",
            background: hasChanges ? "#cdf14a" : "#191a1e",
            color: hasChanges ? "#0a0c07" : "#52555e",
            border: hasChanges ? "none" : "1px solid #282a2f",
            transition: "opacity 0.2s ease",
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <i className="ph-fill ph-check-circle" style={{ fontSize: 18 }} />
          {hasChanges ? `Deploy Policy v${v2Policy.version + 1}` : "Saved On-Chain"}
        </button>
      </header>

      {/* Interactive Waterfall Simulator */}
      <section
        style={{
          background: "#101112",
          border: "1px solid #1c1d20",
          borderRadius: 12,
          padding: "28px",
          marginBottom: 36,
          position: "relative",
          boxShadow: "0 12px 36px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#f4f5f6", display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
              <i className="ph-fill ph-lightning" style={{ color: "#cdf14a" }} />
              Real-Time Waterfall Simulator
            </h2>
            <p style={{ fontSize: 13, color: "#8c9099", marginTop: 4 }}>
              Preview how a payment will be routed with your current policy settings.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#0c0d0f", border: "1px solid #1c1d20", borderRadius: 12, padding: "6px 14px" }}>
            <span style={{ fontSize: 13, color: "#8c9099", fontWeight: 600 }}>Simulated Inflow:</span>
            <span style={{ color: "#cdf14a", fontWeight: 700 }}>$</span>
            <input
              type="number"
              value={simulatedGross}
              onChange={(e) => setSimulatedGross(Math.max(0, Number(e.target.value)))}
              style={{
                background: "transparent",
                border: "none",
                color: "#f4f5f6",
                fontSize: 18,
                fontWeight: 800,
                width: 90,
                outline: "none",
                fontFamily: "monospace",
              }}
            />
            <span style={{ fontSize: 12, color: "#8c9099", fontWeight: 700 }}>USDC</span>
          </div>
        </div>

        {/* Quick simulation pills */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {[500, 1000, 2500, 5000, 10000].map((amt) => (
            <button
              key={amt}
              onClick={() => setSimulatedGross(amt)}
              style={{
                padding: "5px 12px",
                borderRadius: 99,
                fontSize: 12,
                fontWeight: 600,
                background: simulatedGross === amt ? "#f4f5f6" : "#191a1e",
                color: simulatedGross === amt ? "#0a0c07" : "#8c9099",
                border: simulatedGross === amt ? "1px solid #f4f5f6" : "1px solid #282a2f",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              +${amt}
            </button>
          ))}
        </div>

        {/* Visual routing bar */}
        <div style={{ display: "flex", height: 28, borderRadius: 10, overflow: "hidden", background: "#0c0d0f", marginBottom: 24, border: "1px solid #1a1b1f" }}>
          {preview.emergency > 0 && (
            <div
              style={{
                width: `${(preview.emergency / simulatedGross) * 100}%`,
                background: "#cdf14a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 800,
                color: "#0a0c07",
                transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
              title={`Emergency: $${preview.emergency.toFixed(2)}`}
            >
              {((preview.emergency / simulatedGross) * 100) >= 8 && `${Math.round((preview.emergency / simulatedGross) * 100)}%`}
            </div>
          )}
          {preview.obligation > 0 && (
            <div
              style={{
                width: `${(preview.obligation / simulatedGross) * 100}%`,
                background: "#828994",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 800,
                color: "#0a0c07",
                transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
              title={`Obligation: $${preview.obligation.toFixed(2)}`}
            >
              {((preview.obligation / simulatedGross) * 100) >= 8 && `${Math.round((preview.obligation / simulatedGross) * 100)}%`}
            </div>
          )}
          {preview.goal > 0 && (
            <div
              style={{
                width: `${(preview.goal / simulatedGross) * 100}%`,
                background: "#424751",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 800,
                color: "#f4f5f6",
                transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
              title={`Goal Lots: $${preview.goal.toFixed(2)}`}
            >
              {((preview.goal / simulatedGross) * 100) >= 8 && `${Math.round((preview.goal / simulatedGross) * 100)}%`}
            </div>
          )}
          {preview.spendable > 0 && (
            <div
              style={{
                width: `${(preview.spendable / simulatedGross) * 100}%`,
                background: "#1b1d22",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 800,
                color: "#8c9099",
                transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
              title={`Spendable Pool: $${preview.spendable.toFixed(2)}`}
            >
              {((preview.spendable / simulatedGross) * 100) >= 8 && `${Math.round((preview.spendable / simulatedGross) * 100)}%`}
            </div>
          )}
        </div>

        {/* 4 Reserve Breakdown Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 16 }}>
          {/* Emergency */}
          <div style={{ background: "#0c0d0f", padding: 16, borderRadius: 14, border: "1px solid #1a1b20" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: 99, background: "#cdf14a" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#f4f5f6" }}>Emergency Reserve</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#f4f5f6", fontFamily: "monospace" }}>
              +${fmtUsdc(preview.emergency)}
            </div>
            <div style={{ fontSize: 12, color: "#8c9099", marginTop: 4 }}>
              {v2Balances.emergency >= emergencyTarget
                ? "Target Full (Overflow -> Next)"
                : `Current Balance: $${fmtUsdc(v2Balances.emergency)} / $${emergencyTarget}`}
            </div>
          </div>

          {/* Obligation */}
          <div style={{ background: "#0c0d0f", padding: 16, borderRadius: 14, border: "1px solid #1a1b20" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: 99, background: "#828994" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#f4f5f6" }}>Obligations & Taxes</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#f4f5f6", fontFamily: "monospace" }}>
              +${fmtUsdc(preview.obligation)}
            </div>
            <div style={{ fontSize: 12, color: "#8c9099", marginTop: 4 }}>
              {obligationPct}% of remaining &bull; {obligationCooldownDays}d cooldown
            </div>
          </div>

          {/* Goal Lots */}
          <div style={{ background: "#0c0d0f", padding: 16, borderRadius: 14, border: "1px solid #1a1b20" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: 99, background: "#424751" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#f4f5f6" }}>Locked Goal Lots</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#f4f5f6", fontFamily: "monospace" }}>
              +${fmtUsdc(preview.goal)}
            </div>
            <div style={{ fontSize: 12, color: "#8c9099", marginTop: 4 }}>
              {goalPct}% of remaining &bull; {goalLockDays}d timelock lot
            </div>
          </div>

          {/* Spendable Pool */}
          <div style={{ background: "#0c0d0f", padding: 16, borderRadius: 14, border: "1px solid #1a1b20" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: 99, background: "#22262e" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#f4f5f6" }}>Spendable Pool</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#f4f5f6", fontFamily: "monospace" }}>
              +${fmtUsdc(preview.spendable)}
            </div>
            <div style={{ fontSize: 12, color: "#8c9099", marginTop: 4 }}>
              Directly to Wallet (Residual % + Remainder)
            </div>
          </div>
        </div>
      </section>

      {/* Policy Rules Configuration Cards */}
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f4f5f6", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
        <i className="ph-fill ph-sliders-horizontal" style={{ color: "#cdf14a" }} />
        Configure Reserve Lanes & Rules
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Card 1: Emergency Reserve */}
        <div style={{ background: "#101112", border: "1px solid #1c1d20", borderRadius: 12, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#191a1e", border: "1px solid #282a2f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className="ph-fill ph-shield-check" style={{ color: "#f4f5f6", fontSize: 22 }} />
              </div>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "#f4f5f6", margin: 0 }}>Emergency Reserve Lane</h3>
                <p style={{ fontSize: 13, color: "#8c9099", margin: 0 }}>Fills first. No timelock.</p>
              </div>
            </div>
            <span style={{ background: "#191a1e", color: "#cdf14a", padding: "4px 12px", borderRadius: 99, fontSize: 12, fontWeight: 700, border: "1px solid #282a2f" }}>
              Priority Tier 1
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, paddingTop: 12, borderTop: "1px solid #1c1d20" }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#f4f5f6", display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span>Target Balance ($ USDC)</span>
                <span style={{ color: "#cdf14a", fontWeight: 700 }}>${emergencyTarget.toLocaleString()}</span>
              </label>
              <input
                type="range"
                min="0"
                max="10000"
                step="250"
                value={emergencyTarget}
                onChange={(e) => setEmergencyTarget(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#cdf14a", cursor: "pointer" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#71757f", marginTop: 4 }}>
                <span>$0 (Disabled)</span>
                <span>$5,000</span>
                <span>$10,000</span>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#f4f5f6", display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span>Max Refill Rate (% of gross inflow)</span>
                <span style={{ color: "#cdf14a", fontWeight: 700 }}>{emergencyPct}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="70"
                step="5"
                value={emergencyPct}
                onChange={(e) => setEmergencyPct(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#cdf14a", cursor: "pointer" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#71757f", marginTop: 4 }}>
                <span>0%</span>
                <span>35%</span>
                <span>70% Max</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Obligation Reserve */}
        <div style={{ background: "#101112", border: "1px solid #1c1d20", borderRadius: 12, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#191a1e", border: "1px solid #282a2f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className="ph-fill ph-scales" style={{ color: "#f4f5f6", fontSize: 22 }} />
              </div>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "#f4f5f6", margin: 0 }}>Obligation Reserve Lane</h3>
                <p style={{ fontSize: 13, color: "#8c9099", margin: 0 }}>For taxes and payroll. Includes withdrawal cooldown.</p>
              </div>
            </div>
            <span style={{ background: "#191a1e", color: "#8c9099", padding: "4px 12px", borderRadius: 99, fontSize: 12, fontWeight: 700, border: "1px solid #282a2f" }}>
              Tier 2 (Post-Emergency)
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, paddingTop: 12, borderTop: "1px solid #1c1d20" }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#f4f5f6", display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span>Allocation Rate (%)</span>
                <span style={{ color: "#f4f5f6", fontWeight: 700 }}>{obligationPct}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="50"
                step="1"
                value={obligationPct}
                onChange={(e) => setObligationPct(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#cdf14a", cursor: "pointer" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#71757f", marginTop: 4 }}>
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#f4f5f6", display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span>Withdrawal Cooldown Lock (Days)</span>
                <span style={{ color: "#f4f5f6", fontWeight: 700 }}>{obligationCooldownDays} Days</span>
              </label>
              <input
                type="range"
                min="0"
                max="7"
                step="1"
                value={obligationCooldownDays}
                onChange={(e) => setObligationCooldownDays(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#cdf14a", cursor: "pointer" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#71757f", marginTop: 4 }}>
                <span>0 (Instant)</span>
                <span>3 Days</span>
                <span>7 Days Max</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Goal Lots Reserve */}
        <div style={{ background: "#101112", border: "1px solid #1c1d20", borderRadius: 12, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#191a1e", border: "1px solid #282a2f", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className="ph-fill ph-lock-key" style={{ color: "#f4f5f6", fontSize: 22 }} />
              </div>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "#f4f5f6", margin: 0 }}>Goal Lots Reserve Lane</h3>
                <p style={{ fontSize: 13, color: "#8c9099", margin: 0 }}>Timelocked savings per deposit.</p>
              </div>
            </div>
            <span style={{ background: "#191a1e", color: "#8c9099", padding: "4px 12px", borderRadius: 99, fontSize: 12, fontWeight: 700, border: "1px solid #282a2f" }}>
              Tier 3 (Timelocked Lots)
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, paddingTop: 12, borderTop: "1px solid #1c1d20" }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#f4f5f6", display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span>Allocation Rate (%)</span>
                <span style={{ color: "#f4f5f6", fontWeight: 700 }}>{goalPct}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="60"
                step="2"
                value={goalPct}
                onChange={(e) => setGoalPct(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#cdf14a", cursor: "pointer" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#71757f", marginTop: 4 }}>
                <span>0%</span>
                <span>30%</span>
                <span>60%</span>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#f4f5f6", display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span>Lot Timelock Duration (Days)</span>
                <span style={{ color: "#f4f5f6", fontWeight: 700 }}>{goalLockDays} Days</span>
              </label>
              <input
                type="range"
                min="30"
                max="365"
                step="15"
                value={goalLockDays}
                onChange={(e) => setGoalLockDays(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#cdf14a", cursor: "pointer" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#71757f", marginTop: 4 }}>
                <span>30 Days</span>
                <span>180 Days</span>
                <span>365 Days</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Spend Destination */}
        <div style={{ background: "#101112", border: "1px solid #1c1d20", borderRadius: 12, padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#191a1e", border: "1px solid #282a2f", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className="ph-fill ph-wallet" style={{ color: "#f4f5f6", fontSize: 22 }} />
            </div>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: "#f4f5f6", margin: 0 }}>Spendable Pool Destination</h3>
              <p style={{ fontSize: 13, color: "#8c9099", margin: 0 }}>Residuals transfer automatically to this address.</p>
            </div>
          </div>

          <div style={{ paddingTop: 12, borderTop: "1px solid #1c1d20" }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#f4f5f6", display: "block", marginBottom: 8 }}>
              Recipient Soroban / Stellar Address
            </label>
            <input
              type="text"
              value={spendDest}
              onChange={(e) => setSpendDest(e.target.value)}
              placeholder="e.g. GA5ZSE_PRIMARY_WALLET_ADDRESS"
              style={{
                width: "100%",
                background: "#0c0d0f",
                border: "1px solid #27282b",
                borderRadius: 10,
                padding: "12px 16px",
                color: "#f4f5f6",
                fontSize: 14,
                fontFamily: "monospace",
                outline: "none",
              }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
