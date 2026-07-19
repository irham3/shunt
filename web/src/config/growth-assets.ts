/**
 * Growth asset registry — the single source of truth for Shunt's "Grow" lane.
 *
 * Positioning rules baked in here (do not weaken):
 *  - Protected Savings is NEVER represented here. Savings stays 100% USDC and is
 *    never auto-routed into a Growth asset. Growth is always opt-in and spot.
 *  - `live-testnet` means a real, signed testnet transaction executes for this
 *    asset. If an integration isn't genuinely real yet, it stays `roadmap` — we
 *    never label a mock as live (the "real over mock" rule).
 *  - Issuers are NOT hardcoded. The demo gold asset resolves its issuer from
 *    `VITE_DEMO_ASSET_ISSUER` — the same env var `lib/stellar.ts` reads — so
 *    there is exactly one source of truth. If it's unset, the card degrades to
 *    unavailable (see `isPurchasable`), it does not fake an issuer.
 */

/** Issuer of Shunt's testnet demo assets. Mirrors `DEMO_ASSET_ISSUER` in
 *  `lib/stellar.ts`; both read the same env var so they can never diverge. */
const DEMO_ASSET_ISSUER: string =
  (import.meta.env.VITE_DEMO_ASSET_ISSUER as string | undefined) ?? "";

export type GrowthTier = "value-hedge" | "yield-defi" | "crypto" | "roadmap";

export type GrowthExecution =
  | "dex-path-payment"
  | "blend-supply"
  | "defindex-deposit";

export type GrowthStatus = "live-testnet" | "roadmap";

export type ReturnSource =
  | "price-appreciation"
  | "lending-interest"
  | "none";

export type RiskLevel = "low" | "medium" | "high";

export interface GrowthAsset {
  id: string;
  name: string;
  symbol: string;
  tier: GrowthTier;
  status: GrowthStatus;
  /** How a live-testnet buy executes. Absent for roadmap (non-purchasable). */
  execution?: GrowthExecution;
  /** Classic asset code + issuer for `dex-path-payment` assets. Native (XLM)
   *  has no issuer. Issuer is env-resolved, never a literal. */
  demoAsset?: { code: string; issuer: string };
  /** The real mainnet product this testnet stand-in points at, if any. */
  mainnetTarget?: string;
  returnSource: ReturnSource;
  interestBased: boolean;
  riskLevel: RiskLevel;
  shortDescription: string;
  /** One-line honest disclosure shown in muted text on the card. */
  honestNote: string;
}

export const GROWTH_ASSETS: GrowthAsset[] = [
  // --- Value hedge ---------------------------------------------------------
  {
    id: "xaum-demo",
    name: "Gold (demo: TXAUM → XAUm)",
    symbol: "TXAUM",
    tier: "value-hedge",
    status: "live-testnet",
    execution: "dex-path-payment",
    demoAsset: { code: "TXAUM", issuer: DEMO_ASSET_ISSUER },
    mainnetTarget:
      "Matrixdock XAUm — LBMA physical gold, live on Stellar mainnet since June 2026",
    returnSource: "price-appreciation",
    interestBased: false,
    riskLevel: "medium",
    shortDescription: "Spot gold exposure as a value hedge",
    honestNote: "TXAUM is an unbacked testnet stand-in. Production target: XAUm",
  },

  // --- Crypto --------------------------------------------------------------
  {
    id: "xlm",
    name: "Stellar Lumens",
    symbol: "XLM",
    tier: "crypto",
    status: "live-testnet",
    execution: "dex-path-payment",
    returnSource: "price-appreciation",
    interestBased: false,
    riskLevel: "high",
    shortDescription: "Native Stellar asset, bought spot via the DEX",
    honestNote: "Volatile crypto asset",
  },

  // --- Yield-bearing (interest) -------------------------------------------
  // Feasibility (checked against blend-capital/blend-utils testnet.contracts):
  // Blend testnet pools use Blend's own USDC SAC
  // (CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU) — NOT Shunt's
  // Circle classic USDC — so the clean path is supplying the XLM reserve via
  // the testnet XLM SAC (CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC),
  // avoiding a classic↔SAC USDC bridge. Kept status "roadmap" (no execution)
  // until a REAL wallet-signed supply→withdraw round-trip is verified on
  // testnet — "real over mock" forbids labelling it live before then. To
  // promote: add @blend-capital/blend-sdk, implement supply/withdraw of the
  // XLM reserve reading position size back from the pool contract, verify one
  // round-trip, then set status "live-testnet" + execution "blend-supply".
  {
    id: "blend-usdc",
    name: "Lending yield (Blend Protocol, testnet)",
    symbol: "USDC",
    tier: "yield-defi",
    status: "roadmap",
    returnSource: "lending-interest",
    interestBased: true,
    riskLevel: "medium",
    shortDescription: "Interest-bearing USDC supplied to a Blend lending pool",
    honestNote:
      "Interest-based lending yield via Blend. Smart-contract risk applies",
  },

  // --- Coming to Stellar (roadmap, non-purchasable) ------------------------
  {
    id: "benji",
    name: "Franklin Templeton BENJI",
    symbol: "BENJI",
    tier: "roadmap",
    status: "roadmap",
    mainnetTarget:
      "Franklin Templeton BENJI — US government money market fund, ~$654M on Stellar mainnet, KYC via issuer",
    returnSource: "lending-interest",
    interestBased: true,
    riskLevel: "low",
    shortDescription: "Tokenized US money market fund",
    honestNote: "Mainnet-only, KYC-gated. Not available on testnet",
  },
  {
    id: "usdy",
    name: "Ondo USDY",
    symbol: "USDY",
    tier: "roadmap",
    status: "roadmap",
    mainnetTarget: "Ondo USDY — yield-bearing US Treasuries note",
    returnSource: "lending-interest",
    interestBased: true,
    riskLevel: "low",
    shortDescription: "Tokenized US Treasuries yield note",
    honestNote: "Mainnet-only. Not available on testnet",
  },
  {
    id: "stablebonds",
    name: "Etherfuse Stablebonds",
    symbol: "CETES",
    tier: "roadmap",
    status: "roadmap",
    mainnetTarget:
      "Etherfuse Stablebonds — US & MX government bonds (CETES); developer API/sandbox available",
    returnSource: "lending-interest",
    interestBased: true,
    riskLevel: "low",
    shortDescription: "Tokenized government bonds (US & Mexico)",
    honestNote: "Mainnet product with a sandbox API. Not on Stellar testnet",
  },
  {
    id: "tokenized-etf",
    name: "Tokenized stocks & ETFs (DTCC)",
    symbol: "ETF",
    tier: "roadmap",
    status: "roadmap",
    mainnetTarget:
      "DTCC tokenized stocks/ETFs on Stellar — targeted H1 2027",
    returnSource: "price-appreciation",
    interestBased: false,
    riskLevel: "medium",
    shortDescription: "Tokenized equity and ETF exposure",
    honestNote: "Targeted for Stellar in H1 2027. Not yet available",
  },
];

// --- Selectors --------------------------------------------------------------

/** UI section order for the Grow page. */
export const GROWTH_TIER_ORDER: GrowthTier[] = [
  "value-hedge",
  "yield-defi",
  "crypto",
  "roadmap",
];

/** Human-facing section headings, keyed by tier. */
export const GROWTH_TIER_LABEL: Record<GrowthTier, string> = {
  "value-hedge": "Value hedge",
  "yield-defi": "Yield-bearing (interest)",
  crypto: "Crypto",
  roadmap: "Coming to Stellar",
};

export const growthAssetById = (id: string): GrowthAsset | undefined =>
  GROWTH_ASSETS.find((a) => a.id === id);

export const growthAssetsByTier = (tier: GrowthTier): GrowthAsset[] =>
  GROWTH_ASSETS.filter((a) => a.tier === tier);

/**
 * Whether this asset can actually be bought right now. True only for a
 * live-testnet asset that has an execution path AND — for classic DEX assets —
 * a resolved (non-empty) issuer. Everything else renders as non-purchasable.
 */
export const isPurchasable = (a: GrowthAsset): boolean => {
  if (a.status !== "live-testnet" || !a.execution) return false;
  if (a.execution === "dex-path-payment" && a.demoAsset) {
    return a.demoAsset.issuer.length > 0;
  }
  return true;
};
