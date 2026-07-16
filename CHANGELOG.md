# Changelog

Milestone history of Shunt's build. Grouped by capability milestone; dates are
the real dates work landed (the public repo was initialized late in the build,
so git history is compressed — these milestones reflect the actual scope
progression, not a padded timeline).

---

## v0.9 — Cross-menu nominal audit + 32-spec real-testnet coverage (2026-07-16)

Follow-up pass after v0.8, specifically hunting for money that goes out of
sync between screens and buttons that were never exercised end-to-end.

- **Contract-level gap found (not redeployed):** `withdraw_savings` only
  checks the aggregate vault balance, not what's earmarked in goals — the
  generic Withdraw button could silently drain funds a goal was counting on,
  surfacing later as an out-of-nowhere `InsufficientSavings` when withdrawing
  from that goal. Left the deployed contract untouched (redeploying would
  invalidate the published on-chain proof hashes); capped the generic
  Withdraw input to `unallocated` savings client-side so the app can never
  trigger the gap. Earmarked money now visibly must go through the goal's
  own Withdraw.
- **Bookkeeping desyncs fixed** so lane cards stop drifting from the real
  wallet balance: Cash-out no longer decrements Needs before any on-chain
  transfer has actually happened (mirrors Top Up, which was already
  activity-only); a successful USDC send and a USDC→XLM Convert now both
  credit the spend against Needs, since real money left the wallet either
  way; Savings/goal withdrawal payouts and Buffer-credit withdrawals now
  credit their lane's bookkeeping instead of only showing up in the wallet
  total.
- **Regression caught and fixed:** the friendlier Horizon error message added
  in v0.8 ("Transaction rejected: op_no_trust") collided with the existing
  wallet-cancellation heuristic (`msg.includes("reject")`), so a REAL
  on-chain failure — e.g. sending USDC to a recipient with no trustline —
  was silently reclassified as `USER_REJECTED` and shown as no error at all.
  Reworded to "On-chain error: …".
  found only by the expanded e2e (10-full-coverage.spec.ts) sending to a
  known no-trustline account.
- **Copy fix:** Savings Vault's disabled "Gold 🔜" display toggle read as
  "gold isn't available," contradicting the already-shipped Invest→Gold/XAUm
  lane on Configure Shunt — reworded to "Gold display 🔜" with a tooltip
  pointing at the live feature.
- **UX findings flagged for a product decision (not changed):** Configure
  Shunt's "Simulate incoming income" and "Reallocate X USDC" buttons do the
  literal same thing when wallet balance is under 500 USDC, with no copy
  distinguishing when to use which; "Add custom lane" (a savings-kind lane,
  percentage-of-total estimate) and "Labeled sub-vault" (a goal, real
  on-chain per-name balance) both read as "make a sub-bucket of savings" but
  work completely differently, with nothing in the UI explaining the split.
- **e2e coverage roughly tripled the money-moving surface tested:**
  `10-full-coverage.spec.ts` (9 new specs, all real testnet) exercises the
  Home XLM→USDC swap, a 2-income batch split (two sequential real
  `distribute` calls in one approval), Buffer-credit withdraw, a USDC send
  that correctly refuses a no-trustline recipient then succeeds to a valid
  one, Convert USDC→XLM, Invest manual buy on both XLM and Gold, Reallocate,
  and a same-store-field consistency check between Home and the Savings
  Vault page. Full suite: **32 specs, 31 passed + 1 conditional skip**, run
  twice independently for confirmation (~5.8m each).

## v0.8 — Full-flow bug sweep + green e2e (2026-07-16)

- **Navigation unfroze:** route-level `AnimatePresence mode="wait"` hung under
  React Router v7's startTransition navigation, leaving the previous screen
  permanently on screen — transitions are now enter-only.
- **Numbers unfroze:** `AnimatedNumber` rendered a framer-motion MotionValue as
  a child, which silently stops updating under React 19 + framer-motion 12 —
  every balance/percentage froze at its first-mount value. Rewritten with an
  explicit change subscription.
- **Simulate / Reallocate / Split-now fixed:** the `sim-` prefixed synthetic tx
  hash broke the keeper's hex parse ("inflow tx hash must be 32 bytes, got 0");
  synthetic inflow keys are now plain 32-byte hex (keeper source also hardened
  with a SHA-256 fallback for non-hex hashes).
- **Invest DCA + Convert fixed:** slippage floors were sized from CoinGecko
  mainnet rates and path payments omitted the quoted route's intermediate hops,
  so real conversions always failed `op_under_dest_min`. Quotes now come from
  Horizon strict-send pathfinding and the winning path is passed to the op.
- Invest manual buy validates against the real wallet USDC (was: stale local
  bookkeeping, leaving the Buy button dead). Real-time split-event polling
  fixed (`startLedger: 0` was rejected by RPC). Unsplit-income heuristic no
  longer re-flags simulated invest slices. Horizon errors now surface
  `result_codes` instead of "status code 400".
- Layout: `.btn-*` classes are element-agnostic pills (link-buttons no longer
  collapse to cramped text height); duplicate post-save Reallocate button
  removed; goal-row actions wrap on mobile.
- e2e: 23 specs, 22 passed + 1 conditional skip against live testnet; fixture
  now seeds `rulesSavedOnChain: false` so the suite exercises the real
  edit-then-save path.
- Docs: README/SUBMISSION/demo-script simulate-button location corrected,
  keeper README paths fixed, DESIGN.md tables updated to as-built tokens/nav,
  PRD keeper note, test counts made accurate.

## v0.7 — Judge-defense & hardening (2026-07-13/14)

- Invest lane made a real **choice of Stellar asset**: XLM (live testnet DEX) or
  **Gold / XAUm** (Matrixdock 1g LBMA gold on Stellar); `investAsset` persisted.
- Off-ramp pluggability made **runnable, not just claimed**: `scripts/verify-anchor.mjs`
  resolves any anchor's SEP-1 toml; documented against the **live MoneyGram Access**
  APAC corridor (USDC ⇄ PHP at physical locations, mainnet).
- Keeper `/trigger` hardened: per-IP rate limit + optional origin allowlist.
- Contract `init` documented with the pre-mainnet constructor hardening plan.
- Hero copy aligned with the honest body (no "hands-free" over-claim).
- Docs: judging Q&A expanded, demo script + pitch deck, unit-economics labeled illustrative.
- e2e: hardened Friendbot (retry/backoff, sequential) so setup flakiness stops
  masquerading as test failures; fixed stale onboarding assertion after the redesign.

## v0.6 — Real on-chain data + e2e (2026-07-12)

- Home/Activity/Vault read **real Horizon + contract state** (live USDC/XLM/IDR,
  vault savings, buffer credit, un-split-income detection).
- **Playwright e2e** against real testnet (no mocks): rules → split → goals lifecycle
  → anchor in/out → send. Central `signer.ts` (E2E secret injection).
- Full on-chain lifecycle proof re-run on the goals-enabled vault (CB27…).

## v0.5 — Integrated-ecosystem sprint (2026-07-04)

- **SEP-24 Top Up** (on-ramp) mirroring the withdraw stack.
- **Invest lane** (4th lane) — USDC→XLM spot DCA via classic path payment.
- **SEP-7 payment request links** + public payer page.
- **Savings goals** (labeled sub-allocations) added additively to the vault (+8 tests).

## v0.4 — Landing & UI system

- Marketing landing (Finexa-style restrained design), reactbits components,
  scroll-reveal system, Threads hero background.

## v0.3 — MVP end-to-end (2026-07-03)

- `ShuntVault` Soroban contract: `set_rules` / `distribute` (atomic split, dust to
  Needs) / `deposit` / `withdraw_savings` (timelock + 10% penalty→buffer) / `offramp`
  (allowlist). Named errors, 11 unit tests.
- Web app (9 screens), keeper (inflow detection + XDR prep), SEP-1/10/24 off-ramp.
- Deployed to testnet.

## v0.0 — Design & PRD (mentoring period)

- Problem framing, two-tier non-custodial custody model, business model (service
  fees / no riba), positioning, risk register. See `PRD.md` (iterated across the
  mentoring period before the public repo was initialized).
