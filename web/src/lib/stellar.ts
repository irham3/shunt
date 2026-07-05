import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit";
import { FreighterModule } from "@creit.tech/stellar-wallets-kit/modules/freighter";
import { AlbedoModule } from "@creit.tech/stellar-wallets-kit/modules/albedo";
import { xBullModule } from "@creit.tech/stellar-wallets-kit/modules/xbull";
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

// Register wallet modules at import time so all static methods work.
StellarWalletsKit.init({
  modules: [
    new FreighterModule(),
    new AlbedoModule(),
    new xBullModule(),
  ],
  network: NETWORK_PASSPHRASE as any,
});

/** Formats wallet kit errors for better UX (Level 2). */
function parseWalletError(e: unknown): never {
  const msg = String(e).toLowerCase();
  if (msg.includes("not installed") || msg.includes("not found")) {
    throw new Error("Wallet not found. Please install the extension.");
  }
  if (msg.includes("reject") || msg.includes("decline") || msg.includes("cancel")) {
    throw new Error("Transaction rejected by user.");
  }
  if (msg.includes("tx_insufficient_balance") || msg.includes("underfunded")) {
    throw new Error("Insufficient XLM balance for this transaction.");
  }
  throw new Error(e instanceof Error ? e.message : String(e));
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

/** Build, sign (WalletKit), and submit a native XLM payment on Horizon. */
export async function sendXlmPayment(
  sender: string,
  destination: string,
  amount: string,
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
      Operation.payment({
        destination,
        asset: Asset.native(),
        amount,
      }),
    )
    .setTimeout(300)
    .build();

  try {
    const { signedTxXdr } = await StellarWalletsKit.signTransaction(
      tx.toEnvelope().toXDR("base64"),
      { networkPassphrase: NETWORK_PASSPHRASE }
    );
    const sendTx = TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE);
    const result = await horizon.submitTransaction(sendTx as any) as any;
    return result.hash;
  } catch (e) {
    parseWalletError(e);
  }
}

/**
 * F12 Invest lane: spot-convert USDC -> XLM to self via a classic
 * `pathPaymentStrictSend` through the Stellar DEX. Deliberately a separate
 * classic transaction: a Soroban tx is single-operation by protocol, so the
 * conversion can't ride inside `distribute` — honest two-tap UX (README).
 */
export async function convertUsdcToXlm(
  sender: string,
  usdcAmount: string,
  minXlm: string,
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
        sendAsset: new Asset(USDC_CODE, USDC_ISSUER),
        sendAmount: usdcAmount,
        destination: sender,
        destAsset: Asset.native(),
        destMin: minXlm,
      }),
    )
    .setTimeout(300)
    .build();

  try {
    const { signedTxXdr } = await StellarWalletsKit.signTransaction(
      tx.toEnvelope().toXDR("base64"),
      { networkPassphrase: NETWORK_PASSPHRASE }
    );
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
    const { signedTxXdr } = await StellarWalletsKit.signTransaction(
      prepared.toEnvelope().toXDR("base64"),
      { networkPassphrase: NETWORK_PASSPHRASE }
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

/** Sign & submit a distribute tx prepared by the keeper (one-tap approve). */
export async function signAndSubmitXdr(preparedXdr: string): Promise<string> {
  try {
    const server = new rpc.Server(RPC_URL);
    const { signedTxXdr } = await StellarWalletsKit.signTransaction(
      preparedXdr,
      { networkPassphrase: NETWORK_PASSPHRASE }
    );
    const sendTx = TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE);
    const res = await server.sendTransaction(sendTx) as any;
    if (res.status === "ERROR") throw new Error(`Transaction failed: ${res.errorResult}`);
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
