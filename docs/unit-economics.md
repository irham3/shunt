# Shunt — Unit Economics (illustrative model)

> Every number below is an **explicit assumption**, not a measured result. The
> point is not to claim precision we don't have — it's to show the fee model
> has a defensible path to positive contribution margin, and to make the
> assumptions attackable so a reviewer can plug in their own.

## 1. The persona we model

An overseas-earning freelancer / remote worker in Indonesia who invoices in
USD and receives **USDC** on Stellar.

| Input | Base | Range tested |
| --- | --- | --- |
| Monthly income processed per active user | **$2,000** | $1,000 – $3,000 |
| Split: Needs / Savings / Buffer / Invest | 50 / 25 / 15 / 10 | user-set |
| Share of Needs actually cashed out to IDR each month | **70%** | 40% – 100% |
| Share of income arriving via Top Up (vs. direct payment link) | **30%** | 0% – 60% |

## 2. Where revenue actually comes from

Shunt charges a **service fee on the edges of the loop** — never on the money
sitting still. Income landing via a payment link is free; savings deposits and
post-lock withdrawals are free, forever.

| Fee line | Rate | Status in code |
| --- | --- | --- |
| Cash-out (Needs → IDR, SEP-24 withdraw) | **0.40%** | live (`SendPay.tsx`) |
| Top Up (IDR → USDC, SEP-24 deposit) | **0.35%** | live (`TopUp.tsx`) |
| Invest / Convert (USDC ⇄ XLM path payment) | **0.40%** | planned |

## 3. ARPU (monthly, per active user) — base case

| Line | Basis | Rate | Revenue |
| --- | --- | --- | --- |
| Cash-out | $2,000 × 50% Needs × 70% cashed out = $700 | 0.40% | **$2.80** |
| Top Up | $2,000 × 30% via top-up = $600 | 0.35% | **$2.10** |
| Invest/Convert | $2,000 × 10% Invest = $200 | 0.40% | **$0.80** |
| **ARPU (gross)** | | | **≈ $5.70 / user / month** |

Blended take-rate on total processed volume ≈ **0.29%**.

**Context that makes this defensible:** this ~0.29% is *Shunt's own* service
fee, not the user's total landed cost. A fiat anchor charges its own fee on top,
so the true end-to-end cost (on-ramp + spread + Shunt fee + anchor cash-out fee)
depends on the selected anchor and corridor and would be benchmarked before
launch. Against incumbents that cost users **5–7%**, Shunt's own fee is a small
fraction of that — there is real pricing headroom — but we deliberately do **not**
claim a headline "15–20× cheaper" multiple, because that compares Shunt's service
fee alone to a competitor's all-in cost.

## 4. Contribution margin

Marginal cost per transaction is near-zero by design:

- On-chain fees: **sub-cent**, paid by the user's wallet, not Shunt.
- Infra: Cloudflare Workers (free tier, cron doesn't sleep) + public Horizon.
- The anchor charges **its own** fee to the user separately — Shunt's 0.40% is
  on top, so it is not eroded by anchor cost.

Assume **85% gross margin** to cover support/tooling overhead allocated per user:

**Contribution ≈ $5.70 × 85% ≈ $4.85 / user / month** → **~$58 / user / year.**

## 5. CAC, payback, LTV

GTM leans on community + referral, with **interest-free positioning** (all
revenue is service fee, no interest, no lending or yield) as a distribution
wedge in the target market — a structurally lower-CAC channel than paid
acquisition. A formal sharia-compliance claim would require external review.

| Metric | Base | Note |
| --- | --- | --- |
| CAC | **$15** | community/referral blended; paid would be $30–50 |
| Avg. retention | **18 months** | payroll-adjacent → sticky |
| Contribution / month | **$4.85** | from §4 |
| **Payback period** | **~3.1 months** | CAC / monthly contribution |
| **LTV** | **~$87** | contribution × retention |
| **LTV / CAC** | **~5.8×** | benchmark for "healthy" is ≥ 3× |

## 6. Break-even

At an early-stage fixed cost of **~$2,000/month** (one part-time contractor +
tooling; serverless infra is effectively free at this scale):

**Break-even ≈ $2,000 / $4.85 ≈ ~410 active users.**

## 7. Sensitivity — ARPU vs. income size and cash-out behavior

Gross ARPU ($/user/month), holding top-up at 30% and invest at 10%:

| Cash-out share ↓ / Income → | $1,000 | $2,000 | $3,000 |
| --- | --- | --- | --- |
| 40% of Needs | $2.05 | $4.10 | $6.15 |
| 70% of Needs | $2.85 | $5.70 | $8.55 |
| 100% of Needs | $3.65 | $7.30 | $10.95 |

Even the pessimistic corner ($1,000 income, 40% cash-out → $2.05 ARPU,
~$1.74 contribution) still clears CAC inside ~9 months.

## 8. Upside not in the base case

- **Invest/Convert fee** (0.40%) — modeled small; grows with the DCA habit.
- **B2B "pay-&-split" API** — payroll/marketplace partners paying contractors in
  USDC with Shunt handling the split. Flat SaaS + per-tx, higher ARPU, lower CAC.
- **Premium tier** — multiple vaults, custom lanes, priority anchor corridors.

## 9. What would break this

Stated plainly so it can be defended, not hidden:

1. **Cash-out rate near zero** — if users keep everything in-wallet and spend via
   a card we don't yet issue, the 0.40% line evaporates. Mitigation: the Invest/
   Convert and Top Up lines don't depend on cash-out, and a card program is on
   the roadmap.
2. **Anchor economics in the real corridor** — a production IDR anchor may cap the
   fee we can add. Mitigation: fee is a % we control per corridor via the
   on-chain allowlist; corridor is pluggable (see README).
3. **Retention below 12 months** — collapses LTV/CAC below 4×. This is the number
   to instrument first post-launch.
