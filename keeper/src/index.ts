import Fastify from "fastify";
import { Horizon } from "@stellar/stellar-sdk";
import { loadConfig } from "./config.js";
import { KeeperState } from "./state.js";
import { buildDistributeTx, amountToStroops } from "./distribute.js";

const cfg = loadConfig();
const state = new KeeperState(cfg.stateFile);
const horizon = new Horizon.Server(cfg.horizonUrl);

interface PendingSplit {
  account: string;
  amount: string; // display amount, e.g. "500.0000000"
  txHash: string; // inflow tx hash (idempotency key)
  xdr: string | null; // prepared distribute tx, ready for Freighter
  detectedAt: string;
  error?: string;
}

/** Splits detected but not yet approved by the user, keyed by inflow hash. */
const pending = new Map<string, PendingSplit>();

async function handleInflow(account: string, amount: string, txHash: string) {
  if (state.isProcessed(txHash) || pending.has(txHash)) {
    console.log(`[keeper] skip ${txHash} (already handled)`);
    return;
  }
  const entry: PendingSplit = {
    account,
    amount,
    txHash,
    xdr: null,
    detectedAt: new Date().toISOString(),
  };
  pending.set(txHash, entry);
  console.log(`[keeper] inflow ${amount} USDC -> ${account} (tx ${txHash})`);
  try {
    entry.xdr = await buildDistributeTx(cfg, account, amountToStroops(amount), txHash);
    console.log(`[keeper] distribute prepared for ${txHash}`);
  } catch (e) {
    entry.error = String(e);
    console.error(`[keeper] prepare failed for ${txHash}:`, e);
  }
}

/** Stream Horizon payments per watched account, with reconnect + resume. */
function watch(account: string) {
  let backoff = 1_000;
  const connect = () => {
    console.log(`[keeper] streaming payments for ${account} (cursor ${state.getCursor()})`);
    const close = horizon
      .payments()
      .forAccount(account)
      .cursor(state.getCursor())
      .stream({
        onmessage: (payment: any) => {
          backoff = 1_000;
          state.setCursor(payment.paging_token);
          const isUsdcIn =
            payment.type === "payment" &&
            payment.to === account &&
            payment.asset_code === cfg.usdcCode &&
            payment.asset_issuer === cfg.usdcIssuer;
          if (isUsdcIn) {
            void handleInflow(account, payment.amount, payment.transaction_hash);
          }
        },
        onerror: () => {
          close();
          console.warn(`[keeper] stream error for ${account}; reconnecting in ${backoff}ms`);
          setTimeout(connect, backoff);
          backoff = Math.min(backoff * 2, 60_000);
        },
      });
  };
  connect();
}

// ---- HTTP API (frontend + demo fallback) ----

const app = Fastify({ logger: false });

app.get("/health", async () => ({
  ok: true,
  network: cfg.networkPassphrase.includes("Test") ? "testnet" : "mainnet",
  watching: cfg.watchAccounts,
  pending: pending.size,
}));

/** Pending splits awaiting the user's one-tap approval. */
app.get<{ Params: { account: string } }>("/pending/:account", async (req) => {
  return [...pending.values()].filter((p) => p.account === req.params.account);
});

/** Manual trigger (F4 demo fallback): force-detect an inflow. */
app.post<{ Body: { account: string; amount: string; txHash: string } }>(
  "/trigger",
  async (req, reply) => {
    const { account, amount, txHash } = req.body ?? ({} as any);
    if (!account || !amount || !txHash) {
      return reply.code(400).send({ error: "account, amount, txHash required" });
    }
    await handleInflow(account, amount, txHash);
    return pending.get(txHash) ?? { error: "already processed" };
  },
);

/** Frontend reports a signed+submitted split so it is never re-offered. */
app.post<{ Body: { txHash: string } }>("/complete", async (req, reply) => {
  const { txHash } = req.body ?? ({} as any);
  if (!txHash) return reply.code(400).send({ error: "txHash required" });
  pending.delete(txHash);
  state.markProcessed(txHash);
  return { ok: true };
});

async function main() {
  if (!cfg.vaultContractId) {
    console.warn("[keeper] VAULT_CONTRACT_ID not set — prepare will fail until configured");
  }
  for (const account of cfg.watchAccounts) watch(account);
  await app.listen({ port: cfg.port, host: "0.0.0.0" });
  console.log(`[keeper] API on :${cfg.port}, watching ${cfg.watchAccounts.length} account(s)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
