/**
 * F13: SEP-7 payment request links.
 *
 * `web+stellar:pay?...` URIs open in any SEP-7-aware Stellar wallet; the
 * https share link opens Shunt's own /pay screen so a payer without a
 * registered wallet handler still sees exactly what to pay and how.
 * Card checkout for non-crypto payers is a roadmap partner integration.
 */
import { USDC_CODE, USDC_ISSUER } from "./stellar";

export interface PaymentRequest {
  /** Payee Stellar account (G...) */
  to: string;
  /** Optional USDC amount, e.g. "500" */
  amount?: string;
  /** Optional short note shown to the payer (SEP-7 `msg`, max 300 chars) */
  note?: string;
}

/** SEP-7 URI for wallets. */
export function buildSep7Uri(req: PaymentRequest): string {
  const params = new URLSearchParams({ destination: req.to });
  if (req.amount) params.set("amount", req.amount);
  params.set("asset_code", USDC_CODE);
  params.set("asset_issuer", USDC_ISSUER);
  if (req.note) params.set("msg", req.note.slice(0, 300));
  return `web+stellar:pay?${params.toString()}`;
}

/** Shunt-hosted share link (payer-friendly landing at /pay). */
export function buildShareLink(req: PaymentRequest): string {
  const params = new URLSearchParams({ to: req.to });
  if (req.amount) params.set("amount", req.amount);
  if (req.note) params.set("note", req.note);
  return `${window.location.origin}/pay?${params.toString()}`;
}

/** Parse /pay?to=G...&amount=..&note=.. — returns null if `to` is missing. */
export function parsePayQuery(search: string): PaymentRequest | null {
  const params = new URLSearchParams(search);
  const to = params.get("to");
  if (!to) return null;
  return {
    to,
    amount: params.get("amount") ?? undefined,
    note: params.get("note") ?? undefined,
  };
}
