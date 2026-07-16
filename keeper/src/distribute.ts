import {
  Address,
  Contract,
  nativeToScVal,
  rpc,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import type { Env } from "./env";

/**
 * Build an unsigned, simulation-prepared `distribute` transaction with the
 * user's account as source. The keeper NEVER signs — the XDR is handed to
 * the web app for the user's one-tap Freighter approval.
 */
export async function buildDistributeTx(
  env: Env,
  userAccount: string,
  amountStroops: bigint,
  inflowTxHash: string,
  /** Threshold Buffer auto-refill (7-decimal stroops), caller-computed from a
   *  real wallet-balance read against the user's stored buffer_target — the
   *  keeper has no per-lane bookkeeping of its own to derive this itself.
   *  0 (default) preserves the original split behavior. */
  bufferTopupStroops: bigint = 0n,
): Promise<string> {
  const server = new rpc.Server(env.SOROBAN_RPC_URL);
  const source = await server.getAccount(userAccount);
  const contract = new Contract(env.VAULT_CONTRACT_ID);

  // Real inflows send the 64-hex Horizon tx hash. Anything else (older app
  // builds prefixed simulated hashes with "sim-", which Buffer.from(…, "hex")
  // silently truncates to 0 bytes) is digested to a deterministic 32-byte key
  // instead of failing the build.
  const inflowKey = /^[0-9a-fA-F]{64}$/.test(inflowTxHash)
    ? Buffer.from(inflowTxHash, "hex")
    : Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(inflowTxHash)));
  if (inflowKey.length !== 32) {
    throw new Error(`inflow tx hash must be 32 bytes, got ${inflowKey.length}`);
  }

  const op = contract.call(
    "distribute",
    new Address(userAccount).toScVal(),
    nativeToScVal(amountStroops, { type: "i128" }),
    xdr.ScVal.scvBytes(inflowKey),
    nativeToScVal(bufferTopupStroops, { type: "i128" }),
  );

  const tx = new TransactionBuilder(source, {
    fee: "1000000", // 0.1 XLM max fee; actual soroban fee comes from simulation
    networkPassphrase: env.NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(300)
    .build();

  const prepared = await server.prepareTransaction(tx);
  return prepared.toEnvelope().toXDR("base64");
}

/** USDC payment amount string ("500.0000000") -> 7-decimal stroops. */
export function amountToStroops(amount: string): bigint {
  const [whole, frac = ""] = amount.split(".");
  return BigInt(whole) * 10_000_000n + BigInt(frac.padEnd(7, "0").slice(0, 7));
}
