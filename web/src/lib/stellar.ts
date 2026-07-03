import {
  isConnected,
  requestAccess,
  signTransaction,
} from "@stellar/freighter-api";
import {
  Address,
  Contract,
  nativeToScVal,
  rpc,
  TransactionBuilder,
  xdr,
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

export const EXPLORER_TX = (hash: string) =>
  `https://stellar.expert/explorer/${NETWORK === "testnet" ? "testnet" : "public"}/tx/${hash}`;

export async function connectFreighter(): Promise<string> {
  const conn = await isConnected();
  if (!conn.isConnected) {
    throw new Error("Freighter not detected. Install the Freighter extension first.");
  }
  const access = await requestAccess();
  if (access.error) throw new Error(access.error);
  return access.address;
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
  const source = await server.getAccount(userAddress);
  const contract = new Contract(VAULT_CONTRACT_ID);
  const tx = new TransactionBuilder(source, {
    fee: "1000000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(300)
    .build();

  const prepared = await server.prepareTransaction(tx);
  const signed = await signTransaction(prepared.toEnvelope().toXDR("base64"), {
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  if (signed.error) throw new Error(String(signed.error));

  const sendTx = TransactionBuilder.fromXDR(signed.signedTxXdr, NETWORK_PASSPHRASE);
  const res = await server.sendTransaction(sendTx);
  if (res.status === "ERROR") throw new Error(`Transaction failed: ${res.errorResult}`);

  // poll until confirmed
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const g = await server.getTransaction(res.hash);
    if (g.status === "SUCCESS") return res.hash;
    if (g.status === "FAILED") throw new Error("Transaction failed on the ledger.");
  }
  throw new Error("Timed out waiting for confirmation.");
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
  const server = new rpc.Server(RPC_URL);
  const signed = await signTransaction(preparedXdr, {
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  if (signed.error) throw new Error(String(signed.error));
  const sendTx = TransactionBuilder.fromXDR(signed.signedTxXdr, NETWORK_PASSPHRASE);
  const res = await server.sendTransaction(sendTx);
  if (res.status === "ERROR") throw new Error(`Transaction failed: ${res.errorResult}`);
  return res.hash;
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
