import { describe, it, expect } from "vitest";
import { calculateWaterfall, ShuntClient, type RoutingReceipt } from "./index.js";

describe("Shunt v2 SDK Deterministic Waterfall Calculations", () => {
  it("enforces conservation invariant on standard routing split", () => {
    const gross = 2500;
    const currentEmergency = 1000;
    const emergencyTarget = 5000; // Gap is 4000
    const emergencyBps = 3500; // 35%
    const obligationBps = 2000; // 20%
    const goalBps = 2000; // 20%

    const alloc = calculateWaterfall(gross, currentEmergency, emergencyTarget, emergencyBps, obligationBps, goalBps);
    
    expect(alloc.emergency).toBe(875); // 35% of 2500
    const remaining = 2500 - 875; // 1625
    expect(alloc.obligation).toBe(Math.floor(remaining * 0.20)); // 325
    expect(alloc.goal).toBe(Math.floor(remaining * 0.20)); // 325
    expect(alloc.spendable).toBe(remaining - 325 - 325); // 975

    const totalSum = alloc.emergency + alloc.obligation + alloc.goal + alloc.spendable;
    expect(totalSum).toBe(gross);
  });

  it("caps emergency reserve replenishment when near target balance", () => {
    const gross = 10000;
    const currentEmergency = 4800;
    const emergencyTarget = 5000; // Only 200 needed!
    const emergencyBps = 5000; // 50% would normally be 5000

    const alloc = calculateWaterfall(gross, currentEmergency, emergencyTarget, emergencyBps, 1000, 1000);
    expect(alloc.emergency).toBe(200); // capped at gap!
    expect(alloc.gross).toBe(10000);
  });

  it("client verification confirms conservation invariant on receipts", () => {
    const client = new ShuntClient({
      networkPassphrase: "Test SDF Network ; September 2015",
      rpcUrl: "https://soroban-testnet.stellar.org",
      contractId: "CC_SHUNT_ROUTER_V2_MOCK_CONTRACT",
    });

    const validReceipt: RoutingReceipt = {
      gross: 5000,
      emergency: 1500,
      obligation: 700,
      goal: 700,
      spendable: 2100,
      txHash: "0x_hash_mock_test",
      requestId: "REQ-7721-MOCK",
      payer: "GA_PAYER",
      recipient: "GB_RECIPIENT",
      policyVersion: 2,
      timestamp: Date.now(),
      memo: "Test Audit",
    };

    expect(client.verifyReceiptConservation(validReceipt)).toBe(true);
  });
});
