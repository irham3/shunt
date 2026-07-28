import { Horizon } from "@stellar/stellar-sdk";
import { buildDistributeTx, amountToStroops } from "./distribute";
import {
  watchAccounts,
  corsHeaders,
  isRateLimited,
  jobTtlSeconds,
  confirmedTtlSeconds,
  type Env,
} from "./env";

export type KeeperJobStatus =
  | "detected"
  | "prepared"
  | "confirmed"
  | "failed";

export interface PendingSplit {
  account: string;
  amount: string;
  /**
   * Hash of the original incoming payment.
   * Kept as `txHash` for backward compatibility with the web client.
   */
  txHash: string;
  status: KeeperJobStatus;
  xdr: string | null;
  detectedAt: string;
  updatedAt: string;
  /**
   * Hash of the successful signed distribute transaction.
   * Only present after chain verification.
   */
  submissionTxHash?: string;
  error?: string;
}

function pendingKey(inflowTxHash: string): string {
  return `pending:${inflowTxHash}`;
}

function processedKey(inflowTxHash: string): string {
  return `processed:${inflowTxHash}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

async function saveJob(
  env: Env,
  job: PendingSplit,
): Promise<void> {
  await env.KEEPER_KV.put(
    pendingKey(job.txHash),
    JSON.stringify(job),
    { expirationTtl: jobTtlSeconds(env) },
  );
}

async function loadJob(
  env: Env,
  inflowTxHash: string,
): Promise<PendingSplit | null> {
  return await env.KEEPER_KV.get(
    pendingKey(inflowTxHash),
    "json",
  ) as PendingSplit | null;
}

function publicJob(job: PendingSplit): PendingSplit {
  return { ...job };
}

function json(data: unknown, status = 200, cors: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...cors },
  });
}

export async function handleInflow(
  env: Env,
  account: string,
  amount: string,
  inflowTxHash: string,
  isSimulated = false,
  bufferTopup?: string,
): Promise<PendingSplit> {
  const existingConfirmed = await env.KEEPER_KV.get(
    processedKey(inflowTxHash),
  );

  if (!isSimulated && existingConfirmed) {
    const existing = await loadJob(env, inflowTxHash);
    if (existing) {
      return publicJob(existing);
    }
    const timestamp = nowIso();
    return {
      account,
      amount,
      txHash: inflowTxHash,
      status: "confirmed",
      xdr: null,
      detectedAt: timestamp,
      updatedAt: timestamp,
      error: "already confirmed on-chain",
    };
  }

  const existing = isSimulated
    ? null
    : await loadJob(env, inflowTxHash);

  /**
   * A prepared XDR can be returned while it still exists.
   * We intentionally do not create a processed marker here.
   * "Prepared" is not the same as "confirmed".
   */
  if (existing?.status === "prepared" && existing.xdr) {
    return publicJob(existing);
  }

  /**
   * Existing failed, detected, or XDR-less prepared jobs are rebuilt.
   * This makes jobs recoverable after an XDR expires or an earlier
   * Soroban RPC simulation failure.
   */
  const detectedAt = existing?.detectedAt ?? nowIso();

  const detectedJob: PendingSplit = {
    account,
    amount,
    txHash: inflowTxHash,
    status: "detected",
    xdr: null,
    detectedAt,
    updatedAt: nowIso(),
  };

  if (!isSimulated) {
    await saveJob(env, detectedJob);
  }

  try {
    const xdr = await buildDistributeTx(
      env,
      account,
      amountToStroops(amount),
      inflowTxHash,
      bufferTopup ? amountToStroops(bufferTopup) : 0n,
    );

    const preparedJob: PendingSplit = {
      ...detectedJob,
      status: "prepared",
      xdr,
      updatedAt: nowIso(),
      error: undefined,
    };

    if (!isSimulated) {
      await saveJob(env, preparedJob);
    }
    return publicJob(preparedJob);
  } catch (error) {
    const failedJob: PendingSplit = {
      ...detectedJob,
      status: "failed",
      xdr: null,
      updatedAt: nowIso(),
      error: error instanceof Error ? error.message : String(error),
    };

    if (!isSimulated) {
      await saveJob(env, failedJob);
    }
    return publicJob(failedJob);
  }
}

/** Cron: poll each watched account's recent payments for new USDC inflows. */
export async function poll(env: Env): Promise<void> {
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
          /**
           * `handleInflow` persists detected/prepared/failed state before
           * this cursor is advanced. Even a preparation failure therefore
           * remains visible and retryable through /pending and /trigger.
           */
          await handleInflow(
            env,
            account,
            payment.amount,
            payment.transaction_hash,
          );
        }
        /**
         * Advance only after processing/persisting this record.
         * If KV persistence throws, execution jumps to catch and this
         * record can be revisited from the previous stored cursor.
         */
        await env.KEEPER_KV.put(cursorKey, payment.paging_token);
      }
    } catch (error) {
      console.error(`poll failed for ${account}:`, error);
    }
  }
}

export async function listPending(
  env: Env,
  account: string,
): Promise<PendingSplit[]> {
  const jobs: PendingSplit[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.KEEPER_KV.list({
      prefix: "pending:",
      cursor,
    });
    for (const key of page.keys) {
      const job = await env.KEEPER_KV.get(
        key.name,
        "json",
      ) as PendingSplit | null;
      if (
        job &&
        job.account === account &&
        job.status !== "confirmed"
      ) {
        jobs.push(publicJob(job));
      }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  return jobs.sort(
    (a, b) =>
      new Date(a.detectedAt).getTime() -
      new Date(b.detectedAt).getTime(),
  );
}

interface CompleteRequest {
  inflowTxHash?: string;
  submissionTxHash?: string;
}

export async function confirmJob(
  env: Env,
  inflowTxHash: string,
  submissionTxHash: string,
): Promise<PendingSplit> {
  const job = await loadJob(env, inflowTxHash);
  if (!job) {
    throw new Error("keeper job not found");
  }

  if (job.status === "confirmed") {
    if (
      job.submissionTxHash &&
      job.submissionTxHash !== submissionTxHash
    ) {
      throw new Error(
        "job was already confirmed with a different transaction",
      );
    }
    return publicJob(job);
  }

  const horizon = new Horizon.Server(env.HORIZON_URL);
  let transaction: any;
  try {
    transaction = await horizon
      .transactions()
      .transaction(submissionTxHash)
      .call();
  } catch {
    throw new Error(
      "submitted transaction was not found on Horizon",
    );
  }

  if (transaction.successful !== true) {
    throw new Error(
      "submitted transaction is not successful",
    );
  }

  if (transaction.source_account !== job.account) {
    throw new Error(
      "submitted transaction source does not match keeper job account",
    );
  }

  const confirmedJob: PendingSplit = {
    ...job,
    status: "confirmed",
    xdr: null,
    updatedAt: nowIso(),
    submissionTxHash,
    error: undefined,
  };

  /**
   * Persist the terminal job first, then write the replay marker.
   * If the second write fails, /complete can safely be retried.
   */
  await saveJob(env, confirmedJob);
  await env.KEEPER_KV.put(
    processedKey(inflowTxHash),
    submissionTxHash,
    { expirationTtl: confirmedTtlSeconds(env) },
  );

  return publicJob(confirmedJob);
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
      const watching = watchAccounts(env);
      return json({
        ok: true,
        network: env.NETWORK_PASSPHRASE.includes("Test") ? "testnet" : "mainnet",
        contractId: env.VAULT_CONTRACT_ID,
        watchingCount: watching.length,
        watching,
        jobTtlSeconds: jobTtlSeconds(env),
        confirmedTtlSeconds: confirmedTtlSeconds(env),
        lifecycle: [
          "detected",
          "prepared",
          "confirmed",
          "failed",
        ],
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
        isSimulated?: boolean;
        bufferTopup?: string;
      };
      if (!body.account || !body.amount || !body.txHash) {
        return json({ error: "account, amount, txHash required" }, 400, cors);
      }
      const entry = await handleInflow(env, body.account, body.amount, body.txHash, !!body.isSimulated, body.bufferTopup);
      return json(entry, 200, cors);
    }

    if (url.pathname === "/complete" && request.method === "POST") {
      const body = await request
        .json()
        .catch(() => ({})) as CompleteRequest;

      if (!body.inflowTxHash || !body.submissionTxHash) {
        return json(
          {
            error:
              "inflowTxHash and submissionTxHash are required",
          },
          400,
          cors,
        );
      }

      try {
        const job = await confirmJob(
          env,
          body.inflowTxHash,
          body.submissionTxHash,
        );
        return json(
          {
            ok: true,
            job,
          },
          200,
          cors,
        );
      } catch (error) {
        return json(
          {
            error:
              error instanceof Error
                ? error.message
                : String(error),
          },
          409,
          cors,
        );
      }
    }

    return json({ error: "not found" }, 404, cors);
  },
};
