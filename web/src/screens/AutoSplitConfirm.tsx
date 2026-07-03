import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SplitNode } from "../components/SplitNode";
import { markComplete, type PendingSplit } from "../lib/keeper";
import { signAndSubmitXdr, EXPLORER_TX } from "../lib/stellar";
import { fmtUsdc, useShunt } from "../store";

/**
 * F4: one-tap approval of a keeper-prepared split. Also reachable via the
 * manual trigger (demo fallback) with a synthetic amount.
 */
export function AutoSplitConfirm() {
  const nav = useNavigate();
  const { state } = useLocation();
  const pending = state as PendingSplit | null;
  const { buckets, applySplit, showToast } = useShunt();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [doneHash, setDoneHash] = useState<string | null>(null);

  const amount = pending ? Number(pending.amount) : 500;
  const rows = useMemo(() => {
    const pct = (id: string) => buckets.find((b) => b.id === id)?.pct ?? 0;
    const savings = (amount * pct("savings")) / 100;
    const buffer = (amount * pct("buffer")) / 100;
    return [
      { id: "needs", label: "Needs → wallet", amt: amount - savings - buffer },
      { id: "savings", label: "Savings → vault (timelock)", amt: savings },
      { id: "buffer", label: "Buffer → wallet", amt: buffer },
    ];
  }, [amount, buckets]);

  async function onApprove() {
    setBusy(true);
    setErr(null);
    try {
      let hash: string | undefined;
      if (pending?.xdr) {
        hash = await signAndSubmitXdr(pending.xdr);
        await markComplete(pending.txHash);
      }
      applySplit(amount, hash ?? pending?.txHash);
      setDoneHash(hash ?? null);
      showToast("Income landed — auto-split complete");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen" style={{ justifyContent: "center", minHeight: "100dvh", textAlign: "center" }}>
      <h2 style={{ margin: 0 }}>Income landed</h2>
      <div className="numeric" style={{ fontSize: 36, fontWeight: 700 }}>
        {fmtUsdc(amount)} <span style={{ fontSize: 18 }}>USDC</span>
      </div>

      <div className="card">
        <SplitNode buckets={buckets} height={130} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((r) => {
          const bucket = buckets.find((b) => b.id === r.id)!;
          return (
            <div key={r.id} className="card" style={{ display: "flex", justifyContent: "space-between", padding: 12 }}>
              <span style={{ color: bucket.color, fontWeight: 600, fontSize: 14 }}>{r.label}</span>
              <span className="numeric">{fmtUsdc(r.amt)} USDC</span>
            </div>
          );
        })}
      </div>

      <p className="muted" style={{ fontSize: 13, margin: 0 }}>
        Atomic split in a single transaction · sub-cent network fee
      </p>

      {doneHash === null && !pending?.xdr && (
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>
          (Demo mode: contract not configured — split recorded locally.)
        </p>
      )}

      {doneHash ? (
        <>
          <a
            href={EXPLORER_TX(doneHash)}
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--color-accent-secondary)" }}
          >
            View on explorer ↗
          </a>
          <button className="btn-primary" onClick={() => nav("/home")}>
            Done
          </button>
        </>
      ) : (
        <button className="btn-primary" disabled={busy} onClick={onApprove}>
          {busy ? "Processing…" : "Approve split (1 tap)"}
        </button>
      )}
      <button className="btn-ghost" onClick={() => nav("/home")}>
        Later
      </button>
      {err && (
        <p role="alert" style={{ color: "#ffb4ab", fontSize: 13 }}>
          {err}
        </p>
      )}
    </div>
  );
}
