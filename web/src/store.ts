import { create } from "zustand";
import { persist } from "zustand/middleware";
import { vaultGetSavings, vaultGetBufferCredit, vaultGetLockUntil, vaultGetGoals, vaultGetUnallocatedSavings, type Goal as ChainGoal } from "./lib/vault";
import { fetchAccountBalances } from "./lib/stellar";

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
  kind: "split" | "withdraw" | "offramp" | "deposit" | "invest" | "payment" | "convert";
  title: string;
  /** USDC-lane items use this; XLM peer-to-peer sends use amountXlm instead. */
  amountUsdc?: number;
  amountXlm?: number;
  txHash?: string;
  at: string; // ISO
  bucket?: string;
}

/**
 * UI-facing savings goal — mirrors the on-chain `Goal` (id/label/amount are
 * the source of truth, synced via syncFromChain) plus an optional `target`,
 * which is a purely client-side motivational number (not a financial
 * constraint) so it doesn't need on-chain storage.
 */
export interface SavingsGoal {
  id: number;
  label: string;
  amountUsdc: number;
  target?: number;
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
  /** Named sub-allocations of the on-chain Savings balance, from syncFromChain. */
  goals: SavingsGoal[];
  /** Savings not currently assigned to any goal (on-chain, from syncFromChain). */
  unallocatedSavings: number;
  /** On-chain native XLM balance (Level 1 requirement) */
  xlmBalance: string | null;
  /** On-chain wallet USDC balance (Horizon — the real spendable dollars). */
  usdcBalance: string | null;
  /** Whether the wallet has a USDC trustline (can receive USDC at all). */
  usdcTrustline: boolean;
  /** On-chain Buffer credit held inside the vault (10% early-exit penalties). */
  bufferCredit: number;
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
  /** One Horizon round-trip: refresh XLM + USDC wallet balances + trustline. */
  refreshWallet: (address: string) => Promise<void>;
  applySplit: (amount: number, txHash?: string) => void;
  withdrawSavings: (amount: number, penalty: number) => void;
  offramp: (amount: number) => void;
  /** F11: record a Top Up request sent to the anchor (funds land later as a normal inflow). */
  recordTopUp: (amount: number) => void;
  /** F12: record a DCA conversion of the invest slice (real tx or labeled simulation). */
  applyInvestConversion: (usd: number, xlm: number, txHash?: string, simulated?: boolean) => void;
  /** Record a direct wallet-to-wallet XLM payment (Send & Pay, XLM tab). */
  recordXlmPayment: (destination: string, amountXlm: string, txHash: string) => void;
  /** Record an in-app XLM ⇄ USDC conversion (Convert tab, DEX path payment). */
  recordConversion: (
    from: "XLM" | "USDC",
    fromAmount: number,
    to: "XLM" | "USDC",
    toAmount: number,
    txHash: string,
  ) => void;
  setLockUntil: (t: number) => void;
  /** Set the client-side-only motivational target for a goal's progress ring. */
  setGoalTarget: (goalId: number, target: number | undefined) => void;
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
      goals: [],
      unallocatedSavings: 0,
      xlmBalance: null,
      usdcBalance: null,
      usdcTrustline: false,
      bufferCredit: 0,
      activity: [],
      toast: null,

      setAddress: (address) => set({ address }),
      setWalletId: (walletId) => set({ walletId }),
      setBuckets: (buckets) => set({ buckets }),
      setBucketPct: (id, pct) => {
        const buckets = get().buckets;
        const current = buckets.find((b) => b.id === id)?.pct ?? 0;
        const othersSum = totalPct(buckets) - current;
        // Clamp against the room left by every other bucket — the total can
        // never exceed 100%. Only the dragged bucket is ever touched; no
        // silent auto-adjust of its siblings (DESIGN.md §5.2 decision).
        const max = Math.max(0, 100 - othersSum);
        set({
          buckets: buckets.map((b) =>
            b.id === id ? { ...b, pct: Math.max(0, Math.min(max, Math.round(pct))) } : b,
          ),
        });
      },
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

      refreshWallet: async (address: string) => {
        try {
          const b = await fetchAccountBalances(address);
          set({ xlmBalance: b.xlm, usdcBalance: b.usdc, usdcTrustline: b.hasUsdcTrustline });
        } catch {
          // transient Horizon error — keep the last known values
        }
      },

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
        
        // After optimistic local update for needs/invest, pull the true state:
        // vault balances from the contract, wallet balances from Horizon.
        const address = get().address;
        if (address) {
          get().syncFromChain(address);
          get().refreshWallet(address);
        }
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

      recordXlmPayment: (destination, amountXlm, txHash) => {
        const { activity } = get();
        const short = `${destination.slice(0, 4)}…${destination.slice(-4)}`;
        set({
          activity: [
            {
              id: `${Date.now()}`,
              kind: "payment",
              title: `Sent XLM to ${short}`,
              amountXlm: Number(amountXlm),
              txHash,
              at: new Date().toISOString(),
            },
            ...activity,
          ],
        });
      },

      recordConversion: (from, fromAmount, to, toAmount, txHash) => {
        const { activity } = get();
        const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
        set({
          activity: [
            {
              id: `${Date.now()}-cvt`,
              kind: "convert",
              title: `Converted ${fmt(fromAmount)} ${from} → ${fmt(toAmount)} ${to}`,
              // Show what arrived, in its own denomination.
              ...(to === "XLM" ? { amountXlm: toAmount } : { amountUsdc: toAmount }),
              txHash,
              at: new Date().toISOString(),
            },
            ...activity,
          ],
        });
        // The swap changed both wallet balances — pull the truth from Horizon.
        const address = get().address;
        if (address) get().refreshWallet(address);
      },

      setGoalTarget: (goalId, target) =>
        set({
          goals: get().goals.map((g) => (g.id === goalId ? { ...g, target } : g)),
        }),

      setLockUntil: (lockUntil) => set({ lockUntil }),
      showToast: (toast) => set({ toast }),
      clearToast: () => set({ toast: null }),

      syncFromChain: async (address: string) => {
        try {
          const savingsBig = await vaultGetSavings(address);
          const bufferCreditBig = await vaultGetBufferCredit(address);
          const lockUntilBig = await vaultGetLockUntil(address);
          const [chainGoals, unallocatedBig] = await Promise.all([
            vaultGetGoals(address),
            vaultGetUnallocatedSavings(address),
          ]);

          set((state) => {
            // Preserve client-side-only `target` values across a re-sync,
            // matched by goal id (the chain has no concept of a target).
            const prevTargets = new Map(state.goals.map((g) => [g.id, g.target]));
            const goals: SavingsGoal[] = chainGoals.map((g: ChainGoal) => ({
              id: Number(g.id),
              label: g.label,
              amountUsdc: Number(g.amount) / 10_000_000,
              target: prevTargets.get(Number(g.id)),
            }));

            // Buffer is a mix of local wallet buffer + in-vault credit from penalties.
            // When we sync, we ensure savings matches the vault exactly.
            return {
              lockUntil: Number(lockUntilBig),
              goals,
              unallocatedSavings: Number(unallocatedBig) / 10_000_000,
              bufferCredit: Number(bufferCreditBig) / 10_000_000,
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
      version: 4,
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
        if (version < 3 && persisted) {
          // Savings goals — new on-chain contract (CB27...), populated on next syncFromChain.
          persisted.goals = persisted.goals ?? [];
          persisted.unallocatedSavings = persisted.unallocatedSavings ?? 0;
        }
        if (version < 4 && persisted) {
          // Real on-chain wallet balances + vault buffer credit, filled on next refresh.
          persisted.usdcBalance = persisted.usdcBalance ?? null;
          persisted.usdcTrustline = persisted.usdcTrustline ?? false;
          persisted.bufferCredit = persisted.bufferCredit ?? 0;
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
