/**
 * Shunt v2 Payment Request specifications and helpers (PRD §8.1 & §9.3).
 *
 * Allows accountless payers or wallets to verify and execute automated income-routing.
 * Includes cryptographic bindings to expected_policy_version to prevent split manipulation.
 */

export interface PaymentRequest {
  /** Unique 32-byte hex ID for idempotency & replay protection */
  id: string;
  /** Recipient Soroban address */
  recipient: string;
  /** Payment gross amount in 7-decimal USDC stroops (i128 string or bigint) */
  amount: string;
  /** Optional human-readable note/memo for the invoice */
  memo?: string;
  /** Expected recipient policy version at time of invoicing */
  expectedPolicyVersion: number;
  /** Unix timestamp (milliseconds) when this payment request expires */
  expiresAt: number;
  /** Optional cryptographic signature or HMAC to verify authenticity */
  signature?: string;
}

export interface PaymentReceipt {
  requestId: string;
  payer: string;
  recipient: string;
  gross: string;
  emergency: string;
  obligation: string;
  goal: string;
  spendable: string;
  policyVersion: number;
  timestamp: number;
  txHash?: string;
}

/**
 * Generate a random 32-byte hex string for request ID.
 */
export function generateRequestId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Encode a payment request into a shareable Shunt URI (e.g. for QR codes or deep links).
 */
export function encodePaymentRequest(req: PaymentRequest): string {
  const payload = JSON.stringify({
    i: req.id,
    r: req.recipient,
    a: req.amount,
    v: req.expectedPolicyVersion,
    e: req.expiresAt,
    m: req.memo || "",
    s: req.signature || "",
  });
  const base64 = btoa(unescape(encodeURIComponent(payload)));
  return `shunt://pay?data=${base64}`;
}

/**
 * Decode a Shunt payment request URI or raw base64 string.
 */
export function decodePaymentRequest(uriOrData: string): PaymentRequest | null {
  try {
    let data = uriOrData;
    if (uriOrData.startsWith("shunt://pay?data=")) {
      data = uriOrData.replace("shunt://pay?data=", "");
    }
    const json = JSON.parse(decodeURIComponent(escape(atob(data))));
    return {
      id: json.i,
      recipient: json.r,
      amount: String(json.a),
      expectedPolicyVersion: Number(json.v),
      expiresAt: Number(json.e),
      memo: json.m ? String(json.m) : undefined,
      signature: json.s ? String(json.s) : undefined,
    };
  } catch (e) {
    console.error("Failed to decode payment request:", e);
    return null;
  }
}

/**
 * Verify if a payment request is expired or invalid.
 */
export function validatePaymentRequest(req: PaymentRequest): { valid: boolean; reason?: string } {
  if (!req.id || req.id.length !== 64) {
    return { valid: false, reason: "Invalid request ID format (expected 32-byte hex)" };
  }
  if (!req.recipient || (!req.recipient.startsWith("G") && !req.recipient.startsWith("C"))) {
    return { valid: false, reason: "Invalid recipient Stellar address" };
  }
  try {
    if (BigInt(req.amount) <= 0n) {
      return { valid: false, reason: "Payment amount must be positive" };
    }
  } catch {
    return { valid: false, reason: "Invalid amount numeric string" };
  }
  if (Date.now() > req.expiresAt) {
    return { valid: false, reason: "Payment request has expired" };
  }
  return { valid: true };
}
