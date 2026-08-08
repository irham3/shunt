import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CDVFVWRP5YZ7GSXKGKYDIQHHMV4UB2QFLC4NDFB2UFRUUNBAKUFYKDTR",
  }
} as const


/**
 * Global protocol configuration, set at construction time.
 */
export interface Config {
  /**
 * Admin address (multisig on mainnet).
 */
admin: string;
  /**
 * Maximum allowed obligation cooldown in seconds.
 */
max_cooldown_seconds: u64;
  /**
 * Maximum allowed goal lock duration in seconds.
 */
max_lock_seconds: u64;
  /**
 * Maximum open (unclaimed) goal lots per user.
 */
max_open_lots: u32;
  /**
 * Whether new routes are paused (withdrawals still allowed).
 */
paused: boolean;
  /**
 * USDC Stellar Asset Contract address.
 */
usdc: string;
}


/**
 * Protocol limits, passed to constructor.
 */
export interface Limits {
  max_cooldown_seconds: u64;
  max_lock_seconds: u64;
  max_open_lots: u32;
}


/**
 * A recipient's income-routing policy (PRD §8.1).
 * 
 * Controls how incoming USDC is split across buckets.
 * Policy version increments on every update; payers bind to an expected
 * version to prevent stale-policy routing.
 */
export interface Policy {
  /**
 * Whether this policy is active (can receive routes).
 */
active: boolean;
  /**
 * Target emergency reserve in USDC stroops (7-decimal).
 * Emergency allocation stops when balance reaches this target.
 */
emergency_target: i128;
  /**
 * Max percentage of gross allocated to emergency, in basis points.
 */
emergency_topup_bps: u32;
  /**
 * Percentage of post-obligation amount for goal savings, in bps.
 */
goal_bps: u32;
  /**
 * Lock duration in seconds for each new goal lot.
 */
goal_lock_seconds: u64;
  /**
 * Percentage of post-emergency amount for obligation reserve, in bps.
 */
obligation_bps: u32;
  /**
 * Cooldown seconds before obligation withdrawal can be executed.
 */
obligation_cooldown_seconds: u64;
  /**
 * Policy owner (the income recipient).
 */
owner: string;
  /**
 * Where spendable USDC is sent (owner's wallet or a separate address).
 */
spend_destination: string;
  /**
 * Monotonically increasing policy version (starts at 1).
 */
version: u32;
}


/**
 * A single goal deposit lot with its own maturity date (PRD §9.2).
 */
export interface GoalLot {
  /**
 * USDC amount in this lot (7-decimal stroops).
 */
amount: i128;
  /**
 * Whether this lot has been claimed.
 */
claimed: boolean;
  /**
 * Ledger timestamp when this lot was created.
 */
created_at: u64;
  /**
 * Lot owner (recipient).
 */
owner: string;
  /**
 * Ledger timestamp after which this lot can be claimed.
 */
unlock_at: u64;
}


/**
 * Computed allocation breakdown returned by `route_payment` and
 * `preview_route` (PRD §9.2).
 */
export interface Allocation {
  /**
 * Amount routed to emergency reserve.
 */
emergency: i128;
  /**
 * Amount routed to a new goal lot.
 */
goal: i128;
  /**
 * Total payment amount.
 */
gross: i128;
  /**
 * Amount routed to obligation reserve.
 */
obligation: i128;
  /**
 * Amount sent to spend destination.
 */
spendable: i128;
}


/**
 * Input parameters for creating/updating a policy.
 * Excludes `owner` (derived from caller) and `version` (auto-incremented).
 */
export interface PolicyInput {
  emergency_target: i128;
  emergency_topup_bps: u32;
  goal_bps: u32;
  goal_lock_seconds: u64;
  obligation_bps: u32;
  obligation_cooldown_seconds: u64;
  spend_destination: string;
}


/**
 * Aggregated bucket balances for a recipient (PRD §9.2).
 */
export interface BucketBalances {
  /**
 * Emergency reserve balance (instantly withdrawable by owner).
 */
emergency: i128;
  /**
 * Total across all unclaimed goal lots.
 */
goal_total: i128;
  /**
 * Obligation reserve balance (cooldown-gated withdrawal).
 */
obligation: i128;
}


/**
 * Pending obligation withdrawal request.
 */
export interface WithdrawalRequest {
  /**
 * Requested withdrawal amount.
 */
amount: i128;
  /**
 * Ledger timestamp when request was created.
 */
created_at: u64;
  /**
 * Ledger timestamp after which withdrawal can be executed.
 */
execute_after: u64;
  /**
 * Request owner.
 */
owner: string;
}

export const Errors = {
  /**
   * Protocol is paused; new routes are rejected.
   */
  1: {message:"ProtocolPaused"},
  /**
   * Caller is not the admin.
   */
  2: {message:"NotAdmin"},
  /**
   * Caller is not the owner of the resource.
   */
  3: {message:"NotOwner"},
  /**
   * No policy found for the given recipient.
   */
  10: {message:"PolicyNotFound"},
  /**
   * Policy is not active (disabled by owner).
   */
  11: {message:"PolicyNotActive"},
  /**
   * BPS values exceed allowed bounds.
   */
  12: {message:"InvalidBps"},
  /**
   * Emergency target must be non-negative.
   */
  13: {message:"InvalidEmergencyTarget"},
  /**
   * Lock duration exceeds protocol maximum.
   */
  14: {message:"LockTooLong"},
  /**
   * Cooldown duration exceeds protocol maximum.
   */
  15: {message:"CooldownTooLong"},
  /**
   * Spend destination is invalid (zero/contract).
   */
  16: {message:"InvalidSpendDestination"},
  /**
   * Payment amount must be positive.
   */
  20: {message:"AmountNotPositive"},
  /**
   * Request has already been processed (replay protection).
   */
  21: {message:"RequestAlreadyProcessed"},
  /**
   * Expected policy version doesn't match current version.
   */
  22: {message:"PolicyVersionMismatch"},
  /**
   * Only the configured USDC asset is accepted.
   */
  23: {message:"UnsupportedAsset"},
  /**
   * Payment request has expired.
   */
  24: {message:"RequestExpired"},
  /**
   * Insufficient emergency balance for withdrawal.
   */
  30: {message:"InsufficientEmergency"},
  /**
   * Insufficient obligation balance for withdrawal.
   */
  31: {message:"InsufficientObligation"},
  /**
   * No pending withdrawal request found.
   */
  32: {message:"WithdrawalNotFound"},
  /**
   * Cooldown period has not elapsed yet.
   */
  33: {message:"CooldownNotElapsed"},
  /**
   * Goal lot not found.
   */
  34: {message:"GoalLotNotFound"},
  /**
   * Goal lot has not matured yet.
   */
  35: {message:"GoalNotMatured"},
  /**
   * Goal lot has already been claimed.
   */
  36: {message:"GoalAlreadyClaimed"},
  /**
   * Maximum number of open goal lots reached.
   */
  37: {message:"TooManyOpenLots"},
  /**
   * Integer overflow in allocation calculation.
   */
  50: {message:"Overflow"}
}












export type DataKey = {tag: "Config", values: void} | {tag: "Policy", values: readonly [string]} | {tag: "Balances", values: readonly [string]} | {tag: "GoalLot", values: readonly [u64]} | {tag: "NextLotId", values: void} | {tag: "OpenLotCount", values: readonly [string]} | {tag: "WithdrawalReq", values: readonly [u64]} | {tag: "NextWithdrawalId", values: void} | {tag: "Processed", values: readonly [Buffer]};

export interface Client {
  /**
   * Construct and simulate a pause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Pause the protocol. Stops new routes but NOT withdrawals.
   */
  pause: (options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a unpause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Unpause the protocol. Resumes routing.
   */
  unpause: (options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Upgrade the contract WASM. Admin-only.
   * Does NOT give admin power over user funds (PRD §9.7).
   */
  upgrade: ({new_wasm_hash}: {new_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get global protocol configuration.
   */
  get_config: (options?: MethodOptions) => Promise<AssembledTransaction<Config>>

  /**
   * Construct and simulate a get_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Query a recipient's current policy.
   */
  get_policy: ({owner}: {owner: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Policy>>>

  /**
   * Construct and simulate a set_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Create or update income policy. Owner must authorize.
   */
  set_policy: ({owner, input}: {owner: string, input: PolicyInput}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_balances transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get bucket balances for a recipient.
   */
  get_balances: ({owner}: {owner: string}, options?: MethodOptions) => Promise<AssembledTransaction<BucketBalances>>

  /**
   * Construct and simulate a get_goal_lot transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get a specific goal lot by ID.
   */
  get_goal_lot: ({lot_id}: {lot_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Option<GoalLot>>>

  /**
   * Construct and simulate a preview_route transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Preview allocation for a hypothetical payment (read-only).
   */
  preview_route: ({recipient, amount}: {recipient: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Allocation>>

  /**
   * Construct and simulate a route_payment transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Execute an atomic payment route. Payer must authorize.
   * Recipient does NOT sign.
   */
  route_payment: ({payer, recipient, amount, request_id, expected_policy_version}: {payer: string, recipient: string, amount: i128, request_id: Buffer, expected_policy_version: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Allocation>>

  /**
   * Construct and simulate a claim_goal_lots transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Claim matured goal lots (batch).
   */
  claim_goal_lots: ({owner, lot_ids, destination}: {owner: string, lot_ids: Array<u64>, destination: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a withdraw_emergency transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Withdraw from emergency reserve (instant, works during pause).
   */
  withdraw_emergency: ({owner, amount, destination}: {owner: string, amount: i128, destination: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a is_request_processed transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Check if a request ID has been processed.
   */
  is_request_processed: ({request_id}: {request_id: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a cancel_obligation_withdrawal transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Cancel pending obligation withdrawal.
   */
  cancel_obligation_withdrawal: ({owner, withdrawal_id}: {owner: string, withdrawal_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a execute_obligation_withdrawal transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Execute obligation withdrawal after cooldown.
   */
  execute_obligation_withdrawal: ({owner, withdrawal_id, destination}: {owner: string, withdrawal_id: u64, destination: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a request_obligation_withdrawal transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Request obligation withdrawal (starts cooldown).
   */
  request_obligation_withdrawal: ({owner, amount}: {owner: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<u64>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin, usdc, limits}: {admin: string, usdc: string, limits: Limits},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({admin, usdc, limits}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAADlQYXVzZSB0aGUgcHJvdG9jb2wuIFN0b3BzIG5ldyByb3V0ZXMgYnV0IE5PVCB3aXRoZHJhd2Fscy4AAAAAAAAFcGF1c2UAAAAAAAAAAAAAAA==",
        "AAAAAAAAACZVbnBhdXNlIHRoZSBwcm90b2NvbC4gUmVzdW1lcyByb3V0aW5nLgAAAAAAB3VucGF1c2UAAAAAAAAAAAA=",
        "AAAAAAAAAF1VcGdyYWRlIHRoZSBjb250cmFjdCBXQVNNLiBBZG1pbi1vbmx5LgpEb2VzIE5PVCBnaXZlIGFkbWluIHBvd2VyIG92ZXIgdXNlciBmdW5kcyAoUFJEIMKnOS43KS4AAAAAAAAHdXBncmFkZQAAAAABAAAAAAAAAA1uZXdfd2FzbV9oYXNoAAAAAAAD7gAAACAAAAAA",
        "AAAAAAAAACJHZXQgZ2xvYmFsIHByb3RvY29sIGNvbmZpZ3VyYXRpb24uAAAAAAAKZ2V0X2NvbmZpZwAAAAAAAAAAAAEAAAfQAAAABkNvbmZpZwAA",
        "AAAAAAAAACNRdWVyeSBhIHJlY2lwaWVudCdzIGN1cnJlbnQgcG9saWN5LgAAAAAKZ2V0X3BvbGljeQAAAAAAAQAAAAAAAAAFb3duZXIAAAAAAAATAAAAAQAAA+gAAAfQAAAABlBvbGljeQAA",
        "AAAAAAAAADVDcmVhdGUgb3IgdXBkYXRlIGluY29tZSBwb2xpY3kuIE93bmVyIG11c3QgYXV0aG9yaXplLgAAAAAAAApzZXRfcG9saWN5AAAAAAACAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAABWlucHV0AAAAAAAH0AAAAAtQb2xpY3lJbnB1dAAAAAAA",
        "AAAAAAAAACRHZXQgYnVja2V0IGJhbGFuY2VzIGZvciBhIHJlY2lwaWVudC4AAAAMZ2V0X2JhbGFuY2VzAAAAAQAAAAAAAAAFb3duZXIAAAAAAAATAAAAAQAAB9AAAAAOQnVja2V0QmFsYW5jZXMAAA==",
        "AAAAAAAAAB5HZXQgYSBzcGVjaWZpYyBnb2FsIGxvdCBieSBJRC4AAAAAAAxnZXRfZ29hbF9sb3QAAAABAAAAAAAAAAZsb3RfaWQAAAAAAAYAAAABAAAD6AAAB9AAAAAHR29hbExvdAA=",
        "AAAAAAAAAKlEZXBsb3ktdGltZSBjb25zdHJ1Y3RvciDigJQgbm8gZnJvbnQtcnVuIHdpbmRvdyAoUFJEIMKnOS44KS4KCkNhbGxlZCBleGFjdGx5IG9uY2Ugd2hlbiB0aGUgY29udHJhY3QgaXMgZGVwbG95ZWQuIFNldHMgdGhlIGFkbWluLApVU0RDIHRva2VuIGFkZHJlc3MsIGFuZCBwcm90b2NvbCBsaW1pdHMuAAAAAAAADV9fY29uc3RydWN0b3IAAAAAAAADAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAABHVzZGMAAAATAAAAAAAAAAZsaW1pdHMAAAAAB9AAAAAGTGltaXRzAAAAAAAA",
        "AAAAAAAAADpQcmV2aWV3IGFsbG9jYXRpb24gZm9yIGEgaHlwb3RoZXRpY2FsIHBheW1lbnQgKHJlYWQtb25seSkuAAAAAAANcHJldmlld19yb3V0ZQAAAAAAAAIAAAAAAAAACXJlY2lwaWVudAAAAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAEAAAfQAAAACkFsbG9jYXRpb24AAA==",
        "AAAAAAAAAE9FeGVjdXRlIGFuIGF0b21pYyBwYXltZW50IHJvdXRlLiBQYXllciBtdXN0IGF1dGhvcml6ZS4KUmVjaXBpZW50IGRvZXMgTk9UIHNpZ24uAAAAAA1yb3V0ZV9wYXltZW50AAAAAAAABQAAAAAAAAAFcGF5ZXIAAAAAAAATAAAAAAAAAAlyZWNpcGllbnQAAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAACnJlcXVlc3RfaWQAAAAAA+4AAAAgAAAAAAAAABdleHBlY3RlZF9wb2xpY3lfdmVyc2lvbgAAAAAEAAAAAQAAB9AAAAAKQWxsb2NhdGlvbgAA",
        "AAAAAAAAACBDbGFpbSBtYXR1cmVkIGdvYWwgbG90cyAoYmF0Y2gpLgAAAA9jbGFpbV9nb2FsX2xvdHMAAAAAAwAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAdsb3RfaWRzAAAAA+oAAAAGAAAAAAAAAAtkZXN0aW5hdGlvbgAAAAATAAAAAA==",
        "AAAAAAAAAD5XaXRoZHJhdyBmcm9tIGVtZXJnZW5jeSByZXNlcnZlIChpbnN0YW50LCB3b3JrcyBkdXJpbmcgcGF1c2UpLgAAAAAAEndpdGhkcmF3X2VtZXJnZW5jeQAAAAAAAwAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAC2Rlc3RpbmF0aW9uAAAAABMAAAAA",
        "AAAAAAAAAClDaGVjayBpZiBhIHJlcXVlc3QgSUQgaGFzIGJlZW4gcHJvY2Vzc2VkLgAAAAAAABRpc19yZXF1ZXN0X3Byb2Nlc3NlZAAAAAEAAAAAAAAACnJlcXVlc3RfaWQAAAAAA+4AAAAgAAAAAQAAAAE=",
        "AAAAAAAAACVDYW5jZWwgcGVuZGluZyBvYmxpZ2F0aW9uIHdpdGhkcmF3YWwuAAAAAAAAHGNhbmNlbF9vYmxpZ2F0aW9uX3dpdGhkcmF3YWwAAAACAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAADXdpdGhkcmF3YWxfaWQAAAAAAAAGAAAAAA==",
        "AAAAAAAAAC1FeGVjdXRlIG9ibGlnYXRpb24gd2l0aGRyYXdhbCBhZnRlciBjb29sZG93bi4AAAAAAAAdZXhlY3V0ZV9vYmxpZ2F0aW9uX3dpdGhkcmF3YWwAAAAAAAADAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAADXdpdGhkcmF3YWxfaWQAAAAAAAAGAAAAAAAAAAtkZXN0aW5hdGlvbgAAAAATAAAAAA==",
        "AAAAAAAAADBSZXF1ZXN0IG9ibGlnYXRpb24gd2l0aGRyYXdhbCAoc3RhcnRzIGNvb2xkb3duKS4AAAAdcmVxdWVzdF9vYmxpZ2F0aW9uX3dpdGhkcmF3YWwAAAAAAAACAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAEAAAAG",
        "AAAAAQAAADhHbG9iYWwgcHJvdG9jb2wgY29uZmlndXJhdGlvbiwgc2V0IGF0IGNvbnN0cnVjdGlvbiB0aW1lLgAAAAAAAAAGQ29uZmlnAAAAAAAGAAAAJEFkbWluIGFkZHJlc3MgKG11bHRpc2lnIG9uIG1haW5uZXQpLgAAAAVhZG1pbgAAAAAAABMAAAAvTWF4aW11bSBhbGxvd2VkIG9ibGlnYXRpb24gY29vbGRvd24gaW4gc2Vjb25kcy4AAAAAFG1heF9jb29sZG93bl9zZWNvbmRzAAAABgAAAC5NYXhpbXVtIGFsbG93ZWQgZ29hbCBsb2NrIGR1cmF0aW9uIGluIHNlY29uZHMuAAAAAAAQbWF4X2xvY2tfc2Vjb25kcwAAAAYAAAAsTWF4aW11bSBvcGVuICh1bmNsYWltZWQpIGdvYWwgbG90cyBwZXIgdXNlci4AAAANbWF4X29wZW5fbG90cwAAAAAAAAQAAAA6V2hldGhlciBuZXcgcm91dGVzIGFyZSBwYXVzZWQgKHdpdGhkcmF3YWxzIHN0aWxsIGFsbG93ZWQpLgAAAAAABnBhdXNlZAAAAAAAAQAAACRVU0RDIFN0ZWxsYXIgQXNzZXQgQ29udHJhY3QgYWRkcmVzcy4AAAAEdXNkYwAAABM=",
        "AAAAAQAAACdQcm90b2NvbCBsaW1pdHMsIHBhc3NlZCB0byBjb25zdHJ1Y3Rvci4AAAAAAAAAAAZMaW1pdHMAAAAAAAMAAAAAAAAAFG1heF9jb29sZG93bl9zZWNvbmRzAAAABgAAAAAAAAAQbWF4X2xvY2tfc2Vjb25kcwAAAAYAAAAAAAAADW1heF9vcGVuX2xvdHMAAAAAAAAE",
        "AAAAAQAAANRBIHJlY2lwaWVudCdzIGluY29tZS1yb3V0aW5nIHBvbGljeSAoUFJEIMKnOC4xKS4KCkNvbnRyb2xzIGhvdyBpbmNvbWluZyBVU0RDIGlzIHNwbGl0IGFjcm9zcyBidWNrZXRzLgpQb2xpY3kgdmVyc2lvbiBpbmNyZW1lbnRzIG9uIGV2ZXJ5IHVwZGF0ZTsgcGF5ZXJzIGJpbmQgdG8gYW4gZXhwZWN0ZWQKdmVyc2lvbiB0byBwcmV2ZW50IHN0YWxlLXBvbGljeSByb3V0aW5nLgAAAAAAAAAGUG9saWN5AAAAAAAKAAAAM1doZXRoZXIgdGhpcyBwb2xpY3kgaXMgYWN0aXZlIChjYW4gcmVjZWl2ZSByb3V0ZXMpLgAAAAAGYWN0aXZlAAAAAAABAAAAclRhcmdldCBlbWVyZ2VuY3kgcmVzZXJ2ZSBpbiBVU0RDIHN0cm9vcHMgKDctZGVjaW1hbCkuCkVtZXJnZW5jeSBhbGxvY2F0aW9uIHN0b3BzIHdoZW4gYmFsYW5jZSByZWFjaGVzIHRoaXMgdGFyZ2V0LgAAAAAAEGVtZXJnZW5jeV90YXJnZXQAAAALAAAAQE1heCBwZXJjZW50YWdlIG9mIGdyb3NzIGFsbG9jYXRlZCB0byBlbWVyZ2VuY3ksIGluIGJhc2lzIHBvaW50cy4AAAATZW1lcmdlbmN5X3RvcHVwX2JwcwAAAAAEAAAAPlBlcmNlbnRhZ2Ugb2YgcG9zdC1vYmxpZ2F0aW9uIGFtb3VudCBmb3IgZ29hbCBzYXZpbmdzLCBpbiBicHMuAAAAAAAIZ29hbF9icHMAAAAEAAAAL0xvY2sgZHVyYXRpb24gaW4gc2Vjb25kcyBmb3IgZWFjaCBuZXcgZ29hbCBsb3QuAAAAABFnb2FsX2xvY2tfc2Vjb25kcwAAAAAAAAYAAABDUGVyY2VudGFnZSBvZiBwb3N0LWVtZXJnZW5jeSBhbW91bnQgZm9yIG9ibGlnYXRpb24gcmVzZXJ2ZSwgaW4gYnBzLgAAAAAOb2JsaWdhdGlvbl9icHMAAAAAAAQAAAA+Q29vbGRvd24gc2Vjb25kcyBiZWZvcmUgb2JsaWdhdGlvbiB3aXRoZHJhd2FsIGNhbiBiZSBleGVjdXRlZC4AAAAAABtvYmxpZ2F0aW9uX2Nvb2xkb3duX3NlY29uZHMAAAAABgAAACRQb2xpY3kgb3duZXIgKHRoZSBpbmNvbWUgcmVjaXBpZW50KS4AAAAFb3duZXIAAAAAAAATAAAARFdoZXJlIHNwZW5kYWJsZSBVU0RDIGlzIHNlbnQgKG93bmVyJ3Mgd2FsbGV0IG9yIGEgc2VwYXJhdGUgYWRkcmVzcykuAAAAEXNwZW5kX2Rlc3RpbmF0aW9uAAAAAAAAEwAAADZNb25vdG9uaWNhbGx5IGluY3JlYXNpbmcgcG9saWN5IHZlcnNpb24gKHN0YXJ0cyBhdCAxKS4AAAAAAAd2ZXJzaW9uAAAAAAQ=",
        "AAAAAQAAAEFBIHNpbmdsZSBnb2FsIGRlcG9zaXQgbG90IHdpdGggaXRzIG93biBtYXR1cml0eSBkYXRlIChQUkQgwqc5LjIpLgAAAAAAAAAAAAAHR29hbExvdAAAAAAFAAAALFVTREMgYW1vdW50IGluIHRoaXMgbG90ICg3LWRlY2ltYWwgc3Ryb29wcykuAAAABmFtb3VudAAAAAAACwAAACJXaGV0aGVyIHRoaXMgbG90IGhhcyBiZWVuIGNsYWltZWQuAAAAAAAHY2xhaW1lZAAAAAABAAAAK0xlZGdlciB0aW1lc3RhbXAgd2hlbiB0aGlzIGxvdCB3YXMgY3JlYXRlZC4AAAAACmNyZWF0ZWRfYXQAAAAAAAYAAAAWTG90IG93bmVyIChyZWNpcGllbnQpLgAAAAAABW93bmVyAAAAAAAAEwAAADVMZWRnZXIgdGltZXN0YW1wIGFmdGVyIHdoaWNoIHRoaXMgbG90IGNhbiBiZSBjbGFpbWVkLgAAAAAAAAl1bmxvY2tfYXQAAAAAAAAG",
        "AAAAAQAAAFpDb21wdXRlZCBhbGxvY2F0aW9uIGJyZWFrZG93biByZXR1cm5lZCBieSBgcm91dGVfcGF5bWVudGAgYW5kCmBwcmV2aWV3X3JvdXRlYCAoUFJEIMKnOS4yKS4AAAAAAAAAAAAKQWxsb2NhdGlvbgAAAAAABQAAACNBbW91bnQgcm91dGVkIHRvIGVtZXJnZW5jeSByZXNlcnZlLgAAAAAJZW1lcmdlbmN5AAAAAAAACwAAACBBbW91bnQgcm91dGVkIHRvIGEgbmV3IGdvYWwgbG90LgAAAARnb2FsAAAACwAAABVUb3RhbCBwYXltZW50IGFtb3VudC4AAAAAAAAFZ3Jvc3MAAAAAAAALAAAAJEFtb3VudCByb3V0ZWQgdG8gb2JsaWdhdGlvbiByZXNlcnZlLgAAAApvYmxpZ2F0aW9uAAAAAAALAAAAIUFtb3VudCBzZW50IHRvIHNwZW5kIGRlc3RpbmF0aW9uLgAAAAAAAAlzcGVuZGFibGUAAAAAAAAL",
        "AAAAAQAAAHlJbnB1dCBwYXJhbWV0ZXJzIGZvciBjcmVhdGluZy91cGRhdGluZyBhIHBvbGljeS4KRXhjbHVkZXMgYG93bmVyYCAoZGVyaXZlZCBmcm9tIGNhbGxlcikgYW5kIGB2ZXJzaW9uYCAoYXV0by1pbmNyZW1lbnRlZCkuAAAAAAAAAAAAAAtQb2xpY3lJbnB1dAAAAAAHAAAAAAAAABBlbWVyZ2VuY3lfdGFyZ2V0AAAACwAAAAAAAAATZW1lcmdlbmN5X3RvcHVwX2JwcwAAAAAEAAAAAAAAAAhnb2FsX2JwcwAAAAQAAAAAAAAAEWdvYWxfbG9ja19zZWNvbmRzAAAAAAAABgAAAAAAAAAOb2JsaWdhdGlvbl9icHMAAAAAAAQAAAAAAAAAG29ibGlnYXRpb25fY29vbGRvd25fc2Vjb25kcwAAAAAGAAAAAAAAABFzcGVuZF9kZXN0aW5hdGlvbgAAAAAAABM=",
        "AAAAAQAAADdBZ2dyZWdhdGVkIGJ1Y2tldCBiYWxhbmNlcyBmb3IgYSByZWNpcGllbnQgKFBSRCDCpzkuMikuAAAAAAAAAAAOQnVja2V0QmFsYW5jZXMAAAAAAAMAAAA8RW1lcmdlbmN5IHJlc2VydmUgYmFsYW5jZSAoaW5zdGFudGx5IHdpdGhkcmF3YWJsZSBieSBvd25lcikuAAAACWVtZXJnZW5jeQAAAAAAAAsAAAAlVG90YWwgYWNyb3NzIGFsbCB1bmNsYWltZWQgZ29hbCBsb3RzLgAAAAAAAApnb2FsX3RvdGFsAAAAAAALAAAAN09ibGlnYXRpb24gcmVzZXJ2ZSBiYWxhbmNlIChjb29sZG93bi1nYXRlZCB3aXRoZHJhd2FsKS4AAAAACm9ibGlnYXRpb24AAAAAAAs=",
        "AAAAAQAAACZQZW5kaW5nIG9ibGlnYXRpb24gd2l0aGRyYXdhbCByZXF1ZXN0LgAAAAAAAAAAABFXaXRoZHJhd2FsUmVxdWVzdAAAAAAAAAQAAAAcUmVxdWVzdGVkIHdpdGhkcmF3YWwgYW1vdW50LgAAAAZhbW91bnQAAAAAAAsAAAAqTGVkZ2VyIHRpbWVzdGFtcCB3aGVuIHJlcXVlc3Qgd2FzIGNyZWF0ZWQuAAAAAAAKY3JlYXRlZF9hdAAAAAAABgAAADhMZWRnZXIgdGltZXN0YW1wIGFmdGVyIHdoaWNoIHdpdGhkcmF3YWwgY2FuIGJlIGV4ZWN1dGVkLgAAAA1leGVjdXRlX2FmdGVyAAAAAAAABgAAAA5SZXF1ZXN0IG93bmVyLgAAAAAABW93bmVyAAAAAAAAEw==",
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAAGAAAACxQcm90b2NvbCBpcyBwYXVzZWQ7IG5ldyByb3V0ZXMgYXJlIHJlamVjdGVkLgAAAA5Qcm90b2NvbFBhdXNlZAAAAAAAAQAAABhDYWxsZXIgaXMgbm90IHRoZSBhZG1pbi4AAAAITm90QWRtaW4AAAACAAAAKENhbGxlciBpcyBub3QgdGhlIG93bmVyIG9mIHRoZSByZXNvdXJjZS4AAAAITm90T3duZXIAAAADAAAAKE5vIHBvbGljeSBmb3VuZCBmb3IgdGhlIGdpdmVuIHJlY2lwaWVudC4AAAAOUG9saWN5Tm90Rm91bmQAAAAAAAoAAAApUG9saWN5IGlzIG5vdCBhY3RpdmUgKGRpc2FibGVkIGJ5IG93bmVyKS4AAAAAAAAPUG9saWN5Tm90QWN0aXZlAAAAAAsAAAAhQlBTIHZhbHVlcyBleGNlZWQgYWxsb3dlZCBib3VuZHMuAAAAAAAACkludmFsaWRCcHMAAAAAAAwAAAAmRW1lcmdlbmN5IHRhcmdldCBtdXN0IGJlIG5vbi1uZWdhdGl2ZS4AAAAAABZJbnZhbGlkRW1lcmdlbmN5VGFyZ2V0AAAAAAANAAAAJ0xvY2sgZHVyYXRpb24gZXhjZWVkcyBwcm90b2NvbCBtYXhpbXVtLgAAAAALTG9ja1Rvb0xvbmcAAAAADgAAACtDb29sZG93biBkdXJhdGlvbiBleGNlZWRzIHByb3RvY29sIG1heGltdW0uAAAAAA9Db29sZG93blRvb0xvbmcAAAAADwAAAC1TcGVuZCBkZXN0aW5hdGlvbiBpcyBpbnZhbGlkICh6ZXJvL2NvbnRyYWN0KS4AAAAAAAAXSW52YWxpZFNwZW5kRGVzdGluYXRpb24AAAAAEAAAACBQYXltZW50IGFtb3VudCBtdXN0IGJlIHBvc2l0aXZlLgAAABFBbW91bnROb3RQb3NpdGl2ZQAAAAAAABQAAAA3UmVxdWVzdCBoYXMgYWxyZWFkeSBiZWVuIHByb2Nlc3NlZCAocmVwbGF5IHByb3RlY3Rpb24pLgAAAAAXUmVxdWVzdEFscmVhZHlQcm9jZXNzZWQAAAAAFQAAADZFeHBlY3RlZCBwb2xpY3kgdmVyc2lvbiBkb2Vzbid0IG1hdGNoIGN1cnJlbnQgdmVyc2lvbi4AAAAAABVQb2xpY3lWZXJzaW9uTWlzbWF0Y2gAAAAAAAAWAAAAK09ubHkgdGhlIGNvbmZpZ3VyZWQgVVNEQyBhc3NldCBpcyBhY2NlcHRlZC4AAAAAEFVuc3VwcG9ydGVkQXNzZXQAAAAXAAAAHFBheW1lbnQgcmVxdWVzdCBoYXMgZXhwaXJlZC4AAAAOUmVxdWVzdEV4cGlyZWQAAAAAABgAAAAuSW5zdWZmaWNpZW50IGVtZXJnZW5jeSBiYWxhbmNlIGZvciB3aXRoZHJhd2FsLgAAAAAAFUluc3VmZmljaWVudEVtZXJnZW5jeQAAAAAAAB4AAAAvSW5zdWZmaWNpZW50IG9ibGlnYXRpb24gYmFsYW5jZSBmb3Igd2l0aGRyYXdhbC4AAAAAFkluc3VmZmljaWVudE9ibGlnYXRpb24AAAAAAB8AAAAkTm8gcGVuZGluZyB3aXRoZHJhd2FsIHJlcXVlc3QgZm91bmQuAAAAEldpdGhkcmF3YWxOb3RGb3VuZAAAAAAAIAAAACRDb29sZG93biBwZXJpb2QgaGFzIG5vdCBlbGFwc2VkIHlldC4AAAASQ29vbGRvd25Ob3RFbGFwc2VkAAAAAAAhAAAAE0dvYWwgbG90IG5vdCBmb3VuZC4AAAAAD0dvYWxMb3ROb3RGb3VuZAAAAAAiAAAAHUdvYWwgbG90IGhhcyBub3QgbWF0dXJlZCB5ZXQuAAAAAAAADkdvYWxOb3RNYXR1cmVkAAAAAAAjAAAAIkdvYWwgbG90IGhhcyBhbHJlYWR5IGJlZW4gY2xhaW1lZC4AAAAAABJHb2FsQWxyZWFkeUNsYWltZWQAAAAAACQAAAApTWF4aW11bSBudW1iZXIgb2Ygb3BlbiBnb2FsIGxvdHMgcmVhY2hlZC4AAAAAAAAPVG9vTWFueU9wZW5Mb3RzAAAAACUAAAArSW50ZWdlciBvdmVyZmxvdyBpbiBhbGxvY2F0aW9uIGNhbGN1bGF0aW9uLgAAAAAIT3ZlcmZsb3cAAAAy",
        "AAAABQAAAHVFbWl0dGVkIHdoZW4gYSBwYXltZW50IGlzIHJvdXRlZCB0aHJvdWdoIHRoZSB3YXRlcmZhbGwgKFBSRCDCpzkuNSkuClRoaXMgaXMgdGhlIHByaW1hcnkgZXZlbnQgZm9yIHJlY2VpcHQgZ2VuZXJhdGlvbi4AAAAAAAAAAAAADEluY29tZVJvdXRlZAAAAAEAAAANaW5jb21lX3JvdXRlZAAAAAAAAAoAAAAAAAAACnJlcXVlc3RfaWQAAAAAA+4AAAAgAAAAAAAAAAAAAAAFcGF5ZXIAAAAAAAATAAAAAAAAAAAAAAAJcmVjaXBpZW50AAAAAAAAEwAAAAAAAAAAAAAABWFzc2V0AAAAAAAAEwAAAAAAAAAAAAAABWdyb3NzAAAAAAAACwAAAAAAAAAAAAAACWVtZXJnZW5jeQAAAAAAAAsAAAAAAAAAAAAAAApvYmxpZ2F0aW9uAAAAAAALAAAAAAAAAAAAAAAEZ29hbAAAAAsAAAAAAAAAAAAAAAlzcGVuZGFibGUAAAAAAAALAAAAAAAAAAAAAAAOcG9saWN5X3ZlcnNpb24AAAAAAAQAAAAAAAAAAg==",
        "AAAABQAAAEBFbWl0dGVkIHdoZW4gYSByZWNpcGllbnQgY3JlYXRlcyBvciB1cGRhdGVzIHRoZWlyIGluY29tZSBwb2xpY3kuAAAAAAAAAA1Qb2xpY3lVcGRhdGVkAAAAAAAAAQAAAA5wb2xpY3lfdXBkYXRlZAAAAAAABgAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAAAAAAHdmVyc2lvbgAAAAAEAAAAAAAAAAAAAAAQZW1lcmdlbmN5X3RhcmdldAAAAAsAAAAAAAAAAAAAABNlbWVyZ2VuY3lfdG9wdXBfYnBzAAAAAAQAAAAAAAAAAAAAAA5vYmxpZ2F0aW9uX2JwcwAAAAAABAAAAAAAAAAAAAAACGdvYWxfYnBzAAAABAAAAAAAAAAC",
        "AAAABQAAACtFbWl0dGVkIHdoZW4gbWF0dXJlZCBnb2FsIGxvdHMgYXJlIGNsYWltZWQuAAAAAAAAAAAOR29hbExvdENsYWltZWQAAAAAAAEAAAAQZ29hbF9sb3RfY2xhaW1lZAAAAAQAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAAAAAABmxvdF9pZAAAAAAABgAAAAAAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAAAAAAC2Rlc3RpbmF0aW9uAAAAABMAAAAAAAAAAg==",
        "AAAABQAAADZFbWl0dGVkIHdoZW4gYSBuZXcgZ29hbCBsb3QgaXMgY3JlYXRlZCBkdXJpbmcgcm91dGluZy4AAAAAAAAAAAAOR29hbExvdENyZWF0ZWQAAAAAAAEAAAAQZ29hbF9sb3RfY3JlYXRlZAAAAAQAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAAAAAABmxvdF9pZAAAAAAABgAAAAAAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAAAAAACXVubG9ja19hdAAAAAAAAAYAAAAAAAAAAg==",
        "AAAABQAAACdFbWl0dGVkIHdoZW4gYWRtaW4gcGF1c2VzIHRoZSBwcm90b2NvbC4AAAAAAAAAAA5Qcm90b2NvbFBhdXNlZAAAAAAAAQAAAA9wcm90b2NvbF9wYXVzZWQAAAAAAQAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAI=",
        "AAAABQAAACtFbWl0dGVkIHdoZW4gdGhlIGNvbnRyYWN0IFdBU00gaXMgdXBncmFkZWQuAAAAAAAAAAAQQ29udHJhY3RVcGdyYWRlZAAAAAEAAAARY29udHJhY3RfdXBncmFkZWQAAAAAAAACAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAAAAAAAA1uZXdfd2FzbV9oYXNoAAAAAAAD7gAAACAAAAAAAAAAAg==",
        "AAAABQAAAClFbWl0dGVkIHdoZW4gYWRtaW4gdW5wYXVzZXMgdGhlIHByb3RvY29sLgAAAAAAAAAAAAAQUHJvdG9jb2xVbnBhdXNlZAAAAAEAAAARcHJvdG9jb2xfdW5wYXVzZWQAAAAAAAABAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAAAg==",
        "AAAABQAAADhFbWl0dGVkIHdoZW4gdGhlIG93bmVyIHdpdGhkcmF3cyBmcm9tIGVtZXJnZW5jeSByZXNlcnZlLgAAAAAAAAASRW1lcmdlbmN5V2l0aGRyYXduAAAAAAABAAAAE2VtZXJnZW5jeV93aXRoZHJhd24AAAAAAwAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAAAAAALZGVzdGluYXRpb24AAAAAEwAAAAAAAAAC",
        "AAAABQAAAEFFbWl0dGVkIHdoZW4gYW4gb2JsaWdhdGlvbiB3aXRoZHJhd2FsIGlzIGV4ZWN1dGVkIGFmdGVyIGNvb2xkb3duLgAAAAAAAAAAAAATT2JsaWdhdGlvbldpdGhkcmF3bgAAAAABAAAAFG9ibGlnYXRpb25fd2l0aGRyYXduAAAABAAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAAAAAANd2l0aGRyYXdhbF9pZAAAAAAAAAYAAAAAAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAAAAAAAtkZXN0aW5hdGlvbgAAAAATAAAAAAAAAAI=",
        "AAAABQAAADpFbWl0dGVkIHdoZW4gYSBwZW5kaW5nIG9ibGlnYXRpb24gd2l0aGRyYXdhbCBpcyBjYW5jZWxsZWQuAAAAAAAAAAAAHU9ibGlnYXRpb25XaXRoZHJhd2FsQ2FuY2VsbGVkAAAAAAAAAQAAAB9vYmxpZ2F0aW9uX3dpdGhkcmF3YWxfY2FuY2VsbGVkAAAAAAIAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAAAAAADXdpdGhkcmF3YWxfaWQAAAAAAAAGAAAAAAAAAAI=",
        "AAAABQAAADlFbWl0dGVkIHdoZW4gYW4gb2JsaWdhdGlvbiB3aXRoZHJhd2FsIHJlcXVlc3QgaXMgY3JlYXRlZC4AAAAAAAAAAAAAHU9ibGlnYXRpb25XaXRoZHJhd2FsUmVxdWVzdGVkAAAAAAAAAQAAAB9vYmxpZ2F0aW9uX3dpdGhkcmF3YWxfcmVxdWVzdGVkAAAAAAQAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAAAAAADXdpdGhkcmF3YWxfaWQAAAAAAAAGAAAAAAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAAAAAANZXhlY3V0ZV9hZnRlcgAAAAAAAAYAAAAAAAAAAg==",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAACQAAAAAAAAAeR2xvYmFsIHByb3RvY29sIGNvbmZpZ3VyYXRpb24uAAAAAAAGQ29uZmlnAAAAAAABAAAAF1BvbGljeSBmb3IgYSByZWNpcGllbnQuAAAAAAZQb2xpY3kAAAAAAAEAAAATAAAAAQAAACBCdWNrZXQgYmFsYW5jZXMgZm9yIGEgcmVjaXBpZW50LgAAAAhCYWxhbmNlcwAAAAEAAAATAAAAAQAAABNHb2FsIGxvdCBieSBsb3QgSUQuAAAAAAdHb2FsTG90AAAAAAEAAAAGAAAAAAAAABlOZXh0IGdvYWwgbG90IElEIGNvdW50ZXIuAAAAAAAACU5leHRMb3RJZAAAAAAAAAEAAAAoQ291bnQgb2Ygb3BlbiAodW5jbGFpbWVkKSBsb3RzIHBlciB1c2VyLgAAAAxPcGVuTG90Q291bnQAAAABAAAAEwAAAAEAAAAmUGVuZGluZyBvYmxpZ2F0aW9uIHdpdGhkcmF3YWwgcmVxdWVzdC4AAAAAAA1XaXRoZHJhd2FsUmVxAAAAAAAAAQAAAAYAAAAAAAAAI05leHQgd2l0aGRyYXdhbCByZXF1ZXN0IElEIGNvdW50ZXIuAAAAABBOZXh0V2l0aGRyYXdhbElkAAAAAQAAACxJZGVtcG90ZW5jeSBndWFyZDogcmVxdWVzdF9pZCDihpIgcHJvY2Vzc2VkLgAAAAlQcm9jZXNzZWQAAAAAAAABAAAD7gAAACA=" ]),
      options
    )
  }
  public readonly fromJSON = {
    pause: this.txFromJSON<null>,
        unpause: this.txFromJSON<null>,
        upgrade: this.txFromJSON<null>,
        get_config: this.txFromJSON<Config>,
        get_policy: this.txFromJSON<Option<Policy>>,
        set_policy: this.txFromJSON<null>,
        get_balances: this.txFromJSON<BucketBalances>,
        get_goal_lot: this.txFromJSON<Option<GoalLot>>,
        preview_route: this.txFromJSON<Allocation>,
        route_payment: this.txFromJSON<Allocation>,
        claim_goal_lots: this.txFromJSON<null>,
        withdraw_emergency: this.txFromJSON<null>,
        is_request_processed: this.txFromJSON<boolean>,
        cancel_obligation_withdrawal: this.txFromJSON<null>,
        execute_obligation_withdrawal: this.txFromJSON<null>,
        request_obligation_withdrawal: this.txFromJSON<u64>
  }
}