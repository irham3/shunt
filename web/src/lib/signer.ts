/**
 * Central transaction signer. Every screen signs through here so the app
 * has exactly one wallet touchpoint (StellarWalletsKit — Freighter, Albedo,
 * xBull) and one escape hatch: the Playwright E2E harness injects a
 * throwaway *testnet* keypair on `window` and the same flows sign locally,
 * making true end-to-end runs possible in a headless browser where no
 * wallet extension can live. Never set the hook outside tests.
 */
import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit";

declare global {
  interface Window {
    /** Testnet-only secret key injected by the E2E harness (web/e2e). */
    __SHUNT_E2E_SECRET__?: string;
  }
}

/** The injected E2E keypair, or null in normal (wallet) operation. */
export function e2eKeypair(): Keypair | null {
  const secret =
    typeof window !== "undefined" ? window.__SHUNT_E2E_SECRET__ : undefined;
  if (!secret) return null;
  try {
    return Keypair.fromSecret(secret);
  } catch {
    return null;
  }
}

/** Sign a base64 tx envelope with the connected wallet (or E2E keypair). */
export async function signTxXdr(
  xdr: string,
  networkPassphrase: string,
): Promise<{ signedTxXdr: string }> {
  const kp = e2eKeypair();
  if (kp) {
    const tx = TransactionBuilder.fromXDR(xdr, networkPassphrase);
    tx.sign(kp);
    return { signedTxXdr: tx.toXDR() };
  }
  return StellarWalletsKit.signTransaction(xdr, { networkPassphrase });
}
