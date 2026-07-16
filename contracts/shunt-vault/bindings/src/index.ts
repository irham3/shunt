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
    contractId: "CC7E2HL7SNQ34PFLV74WEQSW2OVBRBG3EUTLKWC3NYKIC4XPPABQWBMW",
  }
} as const


/**
 * A user-labeled sub-allocation of their aggregate Savings balance.
 * Purely a bookkeeping split of `Savings(Address)` — `amount` across all of
 * a user's goals must never exceed that aggregate; the difference is the
 * "unallocated" pool (`get_unallocated_savings`). No separate custody: a
 * goal's funds are the same USDC already held by the vault.
 */
export interface Goal {
  amount: i128;
  created_at: u64;
  id: u32;
  label: string;
}

export const Errors = {
  1: {message:"NotInitialized"},
  2: {message:"AlreadyInitialized"},
  3: {message:"RulesNotSet"},
  4: {message:"InvalidRules"},
  5: {message:"AmountNotPositive"},
  6: {message:"AlreadyProcessed"},
  7: {message:"InsufficientSavings"},
  8: {message:"InsufficientBuffer"},
  9: {message:"AnchorNotAllowlisted"},
  10: {message:"GoalNotFound"},
  11: {message:"InsufficientUnallocated"},
  12: {message:"LabelTooLong"}
}


export interface Rules {
  /**
 * Allowlisted anchor addresses permitted to receive off-ramp USDC
 * (PRD §12: we lock the anchor address, not the bank account).
 */
anchors: Array<string>;
  buffer_bps: u32;
  /**
 * Savings timelock duration in seconds, applied from each deposit.
 */
lock_secs: u64;
  /**
 * Basis points per lane; must sum to exactly 10_000.
 */
needs_bps: u32;
  savings_bps: u32;
}

export type DataKey = {tag: "Token", values: void} | {tag: "Rules", values: readonly [string]} | {tag: "Savings", values: readonly [string]} | {tag: "LockUntil", values: readonly [string]} | {tag: "BufferCredit", values: readonly [string]} | {tag: "Processed", values: readonly [Buffer]} | {tag: "Goals", values: readonly [string]};





export interface Client {
  /**
   * Construct and simulate a init transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * One-time init with the USDC SAC address.
   */
  init: ({token}: {token: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a deposit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Voluntary extra deposit into the Savings vault. F5.
   */
  deposit: ({user, amount}: {user: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a offramp transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Off-ramp the given amount from the user's wallet to an allowlisted
   * anchor address (F8 sketch). The contract enforces the anchor
   * allowlist; KYC/bank details live in the anchor's hosted flow.
   */
  offramp: ({user, anchor, amount}: {user: string, anchor: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_rules transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_rules: ({user}: {user: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Rules>>>

  /**
   * Construct and simulate a set_rules transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Store or replace the user's split rules. Percentages are in basis
   * points and must total exactly 10_000 (100%). F3.
   */
  set_rules: ({user, needs_bps, savings_bps, buffer_bps, lock_secs, anchors}: {user: string, needs_bps: u32, savings_bps: u32, buffer_bps: u32, lock_secs: u64, anchors: Array<string>}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a distribute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Split an inflow atomically. F4.
   * 
   * Needs + Buffer never leave the user's wallet; only the Savings lane is
   * pulled into the vault. Dust from integer division is rounded into the
   * Needs lane (PRD §14), i.e. it simply stays in the wallet.
   * 
   * `inflow_key` is the hash of the inflow transaction — the on-chain
   * idempotency guard against double-splits (PRD §12).
   * 
   * Returns (needs, savings, buffer) amounts.
   */
  distribute: ({user, amount, inflow_key}: {user: string, amount: i128, inflow_key: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<readonly [i128, i128, i128]>>

  /**
   * Construct and simulate a get_savings transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_savings: ({user}: {user: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a is_processed transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_processed: ({inflow_key}: {inflow_key: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a get_lock_until transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_lock_until: ({user}: {user: string}, options?: MethodOptions) => Promise<AssembledTransaction<u64>>

  /**
   * Construct and simulate a withdraw_buffer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Withdraw in-vault Buffer credit (accrued penalties). No timelock.
   */
  withdraw_buffer: ({user, amount}: {user: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a withdraw_savings transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Withdraw from Savings. Before `lock_until`, a 10% penalty is deducted
   * and credited to the user's in-vault Buffer credit (instant access).
   * Returns the amount actually sent to the wallet.
   */
  withdraw_savings: ({user, amount}: {user: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a get_buffer_credit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_buffer_credit: ({user}: {user: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a get_savings_goals transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_savings_goals: ({user}: {user: string}, options?: MethodOptions) => Promise<AssembledTransaction<Array<Goal>>>

  /**
   * Construct and simulate a withdraw_from_goal transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Withdraw from a specific goal — same penalty/timelock rules as
   * `withdraw_savings` (goals share the vault's one timelock), and also
   * decrements the goal's own tracked amount. Returns the payout.
   */
  withdraw_from_goal: ({user, goal_id, amount}: {user: string, goal_id: u32, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a create_savings_goal transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Create a new named sub-allocation of the user's aggregate Savings
   * balance. `initial_amount` is drawn from the unallocated pool
   * (`get_unallocated_savings`) — no funds move, this is bookkeeping
   * only. Returns the new goal's id.
   */
  create_savings_goal: ({user, label, initial_amount}: {user: string, label: string, initial_amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a delete_savings_goal transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Delete a goal. Its principal isn't moved — it simply becomes
   * unallocated again, since unallocated is always
   * `Savings(user) - sum(goal.amount for goal in goals)`.
   */
  delete_savings_goal: ({user, goal_id}: {user: string, goal_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a rename_savings_goal transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Rename an existing goal. Purely cosmetic — no balance change.
   */
  rename_savings_goal: ({user, goal_id, new_label}: {user: string, goal_id: u32, new_label: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_unallocated_savings transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Savings not currently assigned to any goal.
   */
  get_unallocated_savings: ({user}: {user: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
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
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAQAAAVVBIHVzZXItbGFiZWxlZCBzdWItYWxsb2NhdGlvbiBvZiB0aGVpciBhZ2dyZWdhdGUgU2F2aW5ncyBiYWxhbmNlLgpQdXJlbHkgYSBib29ra2VlcGluZyBzcGxpdCBvZiBgU2F2aW5ncyhBZGRyZXNzKWAg4oCUIGBhbW91bnRgIGFjcm9zcyBhbGwgb2YKYSB1c2VyJ3MgZ29hbHMgbXVzdCBuZXZlciBleGNlZWQgdGhhdCBhZ2dyZWdhdGU7IHRoZSBkaWZmZXJlbmNlIGlzIHRoZQoidW5hbGxvY2F0ZWQiIHBvb2wgKGBnZXRfdW5hbGxvY2F0ZWRfc2F2aW5nc2ApLiBObyBzZXBhcmF0ZSBjdXN0b2R5OiBhCmdvYWwncyBmdW5kcyBhcmUgdGhlIHNhbWUgVVNEQyBhbHJlYWR5IGhlbGQgYnkgdGhlIHZhdWx0LgAAAAAAAAAAAAAER29hbAAAAAQAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAKY3JlYXRlZF9hdAAAAAAABgAAAAAAAAACaWQAAAAAAAQAAAAAAAAABWxhYmVsAAAAAAAAEA==",
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAADAAAAAAAAAAOTm90SW5pdGlhbGl6ZWQAAAAAAAEAAAAAAAAAEkFscmVhZHlJbml0aWFsaXplZAAAAAAAAgAAAAAAAAALUnVsZXNOb3RTZXQAAAAAAwAAAAAAAAAMSW52YWxpZFJ1bGVzAAAABAAAAAAAAAARQW1vdW50Tm90UG9zaXRpdmUAAAAAAAAFAAAAAAAAABBBbHJlYWR5UHJvY2Vzc2VkAAAABgAAAAAAAAATSW5zdWZmaWNpZW50U2F2aW5ncwAAAAAHAAAAAAAAABJJbnN1ZmZpY2llbnRCdWZmZXIAAAAAAAgAAAAAAAAAFEFuY2hvck5vdEFsbG93bGlzdGVkAAAACQAAAAAAAAAMR29hbE5vdEZvdW5kAAAACgAAAAAAAAAXSW5zdWZmaWNpZW50VW5hbGxvY2F0ZWQAAAAACwAAAAAAAAAMTGFiZWxUb29Mb25nAAAADA==",
        "AAAAAQAAAAAAAAAAAAAABVJ1bGVzAAAAAAAABQAAAH1BbGxvd2xpc3RlZCBhbmNob3IgYWRkcmVzc2VzIHBlcm1pdHRlZCB0byByZWNlaXZlIG9mZi1yYW1wIFVTREMKKFBSRCDCpzEyOiB3ZSBsb2NrIHRoZSBhbmNob3IgYWRkcmVzcywgbm90IHRoZSBiYW5rIGFjY291bnQpLgAAAAAAAAdhbmNob3JzAAAAA+oAAAATAAAAAAAAAApidWZmZXJfYnBzAAAAAAAEAAAAQFNhdmluZ3MgdGltZWxvY2sgZHVyYXRpb24gaW4gc2Vjb25kcywgYXBwbGllZCBmcm9tIGVhY2ggZGVwb3NpdC4AAAAJbG9ja19zZWNzAAAAAAAABgAAADJCYXNpcyBwb2ludHMgcGVyIGxhbmU7IG11c3Qgc3VtIHRvIGV4YWN0bHkgMTBfMDAwLgAAAAAACW5lZWRzX2JwcwAAAAAAAAQAAAAAAAAAC3NhdmluZ3NfYnBzAAAAAAQ=",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABwAAAAAAAAAXVVNEQyBTQUMgdG9rZW4gYWRkcmVzcy4AAAAABVRva2VuAAAAAAAAAQAAAAtSdWxlcyh1c2VyKQAAAAAFUnVsZXMAAAAAAAABAAAAEwAAAAEAAAA7U2F2aW5ncyB2YXVsdCBiYWxhbmNlIHBlciB1c2VyICg3LWRlY2ltYWwgc3Ryb29wcyBvZiBVU0RDKS4AAAAAB1NhdmluZ3MAAAAAAQAAABMAAAABAAAAMlVuaXggdGltZSB1bnRpbCB3aGljaCBTYXZpbmdzIGlzIGxvY2tlZCwgcGVyIHVzZXIuAAAAAAAJTG9ja1VudGlsAAAAAAAAAQAAABMAAAABAAAAR0J1ZmZlciBjcmVkaXQgaGVsZCBpbiB0aGUgdmF1bHQgKGVhcmx5LXdpdGhkcmF3YWwgcGVuYWx0aWVzKSwgcGVyIHVzZXIuAAAAAAxCdWZmZXJDcmVkaXQAAAABAAAAEwAAAAEAAAA/SWRlbXBvdGVuY3kgZ3VhcmQga2V5ZWQgYnkgaW5mbG93IHR4IGhhc2ggKGtlZXBlciBzdXBwbGllcyBpdCkuAAAAAAlQcm9jZXNzZWQAAAAAAAABAAAD7gAAACAAAAABAAAAPUdvYWxzKHVzZXIpIOKAlCB0aGlzIHVzZXIncyBuYW1lZCBzdWItYWxsb2NhdGlvbnMgb2YgU2F2aW5ncy4AAAAAAAAFR29hbHMAAAAAAAABAAAAEw==",
        "AAAAAAAAAChPbmUtdGltZSBpbml0IHdpdGggdGhlIFVTREMgU0FDIGFkZHJlc3MuAAAABGluaXQAAAABAAAAAAAAAAV0b2tlbgAAAAAAABMAAAAA",
        "AAAABQAAAAAAAAAAAAAAClNwbGl0RXZlbnQAAAAAAAEAAAAFc3BsaXQAAAAAAAAGAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAAAAAABW5lZWRzAAAAAAAACwAAAAAAAAAAAAAAB3NhdmluZ3MAAAAACwAAAAAAAAAAAAAABmJ1ZmZlcgAAAAAACwAAAAAAAAAAAAAACmluZmxvd19rZXkAAAAAA+4AAAAgAAAAAAAAAAI=",
        "AAAAAAAAADNWb2x1bnRhcnkgZXh0cmEgZGVwb3NpdCBpbnRvIHRoZSBTYXZpbmdzIHZhdWx0LiBGNS4AAAAAB2RlcG9zaXQAAAAAAgAAAAAAAAAEdXNlcgAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAA=",
        "AAAAAAAAAL1PZmYtcmFtcCB0aGUgZ2l2ZW4gYW1vdW50IGZyb20gdGhlIHVzZXIncyB3YWxsZXQgdG8gYW4gYWxsb3dsaXN0ZWQKYW5jaG9yIGFkZHJlc3MgKEY4IHNrZXRjaCkuIFRoZSBjb250cmFjdCBlbmZvcmNlcyB0aGUgYW5jaG9yCmFsbG93bGlzdDsgS1lDL2JhbmsgZGV0YWlscyBsaXZlIGluIHRoZSBhbmNob3IncyBob3N0ZWQgZmxvdy4AAAAAAAAHb2ZmcmFtcAAAAAADAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAGYW5jaG9yAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAA",
        "AAAABQAAAAAAAAAAAAAADERlcG9zaXRFdmVudAAAAAEAAAAHZGVwb3NpdAAAAAACAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAADE9mZnJhbXBFdmVudAAAAAEAAAAHb2ZmcmFtcAAAAAADAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAAAAAABmFuY2hvcgAAAAAAEwAAAAAAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAC",
        "AAAAAAAAAAAAAAAJZ2V0X3J1bGVzAAAAAAAAAQAAAAAAAAAEdXNlcgAAABMAAAABAAAD6AAAB9AAAAAFUnVsZXMAAAA=",
        "AAAAAAAAAHJTdG9yZSBvciByZXBsYWNlIHRoZSB1c2VyJ3Mgc3BsaXQgcnVsZXMuIFBlcmNlbnRhZ2VzIGFyZSBpbiBiYXNpcwpwb2ludHMgYW5kIG11c3QgdG90YWwgZXhhY3RseSAxMF8wMDAgKDEwMCUpLiBGMy4AAAAAAAlzZXRfcnVsZXMAAAAAAAAGAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAJbmVlZHNfYnBzAAAAAAAABAAAAAAAAAALc2F2aW5nc19icHMAAAAABAAAAAAAAAAKYnVmZmVyX2JwcwAAAAAABAAAAAAAAAAJbG9ja19zZWNzAAAAAAAABgAAAAAAAAAHYW5jaG9ycwAAAAPqAAAAEwAAAAA=",
        "AAAABQAAAAAAAAAAAAAADVdpdGhkcmF3RXZlbnQAAAAAAAABAAAACHdpdGhkcmF3AAAABAAAAAAAAAAEdXNlcgAAABMAAAAAAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAAAAAAAZwYXlvdXQAAAAAAAsAAAAAAAAAAAAAAAdwZW5hbHR5AAAAAAsAAAAAAAAAAg==",
        "AAAAAAAAAYxTcGxpdCBhbiBpbmZsb3cgYXRvbWljYWxseS4gRjQuCgpOZWVkcyArIEJ1ZmZlciBuZXZlciBsZWF2ZSB0aGUgdXNlcidzIHdhbGxldDsgb25seSB0aGUgU2F2aW5ncyBsYW5lIGlzCnB1bGxlZCBpbnRvIHRoZSB2YXVsdC4gRHVzdCBmcm9tIGludGVnZXIgZGl2aXNpb24gaXMgcm91bmRlZCBpbnRvIHRoZQpOZWVkcyBsYW5lIChQUkQgwqcxNCksIGkuZS4gaXQgc2ltcGx5IHN0YXlzIGluIHRoZSB3YWxsZXQuCgpgaW5mbG93X2tleWAgaXMgdGhlIGhhc2ggb2YgdGhlIGluZmxvdyB0cmFuc2FjdGlvbiDigJQgdGhlIG9uLWNoYWluCmlkZW1wb3RlbmN5IGd1YXJkIGFnYWluc3QgZG91YmxlLXNwbGl0cyAoUFJEIMKnMTIpLgoKUmV0dXJucyAobmVlZHMsIHNhdmluZ3MsIGJ1ZmZlcikgYW1vdW50cy4AAAAKZGlzdHJpYnV0ZQAAAAAAAwAAAAAAAAAEdXNlcgAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAKaW5mbG93X2tleQAAAAAD7gAAACAAAAABAAAD7QAAAAMAAAALAAAACwAAAAs=",
        "AAAAAAAAAAAAAAALZ2V0X3NhdmluZ3MAAAAAAQAAAAAAAAAEdXNlcgAAABMAAAABAAAACw==",
        "AAAAAAAAAAAAAAAMaXNfcHJvY2Vzc2VkAAAAAQAAAAAAAAAKaW5mbG93X2tleQAAAAAD7gAAACAAAAABAAAAAQ==",
        "AAAAAAAAAAAAAAAOZ2V0X2xvY2tfdW50aWwAAAAAAAEAAAAAAAAABHVzZXIAAAATAAAAAQAAAAY=",
        "AAAAAAAAAEFXaXRoZHJhdyBpbi12YXVsdCBCdWZmZXIgY3JlZGl0IChhY2NydWVkIHBlbmFsdGllcykuIE5vIHRpbWVsb2NrLgAAAAAAAA93aXRoZHJhd19idWZmZXIAAAAAAgAAAAAAAAAEdXNlcgAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAA=",
        "AAAAAAAAALlXaXRoZHJhdyBmcm9tIFNhdmluZ3MuIEJlZm9yZSBgbG9ja191bnRpbGAsIGEgMTAlIHBlbmFsdHkgaXMgZGVkdWN0ZWQKYW5kIGNyZWRpdGVkIHRvIHRoZSB1c2VyJ3MgaW4tdmF1bHQgQnVmZmVyIGNyZWRpdCAoaW5zdGFudCBhY2Nlc3MpLgpSZXR1cm5zIHRoZSBhbW91bnQgYWN0dWFsbHkgc2VudCB0byB0aGUgd2FsbGV0LgAAAAAAABB3aXRoZHJhd19zYXZpbmdzAAAAAgAAAAAAAAAEdXNlcgAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAEAAAAL",
        "AAAAAAAAAAAAAAARZ2V0X2J1ZmZlcl9jcmVkaXQAAAAAAAABAAAAAAAAAAR1c2VyAAAAEwAAAAEAAAAL",
        "AAAAAAAAAAAAAAARZ2V0X3NhdmluZ3NfZ29hbHMAAAAAAAABAAAAAAAAAAR1c2VyAAAAEwAAAAEAAAPqAAAH0AAAAARHb2Fs",
        "AAAAAAAAAMJXaXRoZHJhdyBmcm9tIGEgc3BlY2lmaWMgZ29hbCDigJQgc2FtZSBwZW5hbHR5L3RpbWVsb2NrIHJ1bGVzIGFzCmB3aXRoZHJhd19zYXZpbmdzYCAoZ29hbHMgc2hhcmUgdGhlIHZhdWx0J3Mgb25lIHRpbWVsb2NrKSwgYW5kIGFsc28KZGVjcmVtZW50cyB0aGUgZ29hbCdzIG93biB0cmFja2VkIGFtb3VudC4gUmV0dXJucyB0aGUgcGF5b3V0LgAAAAAAEndpdGhkcmF3X2Zyb21fZ29hbAAAAAAAAwAAAAAAAAAEdXNlcgAAABMAAAAAAAAAB2dvYWxfaWQAAAAABAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAQAAAAs=",
        "AAAAAAAAAOJDcmVhdGUgYSBuZXcgbmFtZWQgc3ViLWFsbG9jYXRpb24gb2YgdGhlIHVzZXIncyBhZ2dyZWdhdGUgU2F2aW5ncwpiYWxhbmNlLiBgaW5pdGlhbF9hbW91bnRgIGlzIGRyYXduIGZyb20gdGhlIHVuYWxsb2NhdGVkIHBvb2wKKGBnZXRfdW5hbGxvY2F0ZWRfc2F2aW5nc2ApIOKAlCBubyBmdW5kcyBtb3ZlLCB0aGlzIGlzIGJvb2trZWVwaW5nCm9ubHkuIFJldHVybnMgdGhlIG5ldyBnb2FsJ3MgaWQuAAAAAAATY3JlYXRlX3NhdmluZ3NfZ29hbAAAAAADAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAFbGFiZWwAAAAAAAAQAAAAAAAAAA5pbml0aWFsX2Ftb3VudAAAAAAACwAAAAEAAAAE",
        "AAAAAAAAAKNEZWxldGUgYSBnb2FsLiBJdHMgcHJpbmNpcGFsIGlzbid0IG1vdmVkIOKAlCBpdCBzaW1wbHkgYmVjb21lcwp1bmFsbG9jYXRlZCBhZ2Fpbiwgc2luY2UgdW5hbGxvY2F0ZWQgaXMgYWx3YXlzCmBTYXZpbmdzKHVzZXIpIC0gc3VtKGdvYWwuYW1vdW50IGZvciBnb2FsIGluIGdvYWxzKWAuAAAAABNkZWxldGVfc2F2aW5nc19nb2FsAAAAAAIAAAAAAAAABHVzZXIAAAATAAAAAAAAAAdnb2FsX2lkAAAAAAQAAAAA",
        "AAAAAAAAAD9SZW5hbWUgYW4gZXhpc3RpbmcgZ29hbC4gUHVyZWx5IGNvc21ldGljIOKAlCBubyBiYWxhbmNlIGNoYW5nZS4AAAAAE3JlbmFtZV9zYXZpbmdzX2dvYWwAAAAAAwAAAAAAAAAEdXNlcgAAABMAAAAAAAAAB2dvYWxfaWQAAAAABAAAAAAAAAAJbmV3X2xhYmVsAAAAAAAAEAAAAAA=",
        "AAAAAAAAACtTYXZpbmdzIG5vdCBjdXJyZW50bHkgYXNzaWduZWQgdG8gYW55IGdvYWwuAAAAABdnZXRfdW5hbGxvY2F0ZWRfc2F2aW5ncwAAAAABAAAAAAAAAAR1c2VyAAAAEwAAAAEAAAAL" ]),
      options
    )
  }
  public readonly fromJSON = {
    init: this.txFromJSON<null>,
        deposit: this.txFromJSON<null>,
        offramp: this.txFromJSON<null>,
        get_rules: this.txFromJSON<Option<Rules>>,
        set_rules: this.txFromJSON<null>,
        distribute: this.txFromJSON<readonly [i128, i128, i128]>,
        get_savings: this.txFromJSON<i128>,
        is_processed: this.txFromJSON<boolean>,
        get_lock_until: this.txFromJSON<u64>,
        withdraw_buffer: this.txFromJSON<null>,
        withdraw_savings: this.txFromJSON<i128>,
        get_buffer_credit: this.txFromJSON<i128>,
        get_savings_goals: this.txFromJSON<Array<Goal>>,
        withdraw_from_goal: this.txFromJSON<i128>,
        create_savings_goal: this.txFromJSON<u32>,
        delete_savings_goal: this.txFromJSON<null>,
        rename_savings_goal: this.txFromJSON<null>,
        get_unallocated_savings: this.txFromJSON<i128>
  }
}