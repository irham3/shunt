/** Client for the Shunt keeper API (detection + prepared distribute XDRs). */
const KEEPER_URL = import.meta.env.VITE_KEEPER_URL ?? "http://localhost:8787";

/**
 * Synthetic inflow key for simulated/manual splits. Must be exactly 32 bytes
 * of hex — the keeper decodes it with Buffer.from(hash, "hex") and the
 * contract stores it as BytesN<32>, so a "sim-" style prefix breaks the
 * build with "inflow tx hash must be 32 bytes, got 0". Simulated entries are
 * kept out of the pending list by the isSimulated flag instead.
 */
export function randomTxHash(): string {
  return [...crypto.getRandomValues(new Uint8Array(32))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface PendingSplit {
  account: string;
  amount: string;
  txHash: string;
  xdr: string | null;
  detectedAt: string;
  error?: string;
}

export async function fetchPending(account: string): Promise<PendingSplit[]> {
  try {
    const res = await fetch(`${KEEPER_URL}/pending/${account}`);
    if (!res.ok) return [];
    const splits = await res.json() as PendingSplit[];
    return splits.filter(s => !s.txHash.startsWith("sim-"));
  } catch {
    return []; // keeper offline -> manual trigger still available
  }
}

export async function manualTrigger(
  account: string,
  amount: string,
  txHash: string,
  isSimulated = false,
  retries = 3
): Promise<PendingSplit | null> {
  try {
    const res = await fetch(`${KEEPER_URL}/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account, amount, txHash, isSimulated }),
    });
    if (!res.ok) return null;
    const data = await res.json() as PendingSplit;
    
    // If we get RulesNotSet (#3) on a simulated run, it's highly likely to be 
    // Soroban RPC lag immediately after the user saved rules. Retry.
    if (data.error && data.error.includes("#3") && isSimulated && retries > 0) {
      await new Promise(r => setTimeout(r, 2000));
      return manualTrigger(account, amount, txHash, isSimulated, retries - 1);
    }
    
    return data;
  } catch {
    return null;
  }
}

export async function markComplete(txHash: string): Promise<void> {
  try {
    await fetch(`${KEEPER_URL}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ txHash }),
    });
  } catch {
    // best effort
  }
}
