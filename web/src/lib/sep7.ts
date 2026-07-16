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

/** A request parsed from ANY SEP-7 `web+stellar:pay` URI — including ones
 *  from other merchants/wallets that ask to be paid in an asset other than
 *  USDC. Used by the "Pay a request" flow: the requester picks the asset,
 *  Shunt pays it while the user still spends from USDC via a path payment. */
export interface ParsedSep7Request {
  destination: string;
  /** Requested destination amount, if the URI specifies one. */
  amount?: string;
  /** true = requested asset is native XLM. */
  isNative: boolean;
  assetCode?: string;
  assetIssuer?: string;
  memo?: string;
  note?: string;
}

/** Parse an arbitrary `web+stellar:pay?...` SEP-7 URI (RFC: destination,
 *  amount, asset_code, asset_issuer, memo, msg). Returns null if it isn't a
 *  well-formed SEP-7 pay request. */
export function parseSep7PayUri(uri: string): ParsedSep7Request | null {
  const trimmed = uri.trim();
  if (!trimmed.toLowerCase().startsWith("web+stellar:pay")) return null;
  const qIndex = trimmed.indexOf("?");
  if (qIndex === -1) return null;
  const params = new URLSearchParams(trimmed.slice(qIndex + 1));
  const destination = params.get("destination");
  if (!destination) return null;
  const assetCode = params.get("asset_code") ?? undefined;
  const assetIssuer = params.get("asset_issuer") ?? undefined;
  return {
    destination,
    amount: params.get("amount") ?? undefined,
    isNative: !assetCode || assetCode.toLowerCase() === "native",
    assetCode,
    assetIssuer,
    memo: params.get("memo") ?? undefined,
    note: params.get("msg") ?? undefined,
  };
}
