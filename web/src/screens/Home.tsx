import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AllocationBar } from "../components/AllocationBar";
import { getIdrRate } from "../lib/rates";
import { fetchPending, type PendingSplit } from "../lib/keeper";
import { fetchXlmBalance, fundWithFriendbot, fetchLatestSplitEvent, NETWORK } from "../lib/stellar";
import { fmtIdr, fmtUsdc, useShunt } from "../store";
import { BentoGrid, BentoCard } from "../components/BentoGrid";
import { Lock, Wallet, ArrowUpRight } from "lucide-react";

export function Home() {
  const nav = useNavigate();
  const { address, buckets, balances, investXlm, activity, xlmBalance, setXlmBalance, showToast } = useShunt();
  const [idr, setIdr] = useState<number | null>(null);
  const [pending, setPending] = useState<PendingSplit[]>([]);
  const [fundingBot, setFundingBot] = useState(false);
  const [lastEventCursor, setLastEventCursor] = useState<string>("");

  const total = balances.needs + balances.savings + balances.buffer + balances.invest;

  useEffect(() => {
    getIdrRate().then((r) => setIdr(r.rate));
  }, []);

  // Fetch XLM balance on mount and periodically
  useEffect(() => {
    if (!address) return;
    const tick = () =>
      fetchXlmBalance(address)
        .then(setXlmBalance)
        .catch(() => {}); // silent fail — retry next tick
    tick();
    const t = setInterval(tick, 15000);
    return () => clearInterval(t);
  }, [address, setXlmBalance]);

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
          // If it's not the first load, show a real-time toast
          showToast(`Real-time: New contract event detected (Split/Withdraw)`);
        }
        // Sync the latest balances from the contract
        useShunt.getState().syncFromChain(address);
      }
    };
    // Also sync on initial mount
    useShunt.getState().syncFromChain(address);
    const t = setInterval(tick, 5000);
    return () => clearInterval(t);
  }, [address, lastEventCursor, showToast]);

  const bucketBalance = (id: string) =>
    id === "needs"
      ? balances.needs
      : id === "savings"
        ? balances.savings
        : id === "buffer"
          ? balances.buffer
          : id === "invest"
            ? balances.invest
            : 0;

  async function onFundbot() {
    if (!address) return;
    setFundingBot(true);
    try {
      await fundWithFriendbot(address);
      const bal = await fetchXlmBalance(address);
      setXlmBalance(bal);
      showToast("Funded with 10,000 testnet XLM!");
    } catch (e) {
      showToast(`Friendbot error: ${e instanceof Error ? e.message : e}`);
    } finally {
      setFundingBot(false);
    }
  }

  return (
    <div className="screen">
      <header>
        <div className="muted" style={{ fontSize: 13 }}>Total value</div>
        <div className="numeric" style={{ fontSize: "clamp(36px, 5vw, 48px)", fontWeight: 700, lineHeight: 1.1 }}>
          ${fmtUsdc(total)}
        </div>
        <div className="muted" style={{ fontSize: 14 }}>
          {idr ? `≈ ${fmtIdr(total * idr)}` : "…"}
        </div>
      </header>

      {/* XLM Balance — Level 1 requirement */}
      <section className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="muted" style={{ fontSize: 12 }}>XLM Balance ({NETWORK})</div>
          <div className="numeric" style={{ fontSize: 22, fontWeight: 700 }}>
            {xlmBalance !== null ? `${Number(xlmBalance).toLocaleString("en-US", { maximumFractionDigits: 2 })} XLM` : "Loading…"}
          </div>
        </div>
        {xlmBalance !== null && Number(xlmBalance) === 0 && NETWORK === "testnet" && (
          <button
            className="btn-secondary"
            style={{ fontSize: 13, padding: "6px 14px" }}
            disabled={fundingBot}
            onClick={onFundbot}
          >
            {fundingBot ? "Funding…" : "Fund with Friendbot"}
          </button>
        )}
      </section>

      {/* Quick actions: the in/out loop lives one tap from Home (F11/F13/F8) */}
      <section style={{ display: "flex", gap: 8 }}>
        {[
          { to: "/topup", icon: "⬇", label: "Top Up" },
          { to: "/request", icon: "🔗", label: "Request" },
          { to: "/send", icon: "⬆", label: "Send & Pay" },
        ].map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="card"
            style={{ flex: 1, textAlign: "center", textDecoration: "none", color: "inherit", padding: "12px 4px" }}
          >
            <div style={{ fontSize: 20 }}>{a.icon}</div>
            <div style={{ fontSize: 12, marginTop: 4, fontWeight: 600 }}>{a.label}</div>
          </Link>
        ))}
      </section>

      {pending.length > 0 && (
        <button
          className="card"
          onClick={() => nav("/confirm", { state: pending[0] })}
          style={{ border: "1px solid var(--color-accent-primary)", textAlign: "left", display: "block" }}
        >
          <strong style={{ color: "var(--color-accent-primary)" }}>Income detected!</strong>
          <div className="muted" style={{ fontSize: 13 }}>
            {pending[0].amount} USDC landed — tap to approve the split.
          </div>
        </button>
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
                  to={b.id === "savings" ? "/savings" : b.id === "needs" ? "/send" : "/shunt"}
                  style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10, textDecoration: "none", color: "inherit", height: "100%" }}
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
                    <div className="muted" style={{ fontSize: 12 }}>{b.pct}% of each income</div>
                  </span>
                  <span className="numeric" style={{ fontWeight: 600, fontSize: 20, marginTop: "auto" }}>
                    ${fmtUsdc(bucketBalance(b.id))}
                    {b.id === "invest" && investXlm > 0 && (
                      <span className="muted" style={{ fontSize: 12, display: "block", fontWeight: 400 }}>
                        {investXlm.toLocaleString("en-US", { maximumFractionDigits: 2 })} XLM held
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
              {activity.slice(0, 5).map((a) => (
                <div key={a.id} style={{ padding: "11px 0", borderBottom: "1px solid #1f2732", display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</span>
                  <span className="numeric muted">${fmtUsdc(a.amountUsdc)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

