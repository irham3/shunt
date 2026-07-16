# Changelog

Milestone history of Shunt's build. Grouped by capability milestone; dates are
the real dates work landed (the public repo was initialized late in the build,
so git history is compressed — these milestones reflect the actual scope
progression, not a padded timeline).

---

## v0.12 — Invest lane cleanup, honest labeling, e2e hardening (2026-07-16)

**Contract ID cleanup:** every remaining reference to the superseded CB27…
vault instance (Onboarding footer link, keeper debug scripts, the unused
bindings scaffold, a stale store.ts comment, submission-checklist.md) updated
to the current CC7E… — README and SUBMISSION.md already had it right.

**Invest lane holdings — real bug fix:** `investXlm` used to be a single
number whose *unit* silently depended on whichever asset the toggle currently
pointed at — DCA into XLM, flip the toggle to Gold, buy TXAUM, and the two
got summed as if they were the same thing. Split into `investXlmHeld` /
`investGoldHeld`, tracked independently regardless of the toggle, and shown
together on the Invest lane page and Home ("12.35 XLM + 0.79 TXAUM held").
Migration handles existing persisted state (v7→v8).

**Honest labeling pass:** "Gold (XAUm)" / "g XAUm" throughout the app
(Invest lane, Configure Shunt, split confirmation) renamed to what actually
executes — TXAUM, Shunt's own testnet demo token — instead of implying the
real Matrixdock asset. The now-pointless "Yield boost via Blend — not
enabled" disclosure card was removed from the Invest lane (see v0.11 note).

**Three real bugs found and fixed during a full e2e re-hardening pass**
(the goal here was a genuinely green 41-spec run, not a rewritten test that
merely stops complaining):
- `ConfigureShunt.tsx` never called `syncFromChain` itself, unlike every
  other screen — landing directly on `/shunt` (bookmark, reload) always
  showed "Unsaved setup" even when rules were genuinely saved on-chain,
  because nothing had checked. Now syncs once on mount and only ever
  *corrects* a false "unsaved" reading, never forces a user out of an edit
  they've already started.
- The "Settle in a local currency" card rendered the (disabled) submit
  button while the trustline check was still in flight, indistinguishable
  from "ready to submit" — a fast click sequence could sail past the real
  Enable-trustline step. Added an explicit "Checking … trustline" state.
- A savings-goal balance badge is present in the DOM from the very first
  render, before the on-chain read lands — "visible" isn't "correct value
  loaded", and the create-goal form's own validation could reject a valid
  amount against a stale pre-sync 0. Test fix: wait for the value to settle,
  not just appear.

**e2e:** full 41-spec suite green — 40 passed, 1 conditional skip (keeper-down
fallback, by design).

---

## v0.11 — Lane feature expansion: new contract, new demo assets, 8 features (2026-07-16)

A full pass through the lane-by-lane feature backlog, scoped to what's
genuinely buildable and verifiable on testnet today — every item below was
executed as a real transaction and independently confirmed (balance change,
explorer hash, or a second on-chain read), not just exercised through the UI.

**Contract redeployed** — additive changes, same pattern as the goals
feature: `CC7E2HL7SNQ34PFLV74WEQSW2OVBRBG3EUTLKWC3NYKIC4XPPABQWBMW` supersedes
CB27… (init'd against the same USDC SAC). 26 unit tests (19 original + 7 new).
Two new capabilities:
- **Laddered per-goal timelocks** — `Goal` gained its own `unlock_at`,
  independent of the aggregate lock. `create_savings_goal` takes a
  `lock_secs` param; `withdraw_from_goal` checks the goal's own unlock time,
  not the shared one. Verified live: two goals created seconds apart (60s vs
  ~2yr lock), withdrawn seconds apart — one paid out in full, the other ate
  the 10% penalty, purely from their independently laddered dates.
- **Buffer threshold auto-refill** — `Rules.buffer_target` (display/config
  value) + a new `distribute(..., buffer_topup)` param: the caller-computed
  shortfall (from a real wallet-balance read, since the contract can't see
  wallet-side Buffer balance — Needs and Buffer are the same fungible USDC)
  is prioritized ahead of the normal bps split. Verified live: 5 USDC split
  with a 2 USDC topup → needs 1.8 / savings 0.75 / buffer 2.45, exact.

**New Shunt-issued testnet demo assets** (`scripts/issue-demo-assets.mjs`) —
TXAUM (stands in for Matrixdock's real XAUm gold), TIDR, TPHP (local-currency
proxies) — with real seeded orderbook liquidity against USDC, not the
randomly-regenerated Soroswap testnet tokens (checked: unusable for a stable
demo) and not the real Settle Network ARST/BRLT (mainnet-only, same
MoneyGram-style gap as the off-ramp). Labeled as demo assets everywhere they
appear.

**Needs**
- SEP-7 "Pay a request" tab (Send & Pay) — paste any `web+stellar:pay` URI;
  Shunt pays it from USDC via `pathPaymentStrictReceive` even when the
  requester asked for a different asset (verified: paid a request for 10 XLM
  from USDC, recipient's balance moved by exactly 10 XLM).
- Multi-currency settle (Send & Pay → Convert) — spend USDC directly into
  TIDR/TPHP with a live quote; first-use trustline gate, same pattern as USDC.
- Scheduled bill-pay (Needs lane) — native `createClaimableBalance` with a
  future-dated claim predicate for the recipient and an unconditional one for
  the sender, so it's cancellable/reclaimable anytime before the recipient
  claims. Honest framing: still signs today, nothing signs itself later.

**Savings**
- Laddered goal timelocks (UI): a lock-duration picker (No lock/30d/90d/1yr/2yr)
  on goal creation, defaulting to the aggregate lock so existing behavior is
  unchanged unless the picker is touched.
- Auto-escalation: opt-in toggle bumps Savings % by 1 point every 3 splits
  (capped at 50%) via a real follow-up `set_rules` call after the triggering
  split, shown explicitly in the confirmation screen — never silent.
- Reflector oracle checked directly (`assets()` call against the live
  testnet contract) for an IDR/PHP feed — confirmed it carries crypto/CEX
  pairs only (BTC, ETH, XLM, EURC, …), no fiat. IDR display stays a REST
  forex rate; the gap is now a verified fact in the UI copy, not an assumption.

**Buffer**
- Emergency cash-out + quick-convert shortcuts on the Buffer lane page,
  reusing the existing off-ramp/convert flows with Buffer-specific framing.

**Invest**
- Gold DCA (manual buy + auto-DCA after split) now executes for real against
  TXAUM's seeded liquidity instead of always falling back to the labeled
  reference-rate simulation. Found and fixed in the process: neither path
  added the required trustline before the path payment, so every real gold
  purchase failed `op_no_trust` on an account that had never held TXAUM —
  both now check and add it first (one extra signature, first time only).
- Blend Capital yield: researched (real SDK exists, no confirmed testnet pool
  address, third-party API key required beyond this session's reach) —
  shipped as an explicit, clearly-labeled non-integration disclosure in the
  Invest lane instead of a fake/partial wire-up. Removed later the same day
  (v0.12) once it was clear there was no near-term path to actually shipping
  it — a disclosure card explaining a feature that doesn't exist read as
  clutter, not honesty.
- Soroswap aggregator basket DCA: researched — its testnet random-token pool
  is stable in composition but the quote/pools API 404s without a
  third-party API key. Reported honestly as infeasible this session rather
  than forcing a fragile integration.

**Bug found and fixed along the way:** `AnimatePresence mode="wait"` around
Send & Pay's tab switcher hung on every live click (same root cause as the
route-level freeze fixed in v0.8 — mode="wait" blocking on an exit animation
that never resolves under this React 19 setup). All four tabs were
unreachable by clicking; only reachable via the `?tab=` query param, which is
how it went unnoticed. Same enter-only fix applied; a regression spec added.

**e2e:** `e2e/11-new-features.spec.ts` (9 new specs) covers every item above
against live testnet. Full suite: 41 specs.

**Root cause of "Rules expired on-chain" reports:** the live deployment's
`VITE_VAULT_CONTRACT_ID` was baked at build time as
`CA65…` — an older, superseded vault instance — instead of the
then-current `CB27KRLQAJCQRW2GTH4ETXDSS2STMUU4K4QABIY5QEWGAGQQRJBKPW7K`.
Confirmed by decoding a user's real `set_rules` transactions: all three
succeeded on-chain (`txSuccess`) against CA65, while the keeper (correctly
configured for CB27) simulated `distribute` against CB27 and legitimately
found no rules there — hence `Error(Contract, #3)` on every Simulate/
Reallocate attempt. Not a code bug; Vercel's `VITE_VAULT_CONTRACT_ID` env
var needed updating to CB27… and a redeploy (Vite inlines env vars at build
time, so changing the dashboard value alone doesn't take effect). Funds set
aside under the old rules are still on CA65, untouched.
**Update (this release):** CB27 itself is now superseded by
`CC7E2HL7SNQ34PFLV74WEQSW2OVBRBG3EUTLKWC3NYKIC4XPPABQWBMW` (see the
contract-redeploy section above) — **Vercel's `VITE_VAULT_CONTRACT_ID` must be
updated to CC7E… and redeployed**, or the live site will regress to this
exact same "Rules expired on-chain" symptom against the new contract.
- **Defense-in-depth added regardless:** a `#3` from the keeper no longer
  triggers an immediate "rules expired" reset. `resolveRulesNotSet()` (new,
  `lib/vault.ts`) does one direct `get_rules` read before deciding — if the
  rules are genuinely there (the keeper hit a lagging RPC replica, a real
  possibility independent of the misconfiguration above), the user now sees
  "the network needs a moment, try again" and keeps their saved state instead
  of being bounced into edit mode. Applied at all four sites that handle this
  error (Configure Shunt's Simulate + Reallocate, Home's Split now,
  AutoSplitConfirm's rebuild-on-approve). Verified live against both outcomes
  on a fresh account (rules genuinely missing → correct reset + accurate
  copy; rules present → no false positive).

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
