# Shunt — Demo Video Script (≈3 minutes)

Goal: show the loop working **on testnet** end-to-end, and pre-empt the two
questions judges always ask (custody + "is it real?"). Record screen + voiceover.
Keep the honest boundaries in — they're a differentiator, not a weakness.

> Setup before recording: Freighter on testnet with a funded account + USDC
> trustline; `web` running (`npm run dev`, port 5199) or the live URL; keeper URL
> set; have the Stellar Expert explorer open in a second tab for the proof hash.

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
  timelock, Save → Freighter signs `set_rules`.
- **Say:** "I set the split once — this is stored **on-chain**; the contract is the
  source of truth. Invest is optional — the value-preservation promise is Savings,
  100% USDC."

### [1:00–1:40] Income lands → one-tap split (the core)
- **On screen:** Home shows detected un-split USDC → tap Split → review exact
  breakdown → Freighter signs `distribute` → lanes update.
- **Say:** "Income lands. The app detects it from Horizon, I review the exact
  breakdown, and approve once. One atomic transaction: Needs and Buffer stay in my
  wallet, Savings moves into the vault and the timelock starts."
- **On screen:** open the explorer tab, show the `distribute` tx + `split` event.
- **Say:** "Real on-chain, real testnet USDC — here's the hash, and the split event."

### [1:40–2:10] Savings vault + safety valve
- **On screen:** Savings Vault — show locked balance, a goal, then an early
  withdraw showing the 10% penalty → Buffer credit.
- **Say:** "Savings is held by contract code — a timelock in your own wallet would
  be fiction. Early exit costs 10%, but it's not lost — it goes to your *own*
  buffer. Discipline with a safety valve."

### [2:10–2:35] Cash out (anchor)
- **On screen:** Send & Pay → withdraw → anchor's SEP-24 hosted flow opens, rate +
  fee shown before confirm.
- **Say:** "Cash-out to fiat runs on standard SEP-24 anchor rails. Demo uses SDF's
  test anchor — the production corridor is a licensed regional anchor like IDRX or
  Coins.ph; swapping is config, not a rewrite. Settlement is the anchor's, and we
  say so instead of faking 'instant'."

### [2:35–3:00] Honest close
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
