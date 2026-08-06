/**
 * Policy definition representing an immutable on-chain routing configuration
 * for a recipient in Shunt Router v2.
 */
export interface ShuntPolicy {
  emergencyTarget: number; // in stroopes / minimal USDC decimals (7 or 18 depending on token)
  emergencyTopupBps: number; // 0 to 10000 basis points (e.g., 3000 = 30%)
  obligationBps: number; // percentage of post-emergency remaining amount
  obligationCooldownSeconds: number; // cooldown duration in seconds before release
  goalBps: number; // percentage of remaining post-emergency amount
  goalLockSeconds: number; // lock time in seconds for individual goal lots
  spendDestination: string; // Stellar / Soroban address for immediate liquid residual receipt
  version: number; // Monotonically increasing version tracker
}

/**
 * On-chain balances held in protected reserves inside ShuntRouter v2.
 */
export interface ShuntReserves {
  emergency: number;
  obligation: number;
  goalTotal: number;
  spendable: number;
}

/**
 * An independent timelocked storage lot generated during a payment route.
 */
export interface GoalLot {
  lotId: number;
  amountUsdc: number;
  createdAt: number; // UNIX Epoch millseconds or seconds
  unlockAt: number;
  claimed: boolean;
}

/**
 * A pending obligation cooldown withdrawal request.
 */
export interface WithdrawalRequest {
  withdrawalId: number;
  amountUsdc: number;
  requestedAt: number;
  executeAfter: number; // timestamp when cooldown terminates
}

/**
 * Deterministic allocation result representing exact division of incoming funds.
 */
export interface WaterfallAllocation {
  gross: number;
  emergency: number;
  obligation: number;
  goal: number;
  spendable: number;
}

/**
 * Cryptographic audit proof receipt emitted upon payment routing.
 */
export interface RoutingReceipt extends WaterfallAllocation {
  txHash: string;
  requestId: string;
  payer: string;
  recipient: string;
  policyVersion: number;
  timestamp: number;
  memo: string;
}
