# Shunt Three-Minute Pitch Redesign

## Objective

Redesign the existing Canva presentation into a judge-focused six-slide pitch
that finishes within three minutes, including a live product demo. The deck must
feel deliberate, product-specific, and visually dense enough to avoid awkward
empty space without becoming cluttered.

## Timing and Narrative

| Slide | Purpose | Target time |
| --- | --- | ---: |
| 1 | Title and hook | 10 seconds |
| 2 | Problem: one payment, four competing needs | 20 seconds |
| 3 | Solution: rules before payday | 25 seconds |
| 4 | Live demo: review, sign, and verify | 70 seconds |
| 5 | Trust and proof | 30 seconds |
| 6 | Next milestone and ask | 25 seconds |

Total target: 180 seconds.

## Slide Content

### 1. Title — Split freelance income before you spend it

- Shunt logo and product name.
- Primary hook: “Split freelance income before you spend it.”
- Supporting line: “Set rules once. Review each payday split. Sign with your
  own wallet.”
- Proof chips: USDC, Non-custodial, Built on Stellar.
- A compact visual income-to-four-lanes motif anchors the composition.

### 2. Problem — One payment must cover four needs

- Show a single incoming USDC payment branching into Needs, Savings, Buffer,
  and Grow.
- Keep the percentages as an illustrative allocation example, not a financial
  claim.
- Emphasize that irregular income repeats the same allocation decision every
  payday.

### 3. Solution — Set the rules before payday

- Three-step flow: income lands, user reviews, wallet signs.
- Clarify that Savings locks in a Soroban vault while Needs and Buffer remain
  liquid.
- Use one strong horizontal or stepped process diagram instead of paragraph
  copy.

### 4. Live Demo — From incoming USDC to verified transaction

- Use a concise five-step run-of-show: connect, active rules, review split,
  sign, verify hash.
- The slide functions as a visual safety net while the live product is shown.
- State that the core allocation is one Stellar testnet Soroban transaction;
  Grow conversion remains separate and opt-in.

### 5. Trust and Proof — The wallet signs; the contract enforces

- Three responsibility columns: Wallet, Keeper, Contract.
- Add repository evidence as a compact proof rail: 49 contract tests, 14 keeper
  tests, 21 web tests, and public Stellar testnet records.
- Keep signing authority visually dominant in the Wallet column.
- Mention the Savings lock and replay protection without adding unsupported
  security claims.

### 6. Closing — Prove the loop, then bring it to Indonesia

- Proven on testnet: allocation loop, Savings vault, transaction lifecycle,
  SEP-24 client.
- Next milestone: provider-confirmed Indonesia fiat route, KYB/certification,
  contract and operational review.
- Ask: ramp partner and pilot communities already receiving cross-border USDC
  income.
- Close by repeating the core hook.

## Visual System

- Direction: dark fintech editorial with a disciplined geometric grid.
- Palette: near-black background, warm white text, Shunt green as the primary
  accent, restrained cyan only for Stellar/testnet evidence.
- Typography: one modern sans-serif family, two weights, large headlines, short
  line lengths, and clear numeric hierarchy.
- Density: every slide uses one primary visual structure plus one compact proof
  or context rail. Empty areas are intentional negative space around a focal
  element, never unused canvas.
- Visual vocabulary: allocation lanes, transaction rails, proof chips, rounded
  product frames, subtle grid lines, and precise connectors.
- Avoid: generic gradients, random glass cards, decorative blobs, stock photos,
  fake dashboards, excessive icons, and unsupported metrics.

## Motion

- Title: restrained fade-up with a short stagger for proof chips.
- Process slides: sequential reveal following the left-to-right narrative.
- Demo slide: five steps reveal in order; no looping animation.
- Proof slide: metrics appear together after the responsibility columns.
- Closing: simple dissolve or rise; no pulsing CTA.
- Transitions should be consistent and quick so animation does not consume the
  three-minute budget.

## Claim Safety

- Contracts, balances, hashes, and the SDF anchor are labeled Stellar testnet.
- MoonPay and Transak are labeled sandbox/provider staging only if mentioned.
- MoneyGram is onboarding pending only if mentioned.
- Shunt is described as a non-custodial application or income router.
- Do not claim a live IDR route, provider approval, audit, user traction,
  sharia compliance, automatic signing, or production readiness.

## Acceptance Criteria

- Exactly six slides, with slide one functioning unmistakably as the title
  slide.
- The spoken sequence plus live demo fits within three minutes.
- All important content remains legible at presentation distance.
- No slide contains accidental overlap, undersized body copy, or visually dead
  empty regions.
- The deck uses Shunt-specific product visuals and evidence rather than generic
  startup decoration.
- Canva remains editable and the original claims remain accurate.
