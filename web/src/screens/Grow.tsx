import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { fmtUsdc, useShunt } from "../store";
import {
  GROWTH_TIER_LABEL,
  GROWTH_TIER_ORDER,
  growthAssetsByTier,
  isPurchasable,
  type GrowthAsset,
  type GrowthTier,
  type RiskLevel,
} from "../config/growth-assets";
import {
  fetchGrowthPortfolio,
  growthMarketAsset,
  type GrowthPosition,
} from "../lib/growth";
import {
  addTrustline,
  convertUsdcToAsset,
  convertUsdcToXlm,
  EXPLORER_TX,
  formatError,
  hasTrustline,
  quoteConversion,
  quoteUsdcToAsset,
} from "../lib/stellar";

const BANNER_KEY = "shunt.grow.banner.dismissed";

const TIER_ACCENT: Record<GrowthTier, string> = {
  "value-hedge": "var(--color-bucket-buffer)", // amber
  "yield-defi": "var(--color-accent-tertiary)", // violet
  crypto: "var(--color-accent-secondary)", // blue
  roadmap: "var(--color-text-secondary)",
};

const RISK_COLOR: Record<RiskLevel, string> = {
  low: "#34d399",
  medium: "var(--color-bucket-buffer)",
  high: "#f87171",
};

/**
 * Grow — Shunt's opt-in growth lane, rendered entirely from the growth-asset
 * registry. Four tiers; live cards buy spot via real testnet DEX path payments
 * and surface the tx hash; roadmap cards are non-purchasable. Protected Savings
 * is never represented here.
 */
export function Grow() {
  const { address, usdcBalance, showToast, refreshWallet } = useShunt();
  const [bannerDismissed, setBannerDismissed] = useState(
    () => localStorage.getItem(BANNER_KEY) === "1",
  );
  const [positions, setPositions] = useState<GrowthPosition[]>([]);
  const walletUsdc = Number(usdcBalance ?? 0);

  const purchasableIds = useMemo(
    () =>
      GROWTH_TIER_ORDER.flatMap((tier) => growthAssetsByTier(tier))
        .filter(isPurchasable)
        .map((a) => a.id),
    [],
  );

  useEffect(() => {
    if (!address) return;
    let live = true;
    // The page needs the real wallet USDC to size buys ("X available") — other
    // screens do this on mount too; without it every Buy stays disabled at 0.
    refreshWallet(address);
    fetchGrowthPortfolio(address, purchasableIds).then((p) => {
      if (live) setPositions(p.filter((x) => x.balance > 0));
    });
    return () => {
      live = false;
    };
  }, [address, purchasableIds, refreshWallet]);

  function dismissBanner() {
    localStorage.setItem(BANNER_KEY, "1");
    setBannerDismissed(true);
  }

  return (
    <div className="screen screen-wide">
      <header>
        <div>
          <h2 style={{ margin: 0, fontSize: 24 }}>Grow</h2>
          <p className="muted" style={{ margin: "2px 0 0", fontSize: 14 }}>
            Opt-in growth, always spot and from your own wallet
          </p>
        </div>
      </header>

      {!bannerDismissed && (
        <div
          className="card"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            borderColor: "var(--color-accent-primary)",
          }}
          data-testid="grow-banner"
        >
          <i className="ph ph-shield-check" style={{ fontSize: 20, color: "var(--color-accent-primary)", marginTop: 2 }} />
          <p className="muted" style={{ margin: 0, fontSize: 13, flex: 1 }}>
            Growth is separate from your Protected Savings. Savings always stays in USDC. Growth assets can lose value.
          </p>
          <button className="chip" aria-label="Dismiss" onClick={dismissBanner} data-testid="grow-banner-dismiss">
            <X size={13} />
          </button>
        </div>
      )}

      {positions.length > 0 && (
        <div className="card" data-testid="grow-portfolio">
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Your growth holdings</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {positions.map((p) => (
              <PositionRow key={p.assetId} pos={p} />
            ))}
          </div>
          <p className="muted" style={{ fontSize: 11, margin: "10px 0 0" }}>
            Value and growth are computed live from your on-chain balances, real trade history, and DEX quotes — never a stored estimate.
          </p>
        </div>
      )}

      {GROWTH_TIER_ORDER.map((tier) => {
        const assets = growthAssetsByTier(tier);
        if (assets.length === 0) return null;
        return (
          <section key={tier} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h3 style={{ margin: "8px 0 0", fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: TIER_ACCENT[tier] }} />
              {GROWTH_TIER_LABEL[tier]}
            </h3>
            {assets.map((a) => (
              <GrowthCard
                key={a.id}
                asset={a}
                address={address}
                walletUsdc={walletUsdc}
                showToast={showToast}
                onBought={() => address && refreshWallet(address)}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}

function PositionRow({ pos }: { pos: GrowthPosition }) {
  const up = pos.growthPct !== null && pos.growthPct >= 0;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <span className="numeric" style={{ fontSize: 14 }}>
        {pos.balance.toLocaleString("en-US", { maximumFractionDigits: 4 })} {pos.assetId === "xlm" ? "XLM" : "TXAUM"}
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="numeric muted" style={{ fontSize: 14 }}>
          {pos.valueUsdc !== null ? `${fmtUsdc(pos.valueUsdc)} USDC` : "no quote"}
          {pos.valuationSource === "ask" && <span style={{ fontSize: 11 }}> · ask</span>}
        </span>
        {pos.growthPct !== null && (
          <span className="numeric" style={{ fontSize: 13, color: up ? "#34d399" : "#f87171" }}>
            {up ? "+" : ""}
            {(pos.growthPct * 100).toFixed(1)}%
          </span>
        )}
      </span>
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.3,
        textTransform: "uppercase",
        color,
        border: `1px solid ${color}`,
        borderRadius: 999,
        padding: "2px 8px",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function GrowthCard({
  asset,
  address,
  walletUsdc,
  showToast,
  onBought,
}: {
  asset: GrowthAsset;
  address: string | null;
  walletUsdc: number;
  showToast: (msg: string) => void;
  onBought: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastHash, setLastHash] = useState<string | null>(null);
  const live = isPurchasable(asset);

  async function onBuy() {
    const usdc = Number(amount);
    if (!address || usdc <= 0 || usdc > walletUsdc) return;
    const market = growthMarketAsset(asset.id);
    if (!market) return;
    setBusy(true);
    setLastHash(null);
    try {
      const amt = usdc.toFixed(7);
      const quote = market.isNative()
        ? await quoteConversion("usdc-xlm", amt)
        : await quoteUsdcToAsset(market, amt);
      if (!quote) throw new Error(`No USDC → ${asset.symbol} path on the testnet DEX right now — try again shortly.`);
      if (!market.isNative() && !(await hasTrustline(address, market))) {
        await addTrustline(address, market);
      }
      const min = (quote.amount * 0.98).toFixed(7);
      const hash = market.isNative()
        ? await convertUsdcToXlm(address, amt, min, quote.path)
        : await convertUsdcToAsset(address, market, amt, min, quote.path);
      setLastHash(hash);
      setAmount("");
      showToast(`Bought ≈${quote.amount.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${asset.symbol} for ${fmtUsdc(usdc)} USDC`);
      onBought();
    } catch (e) {
      const f = formatError(e);
      if (f) showToast(`Purchase failed: ${f}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div className="card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} data-testid={`grow-card-${asset.id}`}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{asset.name}</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{asset.shortDescription}</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Badge label={asset.riskLevel} color={RISK_COLOR[asset.riskLevel]} />
          {asset.interestBased && <Badge label="Interest-based" color="var(--color-accent-tertiary)" />}
          <Badge
            label={live ? "Live on testnet" : "Roadmap"}
            color={live ? "var(--color-accent-primary)" : "var(--color-text-secondary)"}
          />
        </div>
      </div>

      <p className="muted" style={{ fontSize: 12, margin: "10px 0 0", fontStyle: "italic" }}>
        {asset.honestNote}
      </p>
      {asset.mainnetTarget && (
        <p className="muted" style={{ fontSize: 12, margin: "6px 0 0" }}>
          Mainnet target: {asset.mainnetTarget}
        </p>
      )}

      {live ? (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="muted" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
              Amount (USDC) · {fmtUsdc(walletUsdc)} available
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              max={walletUsdc}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              data-testid={`grow-amount-${asset.id}`}
            />
          </div>
          <button
            className="btn-primary"
            style={{ width: "auto", flexShrink: 0 }}
            disabled={busy || !address || !amount || Number(amount) <= 0 || Number(amount) > walletUsdc}
            onClick={onBuy}
            data-testid={`grow-buy-${asset.id}`}
          >
            {busy ? "Processing…" : "Buy"}
          </button>
        </div>
      ) : (
        <button className="btn-secondary" disabled style={{ marginTop: 12, opacity: 0.6, cursor: "not-allowed" }} data-testid={`grow-unavailable-${asset.id}`}>
          Not yet available
        </button>
      )}

      {lastHash && (
        <a
          href={EXPLORER_TX(lastHash)}
          target="_blank"
          rel="noreferrer"
          className="muted"
          style={{ fontSize: 12, marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6 }}
          data-testid={`grow-txhash-${asset.id}`}
        >
          <i className="ph ph-arrow-square-out" /> View transaction on stellar.expert
        </a>
      )}
    </motion.div>
  );
}
