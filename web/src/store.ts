import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Single source of truth for allocation rules (DESIGN.md §5.1):
 * the Home allocation bar and the Configure Shunt split-node diagram both
 * render from this state — never from local copies.
 */
export interface Bucket {
  id: string;
  name: string;
  /** percentage 0..100 (UI); converted to bps for the contract */
  pct: number;
  color: string;
}

export interface ActivityItem {
  id: string;
  kind: "split" | "withdraw" | "offramp" | "deposit";
  title: string;
  amountUsdc: number;
  txHash?: string;
  at: string; // ISO
  bucket?: string;
}

interface ShuntState {
  address: string | null;
  network: "testnet" | "mainnet";
  buckets: Bucket[];
  rulesSavedOnChain: boolean;
  lockUntil: number; // unix seconds
  lockSecs: number; // timelock duration chosen in Configure Shunt
  /** wallet + vault balances in USDC (display) */
  balances: { needs: number; savings: number; buffer: number };
  activity: ActivityItem[];
  toast: string | null;

  setAddress: (a: string | null) => void;
  setBuckets: (b: Bucket[]) => void;
  setBucketPct: (id: string, pct: number) => void;
  addBucket: () => void;
  removeBucket: (id: string) => void;
  markRulesSaved: () => void;
  setLockSecs: (s: number) => void;
  applySplit: (amount: number, txHash?: string) => void;
  withdrawSavings: (amount: number, penalty: number) => void;
  offramp: (amount: number) => void;
  setLockUntil: (t: number) => void;
  showToast: (msg: string) => void;
  clearToast: () => void;
}

const EXTRA_COLORS = ["var(--color-bucket-extra-1)", "var(--color-bucket-extra-2)"];

export const DEFAULT_BUCKETS: Bucket[] = [
  { id: "needs", name: "Needs", pct: 60, color: "var(--color-bucket-needs)" },
  { id: "savings", name: "Savings", pct: 25, color: "var(--color-bucket-savings)" },
  { id: "buffer", name: "Buffer", pct: 15, color: "var(--color-bucket-buffer)" },
];

export const useShunt = create<ShuntState>()(
  persist(
    (set, get) => ({
      address: null,
      network: "testnet",
      buckets: DEFAULT_BUCKETS,
      rulesSavedOnChain: false,
      lockUntil: 0,
      lockSecs: 30 * 86400,
      balances: { needs: 0, savings: 0, buffer: 0 },
      activity: [],
      toast: null,

      setAddress: (address) => set({ address }),
      setBuckets: (buckets) => set({ buckets }),
      setBucketPct: (id, pct) =>
        set({
          buckets: get().buckets.map((b) =>
            b.id === id ? { ...b, pct: Math.max(0, Math.min(100, Math.round(pct))) } : b,
          ),
        }),
      addBucket: () => {
        const buckets = get().buckets;
        const extraCount = buckets.length - 3;
        if (extraCount >= EXTRA_COLORS.length) return; // max 5 lanes
        set({
          buckets: [
            ...buckets,
            {
              id: `lane-${Date.now()}`,
              name: `Lane ${buckets.length + 1}`,
              pct: 0,
              color: EXTRA_COLORS[extraCount],
            },
          ],
        });
      },
      removeBucket: (id) => {
        const core = ["needs", "savings", "buffer"];
        if (core.includes(id)) return;
        set({ buckets: get().buckets.filter((b) => b.id !== id) });
      },
      markRulesSaved: () => set({ rulesSavedOnChain: true }),
      setLockSecs: (lockSecs) => set({ lockSecs }),

      applySplit: (amount, txHash) => {
        const { buckets, balances, activity, lockUntil, lockSecs } = get();
        const pct = (id: string) => buckets.find((b) => b.id === id)?.pct ?? 0;
        const savings = (amount * pct("savings")) / 100;
        const buffer = (amount * pct("buffer")) / 100;
        const needs = amount - savings - buffer;
        // mirror the contract: each savings deposit extends the timelock
        const newLock = Math.floor(Date.now() / 1000) + lockSecs;
        set({
          lockUntil: savings > 0 ? Math.max(lockUntil, newLock) : lockUntil,
          balances: {
            needs: balances.needs + needs,
            savings: balances.savings + savings,
            buffer: balances.buffer + buffer,
          },
          activity: [
            {
              id: `${Date.now()}`,
              kind: "split",
              title: `Income ${fmtUsdc(amount)} USDC auto-split`,
              amountUsdc: amount,
              txHash,
              at: new Date().toISOString(),
            },
            ...activity,
          ],
        });
      },

      withdrawSavings: (amount, penalty) => {
        const { balances, activity } = get();
        set({
          balances: {
            ...balances,
            savings: balances.savings - amount,
            needs: balances.needs + (amount - penalty),
            buffer: balances.buffer + penalty,
          },
          activity: [
            {
              id: `${Date.now()}`,
              kind: "withdraw",
              title:
                penalty > 0
                  ? `Savings withdrawal (${fmtUsdc(penalty)} penalty → Buffer)`
                  : "Savings withdrawal",
              amountUsdc: amount,
              at: new Date().toISOString(),
              bucket: "savings",
            },
            ...activity,
          ],
        });
      },

      offramp: (amount) => {
        const { balances, activity } = get();
        set({
          balances: { ...balances, needs: balances.needs - amount },
          activity: [
            {
              id: `${Date.now()}`,
              kind: "offramp",
              title: "Cash-out via anchor (pending)",
              amountUsdc: amount,
              at: new Date().toISOString(),
              bucket: "needs",
            },
            ...activity,
          ],
        });
      },

      setLockUntil: (lockUntil) => set({ lockUntil }),
      showToast: (toast) => set({ toast }),
      clearToast: () => set({ toast: null }),
    }),
    { name: "shunt-store" },
  ),
);

export function fmtUsdc(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function fmtIdr(n: number): string {
  return "Rp" + Math.round(n).toLocaleString("en-US");
}

export function totalPct(buckets: Bucket[]): number {
  return buckets.reduce((s, b) => s + b.pct, 0);
}
