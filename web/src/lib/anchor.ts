/**
 * SEP-24 interactive on/off-ramp against a Stellar anchor (F10 / F11).
 *
 * Flow: SEP-1 TOML discovery -> SEP-10 web auth (challenge signed with
 * Freighter) -> SEP-24 interactive withdraw (cash-out) or deposit (Top Up).
 * KYC and bank details live in the anchor's hosted UI; the contract's anchor
 * allowlist governs where withdrawn USDC may be sent (PRD §12). Deposited
 * USDC lands in the wallet like any inflow, so the keeper picks it up.
 *
 * Demo target: SDF test anchor. Production target: IDRX or a PHP-corridor
 * anchor once verified on Stellar.
 */
import { signTxXdr } from "./signer";
import { NETWORK_PASSPHRASE } from "./stellar";

export const ANCHOR_HOME_DOMAIN =
  import.meta.env.VITE_ANCHOR_HOME_DOMAIN ?? "testanchor.stellar.org";

/**
 * SDF's public test anchor caps every sandbox deposit/withdraw at 1–10 of
 * the asset (its /sep24/info, not something Shunt imposes) — a production
 * anchor (IDRX etc.) would have real limits instead. Surfaced client-side
 * so the amount field fails fast instead of round-tripping to a 400.
 */
export const ANCHOR_MIN_AMOUNT = 1;
export const ANCHOR_MAX_AMOUNT = 10;

/** Extract the anchor's own `{"error": "..."}` body, if present, for a readable message. */
async function anchorErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.error === "string") return `${fallback}: ${body.error}`;
  } catch {
    // body wasn't JSON — fall through to the generic message
  }
  return `${fallback} (${res.status})`;
}

interface AnchorInfo {
  webAuthEndpoint: string;
  sep24Endpoint: string;
  signingKey: string;
}

let cachedInfo: AnchorInfo | null = null;

/** SEP-1: fetch and parse the anchor's stellar.toml. */
export async function discoverAnchor(): Promise<AnchorInfo> {
  if (cachedInfo) return cachedInfo;
  const res = await fetch(`https://${ANCHOR_HOME_DOMAIN}/.well-known/stellar.toml`);
  if (!res.ok) throw new Error(`Anchor TOML fetch failed (${res.status})`);
  const toml = await res.text();
  const field = (key: string) =>
    toml.match(new RegExp(`^${key}\\s*=\\s*"([^"]+)"`, "m"))?.[1];
  const webAuthEndpoint = field("WEB_AUTH_ENDPOINT");
  const sep24Endpoint = field("TRANSFER_SERVER_SEP0024");
  const signingKey = field("SIGNING_KEY");
  if (!webAuthEndpoint || !sep24Endpoint || !signingKey) {
    throw new Error("Anchor TOML is missing SEP-10/SEP-24 endpoints.");
  }
  cachedInfo = { webAuthEndpoint, sep24Endpoint, signingKey };
  return cachedInfo;
}

/** SEP-10: obtain a JWT by signing the anchor's challenge with the wallet. */
export async function authenticate(account: string): Promise<string> {
  const { webAuthEndpoint } = await discoverAnchor();
  const chRes = await fetch(
    `${webAuthEndpoint}?account=${encodeURIComponent(account)}`,
  );
  if (!chRes.ok) throw new Error(await anchorErrorMessage(chRes, "SEP-10 challenge failed"));
  const { transaction } = await chRes.json();

  const signed = await signTxXdr(transaction, NETWORK_PASSPHRASE);

  const tokRes = await fetch(webAuthEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transaction: signed.signedTxXdr }),
  });
  if (!tokRes.ok) throw new Error(await anchorErrorMessage(tokRes, "SEP-10 token exchange failed"));
  const { token } = await tokRes.json();
  return token;
}

export interface WithdrawSession {
  /** Anchor-hosted interactive URL to open in a popup/new tab. */
  url: string;
  /** Anchor transaction id for status polling. */
  id: string;
}

/** SEP-24: start an interactive withdraw; returns the hosted-flow URL. */
export async function startWithdraw(
  account: string,
  jwt: string,
  assetCode: string,
  amount: string,
): Promise<WithdrawSession> {
  const { sep24Endpoint } = await discoverAnchor();
  const res = await fetch(`${sep24Endpoint}/transactions/withdraw/interactive`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ asset_code: assetCode, account, amount }),
  });
  if (!res.ok) throw new Error(await anchorErrorMessage(res, "SEP-24 withdraw start failed"));
  const data = await res.json();
  return { url: data.url, id: data.id };
}

/** SEP-24: start an interactive deposit (Top Up) — mirror of `startWithdraw`. */
export async function startDeposit(
  account: string,
  jwt: string,
  assetCode: string,
  amount: string,
): Promise<WithdrawSession> {
  const { sep24Endpoint } = await discoverAnchor();
  const res = await fetch(`${sep24Endpoint}/transactions/deposit/interactive`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ asset_code: assetCode, account, amount }),
  });
  if (!res.ok) throw new Error(await anchorErrorMessage(res, "SEP-24 deposit start failed"));
  const data = await res.json();
  return { url: data.url, id: data.id };
}

export interface AnchorTxStatus {
  status: string;
  amountIn?: string;
  amountOut?: string;
  withdrawAnchorAccount?: string;
  withdrawMemo?: string;
  withdrawMemoType?: string;
}

/** SEP-24: poll a withdraw transaction's status. */
export async function getWithdrawStatus(
  jwt: string,
  id: string,
): Promise<AnchorTxStatus> {
  const { sep24Endpoint } = await discoverAnchor();
  const res = await fetch(`${sep24Endpoint}/transaction?id=${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) throw new Error(await anchorErrorMessage(res, "SEP-24 status failed"));
  const { transaction: t } = await res.json();
  return {
    status: t.status,
    amountIn: t.amount_in,
    amountOut: t.amount_out,
    withdrawAnchorAccount: t.withdraw_anchor_account,
    withdrawMemo: t.withdraw_memo,
    withdrawMemoType: t.withdraw_memo_type,
  };
}
