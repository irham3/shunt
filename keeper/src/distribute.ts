import {
  Address,
  Contract,
  nativeToScVal,
  rpc,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import type { KeeperConfig } from "./config.js";

/**
 * Build an unsigned, simulation-prepared `distribute` transaction with the
 * user's account as source. The keeper NEVER signs — the XDR is handed to
 * the web app for the user's one-tap Freighter approval (PRD §8).
 */
export async function buildDistributeTx(
  cfg: KeeperConfig,
  userAccount: string,
  amountStroops: bigint,
  inflowTxHash: string,
): Promise<string> {
  const server = new rpc.Server(cfg.rpcUrl);
  const source = await server.getAccount(userAccount);
  const contract = new Contract(cfg.vaultContractId);

  const inflowKey = Buffer.from(inflowTxHash, "hex");
  if (inflowKey.length !== 32) {
    throw new Error(`inflow tx hash must be 32 bytes, got ${inflowKey.length}`);
  }

  const op = contract.call(
    "distribute",
    new Address(userAccount).toScVal(),
    nativeToScVal(amountStroops, { type: "i128" }),
    xdr.ScVal.scvBytes(inflowKey),
  );

  const tx = new TransactionBuilder(source, {
    fee: "1000000", // 0.1 XLM max fee; actual soroban fee comes from simulation
    networkPassphrase: cfg.networkPassphrase,
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
