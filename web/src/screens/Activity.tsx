import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Repeat } from "lucide-react";
import { EXPLORER_TX, fetchRecentPayments, type ChainPayment } from "../lib/stellar";
import { fmtUsdc, useShunt, type ActivityItem } from "../store";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "transfer", label: "Transfers" },
  { id: "split", label: "Split" },
  { id: "invest", label: "Invest" },
  { id: "withdraw", label: "Withdraw" },
  { id: "offramp", label: "Off-ramp" },
] as const;

const KIND_ICON: Record<ActivityItem["kind"], string> = {
  split: "⑃",
  withdraw: "↓",
  offramp: "↗",
  deposit: "＋",
  invest: "📈",
  payment: "→",
  convert: "⇄",
};

/** One row in the merged feed — local app events + real Horizon transfers. */
interface FeedRow {
  id: string;
  /** local ActivityItem kind, or "transfer" for on-chain payments */
  kind: ActivityItem["kind"] | "transfer";
  title: string;
  sub?: string;
  /** signed for transfers (+in / −out); unsigned for app events */
  amountLabel: string;
  amountColor?: string;
  icon: React.ReactNode;
  txHash?: string;
  at: string;
}

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

export function Activity() {
  const { address, activity } = useShunt();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [chain, setChain] = useState<ChainPayment[]>([]);
  const [chainLoaded, setChainLoaded] = useState(false);

  // Real on-chain transfers (Horizon /payments) — refreshed while the tab is open,
  // so income and outgoing sends show up even when they never touched the app.
  useEffect(() => {
    if (!address) return;
    const tick = () =>
      fetchRecentPayments(address)
        .then((p) => {
          setChain(p);
          setChainLoaded(true);
        })
        .catch(() => {});
    tick();
    const t = setInterval(tick, 15000);
    return () => clearInterval(t);
  }, [address]);

  const rows = useMemo<FeedRow[]>(() => {
    const localHashes = new Set(activity.map((a) => a.txHash).filter(Boolean));
    const local: FeedRow[] = activity.map((a) => ({
      id: `local-${a.id}`,
      kind: a.kind,
      title: a.title,
      amountLabel:
        a.amountXlm !== undefined
          ? `${a.amountXlm.toLocaleString("en-US", { maximumFractionDigits: 2 })} XLM`
          : `${fmtUsdc(a.amountUsdc ?? 0)} USDC`,
      icon: <span style={{ fontSize: 18 }}>{KIND_ICON[a.kind]}</span>,
      txHash: a.txHash,
      at: a.at,
    }));
    // A transfer the app already recorded (XLM send, real DCA conversion,
    // approved split) keeps its richer local row; the raw payment is skipped.
    const transfers: FeedRow[] = chain
      .filter((p) => !localHashes.has(p.txHash))
      .map((p) => ({
        id: `chain-${p.id}`,
        kind: "transfer" as const,
        title: p.isSelfConversion
          ? `Converted to ${p.asset} (DCA)`
          : p.direction === "in"
            ? `Received ${p.asset}`
            : `Sent ${p.asset}`,
        sub: p.isSelfConversion
          ? "path payment to self"
          : p.direction === "in"
            ? `from ${short(p.counterparty)}`
            : `to ${short(p.counterparty)}`,
        amountLabel: `${p.direction === "in" ? "+" : "−"}${p.amount.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${p.asset}`,
        amountColor: p.direction === "in" ? "var(--color-accent-primary)" : undefined,
        icon: p.isSelfConversion ? (
          <Repeat size={17} style={{ color: "var(--color-accent-tertiary)" }} />
        ) : p.direction === "in" ? (
          <ArrowDownLeft size={17} style={{ color: "var(--color-accent-primary)" }} />
        ) : (
          <ArrowUpRight size={17} style={{ color: "var(--color-bucket-needs)" }} />
        ),
        txHash: p.txHash,
        at: p.at,
      }));
    return [...local, ...transfers].sort((a, b) => +new Date(b.at) - +new Date(a.at));
  }, [activity, chain]);

  const items = rows.filter((r) => {
    if (filter === "all") return true;
    if (filter === "transfer") return r.kind === "transfer" || r.kind === "payment" || r.kind === "convert";
    return r.kind === filter;
  });
  const byDate = items.reduce<Record<string, FeedRow[]>>((acc, a) => {
    const d = new Date(a.at).toLocaleDateString("en-US", { month: "long", day: "numeric" });
    (acc[d] ??= []).push(a);
    return acc;
  }, {});

  return (
    <div className="screen">
      <h2 style={{ margin: 0 }}>Activity</h2>
      <p className="muted" style={{ margin: "-8px 0 0", fontSize: 13 }}>
        App events plus every on-chain transfer in and out of your wallet.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <button key={f.id} className={`chip${filter === f.id ? " active" : ""}`} onClick={() => setFilter(f.id)} data-testid={`filter-${f.id}`}>
            {f.label}
          </button>
        ))}
      </div>

      {Object.keys(byDate).length === 0 && (
        <p className="muted" data-testid="activity-empty">
          {chainLoaded || activity.length > 0
            ? "No transactions for this filter yet."
            : "Loading on-chain history…"}
        </p>
      )}

      {Object.entries(byDate).map(([date, list]) => (
        <section key={date}>
          <div className="muted" style={{ fontSize: 12, margin: "4px 0" }}>{date}</div>
          {list.map((a, i) => (
            <motion.div
              key={a.id}
              className="card"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.03 }}
              style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 12, padding: 12 }}
              data-testid={`activity-row-${a.kind}`}
            >
              <span style={{ width: 28, display: "flex", justifyContent: "center" }}>{a.icon}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</div>
                <div className="muted" style={{ fontSize: 11 }}>
                  {new Date(a.at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  {a.sub && <> · {a.sub}</>}
                  {a.txHash && (
                    <>
                      {" · "}
                      <a href={EXPLORER_TX(a.txHash)} target="_blank" rel="noreferrer" style={{ color: "var(--color-accent-secondary)" }}>
                        on-chain ↗
                      </a>
                    </>
                  )}
                </div>
              </span>
              <span className="numeric" style={{ fontWeight: 600, color: a.amountColor, whiteSpace: "nowrap" }}>
                {a.amountLabel}
              </span>
            </motion.div>
          ))}
        </section>
      ))}
    </div>
  );
}
