import React, { useState } from "react";
import { useShunt, fmtUsdc } from "../store";

export function SavingsVault() {
  const v2Balances = useShunt((s) => s.v2Balances);
  const v2Policy = useShunt((s) => s.v2Policy);
  const v2GoalLots = useShunt((s) => s.v2GoalLots);
  const v2ObligationWithdrawal = useShunt((s) => s.v2ObligationWithdrawal);

  const withdrawV2Emergency = useShunt((s) => s.withdrawV2Emergency);
  const requestV2ObligationWithdrawal = useShunt((s) => s.requestV2ObligationWithdrawal);
  const cancelV2ObligationWithdrawal = useShunt((s) => s.cancelV2ObligationWithdrawal);
  const executeV2ObligationWithdrawal = useShunt((s) => s.executeV2ObligationWithdrawal);
  const claimV2GoalLots = useShunt((s) => s.claimV2GoalLots);

  // Modal / form states
  const [emergencyAmount, setEmergencyAmount] = useState<string>("100");
  const [obligationAmount, setObligationAmount] = useState<string>("100");

  const now = Date.now();
  const maturedLots = v2GoalLots.filter((l) => !l.claimed && now >= l.unlockAt);
  const activeLots = v2GoalLots.filter((l) => !l.claimed && now < l.unlockAt);
  const claimedLots = v2GoalLots.filter((l) => l.claimed);

  const handleClaimAllMatured = () => {
    const ids = maturedLots.map((l) => l.lotId);
    claimV2GoalLots(ids);
  };

  return (
    <main className="vault-screen" style={{ padding: "28px 20px", maxWidth: 1040, margin: "0 auto", paddingBottom: 120 }}>
      {/* Header */}
      <header style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ background: "#101112", color: "#cdf14a", padding: "4px 12px", borderRadius: 99, fontSize: 12, fontWeight: 700, border: "1px solid #1c1d20" }}>
            Programmable Withdrawals
          </span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f4f5f6", margin: 0, fontFamily: "var(--font-heading)" }}>
          Reserve Vault & Cooldowns
        </h1>
        <p style={{ fontSize: 14, color: "#8c9099", marginTop: 6, maxWidth: 640 }}>
          Manage protected reserve balances. Emergency reserves remain accessible immediately, while obligation and goal vaults enforce on-chain timelock controls.
        </p>
      </header>

      {/* Grid of 3 Reserve Sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {/* Section 1: Emergency Reserve Instant Withdraw */}
        <section style={{ background: "#101112", border: "1px solid #1c1d20", borderRadius: 20, padding: 26 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, borderBottom: "1px solid #1c1d20", paddingBottom: 20, marginBottom: 20 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <i className="ph-fill ph-shield-check" style={{ color: "#cdf14a", fontSize: 24 }} />
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "#f4f5f6", margin: 0 }}>Emergency Reserve</h2>
              </div>
              <p style={{ fontSize: 13, color: "#8c9099", margin: 0 }}>
                Liquid cash reserve. Available for instant withdrawal without timelocks or penalties.
              </p>
            </div>

            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: 12, color: "#8c9099", textTransform: "uppercase", fontWeight: 700 }}>Available Balance</span>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#cdf14a", fontFamily: "monospace" }}>
                ${fmtUsdc(v2Balances.emergency)} USDC
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#8c9099", marginBottom: 6 }}>
                Withdrawal Amount ($ USDC)
              </label>
              <input
                type="number"
                value={emergencyAmount}
                onChange={(e) => setEmergencyAmount(e.target.value)}
                placeholder="0"
                style={{ width: "100%", background: "#0c0d0f", border: "1px solid #27282b", borderRadius: 12, padding: "12px 16px", color: "#f4f5f6", fontSize: 16, fontWeight: 700, fontFamily: "monospace", outline: "none" }}
              />
            </div>

            <button
              onClick={() => {
                const amt = Number(emergencyAmount);
                if (amt <= 0) return;
                withdrawV2Emergency(amt);
              }}
              disabled={Number(emergencyAmount) <= 0 || Number(emergencyAmount) > v2Balances.emergency}
              style={{
                marginTop: 22,
                padding: "14px 28px",
                borderRadius: 12,
                background: Number(emergencyAmount) <= 0 || Number(emergencyAmount) > v2Balances.emergency ? "#191a1e" : "#cdf14a",
                color: Number(emergencyAmount) <= 0 || Number(emergencyAmount) > v2Balances.emergency ? "#52555e" : "#0a0c07",
                fontWeight: 800,
                fontSize: 14,
                border: Number(emergencyAmount) <= 0 || Number(emergencyAmount) > v2Balances.emergency ? "1px solid #282a2f" : "none",
                cursor: Number(emergencyAmount) <= 0 || Number(emergencyAmount) > v2Balances.emergency ? "not-allowed" : "pointer",
                transition: "opacity 0.2s ease",
              }}
            >
              Withdraw to Wallet &rarr;
            </button>
          </div>
        </section>

        {/* Section 2: Obligation Reserve with Cooldown */}
        <section style={{ background: "#101112", border: "1px solid #1c1d20", borderRadius: 20, padding: 26 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, borderBottom: "1px solid #1c1d20", paddingBottom: 20, marginBottom: 20 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <i className="ph-fill ph-hourglass-high" style={{ color: "#cdf14a", fontSize: 24 }} />
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "#f4f5f6", margin: 0 }}>Obligation Reserve</h2>
              </div>
              <p style={{ fontSize: 13, color: "#8c9099", margin: 0 }}>
                Requires an on-chain cooldown request ({Math.round(v2Policy.obligationCooldownSeconds / 86400)} days) before execution to protect tax and contractual allocations.
              </p>
            </div>

            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: 12, color: "#8c9099", textTransform: "uppercase", fontWeight: 700 }}>Available Obligation</span>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#f4f5f6", fontFamily: "monospace" }}>
                ${fmtUsdc(v2Balances.obligation)} USDC
              </div>
            </div>
          </div>

          {v2ObligationWithdrawal ? (
            /* Pending Cooldown Card */
            <div style={{ background: "#0c0d0f", border: "1px solid #1c1d20", borderRadius: 16, padding: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                <div>
                  <span style={{ color: "#f4f5f6", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    <i className="ph-fill ph-timer" style={{ color: "#cdf14a" }} />
                    Cooldown Timer Active (Req #{v2ObligationWithdrawal.withdrawalId.toString().slice(0, 8)})
                  </span>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#f4f5f6", fontFamily: "monospace", marginTop: 4 }}>
                    ${fmtUsdc(v2ObligationWithdrawal.amountUsdc)} USDC
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 12, color: "#8c9099", fontWeight: 600 }}>Status:</span>
                  <div style={{ fontSize: 15, fontWeight: 700, color: now >= v2ObligationWithdrawal.executeAfter ? "#cdf14a" : "#f4f5f6" }}>
                    {now >= v2ObligationWithdrawal.executeAfter ? "Ready for Execution" : `Unlocks ${new Date(v2ObligationWithdrawal.executeAfter).toLocaleString()}`}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button
                  onClick={() => cancelV2ObligationWithdrawal(v2ObligationWithdrawal.withdrawalId)}
                  style={{ padding: "10px 20px", borderRadius: 10, background: "#191a1e", color: "#f4f5f6", border: "1px solid #282a2f", fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "opacity 0.2s ease" }}
                >
                  Cancel Request
                </button>
                <button
                  onClick={() => executeV2ObligationWithdrawal(v2ObligationWithdrawal.withdrawalId)}
                  disabled={now < v2ObligationWithdrawal.executeAfter}
                  style={{
                    padding: "10px 22px",
                    borderRadius: 10,
                    background: now < v2ObligationWithdrawal.executeAfter ? "#191a1e" : "#cdf14a",
                    color: now < v2ObligationWithdrawal.executeAfter ? "#52555e" : "#0a0c07",
                    border: now < v2ObligationWithdrawal.executeAfter ? "1px solid #282a2f" : "none",
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: now < v2ObligationWithdrawal.executeAfter ? "not-allowed" : "pointer",
                    transition: "opacity 0.2s ease",
                  }}
                >
                  {now < v2ObligationWithdrawal.executeAfter ? "Cooldown Not Elapsed" : "Execute Withdrawal"}
                </button>
              </div>
            </div>
          ) : (
            /* Request Form */
            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#8c9099", marginBottom: 6 }}>
                  Request Cooldown Release ($ USDC)
                </label>
                <input
                  type="number"
                  value={obligationAmount}
                  onChange={(e) => setObligationAmount(e.target.value)}
                  placeholder="0"
                  style={{ width: "100%", background: "#0c0d0f", border: "1px solid #27282b", borderRadius: 12, padding: "12px 16px", color: "#f4f5f6", fontSize: 16, fontWeight: 700, fontFamily: "monospace", outline: "none" }}
                />
              </div>

              <button
                onClick={() => {
                  const amt = Number(obligationAmount);
                  if (amt <= 0) return;
                  requestV2ObligationWithdrawal(amt);
                }}
                disabled={Number(obligationAmount) <= 0 || Number(obligationAmount) > v2Balances.obligation}
                style={{
                  marginTop: 22,
                  padding: "14px 28px",
                  borderRadius: 12,
                  background: Number(obligationAmount) <= 0 || Number(obligationAmount) > v2Balances.obligation ? "#191a1e" : "#cdf14a",
                  color: Number(obligationAmount) <= 0 || Number(obligationAmount) > v2Balances.obligation ? "#52555e" : "#0a0c07",
                  fontWeight: 800,
                  fontSize: 14,
                  border: Number(obligationAmount) <= 0 || Number(obligationAmount) > v2Balances.obligation ? "1px solid #282a2f" : "none",
                  cursor: Number(obligationAmount) <= 0 || Number(obligationAmount) > v2Balances.obligation ? "not-allowed" : "pointer",
                  transition: "opacity 0.2s ease",
                }}
              >
                Start Cooldown Request &rarr;
              </button>
            </div>
          )}
        </section>

        {/* Section 3: Timelocked Goal Lots */}
        <section style={{ background: "#101112", border: "1px solid #1c1d20", borderRadius: 20, padding: 26 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, borderBottom: "1px solid #1c1d20", paddingBottom: 20, marginBottom: 20 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <i className="ph-fill ph-lock-key" style={{ color: "#cdf14a", fontSize: 24 }} />
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "#f4f5f6", margin: 0 }}>Timelocked Goal Lots ({v2GoalLots.filter(l => !l.claimed).length} Active)</h2>
              </div>
              <p style={{ fontSize: 13, color: "#8c9099", margin: 0 }}>
                Incoming distributions create individual lots locked for {Math.round(v2Policy.goalLockSeconds / 86400)} days. Available to claim upon maturity.
              </p>
            </div>

            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: 12, color: "#8c9099", textTransform: "uppercase", fontWeight: 700 }}>Total Goal Lots</span>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#f4f5f6", fontFamily: "monospace" }}>
                ${fmtUsdc(v2Balances.goalTotal)} USDC
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#8c9099" }}>
              Matured Lots Ready to Claim: <span style={{ color: "#cdf14a" }}>{maturedLots.length} lot(s)</span>
            </span>
            {maturedLots.length > 0 && (
              <button
                onClick={handleClaimAllMatured}
                style={{ padding: "10px 22px", borderRadius: 12, background: "#cdf14a", color: "#0a0c07", fontWeight: 800, fontSize: 13, border: "none", cursor: "pointer", transition: "opacity 0.2s ease" }}
              >
                Claim Matured Lots (${fmtUsdc(maturedLots.reduce((a, b) => a + b.amountUsdc, 0))})
              </button>
            )}
          </div>

          {/* Lot List Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {v2GoalLots.filter(l => !l.claimed).map((lot) => {
              const isMatured = now >= lot.unlockAt;
              return (
                <div key={lot.lotId} style={{ background: "#0c0d0f", border: isMatured ? "1px solid #cdf14a" : "1px solid #1c1d20", borderRadius: 14, padding: 18, position: "relative" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#8c9099", fontFamily: "monospace" }}>Lot #{lot.lotId.toString().slice(-6)}</span>
                    <span style={{ background: isMatured ? "#101112" : "#191a1e", color: isMatured ? "#cdf14a" : "#8c9099", border: isMatured ? "1px solid #cdf14a" : "1px solid #282a2f", padding: "2px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700 }}>
                      {isMatured ? "Matured (Ready)" : "Timelocked"}
                    </span>
                  </div>

                  <div style={{ fontSize: 24, fontWeight: 800, color: "#f4f5f6", fontFamily: "monospace", marginBottom: 8 }}>
                    ${fmtUsdc(lot.amountUsdc)} <span style={{ fontSize: 13, color: "#8c9099" }}>USDC</span>
                  </div>

                  <div style={{ fontSize: 12, color: "#8c9099" }}>
                    <div>Created: {new Date(lot.createdAt).toLocaleDateString()}</div>
                    <div style={{ color: isMatured ? "#cdf14a" : "#8c9099", fontWeight: 600, marginTop: 4 }}>
                      Unlock: {new Date(lot.unlockAt).toLocaleDateString()} ({isMatured ? "Unlocked" : "Pending"})
                    </div>
                  </div>
                </div>
              );
            })}

            {v2GoalLots.filter(l => !l.claimed).length === 0 && (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "30px", background: "#0c0d0f", border: "1px solid #1c1d20", borderRadius: 14, color: "#8c9099" }}>
                No active lots. Incoming routed payments will generate timelocked positions.
              </div>
            )}
          </div>

          {claimedLots.length > 0 && (
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #1c1d20", fontSize: 13, color: "#8c9099" }}>
              <i className="ph-fill ph-check-circle" style={{ color: "#cdf14a", marginRight: 6 }} />
              {claimedLots.length} lot(s) previously claimed ($
              {fmtUsdc(claimedLots.reduce((a, b) => a + b.amountUsdc, 0))} USDC total).
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
