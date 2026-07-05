/**
 * ShuntVault contract client — wraps the auto-generated bindings from
 * `contracts/shunt-vault/bindings` so the rest of the frontend speaks
 * typed methods instead of raw XDR.
 *
 * The bindings Client handles simulation, assembly, and XDR encoding.
 * We only need to plug in the wallet signer from StellarWalletsKit.
 */
import { Client, networks, type Rules } from "bindings";
import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit";
import { RPC_URL, VAULT_CONTRACT_ID, NETWORK_PASSPHRASE } from "./stellar";

// ---------------------------------------------------------------------------
// Client singleton
// ---------------------------------------------------------------------------

function getVaultClient(): Client {
  const contractId = VAULT_CONTRACT_ID || networks.testnet.contractId;
  if (!contractId) {
    throw new Error("VAULT_CONTRACT_ID is not configured (local demo mode).");
  }
  return new Client({
    contractId,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: RPC_URL,
    // The bindings Client calls this to sign assembled transactions.
    async signTransaction(xdr: string) {
      const result = await StellarWalletsKit.signTransaction(xdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
      });
      return result as any;
    },
  });
}

// ---------------------------------------------------------------------------
// Public helpers consumed by screens
// ---------------------------------------------------------------------------

/** set_rules on-chain (percentages → bps). */
export async function vaultSetRules(
  user: string,
  needsPct: number,
  savingsPct: number,
  bufferPct: number,
  lockSecs: number,
  anchors: string[] = [],
): Promise<string> {
  const client = getVaultClient();
  const tx = await client.set_rules({
    user,
    needs_bps: needsPct * 100,
    savings_bps: savingsPct * 100,
    buffer_bps: bufferPct * 100,
    lock_secs: BigInt(lockSecs),
    anchors,
  });
  const result = await tx.signAndSend();
  return (result as any).hash ?? "";
}

/** Withdraw from Savings vault. */
export async function vaultWithdrawSavings(
  user: string,
  usdc: number,
): Promise<string> {
  const client = getVaultClient();
  const tx = await client.withdraw_savings({
    user,
    amount: BigInt(Math.round(usdc * 10_000_000)),
  });
  const result = await tx.signAndSend();
  return (result as any).hash ?? "";
}

/** Withdraw in-vault Buffer credit. */
export async function vaultWithdrawBuffer(
  user: string,
  usdc: number,
): Promise<string> {
  const client = getVaultClient();
  const tx = await client.withdraw_buffer({
    user,
    amount: BigInt(Math.round(usdc * 10_000_000)),
  });
  const result = await tx.signAndSend();
  return (result as any).hash ?? "";
}

/** Off-ramp to an allowlisted anchor address. */
export async function vaultOfframp(
  user: string,
  anchor: string,
  usdc: number,
): Promise<string> {
  const client = getVaultClient();
  const tx = await client.offramp({
    user,
    anchor,
    amount: BigInt(Math.round(usdc * 10_000_000)),
  });
  const result = await tx.signAndSend();
  return (result as any).hash ?? "";
}

/** Voluntary deposit into Savings vault. */
export async function vaultDeposit(
  user: string,
  usdc: number,
): Promise<string> {
  const client = getVaultClient();
  const tx = await client.deposit({
    user,
    amount: BigInt(Math.round(usdc * 10_000_000)),
  });
  const result = await tx.signAndSend();
  return (result as any).hash ?? "";
}

// ---------------------------------------------------------------------------
// Read-only views
// ---------------------------------------------------------------------------

export async function vaultGetRules(user: string): Promise<Rules | null> {
  const client = getVaultClient();
  const tx = await client.get_rules({ user });
  return tx.result ?? null;
}

export async function vaultGetSavings(user: string): Promise<bigint> {
  const client = getVaultClient();
  const tx = await client.get_savings({ user });
  return tx.result;
}

export async function vaultGetLockUntil(user: string): Promise<bigint> {
  const client = getVaultClient();
  const tx = await client.get_lock_until({ user });
  return tx.result;
}

export async function vaultGetBufferCredit(user: string): Promise<bigint> {
  const client = getVaultClient();
  const tx = await client.get_buffer_credit({ user });
  return tx.result;
}

export { type Rules } from "bindings";
