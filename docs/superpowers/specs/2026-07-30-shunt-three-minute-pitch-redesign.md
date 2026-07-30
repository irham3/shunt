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
| 3 | Product loop: income in, structure, grow, and exit | 20 seconds |
| 4 | Live demo of the complete loop | 100 seconds |
| 5 | Why Stellar: tools, protocols, and proof | 20 seconds |
| 6 | Next milestone and ask | 10 seconds |

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

### 3. Product Loop — Income in, structured by code, income out

- Use a connected five-stage journey rather than a feature list:
  1. Get paid in USDC through a wallet transfer or SEP-7 payment request.
  2. Split into Needs, Savings, Buffer, and optional Grow.
  3. Protect Savings as USDC in the Soroban vault; Needs and Buffer remain
     liquid.
  4. Optionally buy a Growth asset through a separately approved Stellar DEX
     path payment.
  5. Send USDC/XLM or open a SEP-24 deposit/withdrawal flow through an anchor.
- Growth choices must distinguish executable testnet assets from roadmap:
  - Live on testnet: XLM and TXAUM, an unbacked demo-gold stand-in for
    Matrixdock XAUm.
  - Roadmap only: Blend lending, BENJI, USDY, Etherfuse Stablebonds, and
    tokenized stocks/ETFs.
- Protected Savings remains 100% USDC. Grow is opt-in, separate, and can lose
  value.
- The visual should be a dense but readable transaction rail with five distinct
  stations and a small “wallet approves” marker at every state-changing step.

### 4. Live Demo — Show the complete payday loop

- The slide functions as a visual run-of-show while the product is on screen:
  connect wallet, set active on-chain rules, review and sign the split, inspect
  Savings, optionally buy TXAUM/XLM, then open Send & Pay or a labeled ramp
  flow.
- Keep a compact progress rail visible in the deck so the audience always knows
  where the demo is.
- Open at least one Stellar Expert hash for the `distribute` transaction. If
  timing and testnet liquidity permit, show the Grow path-payment hash too.
- State that the core Needs/Savings/Buffer allocation is one Stellar testnet
  Soroban transaction. Grow is a separate path payment requiring another
  approval.
- Ramp labels must remain explicit:
  - SDF anchor deposit/withdrawal: Stellar testnet SEP-24 simulation.
  - MoonPay/Transak: sandbox or provider staging only.
  - MoneyGram: onboarding pending.
  - No live IDR cash-in or cash-out claim.

### 5. Why Stellar — Each product promise maps to a real rail

- Present a product-to-protocol map, not a logo wall:
  - USDC plus SEP-7: receive income and request payments.
  - Horizon: detect inflows, read balances and history, fetch DEX paths.
  - Soroban plus the USDC Stellar Asset Contract: enforce allocation, Savings
    locks, authorization, and replay protection.
  - Stellar Wallets Kit: connect Freighter, Albedo, or xBull and preserve user
    signing authority.
  - Classic path payments and Stellar DEX: convert the optional Grow slice to
    XLM or TXAUM.
  - SEP-1, SEP-10, and SEP-24: discover anchors, authenticate with the wallet,
    and open hosted deposit/withdrawal flows.
  - Soroban RPC plus the zero-key keeper: simulate and prepare unsigned
    transactions without holding user keys.
  - Stellar Expert: independently inspect transaction hashes.
- Add repository evidence as a compact bottom proof rail: 49 contract tests,
  14 keeper tests, 21 web tests, and public Stellar testnet records.
- Keep the causal relationship visible: product capability on the left, Stellar
  rail in the middle, user benefit or proof on the right.

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
- Dense slides should use nested grids, compact labels, and short evidence rails
  rather than filling space with decorative shapes.
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
