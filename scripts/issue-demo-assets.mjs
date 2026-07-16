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
 * Run once: `node scripts/issue-demo-assets.mjs`. Prints the asset configs
 * to paste into web/.env.
 */
import {
  Asset, Horizon, Keypair, Networks, Operation, TransactionBuilder,
} from "@stellar/stellar-sdk";

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

async function submit(source, ops, signers) {
  const account = await horizon.loadAccount(source);
  let tx = new TransactionBuilder(account, { fee: "1000", networkPassphrase: Networks.TESTNET });
  for (const op of ops) tx = tx.addOperation(op);
  const built = tx.setTimeout(120).build();
  for (const kp of signers) built.sign(kp);
  const res = await horizon.submitTransaction(built);
  return res.hash;
}

console.log("issuer:", issuer.publicKey());
console.log("liquidity:", liquidity.publicKey());

// 1. Liquidity account trusts USDC + all three demo assets.
const h1 = await submit(liquidity.publicKey(), [
  Operation.changeTrust({ asset: USDC }),
  Operation.changeTrust({ asset: TXAUM }),
  Operation.changeTrust({ asset: TIDR }),
  Operation.changeTrust({ asset: TPHP }),
], [liquidity]);
console.log("trustlines:", h1);

// 2. Liquidity buys real USDC on the DEX (needed so it can also make USDC-
//    denominated offers / hold working capital, mirrors e2e global-setup).
try {
  const h2 = await submit(liquidity.publicKey(), [
    Operation.pathPaymentStrictReceive({
      sendAsset: Asset.native(), sendMax: "500", destination: liquidity.publicKey(),
      destAsset: USDC, destAmount: "20",
    }),
  ], [liquidity]);
  console.log("bought USDC:", h2);
} catch (e) {
  console.warn("USDC purchase skipped (no DEX liquidity today):", e?.response?.data?.extras?.result_codes ?? String(e));
}

// 3. Issuer sends each demo asset's seed supply to the liquidity account.
const h3 = await submit(issuer.publicKey(), [
  Operation.payment({ destination: liquidity.publicKey(), asset: TXAUM, amount: "600" }),
  Operation.payment({ destination: liquidity.publicKey(), asset: TIDR, amount: "6000000" }),
  Operation.payment({ destination: liquidity.publicKey(), asset: TPHP, amount: "30000" }),
], [issuer]);
console.log("issued supply:", h3);

// 4. Liquidity posts sell offers (demo asset -> USDC) so a payer's
//    USDC -> demo-asset path payment has real orderbook depth to route
//    through. Rates are clean demo values, not live fx.
const h4 = await submit(liquidity.publicKey(), [
  Operation.manageSellOffer({ selling: TXAUM, buying: USDC, amount: "500", price: "85" }),        // 1 TXAUM = 85 USDC
  Operation.manageSellOffer({ selling: TIDR, buying: USDC, amount: "5000000", price: "0.0001" }),  // 1 USDC = 10,000 TIDR
  Operation.manageSellOffer({ selling: TPHP, buying: USDC, amount: "25000", price: "0.02" }),      // 1 USDC = 50 TPHP
], [liquidity]);
console.log("offers placed:", h4);

console.log("\n--- paste into web/.env ---");
console.log(`VITE_TXAUM_ISSUER=${issuer.publicKey()}`);
console.log(`VITE_TIDR_ISSUER=${issuer.publicKey()}`);
console.log(`VITE_TPHP_ISSUER=${issuer.publicKey()}`);
