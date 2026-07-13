export interface Env {
  KEEPER_KV: KVNamespace;
  STELLAR_NETWORK: string;
  HORIZON_URL: string;
  SOROBAN_RPC_URL: string;
  NETWORK_PASSPHRASE: string;
  USDC_CODE: string;
  USDC_ISSUER: string;
  VAULT_CONTRACT_ID: string;
  WATCH_ACCOUNTS: string;
  /** Optional comma-separated origin allowlist for CORS. Unset ⇒ "*" (dev). */
  ALLOWED_ORIGINS?: string;
  /** Optional per-IP /trigger cap per minute (default 30). */
  TRIGGER_RATE_PER_MIN?: string;
}

export function watchAccounts(env: Env): string[] {
  return env.WATCH_ACCOUNTS.split(",").map((s) => s.trim()).filter(Boolean);
}

export function allowedOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

/** CORS headers echoing the request Origin when it's on the allowlist; falls
    back to "*" only when no allowlist is configured (keeps dev frictionless). */
export function corsHeaders(env: Env, origin: string | null): Record<string, string> {
  const list = allowedOrigins(env);
  const allow = list.length === 0 ? "*" : origin && list.includes(origin) ? origin : list[0];
  return {
    "access-control-allow-origin": allow,
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "vary": "Origin",
  };
}

/** Fixed-window per-IP rate limit in KV. Returns true if the caller is over the
    cap. Fails OPEN (never blocks on a KV error) — this is spam control, not auth. */
export async function isRateLimited(env: Env, ip: string): Promise<boolean> {
  const cap = Number(env.TRIGGER_RATE_PER_MIN ?? "30") || 30;
  const window = Math.floor(Date.now() / 60_000);
  const key = `rl:${ip}:${window}`;
  try {
    const n = Number((await env.KEEPER_KV.get(key)) ?? "0") + 1;
    await env.KEEPER_KV.put(key, String(n), { expirationTtl: 120 });
    return n > cap;
  } catch {
    return false;
  }
}
