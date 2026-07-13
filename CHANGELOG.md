# Changelog

Milestone history of Shunt's build. Grouped by capability milestone; dates are
the real dates work landed (the public repo was initialized late in the build,
so git history is compressed — these milestones reflect the actual scope
progression, not a padded timeline).

---

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
