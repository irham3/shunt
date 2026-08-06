import { create } from "zustand";
import { persist } from "zustand/middleware";
import { vaultGetSavings, vaultGetBufferCredit, vaultGetLockUntil, vaultGetGoals, vaultGetUnallocatedSavings, vaultGetRules, type Goal as ChainGoal } from "./lib/vault";
import { fetchAccountBalances } from "./lib/stellar";
import { createRampActivity } from "./lib/ramp-activity";
import type { PaymentReceipt } from "./lib/payment-request";

export interface V2Policy {
  owner: string;
  spendDestination: string;
  emergencyTarget: number; // in USDC
  emergencyTopupBps: number;
  obligationBps: number;
  obligationCooldownSeconds: number;
  goalBps: number;
  goalLockSeconds: number;
  version: number;
  active: boolean;
}

export interface V2BucketBalances {
  emergency: number; // in USDC
  obligation: number;
  goalTotal: number;
  spendable: number;
}

export interface V2GoalLot {
  lotId: number;
  amountUsdc: number;
  createdAt: number;
  unlockAt: number;
  claimed: boolean;
}

export interface V2ObligationWithdrawal {
  withdrawalId: number;
  amountUsdc: number;
  createdAt: number;
  executeAfter: number;
}

export function computeWaterfallAllocation(
  gross: number,
  emergencyBalance: number,
  emergencyTarget: number,
  emergencyTopupBps: number,
  obligationBps: number,
  goalBps: number
) {
  const gap = Math.max(0, emergencyTarget - emergencyBalance);
  const cap = (gross * emergencyTopupBps) / 10000;
  const emergency = Math.min(gap, cap);

  const afterEmergency = gross - emergency;
  const obligation = (afterEmergency * obligationBps) / 10000;

  const afterObligation = afterEmergency - obligation;
  const goal = (afterObligation * goalBps) / 10000;

  const spendable = Math.max(0, gross - emergency - obligation - goal);
  return { gross, emergency, obligation, goal, spendable };
}

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
  /** This goal's own unlock unix timestamp (laddered — independent of the
   *  aggregate lockUntil). 0/past = unlocked. */
  unlockAt: number;
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
  /** XLM units accumulated by the Invest lane's DCA conversions while the
      Invest toggle was set to XLM at purchase time (F12). Tracked separately
      from investGoldHeld so switching the toggle never mixes two different
      units into one ambiguous number. */
  investXlmHeld: number;
  /** TXAUM (testnet demo gold) units accumulated the same way, while the
      toggle was set to GOLD. */
  investGoldHeld: number;
  /** Legacy: USDC earmarked for Invest that never left the wallet. This only
      ever accrued from the reference-rate simulation, which has been removed
      ("real over mock") — an invest slice that can't fill on-chain now simply
      stays as spendable wallet USDC. Retained (always 0) for persisted-state
      compatibility; still subtracted in Home's unsplit-USDC heuristic. */
  investWalletUsdc: number;
  /** Which asset the Invest lane buys. XLM = live testnet DEX liquidity;
      GOLD = TXAUM, Shunt's own testnet demo gold token (stands in for
      Matrixdock XAUm, which only trades on mainnet) with real seeded DEX
      liquidity (scripts/issue-demo-assets.mjs). Falls back to a labeled
      reference-rate simulation only if that liquidity is thin. */
  investAsset: "XLM" | "GOLD";
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
  /** Threshold Buffer auto-refill target, in USDC (0 = feature off). Stored
   *  on-chain in Rules.buffer_target; the actual per-split shortfall is
   *  computed client-side from this vs. the current wallet Buffer estimate
   *  and passed to distribute() as buffer_topup (see lib/vault.ts docs). */
  bufferTarget: number;
  /** Opt-in behavioral nudge: the Savings lane's % climbs by `stepPct` after
   *  every `everyNSplits` successful splits, capped at `capPct`. Purely
   *  app-layer — implemented as a follow-up real set_rules call, never
   *  silent (AutoSplitConfirm shows what changed and why). */
  autoEscalate: { enabled: boolean; stepPct: number; capPct: number; everyNSplits: number };
  /** Splits completed since the last auto-escalation bump. */
  splitsSinceEscalation: number;
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
  setBufferTarget: (usdc: number) => void;
  setAutoEscalate: (a: Partial<ShuntState["autoEscalate"]>) => void;
  /** Called after each successful split; bumps Savings % on-chain once the
   *  configured cadence is hit. Returns the new pct if it escalated, else null. */
  maybeEscalateSavings: () => number | null;
  setInvestAsset: (a: "XLM" | "GOLD") => void;
  setXlmBalance: (b: string) => void;
  /** One Horizon round-trip: refresh XLM + USDC wallet balances + trustline. */
  refreshWallet: (address: string) => Promise<void>;
  applySplit: (amount: number, txHash?: string) => void;
  withdrawSavings: (amount: number, penalty: number) => void;
  /** Record a Buffer-credit withdrawal (vault → wallet) in lane bookkeeping + activity. */
  withdrawBufferCredit: (amount: number) => void;
  offramp: (amount: number) => void;
  /** F11: record a Top Up request sent to the anchor (funds land later as a normal inflow). */
  recordTopUp: (amount: number) => void;
  /** F12: record a DCA conversion of the invest slice. Only ever called for a
   *  REAL on-chain conversion (a signed path payment) — there is no simulated
   *  path. If the DEX can't fill, the slice simply stays as spendable USDC. */
  applyInvestConversion: (usd: number, xlm: number, txHash?: string) => void;
  /** Manually buy invest assets using spendable USDC (moves balance from needs
   *  to invest). Real on-chain buys only — no reference-rate simulation. */
  manualInvestBuy: (usd: number, xlm: number, txHash?: string) => void;
  /** Record a direct wallet-to-wallet XLM payment (Send & Pay, XLM tab). */
  recordXlmPayment: (destination: string, amountXlm: string, txHash: string) => void;
  /** Record a direct wallet-to-wallet USDC payment (Send & Pay, USDC transfer). */
  recordUsdcPayment: (destination: string, amountUsdc: string, txHash: string) => void;
  /** Record an in-app XLM ⇄ USDC conversion (Convert tab, DEX path payment). */
  recordConversion: (
    from: "XLM" | "USDC",
    fromAmount: number,
    to: "XLM" | "USDC",
    toAmount: number,
    txHash: string,
  ) => void;
  /** Record a USDC -> local-currency demo asset settle (Send & Pay, real path payment). */
  recordSettle: (assetCode: string, usdcAmount: number, assetAmount: number, txHash: string) => void;
  setLockUntil: (t: number) => void;
  /** Set the client-side-only motivational target for a goal's progress ring. */
  setGoalTarget: (goalId: number, target: number | undefined) => void;
  showToast: (msg: string) => void;
  clearToast: () => void;
  syncFromChain: (address: string) => Promise<void>;

  // V2 Router state & methods (PRD §8 & §9)
  v2Policy: V2Policy;
  v2Balances: V2BucketBalances;
  v2GoalLots: V2GoalLot[];
  v2ObligationWithdrawal: V2ObligationWithdrawal | null;
  v2Receipts: PaymentReceipt[];
  setV2Policy: (patch: Partial<V2Policy>) => void;
  executeV2Route: (payer: string, grossUsdc: number, requestId: string, memo?: string) => PaymentReceipt;
  withdrawV2Emergency: (amountUsdc: number) => void;
  requestV2ObligationWithdrawal: (amountUsdc: number) => number;
  cancelV2ObligationWithdrawal: (withdrawalId: number) => void;
  executeV2ObligationWithdrawal: (withdrawalId: number) => void;
  claimV2GoalLots: (lotIds: number[]) => void;
  addV2Receipt: (receipt: PaymentReceipt) => void;
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
      investXlmHeld: 0,
      investGoldHeld: 0,
      investWalletUsdc: 0,
      investAsset: "XLM",
      goals: [],
      unallocatedSavings: 0,
      xlmBalance: null,
      usdcBalance: null,
      usdcTrustline: false,
      bufferCredit: 0,
      bufferTarget: 0,
      autoEscalate: { enabled: false, stepPct: 1, capPct: 50, everyNSplits: 3 },
      splitsSinceEscalation: 0,
      activity: [],
      toast: null,

      // V2 Defaults
      v2Policy: {
        owner: "",
        spendDestination: "",
        emergencyTarget: 1000,
        emergencyTopupBps: 3000,
        obligationBps: 1000,
        obligationCooldownSeconds: 86400,
        goalBps: 2000,
        goalLockSeconds: 90 * 86400,
        version: 1,
        active: true,
      },
      v2Balances: { emergency: 500, obligation: 150, goalTotal: 400, spendable: 1250 },
      v2GoalLots: [
        {
          lotId: 101,
          amountUsdc: 250,
          createdAt: Date.now() - 30 * 86400 * 1000,
          unlockAt: Date.now() + 60 * 86400 * 1000,
          claimed: false,
        },
        {
          lotId: 102,
          amountUsdc: 150,
          createdAt: Date.now() - 95 * 86400 * 1000,
          unlockAt: Date.now() - 5 * 86400 * 1000,
          claimed: false,
        },
      ],
      v2ObligationWithdrawal: null,
      v2Receipts: [],

      setAddress: (address) => set({ address, rulesSavedOnChain: false }),
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
      setBufferTarget: (bufferTarget) => set({ bufferTarget }),
      setAutoEscalate: (patch) => set({ autoEscalate: { ...get().autoEscalate, ...patch } }),
      maybeEscalateSavings: () => {
        const { autoEscalate, splitsSinceEscalation, buckets } = get();
        if (!autoEscalate.enabled) return null;
        const nextCount = splitsSinceEscalation + 1;
        if (nextCount < autoEscalate.everyNSplits) {
          set({ splitsSinceEscalation: nextCount });
          return null;
        }
        const savingsTotal = buckets.filter((b) => b.kind === "savings").reduce((s, b) => s + b.pct, 0);
        if (savingsTotal >= autoEscalate.capPct) {
          set({ splitsSinceEscalation: 0 }); // cap reached — reset the counter, stop nudging every cycle
          return null;
        }
        // Bump the first (primary) savings-kind bucket; pull the increase
        // from Needs so the total stays 100% without touching Buffer/Invest.
        const primarySavings = buckets.find((b) => b.kind === "savings");
        const needsBucket = buckets.find((b) => b.id === "needs");
        if (!primarySavings || !needsBucket) return null;
        const step = Math.min(autoEscalate.stepPct, autoEscalate.capPct - savingsTotal, needsBucket.pct);
        if (step <= 0) return null;
        set({
          buckets: buckets.map((b) => {
            if (b.id === primarySavings.id) return { ...b, pct: b.pct + step };
            if (b.id === needsBucket.id) return { ...b, pct: b.pct - step };
            return b;
          }),
          splitsSinceEscalation: 0,
        });
        return savingsTotal + step;
      },
      setInvestAsset: (investAsset) => set({ investAsset }),
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
            savings: balances.savings + savings,
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
        
        // After optimistic local update, pull the true state from the network.
        // We delay this by a few seconds because Soroban RPC nodes often lag by
        // a ledger or two, and an immediate query will return stale (pre-tx) state
        // which overwrites the correct optimistic update back to 0.
        const address = get().address;
        if (address) {
          setTimeout(() => {
            get().syncFromChain(address);
            get().refreshWallet(address);
          }, 4000);
        }
      },

      withdrawSavings: (amount, penalty) => {
        const { balances, activity } = get();
        set({
          // The payout lands in the wallet as spendable USDC — credit the
          // Needs bookkeeping so the lane totals keep matching the wallet
          // (the penalty part stays in the vault as Buffer credit).
          balances: { ...balances, needs: balances.needs + (amount - penalty) },
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
        // Pull true updated savings/buffer from contract. Delayed like
        // applySplit: an immediate query often hits a Soroban RPC node that
        // lags a ledger and returns stale (pre-tx) state.
        const address = get().address;
        if (address) {
          setTimeout(() => {
            get().syncFromChain(address);
            get().refreshWallet(address);
          }, 4000);
        }
      },

      withdrawBufferCredit: (amount) => {
        const { balances, activity } = get();
        set({
          // Buffer credit leaves the vault into the wallet — it stays "buffer
          // money", so credit the Buffer lane's bookkeeping.
          balances: { ...balances, buffer: balances.buffer + amount },
          activity: [
            {
              id: `${Date.now()}-bufw`,
              kind: "withdraw",
              title: "Buffer credit withdrawn to wallet",
              amountUsdc: amount,
              at: new Date().toISOString(),
              bucket: "buffer",
            },
            ...activity,
          ],
        });
        const address = get().address;
        if (address) {
          setTimeout(() => {
            get().syncFromChain(address);
            get().refreshWallet(address);
          }, 4000);
        }
      },

      offramp: (amount) => {
        const { activity } = get();
        // No balance change here: clicking "Continue" only opens the
        // anchor's hosted SEP-24 flow (or records a sketched request if the
        // anchor call itself failed) — the actual USDC transfer happens
        // later, inside that hosted flow, whenever the user completes it (or
        // never does). Decrementing Needs immediately (as this used to)
        // desynced the lane bookkeeping from the real on-chain wallet
        // balance the moment a user closed the tab without finishing.
        // Mirrors recordTopUp, which is activity-only for the same reason.
        set({
          activity: [createRampActivity("withdraw", amount), ...activity],
        });
      },

      applyInvestConversion: (usd, xlm, txHash) => {
        const { investXlmHeld, investGoldHeld, activity, investAsset } = get();
        const isGold = investAsset === "GOLD";
        const unit = isGold ? "TXAUM" : "XLM";
        set({
          investXlmHeld: isGold ? investXlmHeld : investXlmHeld + xlm,
          investGoldHeld: isGold ? investGoldHeld + xlm : investGoldHeld,
          activity: [
            {
              id: `${Date.now()}-inv`,
              kind: "invest",
              title: `DCA ${fmtUsdc(usd)} USDC → ${xlm.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${unit}`,
              amountUsdc: usd,
              txHash,
              at: new Date().toISOString(),
              bucket: "invest",
            },
            ...activity,
          ],
        });
      },

      manualInvestBuy: (usd, xlm, txHash) => {
        const { investXlmHeld, investGoldHeld, activity, investAsset, balances } = get();
        const isGold = investAsset === "GOLD";
        const unit = isGold ? "TXAUM" : "XLM";
        set({
          balances: {
            ...balances,
            needs: Math.max(0, balances.needs - usd),
            invest: balances.invest + usd,
          },
          investXlmHeld: isGold ? investXlmHeld : investXlmHeld + xlm,
          investGoldHeld: isGold ? investGoldHeld + xlm : investGoldHeld,
          activity: [
            {
              id: `${Date.now()}-inv-manual`,
              kind: "invest",
              title: `Manual Buy: ${fmtUsdc(usd)} USDC → ${xlm.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${unit}`,
              amountUsdc: usd,
              txHash,
              at: new Date().toISOString(),
              bucket: "invest",
            },
            ...activity,
          ],
        });
        const address = get().address;
        if (address) get().refreshWallet(address);
      },

      recordTopUp: (amount) => {
        const { activity } = get();
        set({
          activity: [createRampActivity("deposit", amount), ...activity],
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

      recordUsdcPayment: (destination, amountUsdc, txHash) => {
        // Called only after the real Horizon payment already succeeded (see
        // SendPay.tsx) — the USDC has genuinely left the wallet, so credit
        // the spend against Needs bookkeeping now. Without this the Needs
        // lane card kept showing pre-send money forever, drifting away from
        // the real on-chain wallet balance shown elsewhere on Home.
        const { activity, balances } = get();
        const amt = Number(amountUsdc);
        const short = `${destination.slice(0, 4)}…${destination.slice(-4)}`;
        set({
          balances: { ...balances, needs: Math.max(0, balances.needs - amt) },
          activity: [
            {
              id: `${Date.now()}`,
              kind: "payment",
              title: `Sent USDC to ${short}`,
              amountUsdc: amt,
              txHash,
              at: new Date().toISOString(),
              bucket: "needs",
            },
            ...activity,
          ],
        });
      },

      recordConversion: (from, fromAmount, to, toAmount, txHash) => {
        const { activity, balances } = get();
        const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
        set({
          // USDC → XLM spends real wallet USDC outside the split mechanism —
          // credit it against Needs bookkeeping like any other outbound USDC
          // payment (recordUsdcPayment), or the lane card keeps showing money
          // that already left. The reverse direction (XLM → USDC) brings NEW
          // USDC in; deliberately left uncategorized so it surfaces via the
          // "unsplit USDC" banner instead of being silently pre-assigned.
          ...(from === "USDC" ? { balances: { ...balances, needs: Math.max(0, balances.needs - fromAmount) } } : {}),
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

      recordSettle: (assetCode, usdcAmount, assetAmount, txHash) => {
        const { activity, balances } = get();
        const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
        set({
          // Real USDC left the wallet to settle into a local-currency asset —
          // credit it against Needs like any other outbound USDC spend.
          balances: { ...balances, needs: Math.max(0, balances.needs - usdcAmount) },
          activity: [
            {
              id: `${Date.now()}-settle`,
              kind: "convert",
              title: `Settled ${fmtUsdc(usdcAmount)} USDC → ${fmt(assetAmount)} ${assetCode}`,
              amountUsdc: usdcAmount,
              txHash,
              at: new Date().toISOString(),
            },
            ...activity,
          ],
        });
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
          // Check if rules exist on-chain for this account. A THROWN error
          // (RPC timeout, transient network hiccup) is not proof the rules
          // are gone — only a clean, successful read that came back null
          // means that. Treating both the same flips rulesSavedOnChain to
          // false on a mere read failure, kicking the user back into edit
          // mode over rules that are actually still saved (2026-07-16: hit
          // by a page reload landing on a lagging RPC replica — the exact
          // failure mode lib/vault.ts's resolveRulesNotSet() already guards
          // against on the keeper-error path; this direct read needed the
          // same discipline).
          let onChainRules: Awaited<ReturnType<typeof vaultGetRules>> | undefined;
          try {
            onChainRules = await vaultGetRules(address);
          } catch {
            onChainRules = undefined;
          }
          if (onChainRules !== undefined) {
            set({ rulesSavedOnChain: onChainRules !== null });
          }

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
              unlockAt: Number(g.unlock_at),
            }));

            const nextState: Partial<ShuntState> = {
              lockUntil: Number(lockUntilBig),
              goals,
              unallocatedSavings: Number(unallocatedBig) / 10_000_000,
              bufferCredit: Number(bufferCreditBig) / 10_000_000,
              balances: {
                ...state.balances,
                savings: Number(savingsBig) / 10000000,
              }
            };

            if (onChainRules) {
              // On-chain needs_bps = Needs + Invest (the contract only has 3
              // lanes; invest stays wallet-side). So we compare savings & buffer
              // individually, and needs+invest as a group.
              const chainNeedsInvestPct = Number(onChainRules.needs_bps) / 100;
              const chainSavingsPct = Number(onChainRules.savings_bps) / 100;
              const chainBufferPct = Number(onChainRules.buffer_bps) / 100;

              nextState.lockSecs = Number(onChainRules.lock_secs);
              nextState.bufferTarget = Number(onChainRules.buffer_target) / 10_000_000;

              const pctKind = (kind: string) =>
                state.buckets.filter((b) => b.kind === kind).reduce((sum, b) => sum + b.pct, 0);

              const localNeedsInvest = pctKind("needs") + pctKind("invest");

              if (
                localNeedsInvest !== chainNeedsInvestPct ||
                pctKind("savings") !== chainSavingsPct ||
                pctKind("buffer") !== chainBufferPct
              ) {
                // Local state is out of sync with blockchain (e.g. fresh device
                // or another device saved different rules). Adjust buckets to
                // match on-chain totals while preserving custom lane structure.
                const scaledBuckets = state.buckets.map(b => {
                  const kindTotal = pctKind(b.kind);
                  if (kindTotal === 0) return b; // avoid division by zero
                  const ratio = b.pct / kindTotal; // this bucket's share within its kind
                  let chainTotal: number;
                  if (b.kind === "needs" || b.kind === "invest") {
                    chainTotal = chainNeedsInvestPct;
                    // Split the combined needs+invest budget: invest lanes
                    // keep their proportional share, needs gets the rest.
                    const investTotal = pctKind("invest");
                    const needsTotal = pctKind("needs");
                    if (b.kind === "invest") {
                      const investShare = needsTotal + investTotal > 0
                        ? investTotal / (needsTotal + investTotal)
                        : 0;
                      chainTotal = Math.round(chainNeedsInvestPct * investShare);
                    } else {
                      const needsShare = needsTotal + investTotal > 0
                        ? needsTotal / (needsTotal + investTotal)
                        : 1;
                      chainTotal = Math.round(chainNeedsInvestPct * needsShare);
                    }
                  } else if (b.kind === "savings") {
                    chainTotal = chainSavingsPct;
                  } else {
                    chainTotal = chainBufferPct;
                  }
                  return { ...b, pct: Math.round(chainTotal * ratio) };
                });

                // Per-bucket rounding can leave the total a point or two off
                // 100% (which blocks the save button) — fold the remainder
                // into the largest bucket.
                const scaledTotal = scaledBuckets.reduce((s, b) => s + b.pct, 0);
                const chainTotal = chainNeedsInvestPct + chainSavingsPct + chainBufferPct;
                const drift = chainTotal - scaledTotal;
                if (drift !== 0 && scaledBuckets.length > 0) {
                  const largest = scaledBuckets.reduce((a, b) => (b.pct > a.pct ? b : a));
                  largest.pct = Math.max(0, largest.pct + drift);
                }

                // If no existing buckets (fresh state), fall back to defaults
                if (scaledBuckets.length === 0) {
                  const defaultInvest = Math.min(10, chainNeedsInvestPct);
                  nextState.buckets = DEFAULT_BUCKETS.map(b => {
                    if (b.kind === "needs") return { ...b, pct: chainNeedsInvestPct - defaultInvest };
                    if (b.kind === "savings") return { ...b, pct: chainSavingsPct };
                    if (b.kind === "buffer") return { ...b, pct: chainBufferPct };
                    if (b.kind === "invest") return { ...b, pct: defaultInvest };
                    return b;
                  });
                } else {
                  nextState.buckets = scaledBuckets;
                }
              }
            }

            return nextState;
          });
        } catch (e) {
          console.warn("Failed to sync from chain (not deployed or RPC error)", e);
        }
      },

      setV2Policy: (patch) => {
        const prev = get().v2Policy;
        set({
          v2Policy: {
            ...prev,
            ...patch,
            version: prev.version + 1,
          },
          toast: "Income routing policy updated successfully (v" + (prev.version + 1) + ")",
        });
      },

      executeV2Route: (payer, grossUsdc, requestId, _memo) => {
        const { v2Policy, v2Balances, v2GoalLots } = get();
        const alloc = computeWaterfallAllocation(
          grossUsdc,
          v2Balances.emergency,
          v2Policy.emergencyTarget,
          v2Policy.emergencyTopupBps,
          v2Policy.obligationBps,
          v2Policy.goalBps
        );

        const newBalances = {
          emergency: v2Balances.emergency + alloc.emergency,
          obligation: v2Balances.obligation + alloc.obligation,
          goalTotal: v2Balances.goalTotal + alloc.goal,
          spendable: v2Balances.spendable + alloc.spendable,
        };

        const nextLots = [...v2GoalLots];
        if (alloc.goal > 0) {
          nextLots.push({
            lotId: Date.now(),
            amountUsdc: alloc.goal,
            createdAt: Date.now(),
            unlockAt: Date.now() + v2Policy.goalLockSeconds * 1000,
            claimed: false,
          });
        }

        const receipt: PaymentReceipt = {
          requestId,
          payer,
          recipient: v2Policy.owner || get().address || "G_RECIP",
          gross: String(alloc.gross),
          emergency: String(alloc.emergency),
          obligation: String(alloc.obligation),
          goal: String(alloc.goal),
          spendable: String(alloc.spendable),
          policyVersion: v2Policy.version,
          timestamp: Date.now(),
          txHash: "0x" + Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10),
        };

        set({
          v2Balances: newBalances,
          v2GoalLots: nextLots,
          v2Receipts: [receipt, ...get().v2Receipts],
          activity: [
            {
              id: requestId,
              kind: "split",
              title: `Routed ${grossUsdc} USDC from ${payer.slice(0, 4)}...`,
              amountUsdc: grossUsdc,
              at: new Date().toISOString(),
              txHash: receipt.txHash,
            },
            ...get().activity,
          ],
          toast: `Payment of ${grossUsdc} USDC routed cleanly across reserves!`,
        });

        return receipt;
      },

      withdrawV2Emergency: (amountUsdc) => {
        const balances = get().v2Balances;
        if (amountUsdc > balances.emergency) {
          set({ toast: "Insufficient Emergency reserve balance!" });
          return;
        }
        set({
          v2Balances: {
            ...balances,
            emergency: balances.emergency - amountUsdc,
            spendable: balances.spendable + amountUsdc,
          },
          activity: [
            {
              id: "em-" + Date.now(),
              kind: "withdraw",
              title: `Withdrew ${amountUsdc} USDC from Emergency reserve`,
              amountUsdc,
              at: new Date().toISOString(),
              bucket: "buffer",
            },
            ...get().activity,
          ],
          toast: `Withdrew ${amountUsdc} USDC instantly from Emergency reserve`,
        });
      },

      requestV2ObligationWithdrawal: (amountUsdc) => {
        const balances = get().v2Balances;
        if (amountUsdc > balances.obligation) {
          set({ toast: "Insufficient Obligation reserve balance!" });
          return 0;
        }
        const wid = Date.now();
        set({
          v2ObligationWithdrawal: {
            withdrawalId: wid,
            amountUsdc,
            createdAt: Date.now(),
            executeAfter: Date.now() + get().v2Policy.obligationCooldownSeconds * 1000,
          },
          toast: `Obligation withdrawal requested. Cooldown period started.`,
        });
        return wid;
      },

      cancelV2ObligationWithdrawal: (_withdrawalId) => {
        set({
          v2ObligationWithdrawal: null,
          toast: `Pending obligation withdrawal cancelled.`,
        });
      },

      executeV2ObligationWithdrawal: (_withdrawalId) => {
        const req = get().v2ObligationWithdrawal;
        if (!req) return;
        if (Date.now() < req.executeAfter) {
          set({ toast: "Cooldown period has not elapsed yet!" });
          return;
        }
        const balances = get().v2Balances;
        set({
          v2Balances: {
            ...balances,
            obligation: balances.obligation - req.amountUsdc,
            spendable: balances.spendable + req.amountUsdc,
          },
          v2ObligationWithdrawal: null,
          activity: [
            {
              id: "ob-" + Date.now(),
              kind: "withdraw",
              title: `Executed Obligation withdrawal (${req.amountUsdc} USDC)`,
              amountUsdc: req.amountUsdc,
              at: new Date().toISOString(),
              bucket: "needs",
            },
            ...get().activity,
          ],
          toast: `Obligation withdrawal of ${req.amountUsdc} USDC executed successfully!`,
        });
      },

      claimV2GoalLots: (lotIds) => {
        let totalClaimed = 0;
        const now = Date.now();
        const nextLots = get().v2GoalLots.map((lot) => {
          if (lotIds.includes(lot.lotId) && !lot.claimed && now >= lot.unlockAt) {
            totalClaimed += lot.amountUsdc;
            return { ...lot, claimed: true };
          }
          return lot;
        });

        if (totalClaimed === 0) {
          set({ toast: "No matured goal lots ready to claim." });
          return;
        }

        const balances = get().v2Balances;
        set({
          v2Balances: {
            ...balances,
            goalTotal: Math.max(0, balances.goalTotal - totalClaimed),
            spendable: balances.spendable + totalClaimed,
          },
          v2GoalLots: nextLots,
          activity: [
            {
              id: "claim-" + Date.now(),
              kind: "withdraw",
              title: `Claimed matured goal lots (${totalClaimed} USDC)`,
              amountUsdc: totalClaimed,
              at: new Date().toISOString(),
              bucket: "savings",
            },
            ...get().activity,
          ],
          toast: `Successfully claimed ${totalClaimed} USDC from matured goal lots!`,
        });
      },
      addV2Receipt: (receipt) => {
        set({ v2Receipts: [receipt, ...get().v2Receipts] });
      },
    }),
    {
      name: "shunt-store",
      version: 9,
      migrate: (persisted: any, version) => {
        if (version < 9 && persisted) {
          persisted.v2Policy = persisted.v2Policy ?? {
            owner: persisted.address || "",
            spendDestination: "",
            emergencyTarget: 1000,
            emergencyTopupBps: 3000,
            obligationBps: 1000,
            obligationCooldownSeconds: 86400,
            goalBps: 2000,
            goalLockSeconds: 90 * 86400,
            version: 1,
            active: true,
          };
          persisted.v2Balances = persisted.v2Balances ?? { emergency: 500, obligation: 150, goalTotal: 400, spendable: 1250 };
          persisted.v2GoalLots = persisted.v2GoalLots ?? [
            { lotId: 101, amountUsdc: 250, createdAt: Date.now() - 30 * 86400 * 1000, unlockAt: Date.now() + 60 * 86400 * 1000, claimed: false },
            { lotId: 102, amountUsdc: 150, createdAt: Date.now() - 95 * 86400 * 1000, unlockAt: Date.now() - 5 * 86400 * 1000, claimed: false }
          ];
          persisted.v2ObligationWithdrawal = persisted.v2ObligationWithdrawal ?? null;
          persisted.v2Receipts = persisted.v2Receipts ?? [];
        }
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
          // Savings goals — new on-chain contract field, populated on next syncFromChain.
          persisted.goals = persisted.goals ?? [];
          persisted.unallocatedSavings = persisted.unallocatedSavings ?? 0;
        }
        if (version < 4 && persisted) {
          // Real on-chain wallet balances + vault buffer credit, filled on next refresh.
          persisted.usdcBalance = persisted.usdcBalance ?? null;
          persisted.usdcTrustline = persisted.usdcTrustline ?? false;
          persisted.bufferCredit = persisted.bufferCredit ?? 0;
        }
        if (version < 5 && persisted) {
          // Invest-asset picker (XLM default; GOLD = XAUm).
          persisted.investAsset = persisted.investAsset ?? "XLM";
        }
        if (version < 6 && persisted) {
          // Invest-slice USDC still sitting in the wallet (simulated DCA).
          persisted.investWalletUsdc = persisted.investWalletUsdc ?? 0;
        }
        if (version < 7 && persisted) {
          // Buffer threshold auto-refill target + Savings auto-escalation.
          persisted.bufferTarget = persisted.bufferTarget ?? 0;
          persisted.autoEscalate = persisted.autoEscalate ?? {
            enabled: false, stepPct: 1, capPct: 50, everyNSplits: 3,
          };
          persisted.splitsSinceEscalation = persisted.splitsSinceEscalation ?? 0;
          // The vault was redeployed (new contract ID) to ship laddered goal
          // timelocks + buffer auto-refill — a stale "saved" flag would point
          // at rules that only ever existed on the OLD contract. Force a
          // fresh on-chain check instead of trusting it (same failure mode
          // diagnosed 2026-07-16: rules genuinely saved, just on an
          // abandoned instance).
          persisted.rulesSavedOnChain = false;
        }
        if (version < 8 && persisted) {
          // investXlm used to be one field whose unit meaning silently
          // changed with the investAsset toggle — buy XLM, flip to GOLD, buy
          // gold, and the two got summed as if they were the same unit. Split
          // into two real fields; the old number can only be attributed to
          // whichever asset was active at the time it was last read.
          const legacy = persisted.investXlm ?? 0;
          persisted.investXlmHeld = persisted.investAsset === "GOLD" ? 0 : legacy;
          persisted.investGoldHeld = persisted.investAsset === "GOLD" ? legacy : 0;
          delete persisted.investXlm;
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
  return "Rp" + Math.round(n).toLocaleString("id-ID");
}

export function totalPct(buckets: Bucket[]): number {
  return buckets.reduce((s, b) => s + b.pct, 0);
}
