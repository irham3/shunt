# Shunt — 5-Minute Pitch Script (Zoom)

**Format:** Each segment has 3 parts → **SLIDE** (what's on screen) · **SAY** (what you speak) · **SHOW** (PPT or live app).
Strict 5:00. Everything is testnet — no mainnet claims.

---

## 1 — HOOK + TITLE (0:00–0:25)

**SLIDE:** Shunt logo · *"Income lands. Instantly split."* · Non-custodial financial autopilot on Stellar

**SAY:**

> "Sixty million freelancers across Southeast Asia get paid in foreign currency. The money lands as one lump sum, sits in a depreciating local currency, and by month-end savings is zero. Not because they're bad with money — because they never had the *tools*. Shunt fixes this in one tap. Income arrives, one tap, instantly split into its purpose — on-chain, non-custodial, on Stellar."

**SHOW:** Slide only. Clean. Don't touch the app yet.

---

## 2 — THE PROBLEM (0:25–1:05)

**SLIDE:** "3 Silent Leaks" · 1. Single-balance trap · 2. Rupiah erosion (–4% annually) · 3. No payroll = no automation

**SAY:**

> "Three things bleed freelancers dry.
>
> **One — the single-balance trap.** Two thousand dollars lands as one number. It *feels* spendable. Two weeks later, gone. Savings equals leftovers equals zero.
>
> **Two — currency erosion.** Dina is a freelance illustrator in Bandung. If she saves in rupiah, she loses 4% purchasing power every year. Eighteen thousand rupiah per dollar last year — today it's worse.
>
> **Three — no payroll, no automation.** Every budgeting app assumes a regular paycheck. Freelancers don't have that. The only clean moment to enforce discipline is the instant the money arrives. Miss that moment, it's gone."

**SHOW:** Slide only.

---

## 3 — THE SOLUTION: ONE LOOP (1:05–1:35)

**SLIDE:** 5-step loop diagram: Connect → Set rules → Income lands → One tap → Split

**SAY:**

> "Shunt captures that moment. Here's the entire loop:
>
> **Connect** your Stellar wallet — Freighter, no sign-up, no custody. **Set rules once** — Needs 50%, Savings 30%, Buffer 10%, Invest 10%. Add custom lanes like 'Holiday'. Rules are saved on-chain via Soroban smart contract. **Income arrives** — Shunt detects it from Horizon in seconds. **One tap** — review the exact per-lane breakdown, confirm, sign. **Done** — one atomic Soroban transaction. Needs and Buffer stay liquid. Savings locks in the vault. Nothing moves without your explicit signature."

**SHOW:** Slide with loop diagram. Do NOT demo yet.

---

## 4 — LIVE DEMO (1:35–3:15) ⭐

> This is 1 minute 40 seconds. Practice until it's muscle memory. Screen-share the live app.

| Step | What you do | What you say |
|------|-------------|--------------|
| 1 | Show Home screen, wallet connected, balances visible | "This is live on Stellar testnet. Real wallet, real on-chain balances. You can verify every hash." |
| 2 | Navigate to **Configure Shunt**. Point at "Active on-chain" badge. | "Rules are saved on-chain. Needs 50, Savings 30, Buffer 10, Invest 10. This badge means the contract accepted them." |
| 3 | *(Optional)* Add custom lane "Holiday" 5%, reduce Needs to 45%. Save. | "Custom lane — Holiday, 5%. One save. On-chain." |
| 4 | Go to Home. Click **Simulate incoming income**. | "Income just landed. Shunt detected it instantly." |
| 5 | Split confirmation appears. **Pause.** Let judges read. | "Every lane, every amount, broken down to the cent. Needs: 450. Savings: 300. Buffer: 100. Invest: 100. Holiday: 50. Nothing moves until I tap confirm." |
| 6 | Tap **Confirm**. Wait for tx. | "One tap. One atomic Soroban transaction." |
| 7 | Show Stellar Explorer tx hash link. | "Here's the hash. On-chain, verifiable, non-custodial." |
| 8 | Go to **Savings Vault**. Show locked amount. | "Savings is in the vault — locked by code, not by a bank. Early withdrawal? 10% penalty goes to my *own* Buffer, not to Shunt. We never take a cut of your savings." |
| 9 | *(If time)* Show **Grow** — XLM or TXAUM purchase. | "The Invest lane buys XLM or tokenized gold via Stellar DEX — real trades, real hashes." |

**Pre-demo checklist (10 min before):**
- Wallet connected, USDC trustline enabled
- Rules saved ("Active on-chain" badge showing)
- ~1000 test USDC in wallet
- Keeper running (`npm run dev`)
- Stellar Expert tab ready for hash verification

---

## 5 — TECHNICAL MOAT (3:15–3:45)

**SLIDE:** "Why Trust Shunt" · Non-custodial: keeper holds zero keys · Double idempotency · 49 Soroban tests + real-testnet E2E · Every action = clickable hash

**SAY:**

> "Why should you trust this? **Non-custodial by construction** — our keeper backend holds zero private keys. Savings is code-custody, owner-only withdraw. **Double idempotency** — deduplicate by transaction hash, and the contract itself rejects replayed inflow keys. That's Error 6 — try it. **49 Soroban unit tests**, real testnet end-to-end tests via Playwright — no mocked network, no mocked contracts. Every action you just saw is clickable and verifiable on-chain."

**SHOW:** Slide. Optional: screenshot of test output (green checkmarks).

---

## 6 — TARGET USER + GTM (3:45–4:05)

**SLIDE:** "Who & How" · 60M SEA freelancers (ID, PH) · Entry: crypto-aware freelancers with USDC · Growth: SEP-7 payment links · Ramps: MoneyGram (applied), MoonPay sandbox, Transak staging

**SAY:**

> "Beachhead: crypto-aware freelancers in Indonesia and the Philippines already earning in USDC. That's day one. From there, SEP-7 payment links turn 'get paid in USD' into our growth funnel. We have signed MoonPay sandbox sessions and a secure Transak staging flow for USD to native XLM. Neither is presented as live settlement in Indonesia. We've applied to MoneyGram Ramps for cash-in and cash-out at participating locations. Production corridors still depend on provider approval, KYB, and route availability."

**SHOW:** Slide. Flags, numbers, provider logos.

---

## 7 — BUSINESS MODEL + COMPETITORS (4:05–4:25)

**SLIDE:** "Revenue: Service Fees Only" · 0.35% top-up · 0.40% cash-out · 0.40% invest · Blended ~0.29% vs 5–7% remittance cost · vs. Wise (no split) · vs. Acorns (no SEA) · vs. hackathon slideware (no live contract)

**SAY:**

> "Revenue: service fees only. 35 basis points on top-up, 40 on cash-out, 40 on invest. **No lending, no yield, no interest on your savings — ever.** Blended take-rate 29 basis points, compared to 5 to 7 percent for traditional remittance. Versus Wise — they move money but don't split it. Versus Acorns — no crypto, no Southeast Asia. Versus other hackathon projects — we have 49 tests, live contracts, and real hashes. Not slides."

**SHOW:** Slide with comparison table.

---

## 8 — HONEST GAPS + ROADMAP (4:25–4:45)

**SLIDE:** Two columns — ✅ Real today (testnet) | 🔜 Roadmap

| Real today | Roadmap |
|---|---|
| Atomic on-chain split + vault | Live IDR/PHP anchor |
| Custom lanes + reallocate | Passkey onboarding |
| SEP-1/10/24 anchor stack | Audit → mainnet |
| Invest lane (XLM, TXAUM) | |
| 49 tests + E2E | |

**SAY:**

> "What's not done. No live IDR off-ramp yet — the rupiah is our market but the nearest production anchor is Philippine peso, so we start there. No passkey onboarding — Freighter works but it's heavy for first-timers. No mainnet — we audit first, then deploy. Everything you saw today is real, testnet, verifiable. The roadmap items are engineering, not research."

**SHOW:** Slide. Two-column table.

---

## 9 — CLOSE (4:45–5:00)

**SLIDE:** Shunt logo · *"Income lands. One tap. Instantly split."* · Live app · GitHub · Demo video

**SAY (slow down, land it):**

> "Income comes in once. One tap. Instantly split into its lanes. Savings held by code, not eroded by the rupiah. Everything you saw runs on-chain, verifiable, non-custodial. That's Shunt. Thank you."

**SHOW:** Final slide. Logo + links. Done.

---

## Quick reference

| Segment | Duration | Format |
|---|---|---|
| Hook + Title | 0:25 | Slide |
| Problem | 0:40 | Slide |
| Solution Loop | 0:30 | Slide |
| **Live Demo** | **1:40** | **Live App** |
| Technical Moat | 0:30 | Slide |
| Target + GTM | 0:20 | Slide |
| Business + Competitors | 0:20 | Slide |
| Gaps + Roadmap | 0:20 | Slide |
| Close | 0:15 | Slide |
| **Total** | **5:00** | |

## Emergency shortcuts (if running over)

- **Cut Business + Competitors** → "Service fees, no interest, details in submission."
- **Cut Gaps + Roadmap** → only if judges aren't technical.
- **NEVER cut Demo** — that's your entire advantage.
- **NEVER cut Technical Moat** — "49 tests" separates you from slideware.

## 5 lines to memorize

1. "The only moment discipline is easy is payday."
2. "One tap, one atomic Soroban transaction."
3. "Here's the hash — on-chain, verifiable, non-custodial."
4. "We never take a cut of your savings."
5. "49 tests, real testnet end-to-end — not slides."
