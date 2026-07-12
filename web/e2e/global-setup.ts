/**
 * Global setup — provisions a throwaway *testnet* identity so the suite can
 * exercise the real money loop without a wallet extension:
 *
 *   1. generate a fresh keypair (plus a funded destination for the send test)
 *   2. fund both via Friendbot (10,000 XLM each)
 *   3. add the USDC trustline
 *   4. buy real USDC on the testnet DEX (path payment, XLM → USDC) — the
 *      same way the README's on-chain lifecycle proof acquired its USDC
 *
 * Everything is written to e2e/.state/account.json; the fixtures inject the
 * secret into the app via window.__SHUNT_E2E_SECRET__ (see src/lib/signer.ts).
 * A fresh account per run keeps the vault state deterministic (no rules, no
 * savings) so the specs can assert the full lifecycle from zero.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Asset,
  Horizon,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const USDC = new Asset(
  "USDC",
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
);
/** How much real USDC the split/off-ramp specs get to play with. */
const USDC_TO_ACQUIRE = "8";
const SEND_MAX_XLM = "200"; // ~5.4 XLM/USDC on the testnet book; generous cap

export interface E2EState {
  publicKey: string;
  secret: string;
  /** Funded second account — destination for the XLM transfer spec. */
  destPublicKey: string;
  /** true when the DEX purchase landed and the wallet holds real USDC. */
  usdcAcquired: boolean;
  usdcAmount: string;
  keeperUp: boolean;
}

// package.json is "type": "module" — no __dirname in ESM.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const STATE_DIR = path.join(HERE, ".state");
const STATE_FILE = path.join(STATE_DIR, "account.json");

async function friendbot(addr: string): Promise<void> {
  const res = await fetch(
    `https://friendbot.stellar.org?addr=${encodeURIComponent(addr)}`,
  );
  if (!res.ok) throw new Error(`Friendbot failed for ${addr}: ${res.status}`);
}

export default async function globalSetup(): Promise<void> {
  const horizon = new Horizon.Server(HORIZON_URL);
  const kp = Keypair.random();
  const dest = Keypair.random();
  console.log(`[e2e setup] test account ${kp.publicKey()}`);

  await Promise.all([friendbot(kp.publicKey()), friendbot(dest.publicKey())]);
  console.log("[e2e setup] both accounts funded (10,000 XLM each)");

  // Trustline + DEX purchase in one transaction — one less ledger round-trip.
  let usdcAcquired = false;
  try {
    const account = await horizon.loadAccount(kp.publicKey());
    const tx = new TransactionBuilder(account, {
      fee: "1000",
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(Operation.changeTrust({ asset: USDC }))
      .addOperation(
        Operation.pathPaymentStrictReceive({
          sendAsset: Asset.native(),
          sendMax: SEND_MAX_XLM,
          destination: kp.publicKey(),
          destAsset: USDC,
          destAmount: USDC_TO_ACQUIRE,
        }),
      )
      .setTimeout(60)
      .build();
    tx.sign(kp);
    await horizon.submitTransaction(tx);
    usdcAcquired = true;
    console.log(`[e2e setup] bought ${USDC_TO_ACQUIRE} USDC on the testnet DEX`);
  } catch (e: any) {
    // No liquidity today — specs that need real USDC will skip with a note.
    const codes = e?.response?.data?.extras?.result_codes;
    console.warn(
      `[e2e setup] DEX purchase failed (${codes ? JSON.stringify(codes) : e}); USDC-dependent specs will be skipped`,
    );
  }

  let keeperUp = false;
  try {
    const res = await fetch("https://shunt-keeper.irhamtria.workers.dev/health");
    keeperUp = res.ok;
  } catch {
    /* keeper offline — split spec asserts the manual-fallback path instead */
  }

  const state: E2EState = {
    publicKey: kp.publicKey(),
    secret: kp.secret(),
    destPublicKey: dest.publicKey(),
    usdcAcquired,
    usdcAmount: USDC_TO_ACQUIRE,
    keeperUp,
  };
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  console.log(`[e2e setup] state written (keeper ${keeperUp ? "up" : "DOWN"})`);
}

export function readE2EState(): E2EState {
  return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
}
