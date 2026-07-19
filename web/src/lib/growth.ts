/**
 * Grow portfolio — derived from REAL on-chain data, never local state.
 *
 *  - Units held come from the Horizon account balances endpoint.
 *  - Cost basis comes from the account's actual self path-payment history
 *    (the exact operations Shunt's DCA / manual buys submit) — USDC spent vs
 *    asset received, weighted.
 *  - Valuation comes from LIVE Horizon DEX pathfinding. For an asset with real
 *    bid depth (XLM, and TXAUM once the bid side is seeded) we mark it at what
 *    it would SELL for; if the sell side has no path (thin testnet USDC) we
 *    fall back to the ASK — the cost to re-buy the holding — which always
 *    routes off the seeded sell offers. Either way the number is DEX-derived
 *    and the source is labelled, never a hardcoded price.
 *
 * The pure aggregation (`aggregateGrowthBuys`) is unit-tested against fixture
 * Horizon records; the network wrapper composes it with live fetches.
 */
import { Asset } from "@stellar/stellar-sdk";
import {
  DEMO_ASSET_ISSUER,
  HORIZON_URL,
  USDC_CODE,
  USDC_ISSUER,
} from "./stellar";

/** Registry asset id → the classic Stellar asset it trades as. */
export function growthMarketAsset(assetId: string): Asset | null {
  switch (assetId) {
    case "xlm":
      return Asset.native();
    case "xaum-demo":
      return DEMO_ASSET_ISSUER ? new Asset("TXAUM", DEMO_ASSET_ISSUER) : null;
    default:
      return null;
  }
}

const isUsdc = (code?: string, issuer?: string) =>
  code === USDC_CODE && issuer === USDC_ISSUER;

/** Minimal shape of a Horizon `/payments` record we care about. */
export interface HorizonPaymentRecord {
  type: string;
  from?: string;
  to?: string;
  /** destination asset */
  asset_type?: string;
  asset_code?: string;
  asset_issuer?: string;
  /** destination amount received */
  amount?: string;
  /** source (spent) asset + amount, present on path_payment records */
  source_asset_type?: string;
  source_asset_code?: string;
  source_asset_issuer?: string;
  source_amount?: string;
}

export interface GrowthBuyAggregate {
  /** Units of the growth asset acquired via USDC-funded self conversions. */
  unitsBought: number;
  /** USDC spent acquiring them. */
  usdcSpent: number;
}

/**
 * Pure: sum the USDC-funded self-conversions into `market` from a list of
 * Horizon payment records. Only counts path payments to self whose SOURCE
 * asset is USDC and whose DESTINATION asset is the growth asset — exactly the
 * DCA / manual-buy shape. (Trustline changes, incoming transfers, and non-USDC
 * funded buys are ignored, so cost basis can't be polluted.)
 */
export function aggregateGrowthBuys(
  records: HorizonPaymentRecord[],
  market: Asset,
  address: string,
): GrowthBuyAggregate {
  let unitsBought = 0;
  let usdcSpent = 0;
  const wantCode = market.isNative() ? undefined : market.getCode();
  const wantIssuer = market.isNative() ? undefined : market.getIssuer();

  for (const r of records) {
    if (r.type !== "path_payment_strict_send" && r.type !== "path_payment_strict_receive") continue;
    // Self conversion only.
    if (r.from !== address || r.to !== address) continue;
    // Funded by USDC.
    if (!isUsdc(r.source_asset_code, r.source_asset_issuer)) continue;
    // Delivered the growth asset.
    const destIsMarket = market.isNative()
      ? r.asset_type === "native"
      : r.asset_code === wantCode && r.asset_issuer === wantIssuer;
    if (!destIsMarket) continue;

    unitsBought += Number(r.amount ?? 0);
    usdcSpent += Number(r.source_amount ?? 0);
  }
  return { unitsBought, usdcSpent };
}

export type ValuationSource = "bid" | "ask" | "unavailable";

export interface GrowthPosition {
  assetId: string;
  /** On-chain units currently held. */
  balance: number;
  /** USDC put in, from real conversion history. */
  costBasisUsdc: number;
  /** Live USDC valuation of the held balance, or null when no path exists. */
  valueUsdc: number | null;
  /** How the valuation was marked, for honest UI labelling. */
  valuationSource: ValuationSource;
  /** (value − cost) / cost, or null when either side is unknown. */
  growthPct: number | null;
}

async function horizonJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** On-chain balance of a classic/native asset for an account. */
async function fetchBalance(address: string, asset: Asset): Promise<number> {
  const data = await horizonJson(`${HORIZON_URL}/accounts/${address}`);
  const balances: any[] = data?.balances ?? [];
  const match = asset.isNative()
    ? balances.find((b) => b.asset_type === "native")
    : balances.find((b) => b.asset_code === asset.getCode() && b.asset_issuer === asset.getIssuer());
  return match ? Number(match.balance) : 0;
}

/** Best strict-send destination amount, or null. Same engine the DEX executes. */
async function quoteStrictSend(source: Asset, amount: string, dest: Asset): Promise<number | null> {
  const srcParam = source.isNative()
    ? "source_asset_type=native"
    : `source_asset_type=credit_alphanum4&source_asset_code=${source.getCode()}&source_asset_issuer=${source.getIssuer()}`;
  const destParam = dest.isNative()
    ? "destination_assets=native"
    : `destination_assets=${dest.getCode()}%3A${dest.getIssuer()}`;
  const data = await horizonJson(
    `${HORIZON_URL}/paths/strict-send?${srcParam}&source_amount=${amount}&${destParam}`,
  );
  const records: any[] = data?._embedded?.records ?? [];
  if (records.length === 0) return null;
  const best = records.reduce((a, b) =>
    Number(b.destination_amount) > Number(a.destination_amount) ? b : a);
  return Number(best.destination_amount);
}

/**
 * Value `balance` units of `market` in USDC via live pathfinding.
 *  - bid: what the balance would SELL for (market → USDC).
 *  - ask fallback: implied price from a nominal USDC → market quote, used when
 *    the sell side has no path (thin testnet bid).
 */
async function valuate(
  market: Asset,
  balance: number,
): Promise<{ valueUsdc: number | null; source: ValuationSource }> {
  if (balance <= 0) return { valueUsdc: 0, source: "bid" };

  // Bid: sell the holding.
  const sell = await quoteStrictSend(market, balance.toFixed(7), new Asset(USDC_CODE, USDC_ISSUER));
  if (sell && sell > 0) return { valueUsdc: sell, source: "bid" };

  // Ask fallback: how much of `market` does 100 USDC buy → implied unit price.
  const probe = 100;
  const bought = await quoteStrictSend(new Asset(USDC_CODE, USDC_ISSUER), probe.toFixed(7), market);
  if (bought && bought > 0) {
    const usdcPerUnit = probe / bought;
    return { valueUsdc: balance * usdcPerUnit, source: "ask" };
  }
  return { valueUsdc: null, source: "unavailable" };
}

/** Build one growth position for `assetId` from real chain data. */
export async function fetchGrowthPosition(
  address: string,
  assetId: string,
): Promise<GrowthPosition | null> {
  const market = growthMarketAsset(assetId);
  if (!market) return null;

  const [balance, paymentsData] = await Promise.all([
    fetchBalance(address, market),
    horizonJson(`${HORIZON_URL}/accounts/${address}/payments?order=desc&limit=200`),
  ]);

  const records: HorizonPaymentRecord[] = paymentsData?._embedded?.records ?? [];
  const { usdcSpent } = aggregateGrowthBuys(records, market, address);
  const { valueUsdc, source } = await valuate(market, balance);

  const growthPct =
    valueUsdc !== null && usdcSpent > 0 ? (valueUsdc - usdcSpent) / usdcSpent : null;

  return {
    assetId,
    balance,
    costBasisUsdc: usdcSpent,
    valueUsdc,
    valuationSource: source,
    growthPct,
  };
}

/** Positions for every live-testnet growth asset the account can hold. */
export async function fetchGrowthPortfolio(
  address: string,
  assetIds: string[],
): Promise<GrowthPosition[]> {
  const positions = await Promise.all(
    assetIds.map((id) => fetchGrowthPosition(address, id)),
  );
  return positions.filter((p): p is GrowthPosition => p !== null);
}
