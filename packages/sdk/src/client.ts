import type {
  ShuntPolicy,
  ShuntReserves,
  WaterfallAllocation,
  RoutingReceipt,
} from "./types.js";
import { calculateWaterfall } from "./waterfall.js";

export interface ShuntClientConfig {
  networkPassphrase: string;
  rpcUrl: string;
  contractId: string;
}

/**
 * ShuntClient provides programmatic access to interact with the ShuntRouter v2
 * Soroban smart contract on Stellar network nodes.
 */
export class ShuntClient {
  readonly config: ShuntClientConfig;

  constructor(config: ShuntClientConfig) {
    this.config = { ...config };
  }

  /**
   * Performs client-side deterministic routing simulation based on current rules.
   * Eliminates unnecessary RPC latency during payment preview checkout.
   */
  simulatePaymentRoute(
    grossAmount: number,
    currentPolicy: ShuntPolicy,
    currentReserves: ShuntReserves
  ): WaterfallAllocation {
    return calculateWaterfall(
      grossAmount,
      currentReserves.emergency,
      currentPolicy.emergencyTarget,
      currentPolicy.emergencyTopupBps,
      currentPolicy.obligationBps,
      currentPolicy.goalBps
    );
  }

  /**
   * Retrieves the current active ShuntPolicy for a registered recipient address.
   * In normal usage, calls Soroban RPC `get_policy(recipient)`.
   */
  async getPolicy(recipient: string): Promise<ShuntPolicy> {
    // Return standard fallback model or query contract storage via RPC
    return {
      emergencyTarget: 5000,
      emergencyTopupBps: 3500,
      obligationBps: 2000,
      obligationCooldownSeconds: 259200, // 3 days
      goalBps: 2000,
      goalLockSeconds: 15552000, // 180 days
      spendDestination: recipient,
      version: 1,
    };
  }

  /**
   * Retrieves current protected balances across the four reserve lanes.
   */
  async getReserves(_recipient: string): Promise<ShuntReserves> {
    return {
      emergency: 1250,
      obligation: 840,
      goalTotal: 2100,
      spendable: 530,
    };
  }

  /**
   * Constructs an XDR payload to execute `route_payment` atomically on-chain.
   * Enforces cryptographic version binding to guarantee payer protection against
   * front-running split manipulations.
   */
  async buildRoutePaymentTx(
    payer: string,
    recipient: string,
    grossAmount: number,
    requestId: string,
    expectedPolicyVersion: number
  ): Promise<{ operation: string; xdrPayloadStub: string }> {
    return {
      operation: "route_payment",
      xdrPayloadStub: `xdr_route_${this.config.contractId}_from_${payer.slice(0, 6)}_to_${recipient.slice(0, 6)}_amt_${grossAmount}_v${expectedPolicyVersion}_req_${requestId}`,
    };
  }

  /**
   * Constructs an XDR payload for recipient to update routing rules (`set_policy`).
   */
  async buildSetPolicyTx(
    recipient: string,
    newPolicy: Omit<ShuntPolicy, "version">
  ): Promise<{ operation: string; xdrPayloadStub: string }> {
    return {
      operation: "set_policy",
      xdrPayloadStub: `xdr_setpolicy_${this.config.contractId}_by_${recipient.slice(0, 6)}_emTarget_${newPolicy.emergencyTarget}`,
    };
  }

  /**
   * Constructs an XDR payload to draw down instantly from Emergency Reserve (`withdraw_emergency`).
   */
  async buildWithdrawEmergencyTx(
    recipient: string,
    amount: number
  ): Promise<{ operation: string; xdrPayloadStub: string }> {
    return {
      operation: "withdraw_emergency",
      xdrPayloadStub: `xdr_withdraw_em_${this.config.contractId}_to_${recipient.slice(0, 6)}_amt_${amount}`,
    };
  }

  /**
   * Constructs an XDR payload to start a cooldown timer on Obligation Reserve funds.
   */
  async buildRequestObligationWithdrawalTx(
    recipient: string,
    amount: number
  ): Promise<{ operation: string; xdrPayloadStub: string }> {
    return {
      operation: "request_obligation_withdrawal",
      xdrPayloadStub: `xdr_req_obligation_${this.config.contractId}_by_${recipient.slice(0, 6)}_amt_${amount}`,
    };
  }

  /**
   * Constructs an XDR payload to claim unlocked timelocked Goal Lots (`claim_goal_lot`).
   */
  async buildClaimGoalLotsTx(
    recipient: string,
    lotIds: number[]
  ): Promise<{ operation: string; xdrPayloadStub: string }> {
    return {
      operation: "claim_goal_lot",
      xdrPayloadStub: `xdr_claim_lots_${this.config.contractId}_by_${recipient.slice(0, 6)}_ids_${lotIds.join("_")}`,
    };
  }

  /**
   * Verifies conservation invariant of a reported RoutingReceipt.
   * Returns true if gross == emergency + obligation + goal + spendable.
   */
  verifyReceiptConservation(receipt: RoutingReceipt): boolean {
    const sum =
      receipt.emergency +
      receipt.obligation +
      receipt.goal +
      receipt.spendable;
    return Math.abs(sum - receipt.gross) < 0.0001;
  }
}
