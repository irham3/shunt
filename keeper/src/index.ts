import { Horizon } from "@stellar/stellar-sdk";
import { buildDistributeTx, amountToStroops } from "./distribute";
import { watchAccounts, corsHeaders, isRateLimited, type Env } from "./env";

interface PendingSplit {
  account: string;
  amount: string;
  txHash: string;
  xdr: string | null;
  detectedAt: string;
  error?: string;
}

function json(data: unknown, status = 200, cors: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...cors },
  });
}

async function handleInflow(
  env: Env,
  account: string,
  amount: string,
  txHash: string,
): Promise<PendingSplit> {
  const processedKey = `processed:${txHash}`;
  const pendingKey = `pending:${txHash}`;

  if (await env.KEEPER_KV.get(processedKey)) {
    const existing = await env.KEEPER_KV.get(pendingKey, "json");
    return (existing as PendingSplit) ?? { account, amount, txHash, xdr: null, detectedAt: new Date().toISOString(), error: "already processed" };
  }

  const entry: PendingSplit = {
    account,
    amount,
    txHash,
    xdr: null,
    detectedAt: new Date().toISOString(),
  };

  try {
    entry.xdr = await buildDistributeTx(env, account, amountToStroops(amount), txHash);
  } catch (e) {
    entry.error = String(e);
  }

  // TTL: pending splits are demo-scoped, expire after a day so KV doesn't grow forever.
  await env.KEEPER_KV.put(pendingKey, JSON.stringify(entry), { expirationTtl: 86400 });
  return entry;
}

/** Cron: poll each watched account's recent payments for new USDC inflows. */
async function poll(env: Env): Promise<void> {
  const horizon = new Horizon.Server(env.HORIZON_URL);
  for (const account of watchAccounts(env)) {
    const cursorKey = `cursor:${account}`;
    const cursor = (await env.KEEPER_KV.get(cursorKey)) ?? "0";
    try {
      const page = await horizon
        .payments()
        .forAccount(account)
        .cursor(cursor)
        .order("asc")
        .limit(50)
        .call();

      for (const payment of page.records as any[]) {
        const isUsdcIn =
          payment.type === "payment" &&
          payment.to === account &&
          payment.asset_code === env.USDC_CODE &&
          payment.asset_issuer === env.USDC_ISSUER;
        if (isUsdcIn) {
          await handleInflow(env, account, payment.amount, payment.transaction_hash);
          await env.KEEPER_KV.put(`processed:${payment.transaction_hash}`, "1", {
            expirationTtl: 2592000, // 30 days
          });
        }
        await env.KEEPER_KV.put(cursorKey, payment.paging_token);
      }
    } catch (e) {
      console.error(`poll failed for ${account}:`, e);
    }
  }
}

async function listPending(env: Env, account: string): Promise<PendingSplit[]> {
  const out: PendingSplit[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.KEEPER_KV.list({ prefix: "pending:", cursor });
    for (const key of page.keys) {
      const entry = await env.KEEPER_KV.get(key.name, "json");
      if (entry && (entry as PendingSplit).account === account) {
        out.push(entry as PendingSplit);
      }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return out;
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(poll(env));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(env, request.headers.get("origin"));

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({
        ok: true,
        network: env.NETWORK_PASSPHRASE.includes("Test") ? "testnet" : "mainnet",
        watching: watchAccounts(env),
      }, 200, cors);
    }

    const pendingMatch = url.pathname.match(/^\/pending\/([^/]+)$/);
    if (pendingMatch && request.method === "GET") {
      return json(await listPending(env, pendingMatch[1]), 200, cors);
    }

    if (url.pathname === "/trigger" && request.method === "POST") {
      // Unauthenticated by design (only builds an unsigned XDR, worthless
      // without the owner's signature) — but rate-limited per IP so it can't be
      // spammed into KV-write amplification.
      const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
      if (await isRateLimited(env, ip)) {
        return json({ error: "rate limited — slow down" }, 429, cors);
      }
      const body = (await request.json().catch(() => ({}))) as {
        account?: string;
        amount?: string;
        txHash?: string;
      };
      if (!body.account || !body.amount || !body.txHash) {
        return json({ error: "account, amount, txHash required" }, 400, cors);
      }
      const entry = await handleInflow(env, body.account, body.amount, body.txHash);
      return json(entry, 200, cors);
    }

    if (url.pathname === "/complete" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as { txHash?: string };
      if (!body.txHash) return json({ error: "txHash required" }, 400, cors);
      await env.KEEPER_KV.delete(`pending:${body.txHash}`);
      await env.KEEPER_KV.put(`processed:${body.txHash}`, "1", { expirationTtl: 2592000 });
      return json({ ok: true }, 200, cors);
    }

    return json({ error: "not found" }, 404, cors);
  },
};
