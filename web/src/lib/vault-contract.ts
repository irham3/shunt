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
    contractId: "CA65BKKNEZEXOXK54G6BAVE3O4QMTCXGSA7YULHADELX5HOIOZPO7JUM",
  }
} as const

export const Errors = {
  1: {message:"NotInitialized"},
  2: {message:"AlreadyInitialized"},
  3: {message:"RulesNotSet"},
  4: {message:"InvalidRules"},
  5: {message:"AmountNotPositive"},
  6: {message:"AlreadyProcessed"},
  7: {message:"InsufficientSavings"},
  8: {message:"InsufficientBuffer"},
  9: {message:"AnchorNotAllowlisted"}
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

export type DataKey = {tag: "Token", values: void} | {tag: "Rules", values: readonly [string]} | {tag: "Savings", values: readonly [string]} | {tag: "LockUntil", values: readonly [string]} | {tag: "BufferCredit", values: readonly [string]} | {tag: "Processed", values: readonly [Buffer]};

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
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAACQAAAAAAAAAOTm90SW5pdGlhbGl6ZWQAAAAAAAEAAAAAAAAAEkFscmVhZHlJbml0aWFsaXplZAAAAAAAAgAAAAAAAAALUnVsZXNOb3RTZXQAAAAAAwAAAAAAAAAMSW52YWxpZFJ1bGVzAAAABAAAAAAAAAARQW1vdW50Tm90UG9zaXRpdmUAAAAAAAAFAAAAAAAAABBBbHJlYWR5UHJvY2Vzc2VkAAAABgAAAAAAAAATSW5zdWZmaWNpZW50U2F2aW5ncwAAAAAHAAAAAAAAABJJbnN1ZmZpY2llbnRCdWZmZXIAAAAAAAgAAAAAAAAAFEFuY2hvck5vdEFsbG93bGlzdGVkAAAACQ==",
        "AAAAAQAAAAAAAAAAAAAABVJ1bGVzAAAAAAAABQAAAH1BbGxvd2xpc3RlZCBhbmNob3IgYWRkcmVzc2VzIHBlcm1pdHRlZCB0byByZWNlaXZlIG9mZi1yYW1wIFVTREMKKFBSRCDCpzEyOiB3ZSBsb2NrIHRoZSBhbmNob3IgYWRkcmVzcywgbm90IHRoZSBiYW5rIGFjY291bnQpLgAAAAAAAAdhbmNob3JzAAAAA+oAAAATAAAAAAAAAApidWZmZXJfYnBzAAAAAAAEAAAAQFNhdmluZ3MgdGltZWxvY2sgZHVyYXRpb24gaW4gc2Vjb25kcywgYXBwbGllZCBmcm9tIGVhY2ggZGVwb3NpdC4AAAAJbG9ja19zZWNzAAAAAAAABgAAADJCYXNpcyBwb2ludHMgcGVyIGxhbmU7IG11c3Qgc3VtIHRvIGV4YWN0bHkgMTBfMDAwLgAAAAAACW5lZWRzX2JwcwAAAAAAAAQAAAAAAAAAC3NhdmluZ3NfYnBzAAAAAAQ=",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABgAAAAAAAAAXVVNEQyBTQUMgdG9rZW4gYWRkcmVzcy4AAAAABVRva2VuAAAAAAAAAQAAAAtSdWxlcyh1c2VyKQAAAAAFUnVsZXMAAAAAAAABAAAAEwAAAAEAAAA7U2F2aW5ncyB2YXVsdCBiYWxhbmNlIHBlciB1c2VyICg3LWRlY2ltYWwgc3Ryb29wcyBvZiBVU0RDKS4AAAAAB1NhdmluZ3MAAAAAAQAAABMAAAABAAAAMlVuaXggdGltZSB1bnRpbCB3aGljaCBTYXZpbmdzIGlzIGxvY2tlZCwgcGVyIHVzZXIuAAAAAAAJTG9ja1VudGlsAAAAAAAAAQAAABMAAAABAAAAR0J1ZmZlciBjcmVkaXQgaGVsZCBpbiB0aGUgdmF1bHQgKGVhcmx5LXdpdGhkcmF3YWwgcGVuYWx0aWVzKSwgcGVyIHVzZXIuAAAAAAxCdWZmZXJDcmVkaXQAAAABAAAAEwAAAAEAAAA/SWRlbXBvdGVuY3kgZ3VhcmQga2V5ZWQgYnkgaW5mbG93IHR4IGhhc2ggKGtlZXBlciBzdXBwbGllcyBpdCkuAAAAAAlQcm9jZXNzZWQAAAAAAAABAAAD7gAAACA=",
        "AAAAAAAAAChPbmUtdGltZSBpbml0IHdpdGggdGhlIFVTREMgU0FDIGFkZHJlc3MuAAAABGluaXQAAAABAAAAAAAAAAV0b2tlbgAAAAAAABMAAAAA",
        "AAAAAAAAADNWb2x1bnRhcnkgZXh0cmEgZGVwb3NpdCBpbnRvIHRoZSBTYXZpbmdzIHZhdWx0LiBGNS4AAAAAB2RlcG9zaXQAAAAAAgAAAAAAAAAEdXNlcgAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAA=",
        "AAAAAAAAAL1PZmYtcmFtcCB0aGUgZ2l2ZW4gYW1vdW50IGZyb20gdGhlIHVzZXIncyB3YWxsZXQgdG8gYW4gYWxsb3dsaXN0ZWQKYW5jaG9yIGFkZHJlc3MgKEY4IHNrZXRjaCkuIFRoZSBjb250cmFjdCBlbmZvcmNlcyB0aGUgYW5jaG9yCmFsbG93bGlzdDsgS1lDL2JhbmsgZGV0YWlscyBsaXZlIGluIHRoZSBhbmNob3IncyBob3N0ZWQgZmxvdy4AAAAAAAAHb2ZmcmFtcAAAAAADAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAGYW5jaG9yAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAA",
        "AAAAAAAAAAAAAAAJZ2V0X3J1bGVzAAAAAAAAAQAAAAAAAAAEdXNlcgAAABMAAAABAAAD6AAAB9AAAAAFUnVsZXMAAAA=",
        "AAAAAAAAAHJTdG9yZSBvciByZXBsYWNlIHRoZSB1c2VyJ3Mgc3BsaXQgcnVsZXMuIFBlcmNlbnRhZ2VzIGFyZSBpbiBiYXNpcwpwb2ludHMgYW5kIG11c3QgdG90YWwgZXhhY3RseSAxMF8wMDAgKDEwMCUpLiBGMy4AAAAAAAlzZXRfcnVsZXMAAAAAAAAGAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAJbmVlZHNfYnBzAAAAAAAABAAAAAAAAAALc2F2aW5nc19icHMAAAAABAAAAAAAAAAKYnVmZmVyX2JwcwAAAAAABAAAAAAAAAAJbG9ja19zZWNzAAAAAAAABgAAAAAAAAAHYW5jaG9ycwAAAAPqAAAAEwAAAAA=",
        "AAAAAAAAAYxTcGxpdCBhbiBpbmZsb3cgYXRvbWljYWxseS4gRjQuCgpOZWVkcyArIEJ1ZmZlciBuZXZlciBsZWF2ZSB0aGUgdXNlcidzIHdhbGxldDsgb25seSB0aGUgU2F2aW5ncyBsYW5lIGlzCnB1bGxlZCBpbnRvIHRoZSB2YXVsdC4gRHVzdCBmcm9tIGludGVnZXIgZGl2aXNpb24gaXMgcm91bmRlZCBpbnRvIHRoZQpOZWVkcyBsYW5lIChQUkQgwqcxNCksIGkuZS4gaXQgc2ltcGx5IHN0YXlzIGluIHRoZSB3YWxsZXQuCgpgaW5mbG93X2tleWAgaXMgdGhlIGhhc2ggb2YgdGhlIGluZmxvdyB0cmFuc2FjdGlvbiDigJQgdGhlIG9uLWNoYWluCmlkZW1wb3RlbmN5IGd1YXJkIGFnYWluc3QgZG91YmxlLXNwbGl0cyAoUFJEIMKnMTIpLgoKUmV0dXJucyAobmVlZHMsIHNhdmluZ3MsIGJ1ZmZlcikgYW1vdW50cy4AAAAKZGlzdHJpYnV0ZQAAAAAAAwAAAAAAAAAEdXNlcgAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAKaW5mbG93X2tleQAAAAAD7gAAACAAAAABAAAD7QAAAAMAAAALAAAACwAAAAs=",
        "AAAAAAAAAAAAAAALZ2V0X3NhdmluZ3MAAAAAAQAAAAAAAAAEdXNlcgAAABMAAAABAAAACw==",
        "AAAAAAAAAAAAAAAMaXNfcHJvY2Vzc2VkAAAAAQAAAAAAAAAKaW5mbG93X2tleQAAAAAD7gAAACAAAAABAAAAAQ==",
        "AAAAAAAAAAAAAAAOZ2V0X2xvY2tfdW50aWwAAAAAAAEAAAAAAAAABHVzZXIAAAATAAAAAQAAAAY=",
        "AAAAAAAAAEFXaXRoZHJhdyBpbi12YXVsdCBCdWZmZXIgY3JlZGl0IChhY2NydWVkIHBlbmFsdGllcykuIE5vIHRpbWVsb2NrLgAAAAAAAA93aXRoZHJhd19idWZmZXIAAAAAAgAAAAAAAAAEdXNlcgAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAA=",
        "AAAAAAAAALlXaXRoZHJhdyBmcm9tIFNhdmluZ3MuIEJlZm9yZSBgbG9ja191bnRpbGAsIGEgMTAlIHBlbmFsdHkgaXMgZGVkdWN0ZWQKYW5kIGNyZWRpdGVkIHRvIHRoZSB1c2VyJ3MgaW4tdmF1bHQgQnVmZmVyIGNyZWRpdCAoaW5zdGFudCBhY2Nlc3MpLgpSZXR1cm5zIHRoZSBhbW91bnQgYWN0dWFsbHkgc2VudCB0byB0aGUgd2FsbGV0LgAAAAAAABB3aXRoZHJhd19zYXZpbmdzAAAAAgAAAAAAAAAEdXNlcgAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAEAAAAL",
        "AAAAAAAAAAAAAAARZ2V0X2J1ZmZlcl9jcmVkaXQAAAAAAAABAAAAAAAAAAR1c2VyAAAAEwAAAAEAAAAL" ]),
      options
    )
  }

}