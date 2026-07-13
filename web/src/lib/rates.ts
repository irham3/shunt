/**
 * Display-only IDR rate (PRD §11: oracle is display-only, funds stay in
 * the native asset). Primary: free forex API; fallback: static estimate.
 * DESIGN.md §5.4 decision: MVP shows USD/IDR only; the "Gold" toggle is
 * visible but disabled until an allocated-gold feed is chosen (P2).
 */
const FALLBACK_IDR_PER_USD = 18_000;

let cached: { rate: number; at: number } | null = null;

export async function getIdrRate(): Promise<{ rate: number; stale: boolean }> {
  if (cached && Date.now() - cached.at < 10 * 60 * 1000) {
    return { rate: cached.rate, stale: false };
  }
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    const data = await res.json();
    const rate = data?.rates?.IDR;
    if (typeof rate === "number" && rate > 0) {
      cached = { rate, at: Date.now() };
      return { rate, stale: false };
    }
  } catch {
    // fall through to fallback
  }
  return { rate: cached?.rate ?? FALLBACK_IDR_PER_USD, stale: true };
}

/**
 * Display/estimate-only XLM/USD rate for the Invest lane (F12). The real
 * conversion price is whatever the path payment executes at on-chain; this
 * rate only sizes the slippage floor and the demo-mode simulation.
 */
const FALLBACK_XLM_USD = 0.4;

let cachedXlm: { rate: number; at: number } | null = null;

export async function getXlmUsdRate(): Promise<{ rate: number; stale: boolean }> {
  if (cachedXlm && Date.now() - cachedXlm.at < 10 * 60 * 1000) {
    return { rate: cachedXlm.rate, stale: false };
  }
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd",
    );
    const data = await res.json();
    const rate = data?.stellar?.usd;
    if (typeof rate === "number" && rate > 0) {
      cachedXlm = { rate, at: Date.now() };
      return { rate, stale: false };
    }
  } catch {
    // fall through to fallback
  }
  return { rate: cachedXlm?.rate ?? FALLBACK_XLM_USD, stale: true };
}

/**
 * USD price of one XAUm (Matrixdock) — 1 token = 1 gram of LBMA-accredited
 * gold. Reference/estimate only: testnet has no XAUm DEX liquidity, so the
 * Invest→Gold lane records the slice at this labeled rate (same honesty
 * pattern as the IDR/XLM fallbacks). ~gold spot / 31.1035 g per troy oz.
 */
const FALLBACK_XAUM_USD = 85;

let cachedGold: { rate: number; at: number } | null = null;

export async function getGoldUsdRate(): Promise<{ rate: number; stale: boolean }> {
  if (cachedGold && Date.now() - cachedGold.at < 10 * 60 * 1000) {
    return { rate: cachedGold.rate, stale: false };
  }
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=pax-gold&vs_currencies=usd",
    );
    const data = await res.json();
    // PAXG = 1 troy oz; XAUm = 1 gram → divide by grams per troy oz.
    const paxg = data?.["pax-gold"]?.usd;
    if (typeof paxg === "number" && paxg > 0) {
      const rate = paxg / 31.1035;
      cachedGold = { rate, at: Date.now() };
      return { rate, stale: false };
    }
  } catch {
    // fall through to fallback
  }
  return { rate: cachedGold?.rate ?? FALLBACK_XAUM_USD, stale: true };
}
