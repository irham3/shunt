import { Horizon, StrKey } from "@stellar/stellar-sdk";
import { buildDistributeTx, amountToStroops } from "./distribute";
import {
  watchAccounts,
  corsHeaders,
  isRateLimited,
  jobTtlSeconds,
  confirmedTtlSeconds,
  type Env,
} from "./env";
import {
  getDurableCursor,
  setDurableCursor,
  listIndexedEvents,
  pollSorobanContractEvents,
  type IndexedEvent,
} from "./indexer";

export {
  getDurableCursor,
  setDurableCursor,
  listIndexedEvents,
  pollSorobanContractEvents,
  type IndexedEvent,
};

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

function isValidStellarAccount(address: unknown): address is string {
  return typeof address === "string" && StrKey.isValidEd25519PublicKey(address);
}

async function verifyTransakWalletAddress(
  apiKey: string,
  cryptoCurrencyCode: string,
  network: string,
  walletAddress: string,
): Promise<boolean> {
  const verifyUrl = new URL("https://api-stg.transak.com/cryptocoverage/api/v1/public/verify-wallet-address");
  verifyUrl.searchParams.set("cryptoCurrency", cryptoCurrencyCode);
  verifyUrl.searchParams.set("network", network);
  verifyUrl.searchParams.set("walletAddress", walletAddress);

  const verifyRes = await fetch(verifyUrl.toString(), {
    method: "GET",
    headers: {
      "x-api-key": apiKey,
    },
  });
  const verifyText = await verifyRes.text();
  let verifyData: any = {};
  try { verifyData = JSON.parse(verifyText); } catch (_) { /* non-JSON */ }

  return verifyRes.ok && verifyData?.response === true;
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
    ctx.waitUntil(pollSorobanContractEvents(env));
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

    const indexerEventsMatch = url.pathname.match(/^\/indexer\/events\/([^/]+)$/);
    if (indexerEventsMatch && request.method === "GET") {
      return json(await listIndexedEvents(env, indexerEventsMatch[1]), 200, cors);
    }

    if (url.pathname === "/indexer/cursor") {
      if (request.method === "GET") {
        return json(await getDurableCursor(env), 200, cors);
      }
      if (request.method === "POST") {
        const body = (await request.json().catch(() => ({}))) as { cursor?: string };
        if (!body.cursor) return json({ error: "cursor required" }, 400, cors);
        return json(await setDurableCursor(env, body.cursor), 200, cors);
      }
    }

    if (url.pathname === "/indexer/poll" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as { contractId?: string };
      return json(await pollSorobanContractEvents(env, body.contractId), 200, cors);
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

    if (url.pathname === "/transak-url" && request.method === "POST") {
      const { TRANSAK_API_KEY, TRANSAK_API_SECRET } = env;
      if (!TRANSAK_API_KEY || !TRANSAK_API_SECRET) {
        return json({ error: "Transak credentials not configured on the backend" }, 500, cors);
      }

      const body = (await request.json().catch(() => ({}))) as {
        mode?: "hosted" | "locked";
        walletAddress?: string;
        walletMemo?: string;
        fiatAmount?: string | number;
      };
      // Shunt never exposes Transak's hosted/manual wallet form. Older clients may
      // still send mode="hosted"; treat those requests as locked as well.
      const mode = "locked";
      const configuredRecipient = env.TRANSAK_STELLAR_RECIPIENT_ADDRESS?.trim();
      const configuredMemo = env.TRANSAK_STELLAR_RECIPIENT_MEMO?.trim();
      const recipientAddress = mode === "locked"
        ? configuredRecipient || body.walletAddress
        : undefined;
      const recipientMemo = mode === "locked"
        ? configuredMemo || body.walletMemo
        : undefined;

      if (mode === "locked" && !recipientAddress) {
        return json({
          error: "Transak auto-fill needs a funded Stellar mainnet recipient configured in Shunt.",
        }, 400, cors);
      }
      if (mode === "locked" && !isValidStellarAccount(recipientAddress)) {
        return json({ error: "valid Stellar walletAddress required" }, 400, cors);
      }

      try {
        // Get caller IP to forward as x-user-ip (required by Transak)
        const userIp = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "127.0.0.1";
        const fiatAmount = Number(body.fiatAmount ?? "100");
        const normalizedFiatAmount = Number.isFinite(fiatAmount) && fiatAmount > 0 ? String(fiatAmount) : "100";
        const fiatCurrency = "USD";
        // Transak staging currently accepts Stellar recipient addresses for XLM
        // but rejects the same addresses for Stellar USDC in its own verifier.
        // Keep this sandbox route honest and internally consistent by using XLM.
        const cryptoCurrencyCode = "XLM";
        // Transak identifies native Stellar XLM as network="mainnet"; its
        // network="stellar" identifier is reserved for Stellar-issued assets.
        const network = "mainnet";
        const paymentMethod = "credit_debit_card";
        const quoteCountryCode = "ID";

        const quoteUrl = new URL("https://api-stg.transak.com/api/v1/pricing/public/quotes");
        quoteUrl.searchParams.set("partnerApiKey", TRANSAK_API_KEY);
        quoteUrl.searchParams.set("fiatCurrency", fiatCurrency);
        quoteUrl.searchParams.set("cryptoCurrency", cryptoCurrencyCode);
        quoteUrl.searchParams.set("network", network);
        quoteUrl.searchParams.set("isBuyOrSell", "BUY");
        quoteUrl.searchParams.set("fiatAmount", normalizedFiatAmount);
        quoteUrl.searchParams.set("paymentMethod", paymentMethod);
        quoteUrl.searchParams.set("quoteCountryCode", quoteCountryCode);
        const quoteRes = await fetch(quoteUrl.toString(), {
          method: "GET",
          headers: {
            "x-api-key": TRANSAK_API_KEY,
          },
        });
        const quoteText = await quoteRes.text();
        let quoteData: any = {};
        try { quoteData = JSON.parse(quoteText); } catch (_) { /* non-JSON */ }

        if (!quoteRes.ok || !quoteData?.response) {
          return json({
            error: "Transak route unavailable for USD to Stellar XLM in the current staging environment.",
            providerStatus: quoteRes.status,
            providerMessage: quoteData?.error?.message ?? quoteData?.message ?? "Unknown provider response",
          }, 400, cors);
        }

        if (mode === "locked") {
          const isAcceptedWallet = await verifyTransakWalletAddress(
            TRANSAK_API_KEY,
            cryptoCurrencyCode,
            network,
            recipientAddress!,
          );

          if (!isAcceptedWallet) {
            return json({
              error: "Transak staging does not accept this wallet for USD to Stellar XLM.",
            }, 400, cors);
          }
        }

        // 1. Refresh Access Token
        // Note: correct staging base is api-stg.transak.com (not api-gateway-stg)
        const tokenRes = await fetch("https://api-stg.transak.com/partners/api/v2/refresh-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "accept": "application/json",
            "api-secret": TRANSAK_API_SECRET,
          },
          body: JSON.stringify({ apiKey: TRANSAK_API_KEY }),
        });
        const tokenText = await tokenRes.text();
        let tokenData: any = {};
        try { tokenData = JSON.parse(tokenText); } catch (_) { /* non-JSON */ }

        const accessToken = tokenData?.data?.accessToken || tokenData?.accessToken;

        if (!accessToken) {
          return json({ error: "Transak token exchange failed" }, 502, cors);
        }

        // 2. Create Secure Widget Session
        const widgetParams: Record<string, unknown> = {
          apiKey: TRANSAK_API_KEY,
          referrerDomain: "shuntapp.xyz",
          productsAvailed: "BUY",
          fiatCurrency,
          fiatAmount: normalizedFiatAmount,
          cryptoCurrencyCode,
          network,
          isBuyOrSell: "BUY",
          paymentMethod,
          quoteCountryCode,
          hideExchangeScreen: true,
        };
        if (mode === "locked") {
          widgetParams.walletAddress = recipientAddress;
          widgetParams.disableWalletAddressForm = true;
        }
        const sessionRes = await fetch("https://api-gateway-stg.transak.com/api/v2/auth/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "access-token": accessToken,
            "x-api-key": TRANSAK_API_KEY,
            "x-user-ip": userIp,
          },
          body: JSON.stringify({
            widgetParams,
          }),
        });
        const sessionText = await sessionRes.text();
        let sessionData: any = {};
        try { sessionData = JSON.parse(sessionText); } catch (_) { /* non-JSON */ }

        const widgetUrl = sessionData?.data?.widgetUrl || sessionData?.widgetUrl;

        if (!widgetUrl) {
          return json({ error: "Transak session creation failed" }, 502, cors);
        }

        return json({ ok: true, widgetUrl }, 200, cors);
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : String(error) }, 500, cors);
      }
    }

    if (url.pathname === "/moonpay-url" && request.method === "POST") {
      const { MOONPAY_API_KEY, MOONPAY_SECRET_KEY } = env;
      if (!MOONPAY_API_KEY || !MOONPAY_SECRET_KEY || MOONPAY_SECRET_KEY.includes("PASTE_YOUR")) {
        return json({ error: "MoonPay credentials not configured" }, 500, cors);
      }

      const body = (await request.json().catch(() => ({}))) as { walletAddress?: string };
      if (!isValidStellarAccount(body.walletAddress)) {
        return json({ error: "valid Stellar walletAddress required" }, 400, cors);
      }

      try {
        // Build query string — order matters for signature validity
        const params = new URLSearchParams();
        params.set("apiKey", MOONPAY_API_KEY);
        params.set("currencyCode", "usdc_xlm");
        params.set("walletAddress", body.walletAddress!);
        params.set("colorCode", "#cdf14a");
        const queryString = `?${params.toString()}`;

        // Sign with HMAC-SHA256 — MoonPay expects base64 output
        const encoder = new TextEncoder();
        const keyData = encoder.encode(MOONPAY_SECRET_KEY);
        const msgData = encoder.encode(queryString);
        const cryptoKey = await crypto.subtle.importKey(
          "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
        );
        const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
        // Convert to base64
        const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

        const widgetUrl = `https://buy-sandbox.moonpay.com${queryString}&signature=${encodeURIComponent(signatureBase64)}`;
        return json({ ok: true, widgetUrl }, 200, cors);
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : String(error) }, 500, cors);
      }
    }

    return json({ error: "not found" }, 404, cors);
  },
};
