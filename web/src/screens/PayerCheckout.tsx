import React, { useState } from "react";
import { useShunt, computeWaterfallAllocation, fmtUsdc } from "../store";
import { generateRequestId, PaymentReceipt } from "../lib/payment-request";

export function PayerCheckout() {
  const v2Policy = useShunt((s) => s.v2Policy);
  const v2Balances = useShunt((s) => s.v2Balances);
  const executeV2Route = useShunt((s) => s.executeV2Route);

  // Form states for testing invoice payment
  const [payerAddress, setPayerAddress] = useState("GA_EXTERNAL_PAYER_WALLET_7721");
  const [amountInput, setAmountInput] = useState<number>(3500);
  const [memoInput, setMemoInput] = useState("Q3 Consulting Retainer Invoice #891");
  const [requestId, setRequestId] = useState(() => generateRequestId());
  const [expectedPolicyVersion, setExpectedPolicyVersion] = useState(v2Policy.version);
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedReceipt, setCompletedReceipt] = useState<PaymentReceipt | null>(null);

  // Preview waterfall split on recipient side
  const preview = computeWaterfallAllocation(
    amountInput,
    v2Balances.emergency,
    v2Policy.emergencyTarget,
    v2Policy.emergencyTopupBps,
    v2Policy.obligationBps,
    v2Policy.goalBps
  );

  const isVersionMatch = expectedPolicyVersion === v2Policy.version;

  const handleExecutePayment = () => {
    if (!isVersionMatch) {
      alert("Policy Version Mismatch! The recipient modified their routing rules after this invoice was issued.");
      return;
    }
    setIsProcessing(true);
    setTimeout(() => {
      const receipt = executeV2Route(payerAddress, amountInput, requestId, memoInput);
      setCompletedReceipt(receipt);
      setIsProcessing(false);
    }, 700);
  };

  const handleReset = () => {
    setCompletedReceipt(null);
    setRequestId(generateRequestId());
  };

  return (
    <main className="payer-checkout-screen" style={{ padding: "28px 20px", maxWidth: 900, margin: "0 auto", paddingBottom: 120 }}>
      {/* Brand & Security Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: "#191a1e", border: "1px solid #282a2f", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="ph-fill ph-arrows-split" style={{ color: "#cdf14a", fontSize: 24 }} />
          </div>
          <div>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#cdf14a", letterSpacing: "0.08em" }}>
              Public Payment Link
            </span>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#f4f5f6", margin: 0, fontFamily: "var(--font-heading)" }}>
              Shunt Programmable Payment
            </h1>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#101112", border: "1px solid #1c1d20", padding: "6px 14px", borderRadius: 99 }}>
          <i className="ph-fill ph-lock" style={{ color: "#cdf14a" }} />
          <span style={{ fontSize: 12, color: "#8c9099", fontWeight: 600 }}>Soroban Network</span>
        </div>
      </div>

      {completedReceipt ? (
        /* Success Receipt Card */
        <div style={{ background: "#101112", border: "1px solid #1c1d20", borderRadius: 12, padding: "36px 32px", textAlign: "center", boxShadow: "0 16px 40px rgba(0, 0, 0, 0.5)" }}>
          <div style={{ width: 64, height: 64, borderRadius: 99, background: "#191a1e", border: "2px solid #cdf14a", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <i className="ph-fill ph-check" style={{ color: "#cdf14a", fontSize: 32 }} />
          </div>

          <h2 style={{ fontSize: 24, fontWeight: 800, color: "#f4f5f6", margin: "0 0 6px" }}>
            Payment Settled & Routed
          </h2>
          <p style={{ fontSize: 14, color: "#8c9099", marginBottom: 28 }}>
            Deposit successfully distributed across recipient reserves.
          </p>

          <div style={{ background: "#0c0d0f", border: "1px solid #1a1b20", borderRadius: 12, padding: 24, marginBottom: 28, textAlign: "left", fontFamily: "monospace" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, borderBottom: "1px dashed #1e2026", paddingBottom: 12 }}>
              <span style={{ color: "#8c9099" }}>Transaction Hash</span>
              <span style={{ color: "#f4f5f6", fontWeight: 700 }}>{completedReceipt.txHash}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, borderBottom: "1px dashed #1e2026", paddingBottom: 12 }}>
              <span style={{ color: "#8c9099" }}>Gross Paid</span>
              <span style={{ color: "#cdf14a", fontWeight: 800 }}>${completedReceipt.gross} USDC</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
              <span style={{ color: "#8c9099" }}>Emergency Reserve</span>
              <span style={{ color: "#f4f5f6", fontWeight: 700 }}>${completedReceipt.emergency}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
              <span style={{ color: "#8c9099" }}>Obligation Reserve</span>
              <span style={{ color: "#f4f5f6", fontWeight: 700 }}>${completedReceipt.obligation}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
              <span style={{ color: "#8c9099" }}>Timelocked Goal Lot</span>
              <span style={{ color: "#f4f5f6", fontWeight: 700 }}>${completedReceipt.goal}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "#8c9099" }}>Spendable Wallet Pool</span>
              <span style={{ color: "#f4f5f6", fontWeight: 700 }}>${completedReceipt.spendable}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
            <button
              onClick={handleReset}
              style={{
                padding: "12px 28px",
                borderRadius: 8,
                background: "#cdf14a",
                color: "#0a0c07",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                transition: "opacity 0.2s ease",
              }}
            >
              Pay Another Invoice
            </button>
          </div>
        </div>
      ) : (
        /* Checkout Interactive Form */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 24 }}>
          {/* Invoice Parameter Input Panel */}
          <div style={{ background: "#101112", border: "1px solid #1c1d20", borderRadius: 12, padding: 26 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#f4f5f6", marginBottom: 20, display: "flex", alignItems: "center", gap: 8, margin: "0 0 20px 0" }}>
              <i className="ph-fill ph-receipt" style={{ color: "#cdf14a" }} />
              Invoice Payment Details
            </h2>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#8c9099", marginBottom: 6 }}>
                Payment Amount ($ USDC)
              </label>
              <div style={{ display: "flex", alignItems: "center", background: "#0c0d0f", border: "1px solid #27282b", borderRadius: 8, padding: "4px 16px" }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: "#cdf14a" }}>$</span>
                <input
                  type="number"
                  value={amountInput}
                  onChange={(e) => setAmountInput(Math.max(0, Number(e.target.value)))}
                  style={{ background: "transparent", border: "none", width: "100%", fontSize: 22, fontWeight: 800, color: "#f4f5f6", padding: "10px", outline: "none", fontFamily: "monospace" }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#8c9099", marginBottom: 6 }}>
                Invoice Memo / Purpose
              </label>
              <input
                type="text"
                value={memoInput}
                onChange={(e) => setMemoInput(e.target.value)}
                style={{ width: "100%", background: "#0c0d0f", border: "1px solid #27282b", borderRadius: 8, padding: "12px 14px", color: "#f4f5f6", fontSize: 14, outline: "none" }}
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#8c9099", marginBottom: 6 }}>
                Payer Wallet Address (Accountless Simulation)
              </label>
              <input
                type="text"
                value={payerAddress}
                onChange={(e) => setPayerAddress(e.target.value)}
                style={{ width: "100%", background: "#0c0d0f", border: "1px solid #27282b", borderRadius: 8, padding: "12px 14px", color: "#f4f5f6", fontFamily: "monospace", fontSize: 13, outline: "none" }}
              />
            </div>

            {/* Policy Protection Notice */}
            <div style={{ background: "#0c0d0f", border: "1px solid #282a2f", borderRadius: 8, padding: "14px 16px", marginTop: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: isVersionMatch ? "#f4f5f6" : "#ef4444", display: "flex", alignItems: "center", gap: 6 }}>
                  <i className={`ph-fill ${isVersionMatch ? "ph-shield-check" : "ph-warning"}`} style={{ fontSize: 16, color: isVersionMatch ? "#cdf14a" : "#ef4444" }} />
                  {isVersionMatch ? "Policy Revision Lock Active" : "Policy Revision Mismatch!"}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#8c9099" }}>
                  Expected Revision #{expectedPolicyVersion} (Live: #{v2Policy.version})
                </span>
              </div>
              <p style={{ fontSize: 12, color: "#8c9099", margin: 0, lineHeight: 1.4 }}>
                {isVersionMatch
                  ? `Invoice bound to revision #${v2Policy.version}. Allocation changes will reject the transaction.`
                  : "Recipient updated routing splits. Execution blocked."}
              </p>
            </div>
          </div>

          {/* Real-Time Split Preview Panel */}
          <div style={{ background: "#101112", border: "1px solid #1c1d20", borderRadius: 12, padding: 26, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#f4f5f6", marginBottom: 16, display: "flex", alignItems: "center", gap: 8, margin: "0 0 16px 0" }}>
                <i className="ph-fill ph-chart-pie-slice" style={{ color: "#cdf14a" }} />
                On-Chain Routing Preview
              </h2>
              <p style={{ fontSize: 13, color: "#8c9099", marginBottom: 20 }}>
                Estimated distribution for ${fmtUsdc(amountInput)} USDC:
              </p>

              {/* Breakdown Table */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, background: "#0c0d0f", padding: 18, borderRadius: 12, border: "1px solid #1a1b20" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 99, background: "#cdf14a" }} />
                    <span style={{ color: "#f4f5f6", fontWeight: 600, fontSize: 14 }}>Emergency Reserve</span>
                  </div>
                  <span style={{ color: "#f4f5f6", fontWeight: 700, fontFamily: "monospace", fontSize: 15 }}>+${fmtUsdc(preview.emergency)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 99, background: "#828994" }} />
                    <span style={{ color: "#f4f5f6", fontWeight: 600, fontSize: 14 }}>Obligation & Taxes</span>
                  </div>
                  <span style={{ color: "#f4f5f6", fontWeight: 700, fontFamily: "monospace", fontSize: 15 }}>+${fmtUsdc(preview.obligation)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 99, background: "#424751" }} />
                    <span style={{ color: "#f4f5f6", fontWeight: 600, fontSize: 14 }}>Timelocked Goal Lot</span>
                  </div>
                  <span style={{ color: "#f4f5f6", fontWeight: 700, fontFamily: "monospace", fontSize: 15 }}>+${fmtUsdc(preview.goal)}</span>
                </div>
                <div style={{ borderTop: "1px solid #1c1d20", margin: "4px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 99, background: "#22262e" }} />
                    <span style={{ color: "#f4f5f6", fontWeight: 700, fontSize: 14 }}>Spendable Pool (Direct)</span>
                  </div>
                  <span style={{ color: "#cdf14a", fontWeight: 800, fontFamily: "monospace", fontSize: 16 }}>+${fmtUsdc(preview.spendable)}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleExecutePayment}
              disabled={isProcessing || !isVersionMatch || amountInput <= 0}
              style={{
                width: "100%",
                padding: "16px 24px",
                borderRadius: 8,
                fontWeight: 800,
                fontSize: 16,
                background: isProcessing || !isVersionMatch ? "#191a1e" : "#cdf14a",
                color: isProcessing || !isVersionMatch ? "#52555e" : "#0a0c07",
                border: isProcessing || !isVersionMatch ? "1px solid #282a2f" : "none",
                cursor: isProcessing || !isVersionMatch ? "not-allowed" : "pointer",
                transition: "opacity 0.2s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                marginTop: 28,
              }}
            >
              {isProcessing ? (
                <>
                  <i className="ph ph-spinner ph-spin" style={{ fontSize: 20 }} />
                  Executing Route...
                </>
              ) : (
                <>
                  <i className="ph-fill ph-paper-plane-right" style={{ fontSize: 20 }} />
                  Execute Routing (${fmtUsdc(amountInput)})
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
