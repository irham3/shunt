# Shunt — Judging Q&A prep

Four risks a sharp judge will probe, and the strongest honest answer for each.
Keep answers short out loud; the detail here is backup.

---

## Q1. "SDF sandbox doesn't connect users to any local economy — where's the real regional anchor?"

**30-second answer:** "The corridor that already connects Stellar USDC to a local
APAC economy today is **MoneyGram Access** — USDC cashed out to **PHP at physical
MoneyGram locations across the Philippines**, live on mainnet. Our off-ramp is
generic SEP-24, so pointing at it is one config value. Run `node
scripts/verify-anchor.mjs stellar.moneygram.com` — our SEP-1 discovery resolves
MoneyGram's real SEP-24 endpoint. The demo uses the SDF test anchor only because
MoneyGram and every regulated regional off-ramp run on **mainnet only** — no one
exposes a testnet SEP-24 endpoint except SDF. Same code, different domain."

**Why it holds:** off-ramp = generic SEP-24 + an on-chain `anchors` allowlist in
`set_rules`. Swapping corridor = `VITE_ANCHOR_HOME_DOMAIN`, not a contract change.
The verify-anchor script proves the discovery works against MoneyGram's live toml.

**For IDR specifically:** IDRX (regulated, CertiK-audited) is the roadmap target —
say "candidate corridor," never "already on Stellar" (unverified).

**Demo move:** run the verify-anchor script live against `stellar.moneygram.com` to
show the real endpoints resolve — turns "pluggable" from a claim into a thing on screen.

---

## Q2. "The keeper is centralized — isn't that a single point of failure?"

**30-second answer:** "The keeper holds zero keys and can't move or lose funds —
it only *watches* Horizon and *prepares* an unsigned transaction you sign. And as
of the latest build, detection isn't even keeper-dependent: the app itself polls
Horizon and flags un-split income client-side. The keeper's only remaining job is
preparing the split XDR, which is stateless and replaceable — the in-app manual
trigger does the identical thing, and the keeper's API is open so anyone can run
their own. Worst case if it's down: a short UX delay, never a fund risk."

**Demo move (if asked):** turn the keeper off and show Home still detecting the
un-split USDC from Horizon, then split via the manual trigger.

**Accurate boundary — don't overclaim:** the *client* now handles detection;
*preparation* of the distribute XDR still runs through the keeper (or the manual
trigger). Both are keyless. We do not claim the keeper is fully removed.

**Roadmap line:** session keys + AMM-router single-signature splits reduce the
keeper's role further.

---

## Q3. "Where are your unit economics? Is this business actually viable?"

**30-second answer:** "Blended take-rate is about 0.29% on processed volume —
call it ~$5–7 revenue per active user per month at $2,000 income, ~85% margin
because on-chain fees are sub-cent and infra is serverless-free. Against a ~$15
community/referral CAC that's roughly a 3-month payback and ~5–6× LTV/CAC. The
anchor we're displacing costs users 5–7%, so we're 15–20× cheaper — the fee is
headroom, not a barrier. Full model with assumptions is in `docs/unit-economics.md`."

**The one number to volunteer:** break-even ≈ ~410 active users.

**If pushed on the weakest assumption:** retention. "18 months is an assumption;
it's the first thing we'd instrument post-launch, and LTV/CAC stays above 3× down
to ~11 months."

---

## Q4. "The vault contract is unaudited — how do you justify holding real user funds?"

**30-second answer:** "We don't, yet — the README says keep real amounts trivial
until audit, by design. What we *do* have: 19 unit tests covering every
money-critical path — exact split, dust (no stroop ever lost), replay rejection,
timelock, the anchor allowlist, and the full goals lifecycle. The attack surface
is deliberately small: the contract only holds the Savings lane, withdrawals are
owner-only, and there are no external calls except the token contract. Audit
before mainnet with real funds is on the roadmap."

**Strength to lean on:** the honesty itself. Judges trust a team that names its
unaudited status over one that glosses it.

---

## Q5. "You said mainnet — why is every hash I find on the explorer testnet?"

**30-second answer:** "You're right, and we corrected our own docs before submitting.
The proof is 100% **testnet**, with real testnet USDC — not mainnet. An early draft
over-stated 'mainnet'; our position now is explicit: *testnet only, mainnet deferred
until after an audit.* We deliberately don't put real funds in an unaudited vault."

**Turn it into a strength:** self-correction = integrity. **Don't** mumble "typo" — frame
it as the disciplined choice (unaudited → no mainnet funds).

---

## Q6. "Why is Invest = XLM? Isn't that volatile 'investment', contradicting hold-value?"

**30-second answer:** "The hold-value promise is **Savings — 100% USDC, code-locked**,
never touched by volatility. **Invest is a separate, optional lane** (set it to 0% and
nothing about the promise changes) for users who explicitly want a growth slice — a
spot purchase, not yield or leverage. It's XLM *only* because that's the asset with real
DEX liquidity on **testnet** to prove the path-payment mechanism; the intended growth
asset is **allocated gold**. XLM is a testnet placeholder, not an investment recommendation."

**Don't** defend XLM as a good store of value. Separate the two lanes cleanly.

---

## Q7. "Your migrant worker — how does she get USDC and manage Freighter? Show a real on-ramp."

**30-second answer:** "Honestly: today's MVP targets the **crypto-aware wedge** — someone
already paid in USDC. For the mainstream we have two real rungs: a **payment link (SEP-7)**
so a client pays and USDC just lands, and **SEP-24 Top Up** (IDR→USDC via a licensed
anchor). What we do *not* claim solved is self-custody UX for a first-timer — Freighter is
too heavy, so **passkey / smart-wallet onboarding is roadmap.** We prove the engine on the
wedge; mainstream onboarding is the next validation step." (See README → *How a real
Indonesian / PH user actually onboards*.)

**Don't** pretend Freighter is easy for a non-crypto user. Name the gap; show the staged path.

---

## Q8. "The repo was created recently — what did you build during the mentoring period since June?"

> ⚠️ **Fill this with your REAL history — never invent a June timeline.** Judges can check,
> and a fabricated story is fatal. Below is the structure; you supply the truth.

**If real work started in June (research / PRD / contract design):** "The public repo was
initialized recently [because the git history was reset], but the work predates it — here's
the trail: `[PRD version dates, DESIGN.md, wireframes, mentoring notes, older branches/commits]`."
→ **Action for you:** gather that evidence *outside git* now (PRD drafts, design files,
dated notes) so you can show it.

**If the core build really was early July:** own it. "The engine was built intensively in
early July — and here's the substance: a 19-test Soroban contract, a real-testnet e2e suite,
double idempotency, a full on-chain lifecycle. Depth over a long timeline." Judges respect
honest velocity over a polished fake history.

**Never say:** a specific June activity you didn't actually do.

---

## Q9. "Your whole story is rupiah, but your only live corridor is PHP (MoneyGram). The IDR corridor you actually need doesn't exist."

**30-second answer:** "Correct, and we say it in the README rather than hide it. The
rupiah-erosion problem is our primary market — but the off-ramp that's *live on
Stellar today* is PHP via MoneyGram, not IDR. There is no production IDR off-ramp on
Stellar yet: IDRX's Stellar availability is unconfirmed and MoneyGram's Indonesia
payout isn't a listed Stellar corridor. So our honest go-to-market is
**Philippines-first** — the rail exists there now — with **Indonesia next** as the
IDR corridor lands. What we prove today is the engine and the off-ramp *mechanism*,
live in an APAC country; we don't claim a rupiah cash-out we don't have."

**Why it's a strength, not a dodge:** the split engine, code-custody vault, and
SEP-24 stack are corridor-agnostic — PH validates them for real, and pointing at an
IDR anchor is one config value the day one exists. Same rail, different domain.

**Don't:** keep pitching "rupiah, rupiah" while showing a PHP demo without naming the
gap — that's the exact mismatch a sharp Indonesian judge will attack. Name it first.

**And on MoneyGram itself:** it's a legitimate *global* remittance on/off-ramp, not a
grassroots local anchor — so we frame it as "the real live fiat rail we can point at
today," never as deep local-ecosystem integration.

---

## General posture

- Lead every answer with the **honest boundary**, then the **mitigation**. This
  team's credibility *is* the pitch — the savings lane "never lies to you" only
  lands if the team doesn't either.
- When you don't know a number, say "that's an assumption" — never invent one.
