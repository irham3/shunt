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
