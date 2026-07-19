/**
 * One-time testnet setup: issues Shunt's own clearly-labeled DEMO assets and
 * seeds real orderbook liquidity for them, so path payments genuinely
 * execute on testnet instead of falling back to a labeled simulation.
 *
 * These are NOT the real branded assets they're inspired by (Settle
 * Network's ARST/BRLT, Matrixdock's XAUm) — those are mainnet-only, like
 * MoneyGram's PHP corridor documented elsewhere in this repo. Same honesty
 * pattern: name the real target, but testnet gets our own issuance, labeled
 * as such everywhere it appears in the UI.
 *
 * TXAUM/USDC is seeded TWO-SIDED (an ask AND a bid): the ask lets a user BUY
 * gold (USDC→TXAUM), and the bid lets the Grow portfolio value a holding and a
 * user sell back (TXAUM→USDC). Without the bid, valuation quotes return no path.
 * The bid is limited by how much testnet USDC the liquidity account can
 * acquire on the DEX — the verify step at the end prints the real depth so you
 * know whether the round trip routes.
 *
 * Run once: `node scripts/issue-demo-assets.mjs`. Prints the asset config to
 * paste into web/.env.
 */
// The SDK is a dependency of the web app (web/node_modules), and this script
// lives in scripts/ — where ESM bare-specifier resolution can't reach it. Load
// it from the web workspace explicitly so `node scripts/…` works from the repo
// root with no extra install or symlink.
import { createRequire } from "node:module";
const require = createRequire(new URL("../web/node_modules/", import.meta.url));
const {
  Asset, Horizon, Keypair, Networks, Operation, TransactionBuilder,
} = require("@stellar/stellar-sdk");

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const horizon = new Horizon.Server(HORIZON_URL);

const ISSUER_SECRET = process.env.SHUNT_ISSUER_SECRET;
const LIQUIDITY_SECRET = process.env.SHUNT_LIQUIDITY_SECRET;
if (!ISSUER_SECRET || !LIQUIDITY_SECRET) {
  console.error("Set SHUNT_ISSUER_SECRET and SHUNT_LIQUIDITY_SECRET env vars first.");
  process.exit(1);
}
const issuer = Keypair.fromSecret(ISSUER_SECRET);
const liquidity = Keypair.fromSecret(LIQUIDITY_SECRET);

const USDC = new Asset("USDC", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");
const TXAUM = new Asset("TXAUM", issuer.publicKey());
const TIDR = new Asset("TIDR", issuer.publicKey());
const TPHP = new Asset("TPHP", issuer.publicKey());

// --- Tunables --------------------------------------------------------------
// Clean demo mid price for gold, in USDC per TXAUM. Ask sits at MID, bid one
// tick below so the two offers never cross and self-trade.
const GOLD_MID = 85;
const GOLD_BID = 84;
// How much XLM the liquidity account spends trying to acquire USDC working
// capital for the bid side. Strict-send (not strict-receive) so a thin DEX
// yields *some* USDC instead of failing all-or-nothing.
const XLM_FOR_USDC = "4000";
const EXPLORER = (addr) => `https://stellar.expert/explorer/testnet/account/${addr}`;

async function submit(source, ops, signers) {
  const account = await horizon.loadAccount(source);
  let tx = new TransactionBuilder(account, { fee: "1000", networkPassphrase: Networks.TESTNET });
  for (const op of ops) tx = tx.addOperation(op);
  const built = tx.setTimeout(120).build();
  for (const kp of signers) built.sign(kp);
  const res = await horizon.submitTransaction(built);
  return res.hash;
}

/** Live strict-send quote via Horizon pathfinding — mirrors what the app does. */
async function quoteStrictSend(sourceAsset, sourceAmount, destAsset) {
  const srcParam = sourceAsset.isNative()
    ? "source_asset_type=native"
    : `source_asset_type=credit_alphanum4&source_asset_code=${sourceAsset.getCode()}&source_asset_issuer=${sourceAsset.getIssuer()}`;
  const destParam = destAsset.isNative()
    ? "destination_assets=native"
    : `destination_assets=${destAsset.getCode()}%3A${destAsset.getIssuer()}`;
  const url = `${HORIZON_URL}/paths/strict-send?${srcParam}&source_amount=${sourceAmount}&${destParam}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const records = data?._embedded?.records ?? [];
  if (records.length === 0) return null;
  const best = records.reduce((a, b) =>
    Number(b.destination_amount) > Number(a.destination_amount) ? b : a);
  return Number(best.destination_amount);
}

async function usdcBalance(addr) {
  const acct = await horizon.loadAccount(addr);
  const b = acct.balances.find(
    (x) => x.asset_code === "USDC" && x.asset_issuer === USDC.getIssuer());
  return b ? Number(b.balance) : 0;
}

console.log("issuer:   ", issuer.publicKey());
console.log("liquidity:", liquidity.publicKey());

// 1. Liquidity account trusts USDC + all three demo assets.
const h1 = await submit(liquidity.publicKey(), [
  Operation.changeTrust({ asset: USDC }),
  Operation.changeTrust({ asset: TXAUM }),
  Operation.changeTrust({ asset: TIDR }),
  Operation.changeTrust({ asset: TPHP }),
], [liquidity]);
console.log("trustlines:", h1);

// 2. Liquidity acquires USDC working capital on the DEX. Strict-SEND so a thin
//    orderbook still yields whatever USDC is available (destMin 1) instead of
//    failing all-or-nothing — this USDC funds the TXAUM bid in step 4b.
try {
  const h2 = await submit(liquidity.publicKey(), [
    Operation.pathPaymentStrictSend({
      sendAsset: Asset.native(), sendAmount: XLM_FOR_USDC, destination: liquidity.publicKey(),
      destAsset: USDC, destMin: "1",
    }),
  ], [liquidity]);
  console.log("bought USDC:", h2);
} catch (e) {
  console.warn("USDC purchase skipped (no DEX liquidity today):", e?.response?.data?.extras?.result_codes ?? String(e));
}
const usdcHeld = await usdcBalance(liquidity.publicKey());
console.log(`USDC working capital: ${usdcHeld.toFixed(4)}`);

// 3. Issuer sends each demo asset's seed supply to the liquidity account.
const h3 = await submit(issuer.publicKey(), [
  Operation.payment({ destination: liquidity.publicKey(), asset: TXAUM, amount: "600" }),
  Operation.payment({ destination: liquidity.publicKey(), asset: TIDR, amount: "6000000" }),
  Operation.payment({ destination: liquidity.publicKey(), asset: TPHP, amount: "30000" }),
], [issuer]);
console.log("issued supply:", h3);

// 4a. ASK side — sell demo assets for USDC. A payer's USDC→demo-asset path
//     payment routes through these (buying gold, paying a local-currency
//     request). Rates are clean demo values, not live fx.
const h4a = await submit(liquidity.publicKey(), [
  Operation.manageSellOffer({ selling: TXAUM, buying: USDC, amount: "500", price: String(GOLD_MID) }), // 1 TXAUM = 85 USDC
  Operation.manageSellOffer({ selling: TIDR, buying: USDC, amount: "5000000", price: "0.0001" }),        // 1 USDC = 10,000 TIDR
  Operation.manageSellOffer({ selling: TPHP, buying: USDC, amount: "25000", price: "0.02" }),            // 1 USDC = 50 TPHP
], [liquidity]);
console.log("ask offers placed:", h4a);

// 4b. BID side for TXAUM — sell USDC to buy TXAUM, one tick below the ask so
//     the offers don't cross. This is what makes TXAUM→USDC valuation quotes
//     (and sell-backs) route. Depth is capped by the USDC acquired in step 2;
//     `amount` is the USDC offered (price = TXAUM per USDC = 1/84).
if (usdcHeld > 1) {
  const bidUsdc = Math.floor(usdcHeld - 1); // keep a little for reserves/fees
  const h4b = await submit(liquidity.publicKey(), [
    Operation.manageSellOffer({
      selling: USDC, buying: TXAUM, amount: String(bidUsdc), price: String(1 / GOLD_BID),
    }),
  ], [liquidity]);
  console.log(`bid offer placed (${bidUsdc} USDC @ ${GOLD_BID}/TXAUM):`, h4b);
} else {
  console.warn(
    "bid offer SKIPPED — the liquidity account holds no USDC. TXAUM→USDC " +
    "valuation quotes will not route until it has USDC working capital. " +
    "Fund it with testnet USDC (SDF test anchor / a USDC faucet) and re-run.");
}

// 5. Verify — quote BOTH directions with live pathfinding and print depth so
//    "seeded and routable" is provable, not assumed.
console.log("\n--- verify: live round-trip quotes (Horizon pathfinding) ---");
const buyOut = await quoteStrictSend(USDC, String(GOLD_MID), TXAUM); // 85 USDC -> ? TXAUM
const sellOut = await quoteStrictSend(TXAUM, "1", USDC);            // 1 TXAUM -> ? USDC
console.log(`BUY  ${GOLD_MID} USDC -> ${buyOut ?? "NO PATH"} TXAUM`);
console.log(`SELL 1 TXAUM      -> ${sellOut ?? "NO PATH"} USDC`);
if (buyOut && sellOut) {
  console.log("round trip ROUTES ✓ — both directions have real depth");
} else {
  console.warn("round trip INCOMPLETE — see the skipped-bid note above");
}
console.log("liquidity book:", EXPLORER(liquidity.publicKey()));

console.log("\n--- paste into web/.env ---");
// NOTE: the app reads ONE issuer var (VITE_DEMO_ASSET_ISSUER) for all three
// demo assets — they share an issuer. (Older output printed per-asset var
// names the app never reads, which silently disabled the gold lane.)
console.log(`VITE_DEMO_ASSET_ISSUER=${issuer.publicKey()}`);
