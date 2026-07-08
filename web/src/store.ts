import { create } from "zustand";
import { persist } from "zustand/middleware";
import { vaultGetSavings, vaultGetBufferCredit, vaultGetLockUntil } from "./lib/vault";

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
  kind: "needs" | "savings" | "buffer" | "invest";
}

export interface ActivityItem {
  id: string;
  kind: "split" | "withdraw" | "offramp" | "deposit" | "invest";
  title: string;
  amountUsdc: number;
  txHash?: string;
  at: string; // ISO
  bucket?: string;
}

interface ShuntState {
  address: string | null;
  walletId: string | null;
  network: "testnet" | "mainnet";
  buckets: Bucket[];
  rulesSavedOnChain: boolean;
  lockUntil: number; // unix seconds
  lockSecs: number; // timelock duration chosen in Configure Shunt
  /** wallet + vault balances in USDC (display); invest = DCA cost basis */
  balances: { needs: number; savings: number; buffer: number; invest: number };
  /** XLM units accumulated by the Invest lane's DCA conversions (F12) */
  investXlm: number;
  /** On-chain native XLM balance (Level 1 requirement) */
  xlmBalance: string | null;
  activity: ActivityItem[];
  toast: string | null;

  setAddress: (a: string | null) => void;
  setWalletId: (w: string | null) => void;
  setBuckets: (b: Bucket[]) => void;
  setBucketPct: (id: string, pct: number) => void;
  addBucket: (name: string, kind: "needs" | "savings" | "buffer" | "invest") => void;
  removeBucket: (id: string) => void;
  markRulesSaved: () => void;
  setLockSecs: (s: number) => void;
  setXlmBalance: (b: string) => void;
  applySplit: (amount: number, txHash?: string) => void;
  withdrawSavings: (amount: number, penalty: number) => void;
  offramp: (amount: number) => void;
  /** F11: record a Top Up request sent to the anchor (funds land later as a normal inflow). */
  recordTopUp: (amount: number) => void;
  /** F12: record a DCA conversion of the invest slice (real tx or labeled simulation). */
  applyInvestConversion: (usd: number, xlm: number, txHash?: string, simulated?: boolean) => void;
  setLockUntil: (t: number) => void;
  showToast: (msg: string) => void;
  clearToast: () => void;
  syncFromChain: (address: string) => Promise<void>;
}

const EXTRA_COLORS = ["var(--color-bucket-extra-1)", "var(--color-bucket-extra-2)", "#818cf8", "#34d399", "#f87171"];

export const DEFAULT_BUCKETS: Bucket[] = [
  { id: "needs", name: "Needs", pct: 50, color: "var(--color-bucket-needs)", kind: "needs" },
  { id: "savings", name: "Savings", pct: 25, color: "var(--color-bucket-savings)", kind: "savings" },
  { id: "buffer", name: "Buffer", pct: 15, color: "var(--color-bucket-buffer)", kind: "buffer" },
  { id: "invest", name: "Invest", pct: 10, color: "var(--color-bucket-extra-1)", kind: "invest" },
];

/** Core lanes that cannot be removed in Configure Shunt. */
export const CORE_BUCKET_IDS = ["needs", "savings", "buffer", "invest"];

export const useShunt = create<ShuntState>()(
  persist(
    (set, get) => ({
      address: null,
      walletId: null,
      network: "testnet",
      buckets: DEFAULT_BUCKETS,
      rulesSavedOnChain: false,
      lockUntil: 0,
      lockSecs: 30 * 86400,
      balances: { needs: 0, savings: 0, buffer: 0, invest: 0 },
      investXlm: 0,
      xlmBalance: null,
      activity: [],
      toast: null,

      setAddress: (address) => set({ address }),
      setWalletId: (walletId) => set({ walletId }),
      setBuckets: (buckets) => set({ buckets }),
      setBucketPct: (id, pct) =>
        set({
          buckets: get().buckets.map((b) =>
            b.id === id ? { ...b, pct: Math.max(0, Math.min(100, Math.round(pct))) } : b,
          ),
        }),
      addBucket: (name, kind) => {
        const buckets = get().buckets;
        const extraCount = buckets.length - 4;
        if (extraCount >= EXTRA_COLORS.length) return; // max lanes limit
        // assign a slightly varied color based on kind, or use extra colors
        const color = EXTRA_COLORS[extraCount % EXTRA_COLORS.length];
        set({
          buckets: [
            ...buckets,
            {
              id: `lane-${Date.now()}`,
              name,
              pct: 0,
              color,
              kind,
            },
          ],
        });
      },
      removeBucket: (id) => {
        if (CORE_BUCKET_IDS.includes(id)) return;
        set({ buckets: get().buckets.filter((b) => b.id !== id) });
      },
      markRulesSaved: () => set({ rulesSavedOnChain: true }),
      setLockSecs: (lockSecs) => set({ lockSecs }),
      setXlmBalance: (xlmBalance) => set({ xlmBalance }),

      applySplit: (amount, txHash) => {
        const { buckets, balances, activity, lockUntil, lockSecs } = get();
        const pctKind = (kind: string) =>
          buckets.filter((b) => b.kind === kind).reduce((sum, b) => sum + b.pct, 0);
          
        const savings = (amount * pctKind("savings")) / 100;
        const buffer = (amount * pctKind("buffer")) / 100;
        const invest = (amount * pctKind("invest")) / 100;
        const needs = amount - savings - buffer - invest;
        // mirror the contract: each savings deposit extends the timelock
        const newLock = Math.floor(Date.now() / 1000) + lockSecs;
        set({
          lockUntil: savings > 0 ? Math.max(lockUntil, newLock) : lockUntil,
          balances: {
            ...balances,
            needs: balances.needs + needs,
            buffer: balances.buffer + buffer,
            invest: balances.invest + invest,
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
        
        // After optimistic local update for needs/invest, trigger a sync to pull the true contract state
        const address = get().address;
        if (address) get().syncFromChain(address);
      },

      withdrawSavings: (amount, penalty) => {
        const { balances, activity } = get();
        set({
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
        // Pull true updated savings/buffer from contract
        const address = get().address;
        if (address) get().syncFromChain(address);
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

      applyInvestConversion: (usd, xlm, txHash, simulated) => {
        const { investXlm, activity } = get();
        set({
          investXlm: investXlm + xlm,
          activity: [
            {
              id: `${Date.now()}-inv`,
              kind: "invest",
              title: `DCA ${fmtUsdc(usd)} USDC → ${xlm.toLocaleString("en-US", { maximumFractionDigits: 2 })} XLM${simulated ? " (simulated rate)" : ""}`,
              amountUsdc: usd,
              txHash,
              at: new Date().toISOString(),
              bucket: "invest",
            },
            ...activity,
          ],
        });
      },

      recordTopUp: (amount) => {
        const { activity } = get();
        set({
          activity: [
            {
              id: `${Date.now()}`,
              kind: "deposit",
              title: "Top Up via anchor (pending)",
              amountUsdc: amount,
              at: new Date().toISOString(),
            },
            ...activity,
          ],
        });
      },

      setLockUntil: (lockUntil) => set({ lockUntil }),
      showToast: (toast) => set({ toast }),
      clearToast: () => set({ toast: null }),

      syncFromChain: async (address: string) => {
        try {
          const savingsBig = await vaultGetSavings(address);
          const bufferCreditBig = await vaultGetBufferCredit(address);
          const lockUntilBig = await vaultGetLockUntil(address);
          
          set((state) => {
            // Buffer is a mix of local wallet buffer + in-vault credit from penalties.
            // When we sync, we ensure savings matches the vault exactly.
            return {
              lockUntil: Number(lockUntilBig),
              balances: {
                ...state.balances,
                savings: Number(savingsBig) / 10000000,
                // We don't overwrite buffer because it tracks the wallet side too,
                // but if we were strictly syncing, we'd need to know the split history.
                // For this MVP fix, we just ensure savings and lock are true on-chain.
              }
            };
          });
        } catch (e) {
          console.warn("Failed to sync from chain (not deployed or RPC error)", e);
        }
      },
    }),
    {
      name: "shunt-store",
      version: 2,
      migrate: (persisted: any, version) => {
        if (version < 1 && persisted) {
          if (Array.isArray(persisted.buckets) && !persisted.buckets.some((b: any) => b.id === "invest")) {
            persisted.buckets = [
              ...persisted.buckets,
              { id: "invest", name: "Invest", pct: 0, color: "var(--color-bucket-extra-1)" },
            ];
          }
          persisted.balances = { invest: 0, ...(persisted.balances ?? {}) };
          persisted.investXlm = persisted.investXlm ?? 0;
        }
        if (version < 2 && persisted) {
          if (Array.isArray(persisted.buckets)) {
            persisted.buckets = persisted.buckets.map((b: any) => ({
              ...b,
              kind: b.kind || (b.id.startsWith("lane-") ? "needs" : b.id),
            }));
          }
        }
        return persisted;
      },
    },
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
