# Shunt — Judging Q&A prep

Four risks a sharp judge will probe, and the strongest honest answer for each.
Keep answers short out loud; the detail here is backup.

---

## Q1. "IDRX doesn't exist natively on Stellar — isn't your production corridor a promise with no path?"

**30-second answer:** "The corridor is *pluggable*, not hard-wired. We're live on
the SDF test anchor today over standard SEP-1/10/24 rails — that proves the
mechanism end to end. Which regulated anchor we settle IDR through in production
(IDRX, a PHP anchor, or another) is a partnership-and-regulation question, not an
unsolved technical one. The on-chain allowlist means USDC can only ever flow to an
anchor the *user* approved."

**Why it holds:** the off-ramp is generic SEP-24 + an on-chain `anchors` allowlist
in `set_rules`. Swapping corridors is config, not a contract change or a rewrite.

**Don't say:** "IDRX is already on Stellar" (unverified). Say "IDRX is one
*candidate* corridor."

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

## General posture

- Lead every answer with the **honest boundary**, then the **mitigation**. This
  team's credibility *is* the pitch — the savings lane "never lies to you" only
  lands if the team doesn't either.
- When you don't know a number, say "that's an assumption" — never invent one.
