# Shunt — Demo Video Script (≈3 minutes)

Goal: show the loop working **on testnet** end-to-end, and pre-empt the two
questions judges always ask (custody + "is it real?"). Record screen + voiceover.
Keep the honest boundaries in — they're a differentiator, not a weakness.

> Setup before recording: Freighter on testnet with a funded account + USDC
> trustline; `web` running (`npm run dev`, port 5199) or the live URL; keeper URL
> set; have the Stellar Expert explorer open in a second tab for the proof hash.
> If real income isn't already sitting in the wallet, use the **"Try it
> (simulated income)"** button in Configure Shunt's post-save panel (or
> Settings → Demo fallback → "Simulate incoming income") — it builds a real
> `distribute` XDR against the wallet's actual USDC balance via the keeper, so
> the split that follows is a genuine on-chain transaction, not a mock.
> *(Need USDC? Tap "Swap 1000 XLM for testnet USDC" on the Home screen to instantly fund it via the testnet DEX).*

---

### [0:00–0:20] Hook
- **On screen:** landing page (hero).
- **Say:** "An Indonesian freelancer gets paid $2,000 by a client abroad. It lands
  as one balance, feels spendable, and two weeks later it's gone — savings zero.
  Shunt fixes that at the one moment discipline is easy: the instant income arrives."

### [0:20–0:35] Connect (non-custodial)
- **On screen:** click Connect → Freighter approves.
- **Say:** "Just a browser wallet — no sign-up, no custody. The keeper never holds
  keys; nothing moves without my signature."

### [0:35–1:00] Set rules on-chain
- **On screen:** Configure Shunt — drag sliders Needs/Savings/Buffer/Invest, set
  timelock, Save → Freighter signs `set_rules`. Badge flips to **"Active on-chain"**.
  Optionally add a **custom lane** (e.g. "Holiday", type: savings) to show the
  sub-allocation feature.
- **Say:** "I set the split once — this is stored **on-chain**; the contract is the
  source of truth. See the green badge? That means these rules are live on the
  blockchain. Invest is optional — the value-preservation promise is Savings,
  100% USDC."

### [1:00–1:40] Income lands → one-tap split (the core)
- **On screen:** Home shows detected un-split USDC → tap Split → review exact
  breakdown (showing all lanes including custom ones with clear destination
  labels) → Freighter signs `distribute` → lanes update. (No inflow queued
  yet? Tap "Try it (simulated income)" on Configure Shunt instead — same
  keeper-prepared XDR, same on-chain split, just triggered manually so the
  demo isn't blocked on waiting for a real transfer.)
- **Say:** "Income lands. The app detects it from Horizon, I review the exact
  breakdown — every lane, including custom ones like 'Holiday', shows exactly
  where the funds go — and approve once. One atomic transaction: Needs and
  Buffer stay in my wallet, Savings moves into the vault and the timelock starts."
- **On screen:** open the explorer tab, show the `distribute` tx + `split` event.
- **Say:** "Real on-chain, real testnet USDC — here's the hash, and the split event."

### [1:40–1:55] Reallocate & Edit mode
- **On screen:** go back to Configure Shunt → click **"Edit configuration"** →
  adjust sliders → **"Update on-chain rules"** → Freighter signs → click
  **"Reallocate X USDC with new rules"** to re-split existing balance.
- **Say:** "Changed your mind? Edit mode lets you adjust, re-save to the blockchain,
  then immediately reallocate your existing balance with the new rules — no need
  to wait for new income."

### [1:55–2:20] Savings vault + safety valve
- **On screen:** Savings Vault — show locked balance, a goal, then an early
  withdraw showing the 10% penalty → Buffer credit.
- **Say:** "Savings is held by contract code — a timelock in your own wallet would
  be fiction. Early exit costs 10%, but it's not lost — it goes to your *own*
  buffer. Discipline with a safety valve."

### [2:20–2:45] Cash out & Transfer
- **On screen:** Send & Pay — choose between USDC and XLM for the asset. Show a direct transfer, then withdraw where the anchor's SEP-24 hosted flow opens, rate + fee shown before confirm.
- **Say:** "You can send either USDC or XLM. Cash-out to fiat runs on standard SEP-24 anchor rails. Demo uses SDF's test anchor — the production corridor is a licensed regional anchor like IDRX or Coins.ph; swapping is config, not a rewrite. Settlement is the anchor's, and we say so instead of faking 'instant'."

### [2:45–3:00] Honest close
- **Say:** "What's real today: a 19-test contract, a real-testnet end-to-end suite,
  double idempotency, zero-key keeper — all on **testnet**, no mainnet claims.
  What's next: a live regional anchor, passkey onboarding for non-crypto users, and
  an audit before any mainnet funds. Income in, structured by code, income out —
  and the savings lane never lies to you. That's Shunt."

---

### Recording checklist
- [ ] Testnet only — no mainnet anywhere on screen.
- [ ] Show at least one real explorer hash (the `distribute` split).
- [ ] Keep the "honest boundary" lines — they land with judges.
- [ ] ≤ 3 min; upload unlisted (YouTube/Loom); paste link into SUBMISSION.md.
- [ ] **Before recording against the live URL:** confirm the deployed build is
  current — `cd web && npm run build` must succeed locally with no `tsc`
  errors. A failed Vercel build silently keeps serving the previous good
  deploy, so a broken build never shows up as "down" — it shows up as stale
  bugs already fixed in the repo. If in doubt, record against `npm run dev`.
