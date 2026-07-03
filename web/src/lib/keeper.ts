/** Client for the Shunt keeper API (detection + prepared distribute XDRs). */
const KEEPER_URL = import.meta.env.VITE_KEEPER_URL ?? "http://localhost:8787";

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
    return await res.json();
  } catch {
    return []; // keeper offline -> manual trigger still available
  }
}

export async function manualTrigger(
  account: string,
  amount: string,
  txHash: string,
): Promise<PendingSplit | null> {
  try {
    const res = await fetch(`${KEEPER_URL}/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account, amount, txHash }),
    });
    if (!res.ok) return null;
    return await res.json();
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
