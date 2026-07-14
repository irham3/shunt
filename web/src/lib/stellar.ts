import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit";
import { FreighterModule } from "@creit.tech/stellar-wallets-kit/modules/freighter";
import { AlbedoModule } from "@creit.tech/stellar-wallets-kit/modules/albedo";
import { xBullModule } from "@creit.tech/stellar-wallets-kit/modules/xbull";
import { signTxXdr } from "./signer";
import {
  Address,
  Contract,
  Horizon,
  nativeToScVal,
  rpc,
  TransactionBuilder,
  xdr,
  Asset,
  Operation,
  StrKey,
} from "@stellar/stellar-sdk";

export const NETWORK = (import.meta.env.VITE_STELLAR_NETWORK ?? "testnet") as
  | "testnet"
  | "mainnet";

export const RPC_URL =
  import.meta.env.VITE_SOROBAN_RPC_URL ??
  (NETWORK === "testnet"
    ? "https://soroban-testnet.stellar.org"
    : "https://mainnet.sorobanrpc.com");

export const NETWORK_PASSPHRASE =
  NETWORK === "testnet"
    ? "Test SDF Network ; September 2015"
    : "Public Global Stellar Network ; September 2015";

export const VAULT_CONTRACT_ID = import.meta.env.VITE_VAULT_CONTRACT_ID ?? "";

/** Classic USDC asset (code + issuer G-address) for path payments (F12). */
export const USDC_CODE = import.meta.env.VITE_USDC_CODE ?? "USDC";
export const USDC_ISSUER =
  import.meta.env.VITE_USDC_ISSUER ??
  // Circle's well-known testnet issuer
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

export const HORIZON_URL =
  NETWORK === "testnet"
    ? "https://horizon-testnet.stellar.org"
    : "https://horizon.stellar.org";

export const EXPLORER_TX = (hash: string) =>
  `https://stellar.expert/explorer/${NETWORK === "testnet" ? "testnet" : "public"}/tx/${hash}`;

export const EXPLORER_ACCOUNT = (addr: string) =>
  `https://stellar.expert/explorer/${NETWORK === "testnet" ? "testnet" : "public"}/account/${addr}`;

// ---------------------------------------------------------------------------
// Wallet Kit Initialization
// ---------------------------------------------------------------------------

export function formatError(e: unknown): string {
  const msg = extractErrorString(e);
  if (msg === "USER_REJECTED") return "";
  // Fix snake_case errors from Soroban / Stellar
  return msg.replace(/_/g, " ");
}

// Register wallet modules at import time so all static methods work.
StellarWalletsKit.init({
  modules: [
    new FreighterModule(),
    new AlbedoModule(),
    new xBullModule(),
  ],
  network: NETWORK_PASSPHRASE as any,
});

function extractErrorString(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    if ("message" in e && typeof (e as any).message === "string") return (e as any).message;
    if ("error" in e && typeof (e as any).error === "string") return (e as any).error;
    try { return JSON.stringify(e); } catch { return "Unknown error"; }
  }
  return String(e);
}

/** Formats wallet kit errors for better UX (Level 2). */
function parseWalletError(e: unknown): never {
  const errStr = extractErrorString(e);
  const msg = errStr.toLowerCase();
  
  if (msg.includes("not installed") || msg.includes("not found")) {
    throw new Error("Wallet not found. Please install the extension.");
  }
  if (msg.includes("reject") || msg.includes("decline") || msg.includes("cancel")) {
    throw new Error("USER_REJECTED");
  }
  if (msg.includes("tx_insufficient_balance") || msg.includes("underfunded")) {
    throw new Error("Insufficient XLM balance for this transaction.");
  }
  throw new Error(errStr);
}

/**
 * Opens the built-in auth modal — the user picks their wallet,
 * approves access, and we get back the public key. Works for
 * Freighter, Albedo, xBull out of the box.
 */
export async function connectWithAuthModal(): Promise<string> {
  try {
    const { address } = await StellarWalletsKit.authModal();
    return address;
  } catch (e) {
    parseWalletError(e);
  }
}

export async function disconnectWalletKit(): Promise<void> {
  await StellarWalletsKit.disconnect();
}

export async function openProfileModal(): Promise<void> {
  await StellarWalletsKit.profileModal();
}

// ---------------------------------------------------------------------------
// Level 1 & 2 — XLM balance & payment
// ---------------------------------------------------------------------------

/** Fetch the native XLM balance for a Stellar account via Horizon. */
export async function fetchXlmBalance(address: string): Promise<string> {
  const res = await fetch(`${HORIZON_URL}/accounts/${address}`);
  if (!res.ok) {
    if (res.status === 404) return "0"; // account not funded yet
    throw new Error(`Horizon error ${res.status}`);
  }
  const data = await res.json();
  const native = data.balances?.find(
    (b: { asset_type: string }) => b.asset_type === "native",
  );
  return native?.balance ?? "0";
}

/** Fetch the USDC balance for a Stellar account via Horizon. */
export async function fetchUsdcBalance(address: string): Promise<string> {
  const res = await fetch(`${HORIZON_URL}/accounts/${address}`);
  if (!res.ok) {
    if (res.status === 404) return "0"; // account not funded yet
    throw new Error(`Horizon error ${res.status}`);
  }
  const data = await res.json();
  const usdc = data.balances?.find(
    (b: { asset_code?: string; asset_issuer?: string }) =>
      b.asset_code === USDC_CODE && b.asset_issuer === USDC_ISSUER,
  );
  return usdc?.balance ?? "0";
}

export interface AccountBalances {
  xlm: string;
  usdc: string;
  hasUsdcTrustline: boolean;
  funded: boolean;
}

/** One Horizon round-trip for everything Home needs: XLM + USDC + trustline. */
export async function fetchAccountBalances(address: string): Promise<AccountBalances> {
  const res = await fetch(`${HORIZON_URL}/accounts/${address}`);
  if (!res.ok) {
    if (res.status === 404)
      return { xlm: "0", usdc: "0", hasUsdcTrustline: false, funded: false };
    throw new Error(`Horizon error ${res.status}`);
  }
  const data = await res.json();
  const balances: any[] = data.balances ?? [];
  const native = balances.find((b) => b.asset_type === "native");
  const usdc = balances.find(
    (b) => b.asset_code === USDC_CODE && b.asset_issuer === USDC_ISSUER,
  );
  return {
    xlm: native?.balance ?? "0",
    usdc: usdc?.balance ?? "0",
    hasUsdcTrustline: Boolean(usdc),
    funded: true,
  };
}

// ---------------------------------------------------------------------------
// On-chain transfer history (Activity tab) — real Horizon payments, in & out.
// ---------------------------------------------------------------------------

export interface ChainPayment {
  id: string;
  txHash: string;
  direction: "in" | "out";
  /** "XLM", "USDC", or another asset code. */
  asset: string;
  amount: number;
  /** The other account (or the funder for create_account). */
  counterparty: string;
  at: string; // ISO timestamp
  /** true for self path payments (e.g. the Invest lane's DCA conversion). */
  isSelfConversion: boolean;
}

/**
 * Recent payments touching this account, newest first — direct transfers,
 * account funding, and path payments — so incoming/outgoing money always
 * shows up in Activity even when it never went through the app.
 */
export async function fetchRecentPayments(
  address: string,
  limit = 60,
): Promise<ChainPayment[]> {
  const res = await fetch(
    `${HORIZON_URL}/accounts/${address}/payments?order=desc&limit=${limit}`,
  );
  if (!res.ok) return []; // unfunded account / transient error — just show local items
  const data = await res.json();
  const records: any[] = data?._embedded?.records ?? [];
  const out: ChainPayment[] = [];
  for (const r of records) {
    if (r.type === "create_account") {
      if (r.account !== address) continue;
      out.push({
        id: r.id,
        txHash: r.transaction_hash,
        direction: "in",
        asset: "XLM",
        amount: Number(r.starting_balance),
        counterparty: r.funder,
        at: r.created_at,
        isSelfConversion: false,
      });
      continue;
    }
    if (
      r.type !== "payment" &&
      r.type !== "path_payment_strict_send" &&
      r.type !== "path_payment_strict_receive"
    )
      continue;
    const assetCode =
      r.asset_type === "native"
        ? "XLM"
        : r.asset_code === USDC_CODE && r.asset_issuer === USDC_ISSUER
          ? "USDC"
          : (r.asset_code ?? "?");
    const self = r.from === address && r.to === address;
    const incoming = r.to === address;
    out.push({
      id: r.id,
      txHash: r.transaction_hash,
      direction: self || incoming ? "in" : "out",
      asset: assetCode,
      amount: Number(r.amount),
      counterparty: self ? address : incoming ? r.from : r.to,
      at: r.created_at,
      isSelfConversion: self,
    });
  }
  return out;
}

/** Build, sign (WalletKit), and submit a classic payment of `asset` on Horizon.
    Shared by the XLM and USDC transfer paths — the user picks which asset to
    send in Send & Pay. */
async function sendAssetPayment(
  sender: string,
  destination: string,
  amount: string,
  asset: Asset,
): Promise<string> {
  const horizon = new Horizon.Server(HORIZON_URL);
  let source;
  try {
    source = await horizon.loadAccount(sender);
  } catch {
    throw new Error("Sender account not found on network.");
  }

  const tx = new TransactionBuilder(source, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.payment({ destination, asset, amount }))
    .setTimeout(300)
    .build();

  try {
    const { signedTxXdr } = await signTxXdr(tx.toEnvelope().toXDR("base64"), NETWORK_PASSPHRASE);
    const sendTx = TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE);
    const result = await horizon.submitTransaction(sendTx as any) as any;
    return result.hash;
  } catch (e) {
    parseWalletError(e);
  }
}

/** Send native XLM to another wallet. */
export async function sendXlmPayment(sender: string, destination: string, amount: string): Promise<string> {
  return sendAssetPayment(sender, destination, amount, Asset.native());
}

/** Send USDC to another wallet. The recipient must hold a USDC trustline or the
    payment is rejected by the network (surfaced as an error). */
export async function sendUsdcPayment(sender: string, destination: string, amount: string): Promise<string> {
  return sendAssetPayment(sender, destination, amount, new Asset(USDC_CODE, USDC_ISSUER));
}

/**
 * Spot-convert one asset to another *to self* via a classic
 * `pathPaymentStrictSend` through the Stellar DEX — no third party, the
 * orderbook/AMM is part of the protocol. Used by the Invest lane's DCA
 * (USDC→XLM) and the in-app Convert tab (both directions).
 */
async function pathPaymentSelf(
  sender: string,
  sendAsset: Asset,
  destAsset: Asset,
  sendAmount: string,
  destMin: string,
): Promise<string> {
  const horizon = new Horizon.Server(HORIZON_URL);
  let source;
  try {
    source = await horizon.loadAccount(sender);
  } catch {
    throw new Error("Sender account not found on network.");
  }

  const tx = new TransactionBuilder(source, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.pathPaymentStrictSend({
        sendAsset,
        sendAmount,
        destination: sender,
        destAsset,
        destMin,
      }),
    )
    .setTimeout(300)
    .build();

  try {
    const { signedTxXdr } = await signTxXdr(tx.toEnvelope().toXDR("base64"), NETWORK_PASSPHRASE);
    const sendTx = TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE);
    const result = await horizon.submitTransaction(sendTx as any) as any;
    return result.hash;
  } catch (e) {
    parseWalletError(e);
  }
}

/** F12 Invest lane: USDC → XLM after the split (separate classic tx — a
 * Soroban tx is single-operation by protocol, honest two-tap UX, README). */
export async function convertUsdcToXlm(
  sender: string,
  usdcAmount: string,
  minXlm: string,
): Promise<string> {
  return pathPaymentSelf(sender, new Asset(USDC_CODE, USDC_ISSUER), Asset.native(), usdcAmount, minXlm);
}

/** Convert tab: XLM → USDC, e.g. turning testnet XLM into split-able income. */
export async function convertXlmToUsdc(
  sender: string,
  xlmAmount: string,
  minUsdc: string,
): Promise<string> {
  return pathPaymentSelf(sender, Asset.native(), new Asset(USDC_CODE, USDC_ISSUER), xlmAmount, minUsdc);
}

export type ConvertDirection = "xlm-usdc" | "usdc-xlm";

/**
 * Live quote for a self-conversion via Horizon's strict-send pathfinding —
 * the same engine the DEX uses, so the preview matches what would execute.
 * Returns the estimated destination amount, or null when no path exists.
 */
export async function quoteConversion(
  direction: ConvertDirection,
  amount: string,
): Promise<number | null> {
  const params =
    direction === "xlm-usdc"
      ? `source_asset_type=native&source_amount=${amount}&destination_assets=${USDC_CODE}%3A${USDC_ISSUER}`
      : `source_asset_type=credit_alphanum4&source_asset_code=${USDC_CODE}&source_asset_issuer=${USDC_ISSUER}&source_amount=${amount}&destination_assets=native`;
  try {
    const res = await fetch(`${HORIZON_URL}/paths/strict-send?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    const records: any[] = data?._embedded?.records ?? [];
    if (records.length === 0) return null;
    // Records are candidate paths; take the best (highest) destination amount.
    return Math.max(...records.map((r) => Number(r.destination_amount)));
  } catch {
    return null;
  }
}

/** True if the account has a USDC trustline (can receive USDC). */
export async function hasUsdcTrustline(address: string): Promise<boolean> {
  const res = await fetch(`${HORIZON_URL}/accounts/${address}`);
  if (!res.ok) return false; // unfunded account has no trustlines
  const data = await res.json();
  return (data.balances ?? []).some(
    (b: { asset_code?: string; asset_issuer?: string }) =>
      b.asset_code === USDC_CODE && b.asset_issuer === USDC_ISSUER,
  );
}

/**
 * Add a USDC trustline (changeTrust) so the account can receive USDC —
 * required once before Top Up / payment links can deliver USDC.
 */
export async function addUsdcTrustline(sender: string): Promise<string> {
  const horizon = new Horizon.Server(HORIZON_URL);
  let source;
  try {
    source = await horizon.loadAccount(sender);
  } catch {
    throw new Error("Account not funded yet — get XLM first (Friendbot).");
  }

  const already = source.balances.some(
    (b: any) => b.asset_code === USDC_CODE && b.asset_issuer === USDC_ISSUER,
  );
  if (already) throw new Error("USDC trustline already exists.");

  const tx = new TransactionBuilder(source, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.changeTrust({ asset: new Asset(USDC_CODE, USDC_ISSUER) }),
    )
    .setTimeout(300)
    .build();

  try {
    const { signedTxXdr } = await signTxXdr(tx.toEnvelope().toXDR("base64"), NETWORK_PASSPHRASE);
    const sendTx = TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE);
    const result = await horizon.submitTransaction(sendTx as any) as any;
    return result.hash;
  } catch (e) {
    parseWalletError(e);
  }
}

/** Fund a testnet account with the Friendbot faucet (10,000 XLM). */
export async function fundWithFriendbot(address: string): Promise<void> {
  const res = await fetch(
    `https://friendbot.stellar.org?addr=${encodeURIComponent(address)}`,
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Friendbot failed: ${text.slice(0, 200)}`);
  }
}

async function invoke(
  userAddress: string,
  method: string,
  args: xdr.ScVal[],
): Promise<string> {
  if (!VAULT_CONTRACT_ID) {
    throw new Error("VAULT_CONTRACT_ID is not configured (local demo mode).");
  }
  const server = new rpc.Server(RPC_URL);
  let source;
  try {
    source = await server.getAccount(userAddress);
  } catch {
    throw new Error("Account not funded yet.");
  }

  const contract = new Contract(VAULT_CONTRACT_ID);
  const tx = new TransactionBuilder(source, {
    fee: "1000000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(300)
    .build();

  try {
    const prepared = await server.prepareTransaction(tx);
    const { signedTxXdr } = await signTxXdr(
      prepared.toEnvelope().toXDR("base64"),
      NETWORK_PASSPHRASE,
    );

    const sendTx = TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE);
    const res = await server.sendTransaction(sendTx) as any;
    if (res.status === "ERROR") throw new Error(`Transaction failed: ${res.errorResult}`);

    // poll until confirmed
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const g = await server.getTransaction(res.hash) as any;
      if (g.status === "SUCCESS") return res.hash;
      if (g.status === "FAILED") throw new Error("Transaction failed on the ledger.");
    }
    throw new Error("Timed out waiting for confirmation.");
  } catch (e) {
    parseWalletError(e);
  }
}

const toI128 = (usdc: number) =>
  nativeToScVal(BigInt(Math.round(usdc * 10_000_000)), { type: "i128" });

/** set_rules on-chain (percentages -> bps). */
export async function txSetRules(
  user: string,
  needsPct: number,
  savingsPct: number,
  bufferPct: number,
  lockSecs: number,
  anchors: string[] = [],
): Promise<string> {
  return invoke(user, "set_rules", [
    new Address(user).toScVal(),
    nativeToScVal(needsPct * 100, { type: "u32" }),
    nativeToScVal(savingsPct * 100, { type: "u32" }),
    nativeToScVal(bufferPct * 100, { type: "u32" }),
    nativeToScVal(BigInt(lockSecs), { type: "u64" }),
    xdr.ScVal.scvVec(anchors.map((a) => new Address(a).toScVal())),
  ]);
}

/** Sign & submit a distribute tx prepared by the keeper (one-tap approve).
 *  Re-stamps the sequence number from the network before signing so the XDR
 *  stays valid even when other transactions (friendbot, trustline, etc.) have
 *  advanced the account's sequence since the keeper prepared it. */
export async function signAndSubmitXdr(preparedXdr: string): Promise<string> {
  try {
    const server = new rpc.Server(RPC_URL);

    // Parse the keeper-prepared tx to extract the source account
    const origTx = TransactionBuilder.fromXDR(preparedXdr, NETWORK_PASSPHRASE);
    const sourceAddr = origTx.source;

    // Fetch the current sequence number from the network
    let freshSource;
    try {
      freshSource = await server.getAccount(sourceAddr);
    } catch {
      throw new Error("Source account not found on network.");
    }

    // Rebuild the transaction with a fresh sequence number AND time bounds.
    // This preserves all operations, fee, and Soroban auth/resources from
    // the keeper's prepared envelope — only the sequence + timeBounds change.
    const origEnv = xdr.TransactionEnvelope.fromXDR(preparedXdr, "base64");
    const txV1 = origEnv.v1().tx();
    txV1.seqNum(xdr.SequenceNumber.fromString(
      (BigInt(freshSource.sequenceNumber()) + 1n).toString(),
    ));

    // Extend time bounds: set maxTime to now + 300s so the tx doesn't fail
    // with txTOO_LATE when the keeper prepared it long ago.
    const newMaxTime = Math.floor(Date.now() / 1000) + 300;
    const zeroTime = xdr.TimePoint.fromString("0");
    const freshMaxTime = xdr.TimePoint.fromString(newMaxTime.toString());

    const condSwitch = txV1.cond().switch().name;
    if (condSwitch === "precondTime") {
      const old = txV1.cond().timeBounds();
      txV1.cond(xdr.Preconditions.precondTime(
        new xdr.TimeBounds({ minTime: old.minTime(), maxTime: freshMaxTime }),
      ));
    } else if (condSwitch === "precondV2") {
      const v2 = txV1.cond().v2();
      const oldTb = v2.timeBounds();
      v2.timeBounds(new xdr.TimeBounds({
        minTime: oldTb ? oldTb.minTime() : zeroTime,
        maxTime: freshMaxTime,
      }));
    } else {
      // precondNone → add time bounds
      txV1.cond(xdr.Preconditions.precondTime(
        new xdr.TimeBounds({ minTime: zeroTime, maxTime: freshMaxTime }),
      ));
    }

    const freshXdr = origEnv.toXDR("base64");

    const { signedTxXdr } = await signTxXdr(freshXdr, NETWORK_PASSPHRASE);
    const sendTx = TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE);
    const res = await server.sendTransaction(sendTx) as any;
    if (res.status === "ERROR") throw new Error(`Transaction failed: ${res.errorResult}`);

    // poll until confirmed (Soroban txs need a few ledgers)
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const g = await server.getTransaction(res.hash) as any;
      if (g.status === "SUCCESS") return res.hash;
      if (g.status === "FAILED") throw new Error("Transaction failed on the ledger.");
    }
    return res.hash;
  } catch (e) {
    parseWalletError(e);
  }
}

export async function txWithdrawSavings(user: string, usdc: number): Promise<string> {
  return invoke(user, "withdraw_savings", [new Address(user).toScVal(), toI128(usdc)]);
}

export async function txOfframp(
  user: string,
  anchor: string,
  usdc: number,
): Promise<string> {
  return invoke(user, "offramp", [
    new Address(user).toScVal(),
    new Address(anchor).toScVal(),
    toI128(usdc),
  ]);
}

// ---------------------------------------------------------------------------
// Level 2 — Real-time Soroban Event Polling
// ---------------------------------------------------------------------------

/** Polls Soroban getEvents for real-time state synchronization. */
export async function fetchLatestSplitEvent(cursor: string = ""): Promise<{ cursor: string; hash: string } | null> {
  if (!VAULT_CONTRACT_ID) return null;
  const server = new rpc.Server(RPC_URL);
  try {
    const request: any = {
      filters: [
        {
          type: "contract",
          contractIds: [VAULT_CONTRACT_ID],
          topics: [
            [xdr.ScVal.scvSymbol("split").toXDR("base64")],
          ],
        },
      ],
      limit: 10,
    };
    if (cursor) {
      request.cursor = cursor;
    } else {
      request.startLedger = 0; // or any valid starting ledger
    }

    const res = await server.getEvents(request);
    
    if (res.events.length > 0) {
      const latest = res.events[res.events.length - 1] as any;
      return { cursor: latest.pagingToken, hash: latest.txHash };
    }
  } catch {
    // Ignore RPC parsing errors, try again next poll
  }
  return null;
}
