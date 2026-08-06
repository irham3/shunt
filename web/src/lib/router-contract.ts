import { Buffer } from "buffer";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type { u32, u64, i128, Option } from "@stellar/stellar-sdk/contract";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}

export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "ROUTER_V2_TESTNET_PLACEHOLDER",
  },
} as const;

export const Errors = {
  1: { message: "ProtocolPaused" },
  2: { message: "NotAdmin" },
  3: { message: "NotOwner" },
  10: { message: "PolicyNotFound" },
  11: { message: "PolicyNotActive" },
  12: { message: "InvalidBps" },
  13: { message: "InvalidEmergencyTarget" },
  14: { message: "LockTooLong" },
  15: { message: "CooldownTooLong" },
  16: { message: "InvalidSpendDestination" },
  20: { message: "AmountNotPositive" },
  21: { message: "RequestAlreadyProcessed" },
  22: { message: "PolicyVersionMismatch" },
  23: { message: "UnsupportedAsset" },
  24: { message: "RequestExpired" },
  30: { message: "InsufficientEmergency" },
  31: { message: "InsufficientObligation" },
  32: { message: "WithdrawalNotFound" },
  33: { message: "CooldownNotElapsed" },
  34: { message: "GoalLotNotFound" },
  35: { message: "GoalNotMatured" },
  36: { message: "GoalAlreadyClaimed" },
  37: { message: "TooManyOpenLots" },
  50: { message: "Overflow" },
} as const;

export interface PolicyInput {
  spend_destination: string;
  emergency_target: i128;
  emergency_topup_bps: u32;
  obligation_bps: u32;
  obligation_cooldown_seconds: u64;
  goal_bps: u32;
  goal_lock_seconds: u64;
}

export interface Policy {
  owner: string;
  spend_destination: string;
  emergency_target: i128;
  emergency_topup_bps: u32;
  obligation_bps: u32;
  obligation_cooldown_seconds: u64;
  goal_bps: u32;
  goal_lock_seconds: u64;
  version: u32;
  active: boolean;
}

export interface BucketBalances {
  emergency: i128;
  obligation: i128;
  goal_total: i128;
}

export interface GoalLot {
  owner: string;
  amount: i128;
  created_at: u64;
  unlock_at: u64;
  claimed: boolean;
}

export interface Allocation {
  gross: i128;
  emergency: i128;
  obligation: i128;
  goal: i128;
  spendable: i128;
}

export interface Config {
  admin: string;
  usdc: string;
  paused: boolean;
  max_lock_seconds: u64;
  max_cooldown_seconds: u64;
  max_open_lots: u32;
}

export interface Client {
  set_policy: (
    { owner, input }: { owner: string; input: PolicyInput },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  get_policy: (
    { owner }: { owner: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Option<Policy>>>;

  preview_route: (
    { recipient, amount }: { recipient: string; amount: i128 },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Allocation>>;

  route_payment: (
    {
      payer,
      recipient,
      amount,
      request_id,
      expected_policy_version,
    }: {
      payer: string;
      recipient: string;
      amount: i128;
      request_id: Buffer | Uint8Array | string;
      expected_policy_version: u32;
    },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Allocation>>;

  withdraw_emergency: (
    { owner, amount, destination }: { owner: string; amount: i128; destination: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  request_obligation_withdrawal: (
    { owner, amount }: { owner: string; amount: i128 },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<u64>>;

  cancel_obligation_withdrawal: (
    { owner, withdrawal_id }: { owner: string; withdrawal_id: u64 },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  execute_obligation_withdrawal: (
    {
      owner,
      withdrawal_id,
      destination,
    }: { owner: string; withdrawal_id: u64; destination: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  claim_goal_lots: (
    { owner, lot_ids, destination }: { owner: string; lot_ids: Array<u64>; destination: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  get_balances: (
    { owner }: { owner: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<BucketBalances>>;

  get_goal_lot: (
    { lot_id }: { lot_id: u64 },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Option<GoalLot>>>;

  is_request_processed: (
    { request_id }: { request_id: Buffer | Uint8Array | string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<boolean>>;

  get_config: (options?: MethodOptions) => Promise<AssembledTransaction<Config>>;

  pause: (options?: MethodOptions) => Promise<AssembledTransaction<null>>;
  unpause: (options?: MethodOptions) => Promise<AssembledTransaction<null>>;
}

export class Client extends ContractClient {
  constructor(public readonly options: ContractClientOptions) {
    super(new ContractSpec([]), options);
  }
}
