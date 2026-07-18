# Shunt — Design System & Screen Specification

> **Status note (2026-07):** this document is the original pre-implementation
> spec plus its critique notes. Where the shipped app diverged, the tables
> below have been updated to the **as-built** values (source of truth:
> `web/src/styles/tokens.css`). The original open questions in §8 are each
> marked with the decision that was made.

## 1. Product Summary

| Parameter | Value |
|---|---|
| Product Name | Shunt |
| Category | Fintech — auto-split cross-border remittance (USDC on Stellar network) |
| Brand Metaphor | Electrical shunt — one incoming current, split into multiple paths so no single path is overloaded |
| Platform | Responsive web app, **mobile-first** (~390px column, PWA-style), scales to desktop |
| Wallet | Freighter / Albedo / xBull via Stellar Wallets Kit (non-custodial) |
| Core Lanes (as built) | Needs (sky-blue `#38BDF8`), Savings (lime `#CDF14A`), Buffer (amber `#F59E0B`), Invest (violet `#A78BFA`) + user-defined custom lanes |

Resolved: the original "what about a 4th bucket?" question was decided in code — Invest became the 4th core lane (violet), and custom lanes draw from an extension palette (`--color-bucket-extra-1/2`, then indigo/emerald/red), capped at 5 extra lanes.

---

## 2. Design Tokens

### 2.1 Colors (as built — `web/src/styles/tokens.css`)

| Token | Hex | Usage |
|---|---|---|
| `--color-bg-base` | `#060707` | Main background, near-black |
| `--color-bg-elevated` | `#101112` | Cards, modals, elevated surfaces |
| `--color-accent-primary` | `#CDF14A` | Primary CTA, positive indicators, active state ("live-wire" lime) |
| `--color-accent-secondary` | `#38BDF8` | Electric blue — secondary elements |
| `--color-accent-tertiary` | `#A78BFA` | Soft violet — additional differentiator |
| `--color-bucket-needs` | `#38BDF8` | Needs lane (sky-blue — everyday spending) |
| `--color-bucket-savings` | `#CDF14A` | Savings lane (lime — growth / lock-up) |
| `--color-bucket-buffer` | `#F59E0B` | Buffer lane (amber — safety net) |
| `--color-bucket-extra-1` | `#A78BFA` | Invest lane (violet) / first custom lane color |
| `--color-bucket-extra-2` | `#34D399` | Extension palette for further custom lanes |
| `--color-text-primary` | `#F4F5F6` | Primary text on dark background |
| `--color-text-secondary` | `#8C9099` | Secondary/muted text |
| `--color-text-on-accent` | `#0A0C07` | Near-black text on lime/amber surfaces (WCAG) |

Resolved (contrast): the original critique flagged white-on-lime CTA contrast; the shipped tokens define `--color-text-on-accent` (near-black) which every filled button and colored chip uses.

### 2.2 Typography (as built)

| Token | Font | Role |
|---|---|---|
| `--font-heading` | Montserrat | Headings, large numbers (portfolio value), `.numeric` |
| `--font-body` | Plus Jakarta Sans | Body text, microcopy, labels |

(The original spec proposed Space Grotesk / Inter; the build settled on Montserrat / Plus Jakarta Sans during the landing-page design pass.)

### 2.3 Motifs & Iconography

- Main motif: thin circuit-trace lines and a "split node" — one incoming line branching into three paths; this motif must consistently appear in Onboarding (Prompt 1), Home (Prompt 3), Configure Shunt (Prompt 4), and the confirmation modal (Prompt 5).
- Iconography: minimal line icons, with a node/branch icon representing the split concept.
- Cards: rounded corners, soft shadows, loose spacing, large tap targets (minimum target recommended is 44x44px according to mobile touch target conventions, although this number is not explicitly mentioned in the source prompt).

---

## 3. Navigation Architecture (as built)

- **Mobile (<1024px)**: bottom tab bar with Home, Shunt, Activity + a **Menu** tab that opens a drawer listing every lane (including custom ones) and Settings. Savings is reached through its lane entry.
- **Desktop (≥1024px)**: fixed left navigation rail — the three main tabs, a collapsible **Lanes** group (one entry per lane, colored dot), and Settings pinned at the bottom. Dashboard-style screens widen to multi-column (`.split-cols`); form screens stay capped at a comfortable reading width.

Resolved: the breakpoint question from the original spec was decided exactly as recommended — under 1024px is the centered column + tab bar, 1024px and above is the left rail (`tokens.css` app-shell rules).

---

## 4. Screen Inventory

| # | Screen | Main Goal | Key Elements | Primary CTA |
|---|---|---|---|---|
| 1 | Onboarding | Explain value proposition in 3 slides | Split-node hero, progress dots | "Start" |
| 2 | Connect Wallet | Connect Freighter or manual address | Trust badge (Stellar, USDC), manual address fallback | "Connect Freighter" |
| 3 | Home / Dashboard | Portfolio summary and recent activity | 3-segment allocation bar, 3 bucket cards, activity feed, auto-split toast | Implicit (navigate to bucket) |
| 4 | Configure Shunt | Set allocation percentages (core screen) | Split-node diagram, slider/stepper per bucket, 100% total validation | "Save rules" |
| 5 | Auto-split Confirmation | Confirm automatic split results | Split-node animation, nominal breakdown per bucket, execution time, network fee | "Done" |
| 6 | Savings Vault Detail | Savings details and progress | USD/IDR/Gold toggle, growth chart, timelock badge | "Withdraw" / "Change goal" |
| 7 | Send / Pay (off-ramp) | Withdrawal from Needs bucket | Bank transfer/e-wallet/bill card, rate & fee before confirmation | "Continue" |
| 8 | Activity / History | On-chain transaction transparency | Chronological list, filter chips, on-chain explorer tags | — |
| 9 | Settings / Profile | Account settings and preferences | Wallet, Shunt rules, security, display currency, PWA install hint | — |
| 10 | Top Up (on-ramp) | Fund the wallet with IDR via the anchor's hosted SEP-24 deposit | Amount input, rate & fee before confirmation, hosted-flow handoff note, pending status | "Top up" |
| 11 | Request Payment | Generate a SEP-7 payment link/QR to get paid from abroad | Amount + note inputs, generated `web+stellar:pay` URI, copy/share buttons, payer-view explainer | "Create link" |

Sprint additions (P0.5, Jul 4–15): the Invest lane appears as a 4th slider in screen 4 (Configure Shunt) using the established extension palette (violet `#A78BFA`), and as a 4th card on screen 3 (Home) showing XLM units + USD value with a "converted after split" caption. Screen 7 gains a sibling: the flow in/out pair (Top Up / Send & Pay) should be visually symmetric — same rate-and-fee-before-confirm card pattern.

Later additions (as built): **12 — Lane Detail** (`/lane/:id`, one page per lane incl. custom lanes: balance, lane-specific actions such as the Invest manual buy and Buffer-credit withdraw, lane activity) and **13 — Public Payer Page** (`/pay`, the SEP-7 payment-request landing a payer opens with no wallet connected). Total: 13 screens.

---

## 5. Critical Component Specifications

### 5.1 Allocation Bar (Home) and Split-Node Diagram (Configure Shunt)

Both components represent the same data (allocation percentages of three buckets) in two different visual forms. Implementation risk: if both are hardcoded separately instead of reading from the same state/rule engine, inconsistencies will arise between what is displayed on Home and what is configured in Configure Shunt after the user changes rules. Technical specifications must assert that these two components are two representations of a single data source (single source of truth at the state management level), not two independent components.

### 5.2 100% Total Validation

Prompt 4 mentions "must total 100%" with a lime check indicator when validated, but does not define system behavior when the total is not yet 100% — whether the "Save rules" button is disabled, whether an inline error message appears, or whether the system auto-adjusts other sliders proportionally. This ambiguity must be resolved before development, because these three approaches have significantly different UX implications and implementation complexities.

### 5.3 Timelock on Savings

Prompt 6 mentions an early withdrawal penalty that goes to Buffer, but the penalty amount (percentage or fixed nominal) is not defined at the design layer, nor is there a reference to the Soroban smart contract logic. This is a business parameter that must be locked as an explicit variable (e.g., "penalty = X% of nominal withdrawn before lock date"), not left as a generic text "early withdrawal penalty goes to Buffer" on the UI.

### 5.4 Oracle for Currency Conversion

The "USD / IDR / Gold" toggle in Prompt 6 assumes the existence of a reliable price oracle for all three denominations, including gold. The source document does not mention the oracle source, update frequency, or UI behavior when the oracle fails or data is stale — this is a gap that must be closed at the backend/smart contract technical specification level before the frontend team builds this toggle component.

---

## 6. Responsive Behavior

- **Base breakpoint**: ~390px application column on mobile; scaling to desktop is done with one of the two patterns in Section 3.
- **Full-width cards** on mobile; on desktop, cards can be arranged in a grid if the 2-column layout is selected.
- **Bottom tab bar → left rail** as a primary navigation transformation, not just repositioning the same elements.

---

## 7. Microcopy (English translation reference)

| Context | Microcopy |
|---|---|
| Onboarding headline | "Incomes in, instantly split." |
| Onboarding sub | "Set it once, the rest is automatic." |
| Connect wallet note | "Non-custodial — keys remain yours." |
| Auto-split toast | "Income received — split automatically ✓" |
| Configure Shunt note | "Every incoming income is automatically split according to these rules." |
| Confirmation | "Automatically split in 8 seconds" |
| Savings note | "Stored in hard value — resists currency depreciation." |
| Off-ramp note | "Sent via anchor — rate & fees displayed before confirmation." |

Note: the "8 seconds" figure in the auto-split confirmation and "< Rp2" for network fees appear to be illustrative placeholders from the design prompt, not verified numbers against actual Stellar network conditions (ledger confirmation times and base fee costs may vary). These figures must not be brought as-is into production UI without validation against real network conditions.

---

## 8. Recommended Next Steps — all resolved in the build

1. ✅ Desktop breakpoint locked at 1024px (Section 3; `tokens.css`).
2. ✅ 100% validation: save button disabled while total ≠ 100%, inline "X% left to allocate" status, over-allocation clamped with a visible hint, plus a one-tap "add remainder to Needs" fix (Section 5.2; `ConfigureShunt.tsx`).
3. ✅ Timelock penalty locked as a contract constant: `PENALTY_BPS = 1_000` (10%), penalty credited to the user's own Buffer credit (Section 5.3; `contracts/shunt-vault/src/lib.rs`).
4. ✅ Oracle: display-only rates with 10-minute cache and labeled fallbacks — IDR via open.er-api.com, XLM and gold (PAXG→per-gram) via CoinGecko (Section 5.4; `web/src/lib/rates.ts`). Funds never convert on these rates; DEX swaps quote Horizon pathfinding live.
5. ✅ Contrast: near-black `--color-text-on-accent` on all lime/amber surfaces (Section 2.1).
6. ✅ Extension palette for lane #5+ defined (`EXTRA_COLORS` in `web/src/store.ts`), max 5 custom lanes.