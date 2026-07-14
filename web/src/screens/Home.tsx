import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { AllocationBar } from "../components/AllocationBar";
import { getIdrRate, getXlmUsdRate } from "../lib/rates";
import { fetchPending, manualTrigger, type PendingSplit } from "../lib/keeper";
import {
  fundWithFriendbot,
  fetchLatestSplitEvent,
  addUsdcTrustline,
  NETWORK,
  formatError,
} from "../lib/stellar";
import { fmtIdr, fmtUsdc, useShunt } from "../store";
import { BentoGrid, BentoCard } from "../components/BentoGrid";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { Lock, Wallet, ArrowUpRight, ShieldCheck, Sparkles, SlidersHorizontal } from "lucide-react";

/** Balance denominations the user can flip between (README: XLM + USDC live side by side). */
type AssetView = "USDC" | "XLM" | "IDR";

export function Home() {
  const nav = useNavigate();
  const {
    address,
    buckets,
    balances,
    investXlm,
    investAsset,
    activity,
    xlmBalance,
    usdcBalance,
    usdcTrustline,
    bufferCredit,
    goals,
    rulesSavedOnChain,
    refreshWallet,
    showToast,
  } = useShunt();
  const [view, setView] = useState<AssetView>("XLM");
  const [idr, setIdr] = useState<number | null>(null);
  const [xlmUsd, setXlmUsd] = useState<number | null>(null);
  const [pending, setPending] = useState<PendingSplit[]>([]);
  const [fundingBot, setFundingBot] = useState(false);
  const [enablingUsdc, setEnablingUsdc] = useState(false);
  const [splittingNow, setSplittingNow] = useState(false);
  const [lastEventCursor, setLastEventCursor] = useState<string>("");

  const walletUsdc = Number(usdcBalance ?? 0);
  const walletXlm = Number(xlmBalance ?? 0);
  // Real money, real places: wallet USDC (Horizon) + vault savings + buffer
  // credit (contract). All three are on-chain reads — no bookkeeping here.
  const totalUsdc = walletUsdc + balances.savings + bufferCredit;

  // USDC sitting in the wallet that no lane has claimed yet (e.g. a direct
  // transfer the keeper hasn't offered to split). Heuristic over the local
  // lane bookkeeping — shown with a one-tap "Split now" escape hatch.
  const unsplitUsdc = Math.max(0, walletUsdc - balances.needs - balances.buffer);

  useEffect(() => {
    getIdrRate().then((r) => setIdr(r.rate));
    getXlmUsdRate().then((r) => setXlmUsd(r.rate));
  }, []);

  // Refresh real wallet balances (XLM + USDC in one call) on mount + every 15s
  useEffect(() => {
    if (!address) return;
    refreshWallet(address);
    const t = setInterval(() => refreshWallet(address), 15000);
    return () => clearInterval(t);
  }, [address, refreshWallet]);

  // poll keeper for detected inflows awaiting one-tap approval
  useEffect(() => {
    if (!address) return;
    const tick = () => fetchPending(address).then(setPending);
    tick();
    const t = setInterval(tick, 8000);
    return () => clearInterval(t);
  }, [address]);

  // Real-time Soroban Event Integration (Level 2 Blue Belt requirement)
  useEffect(() => {
    if (!address) return;
    const tick = async () => {
      const latest = await fetchLatestSplitEvent(lastEventCursor);
      if (latest && latest.cursor !== lastEventCursor) {
        setLastEventCursor(latest.cursor);
        if (lastEventCursor !== "") {
          showToast(`Real-time: New contract event detected (Split/Withdraw)`);
        }
        useShunt.getState().syncFromChain(address);
        useShunt.getState().refreshWallet(address);
      }
    };
    // Also sync on initial mount
    useShunt.getState().syncFromChain(address);
    const t = setInterval(tick, 5000);
    return () => clearInterval(t);
  }, [address, lastEventCursor, showToast]);

  const bucketBalance = (id: string) => {
    const b = buckets.find((x) => x.id === id);
    if (!b) return 0;
    const kindTotal = balances[b.kind as keyof typeof balances] || 0;
    const kindPct = buckets.filter((x) => x.kind === b.kind).reduce((s, x) => s + x.pct, 0);
    return kindPct > 0 ? kindTotal * (b.pct / kindPct) : 0;
  };

  const bucketNote = (kind: string) =>
    kind === "savings" ? "in vault · locked" : kind === "invest" ? "DCA cost basis" : "in wallet";

  async function onFundbot() {
    if (!address) return;
    setFundingBot(true);
    try {
      await fundWithFriendbot(address);
      await refreshWallet(address);
      showToast("Funded with 10,000 testnet XLM!");
    } catch (e) {
      const formatted = formatError(e);
      if (formatted) showToast(`Friendbot error: ${formatted}`);
    } finally {
      setFundingBot(false);
    }
  }

  async function onEnableUsdc() {
    if (!address) return;
    setEnablingUsdc(true);
    try {
      await addUsdcTrustline(address);
      await refreshWallet(address);
      showToast("USDC enabled — this wallet can now receive USDC");
    } catch (e) {
      const formatted = formatError(e);
      if (formatted) showToast(formatted);
    } finally {
      setEnablingUsdc(false);
    }
  }

  /** One-tap split for wallet USDC no lane has claimed (direct transfers). */
  async function onSplitNow() {
    if (!address || unsplitUsdc <= 0) return;
    setSplittingNow(true);
    try {
      const syntheticHash = [...crypto.getRandomValues(new Uint8Array(32))]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const p = await manualTrigger(address, unsplitUsdc.toFixed(7), syntheticHash);
      nav("/confirm", {
        state: p ?? { account: address, amount: unsplitUsdc.toFixed(7), txHash: syntheticHash, xdr: null },
      });
    } finally {
      setSplittingNow(false);
    }
  }

  const headline = useMemo(() => {
    switch (view) {
      case "USDC":
        return {
          value: totalUsdc,
          decimals: 2,
          unit: "USDC",
          sub: idr ? `≈ ${fmtIdr(totalUsdc * idr)} · display rate only, funds stay in USDC` : "…",
        };
      case "XLM":
        return {
          value: walletXlm,
          decimals: 2,
          unit: "XLM",
          sub: xlmUsd ? `≈ ${fmtUsdc(walletXlm * xlmUsd)} USDC · native balance (${NETWORK})` : "…",
        };
      case "IDR":
        return {
          value: idr ? totalUsdc * idr : 0,
          decimals: 0,
          unit: "IDR",
          sub: "Display conversion of your USDC total — nothing is held in rupiah",
        };
    }
  }, [view, totalUsdc, walletXlm, idr, xlmUsd]);

  return (
    <div className="screen screen-wide">
      <motion.header
        className="card"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        data-testid="total-balance-card"
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div className="muted" style={{ fontSize: 13 }}>Total balance</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["XLM", "USDC", "IDR"] as const).map((c) => (
              <button
                key={c}
                className={`chip${view === c ? " active" : ""}`}
                onClick={() => setView(c)}
                data-testid={`asset-toggle-${c.toLowerCase()}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div
          className="numeric"
          style={{ fontSize: "clamp(34px, 5vw, 46px)", fontWeight: 700, lineHeight: 1.15, marginTop: 6 }}
          data-testid="total-balance-value"
        >
          {view === "IDR" ? (
            <>Rp<AnimatedNumber value={headline.value} decimals={0} locale="id-ID" /></>
          ) : (
            <>
              <AnimatedNumber value={headline.value} decimals={headline.decimals} />{" "}
              <span style={{ fontSize: 20, color: "var(--color-text-secondary)" }}>{headline.unit}</span>
            </>
          )}
        </div>
        <div className="muted" style={{ fontSize: 13 }}>{headline.sub}</div>

        {/* On-chain breakdown — every row is a live Horizon/contract read */}
        <div style={{ marginTop: 14, borderTop: "1px solid #1f2732", paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { label: "Wallet USDC · spendable", value: walletUsdc, unit: "USDC", testid: "row-wallet-usdc" },
            { label: "Vault savings · locked by code", value: balances.savings, unit: "USDC", testid: "row-vault-savings" },
            ...(bufferCredit > 0
              ? [{ label: "Buffer credit · in vault", value: bufferCredit, unit: "USDC", testid: "row-buffer-credit" }]
              : []),
            { label: `XLM · native (${NETWORK})`, value: walletXlm, unit: "XLM", testid: "row-wallet-xlm" },
          ].map((r) => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }} data-testid={r.testid}>
              <span className="muted">{r.label}</span>
              <span className="numeric">
                <AnimatedNumber value={r.value} decimals={2} /> {r.unit}
              </span>
            </div>
          ))}
        </div>

        {/* Onboarding gaps surfaced where the money is — not buried in Settings */}
        {walletXlm === 0 && NETWORK === "testnet" && (
          <button
            className="btn-secondary"
            style={{ fontSize: 13, marginTop: 12 }}
            disabled={fundingBot}
            onClick={onFundbot}
            data-testid="friendbot-button"
          >
            {fundingBot ? "Funding…" : "Fund with Friendbot (testnet XLM)"}
          </button>
        )}
        {walletXlm > 0 && !usdcTrustline && (
          <button
            className="btn-secondary"
            style={{ fontSize: 13, marginTop: 12 }}
            disabled={enablingUsdc}
            onClick={onEnableUsdc}
            data-testid="enable-usdc-button"
          >
            {enablingUsdc ? "Confirm in wallet…" : "Enable USDC — add trustline to receive income"}
          </button>
        )}
      </motion.header>

      {/* First-run nudge: new users now land on Home, so guide them to set rules. */}
      {!rulesSavedOnChain && (
        <Link
          to="/shunt"
          className="card"
          style={{ border: "1px solid var(--color-accent-primary)", textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: 12 }}
          data-testid="setup-rules-nudge"
        >
          <SlidersHorizontal size={20} style={{ color: "var(--color-accent-primary)", flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontWeight: 600, display: "block" }}>Set your split rules</span>
            <span className="muted" style={{ fontSize: 12 }}>
              Decide how each income divides into your lanes — then every payday auto-splits in one tap.
            </span>
          </span>
          <span className="numeric" style={{ color: "var(--color-accent-primary)" }}>→</span>
        </Link>
      )}

      {/* Quick actions: the in/out loop lives one tap from Home (F11/F13/F8) */}
      <section style={{ display: "flex", gap: 8 }}>
        {[
          { to: "/topup", icon: "ph-download-simple", label: "Top Up" },
          { to: "/request", icon: "ph-link", label: "Request" },
          { to: "/send", icon: "ph-paper-plane-right", label: "Send & Pay" },
          { to: "/send?tab=convert", icon: "ph-swap", label: "Convert" },
        ].map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="card"
            style={{ flex: 1, textAlign: "center", textDecoration: "none", color: "inherit", padding: "12px 4px" }}
          >
            <i className={`ph ${a.icon}`} style={{ fontSize: 24 }} />
            <div style={{ fontSize: 12, marginTop: 4, fontWeight: 600 }}>{a.label}</div>
          </Link>
        ))}
      </section>

      {pending.length > 0 && (
        <div
          className="card"
          style={{ border: "1px solid var(--color-accent-primary)", textAlign: "left" }}
          data-testid="income-detected-banner"
        >
          <strong style={{ color: "var(--color-accent-primary)" }}>
            {pending.length === 1 ? "Income detected!" : `${pending.length} incomes detected!`}
          </strong>
          <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
            {pending.length === 1
              ? `${pending[0].amount} USDC landed — tap to approve the split.`
              : `${fmtUsdc(pending.reduce((s, p) => s + Number(p.amount), 0))} USDC total — split them all in one go, or review individually.`
            }
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn-primary"
              style={{ flex: 1 }}
              onClick={() => nav("/confirm", { state: pending.length === 1 ? pending[0] : pending })}
              data-testid="split-all-button"
            >
              {pending.length === 1 ? "Approve split" : `Split all ${pending.length}`}
            </button>
            {pending.length > 1 && (
              <button
                className="btn-secondary"
                style={{ flex: 0, whiteSpace: "nowrap", width: "auto", padding: "0 16px" }}
                onClick={() => nav("/confirm", { state: pending[0] })}
              >
                Review 1st
              </button>
            )}
          </div>
        </div>
      )}

      {pending.length === 0 && rulesSavedOnChain && unsplitUsdc >= 0.01 && (
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ border: "1px dashed var(--color-accent-secondary)", display: "flex", alignItems: "center", gap: 12 }}
          data-testid="unsplit-banner"
        >
          <Sparkles size={20} style={{ color: "var(--color-accent-secondary)", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              {fmtUsdc(unsplitUsdc)} USDC in your wallet isn't split yet
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              Received directly? Route it through your rules now.
            </div>
          </div>
          <button
            className="btn-secondary"
            style={{ width: "auto", padding: "0 16px", fontSize: 13 }}
            disabled={splittingNow}
            onClick={onSplitNow}
            data-testid="split-now-button"
          >
            {splittingNow ? "Preparing…" : "Split now"}
          </button>
        </motion.div>
      )}

      {/* Desktop: allocation + buckets left, activity right. Mobile: stacked. */}
      <div className="split-cols">
        <div className="col-main">
          <section className="card">
            <AllocationBar buckets={buckets} />
          </section>

          <BentoGrid className="bucket-grid">
            {buckets.map((b, i) => (
              <BentoCard key={b.id} delay={i * 0.1}>
                <Link
                  to={b.id === "savings" ? "/savings" : `/lane/${b.id}`}
                  style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10, textDecoration: "none", color: "inherit", height: "100%" }}
                  data-testid={`bucket-card-${b.id}`}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      background: b.color,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--color-text-on-accent)",
                      fontWeight: 700,
                    }}
                  >
                    {b.kind === "savings" ? <Lock size={20} /> : b.kind === "invest" ? <ArrowUpRight size={20} /> : <Wallet size={20} />}
                  </span>
                  <span>
                    <div style={{ fontWeight: 600 }}>{b.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{b.pct}% of each income · {bucketNote(b.kind)}</div>
                  </span>
                  <span className="numeric" style={{ fontWeight: 600, fontSize: 20, marginTop: "auto" }}>
                    <AnimatedNumber value={bucketBalance(b.id)} decimals={2} />{" "}
                    <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>USDC</span>
                    {b.id === "invest" && investXlm > 0 && (
                      <span className="muted" style={{ fontSize: 12, display: "block", fontWeight: 400 }}>
                        {investXlm.toLocaleString("en-US", { maximumFractionDigits: 2 })} {investAsset === "GOLD" ? "g XAUm" : "XLM"} held
                      </span>
                    )}
                    {b.id === "savings" && goals.length > 0 && (
                      <span className="muted" style={{ fontSize: 12, display: "block", fontWeight: 400 }}>
                        <ShieldCheck size={11} style={{ verticalAlign: "-1px" }} />{" "}
                        {goals.slice(0, 2).map((g) => g.label).join(" · ")}
                        {goals.length > 2 ? ` +${goals.length - 2}` : ""}
                      </span>
                    )}
                  </span>
                </Link>
              </BentoCard>
            ))}
          </BentoGrid>
        </div>

        <section className="col-side card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Recent activity</h3>
            <Link to="/activity" className="muted" style={{ fontSize: 13 }}>All →</Link>
          </div>
          {activity.length === 0 ? (
            <p className="muted" style={{ fontSize: 14, margin: 0 }}>
              No activity yet. Your first USDC income will show up here.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {activity.slice(0, 5).map((a, i) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  style={{ padding: "11px 0", borderBottom: "1px solid #1f2732", display: "flex", justifyContent: "space-between", gap: 12 }}
                >
                  <span style={{ fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</span>
                  <span className="numeric muted">
                    {a.amountXlm !== undefined
                      ? `${a.amountXlm.toLocaleString("en-US", { maximumFractionDigits: 2 })} XLM`
                      : `${fmtUsdc(a.amountUsdc ?? 0)} USDC`}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
