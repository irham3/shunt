/**
 * ShuntVault contract client — wraps the auto-generated bindings from
 * `contracts/shunt-vault/bindings` so the rest of the frontend speaks
 * typed methods instead of raw XDR.
 *
 * The bindings Client handles simulation, assembly, and XDR encoding.
 * We only need to plug in the wallet signer from StellarWalletsKit.
 */
import { Client, networks, type Rules, type Goal } from "./vault-contract";
import { signTxXdr } from "./signer";
import { RPC_URL, VAULT_CONTRACT_ID, NETWORK_PASSPHRASE } from "./stellar";

// ---------------------------------------------------------------------------
// Client singleton
// ---------------------------------------------------------------------------

function getVaultClient(publicKey: string): Client {
  const contractId = VAULT_CONTRACT_ID || networks.testnet.contractId;
  if (!contractId) {
    throw new Error("VAULT_CONTRACT_ID is not configured (local demo mode).");
  }
  return new Client({
    contractId,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: RPC_URL,
    // Required so the bindings Client knows which account is the tx source
    // (needed even for read-only simulation) — without it every call fails
    // with "constructed using a default account".
    publicKey,
    // The bindings Client calls this to sign assembled transactions.
    async signTransaction(xdr: string) {
      return signTxXdr(xdr, NETWORK_PASSPHRASE);
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
  const client = getVaultClient(user);
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
  const client = getVaultClient(user);
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
  const client = getVaultClient(user);
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
  const client = getVaultClient(user);
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
  const client = getVaultClient(user);
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
  const client = getVaultClient(user);
  const tx = await client.get_rules({ user });
  return tx.result ?? null;
}

export async function vaultGetSavings(user: string): Promise<bigint> {
  const client = getVaultClient(user);
  const tx = await client.get_savings({ user });
  return tx.result;
}

export async function vaultGetLockUntil(user: string): Promise<bigint> {
  const client = getVaultClient(user);
  const tx = await client.get_lock_until({ user });
  return tx.result;
}

export async function vaultGetBufferCredit(user: string): Promise<bigint> {
  const client = getVaultClient(user);
  const tx = await client.get_buffer_credit({ user });
  return tx.result;
}

// ---------------------------------------------------------------------------
// Savings goals — named sub-allocations of the aggregate Savings balance.
// No separate custody: a goal's `amount` is drawn from — and released back
// to — the same on-chain Savings(user) total (contracts/shunt-vault/src/lib.rs).
// ---------------------------------------------------------------------------

/** Create a goal, allocating `usdc` from the unallocated Savings pool. */
export async function vaultCreateGoal(
  user: string,
  label: string,
  usdc: number,
): Promise<{ hash: string; goalId: number }> {
  const client = getVaultClient(user);
  const tx = await client.create_savings_goal({
    user,
    label,
    initial_amount: BigInt(Math.round(usdc * 10_000_000)),
  });
  const result = await tx.signAndSend();
  return { hash: (result as any).hash ?? "", goalId: Number(result.result) };
}

/** Withdraw from a specific goal (same penalty/timelock rules as Savings). */
export async function vaultWithdrawFromGoal(
  user: string,
  goalId: number,
  usdc: number,
): Promise<string> {
  const client = getVaultClient(user);
  const tx = await client.withdraw_from_goal({
    user,
    goal_id: goalId,
    amount: BigInt(Math.round(usdc * 10_000_000)),
  });
  const result = await tx.signAndSend();
  return (result as any).hash ?? "";
}

/** Rename a goal — cosmetic only, no balance change. */
export async function vaultRenameGoal(
  user: string,
  goalId: number,
  newLabel: string,
): Promise<string> {
  const client = getVaultClient(user);
  const tx = await client.rename_savings_goal({ user, goal_id: goalId, new_label: newLabel });
  const result = await tx.signAndSend();
  return (result as any).hash ?? "";
}

/** Delete a goal — its principal becomes unallocated again, no fund movement. */
export async function vaultDeleteGoal(user: string, goalId: number): Promise<string> {
  const client = getVaultClient(user);
  const tx = await client.delete_savings_goal({ user, goal_id: goalId });
  const result = await tx.signAndSend();
  return (result as any).hash ?? "";
}

export async function vaultGetGoals(user: string): Promise<Goal[]> {
  const client = getVaultClient(user);
  const tx = await client.get_savings_goals({ user });
  return [...(tx.result ?? [])];
}

export async function vaultGetUnallocatedSavings(user: string): Promise<bigint> {
  const client = getVaultClient(user);
  const tx = await client.get_unallocated_savings({ user });
  return tx.result;
}

export { type Rules, type Goal } from "./vault-contract";
