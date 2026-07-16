# Shunt — Pitch Deck (content in Markdown)

One `##` = one slide. Speaker notes in the blockquotes. Copy each slide into
Google Slides / PowerPoint / Gamma. Keep on-screen text to the bullets; say the
rest. Target: 10–12 slides, ~5 min. **Everything is testnet — no mainnet claims.**

---

## 1 — Title

**Shunt**
*Income lands. Instantly split.*

A non-custodial financial autopilot on Stellar for people who earn from abroad.

> Track: Local Finance — APAC Stellar Hackathon 2026. Live on testnet.

---

## 2 — The problem (3 quiet leaks)

- **Single-balance trap** — $2,000 lands as one number, feels spendable, gone in 2 weeks. Savings = leftover = zero.
- **Rupiah erosion** — saving in IDR loses value every year (~Rp18,000/USD).
- **No salary, no automation** — irregular income defeats every payroll-based tool. The one clean moment to save is *the instant income arrives*.

> Meet Dina, 27, freelance illustrator in Bandung, ~$2,000/mo from foreign clients. Income irregular; savings "whatever's left" — which is nothing.

---

## 3 — The insight

> The only moment discipline is easy is **payday**. Shunt captures that moment: the
> instant USDC lands, it's split by rules you set once — one tap, on-chain.

Not a remittance app. Shunt works **after** the money lands: split, save, protect value.

---

## 4 — How it works (the loop)

1. **Connect** — Freighter, no sign-up, no custody.
2. **Set rules once** — Needs / Savings / Buffer / Invest (+ optional custom lanes like "Holiday"), saved on-chain (`set_rules`). Badge shows **"Active on-chain"** once saved; fields lock until you click **Edit**.
3. **Income lands** — detected from Horizon in seconds.
4. **One tap** — review the exact per-lane breakdown (including custom lanes), sign. *Nothing moves without you.*
5. **Auto-split** — one atomic Soroban tx: Needs & Buffer stay liquid, Savings locks in the vault.
6. **Reallocate** — changed your mind? Edit rules, re-save, and instantly re-split your existing balance with one tap.

> Emphasize: "automatic" = automatic *detection + preparation*, one-touch confirm. We never over-claim hands-free.

---

## 5 — Where each lane lives (and why)

| Lane | Lives in | Why |
| --- | --- | --- |
| 🟡 Needs | Your wallet | Daily spend; cash out to IDR/PHP when you choose |
| 🟢 **Savings** | **Vault contract** | Value-holding USDC, **locked by code** — a timelock in your own wallet would be fiction |
| 🟢 *Custom savings lanes* | **Vault contract** | Named sub-allocations (e.g. "Holiday", "Education") — same vault, individual tracking |
| 🟤 Buffer | Your wallet | Instant emergency fund, no lock |
| 🟣 Invest *(optional)* | Your wallet | Opt-in growth slice — **XLM** (live) or **Gold / XAUm** (1g LBMA gold on Stellar) |

> The value-preservation promise is **Savings (100% USDC)**. Invest is separate and optional — set it to 0% and the promise is unchanged.

---

## 6 — Live demo

> Screen-share the app (testnet). Beats: connect → set rules (show the "Active
> on-chain" badge) → optionally add a custom lane like "Holiday" → income lands
> (or tap "Simulate incoming income" for a keeper-prepared split against the
> wallet's real balance, no waiting on a transfer; easily fund testnet USDC from the Home screen) → one-tap split (confirm page
> shows every lane including custom ones) → show the explorer hash + `split` event
> → edit rules & **Reallocate** existing balance with new percentages
> → savings vault with the 10%-penalty-to-buffer safety valve
> → multi-asset transfer (USDC/XLM) → anchor cash-out with rate+fee shown first.

**One line to say while the explorer loads:** "Real on-chain, real testnet USDC — here's the hash."

---

## 7 — Why it's trustworthy (the technical moat)

- **Non-custodial by construction** — keeper holds **zero keys**; Savings is code-custody, owner-only withdraw.
- **Double idempotency** — dedupe by tx hash *and* contract rejects repeat `inflow_key`s. One income, one split, ever.
- **19 Soroban unit tests** + **real-testnet e2e** (Playwright, no mocks): exact split, dust (no stroop lost), replay rejection, timelock, goals lifecycle.
- **Verifiable** — every step is a clickable testnet hash.

> This is the differentiator vs. slideware. Lead with it if judges are technical.

---

## 8 — Business model (service fees, never interest)

- 0.40% cash-out · 0.35% Top Up · 0.40% Invest conversion. **No lending, no yield, no cut of savings.**
- 10% early-withdrawal penalty → goes to **your own** Buffer, never to us.
- Blended take-rate **~0.29%** — *illustrative model* vs. 5–7% remittance cost (`docs/unit-economics.md`).
- **Sharia-aligned by design** — all fees are ujrah; Invest is spot purchase (bay'), not riba.

> Say "illustrative" out loud — the corridor comparison is directional, not a live-measured number.

---

## 9 — Corridors & onboarding (honest)

- **Live rail today:** cash-out to **PHP via MoneyGram** (real, on Stellar mainnet — `verify-anchor` proves it). Rupiah is our market, but the live corridor is Philippine peso → **go-to-market is PH-first, Indonesia-next** as the IDR corridor (IDRX / MoneyGram-ID) lands. We name this gap, not hide it.
- **Getting in:** crypto-aware freelancers already hold USDC; payment link (SEP-7) turns "get paid in USD" into the funnel; SEP-24 Top Up for fiat-in.
- **Named gaps:** no live IDR off-ramp yet, plus passkey/smart-wallet UX (Freighter is too heavy for first-timers) — **roadmap**.

> The "rupiah story / PHP proof" mismatch is the sharpest attack an Indonesian judge has. Say it first, on this slide.

---

## 10 — What's real vs. roadmap

| Real today (testnet) | Roadmap |
| --- | --- |
| Atomic on-chain split + code-custody vault | Live regional IDR/PHP anchor |
| Custom lanes (sub-allocations of savings/needs/invest) | Passkey / smart-wallet onboarding |
| Edit mode + instant reallocate with new rules | Session keys (hands-free), AMM 1-sig split+invest |
| SEP-1/10/24 anchor stack + SEP-7 links | Audit → then mainnet |
| Invest lane (XLM or TXAUM, both live) | |
| 26 tests + real-testnet e2e | |

> No mainnet claims. Audit before any real funds.

---

## 11 — Close

> "Income comes in once, one tap, instantly split into its lanes — savings held by
> code, not eroded by the rupiah. Everything you saw runs on-chain on testnet,
> verifiable, non-custodial. That's Shunt — and the savings lane never lies to you."

**Live app** · **GitHub repo** · **Demo video** — links on the submission.

---

### Design notes
- Palette: near-black + one lime accent (matches the app). Font: Montserrat headings.
- Every slide with a number/claim: if it's a projection, label it. Judges trust the honest team.
- If short on time, cut slides 8 and 10; never cut 6 (demo) or 7 (technical moat).
