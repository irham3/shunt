# Shunt — Submission Readiness Checklist

Status as of 2026-07-14. Tick the ⬜ items before you submit.

## Deliverables

| Item | Status | Where |
| --- | --- | --- |
| Live app (testnet) | ✅ deployed & auto-updates on push | https://shunt-app.vercel.app |
| Public repo | ✅ pushed | https://github.com/irham3/shunt (`main`) |
| Smart contract on testnet | ✅ live + verified | vault `CB27…` (explorer-linked in README) |
| Keeper (hardened) | ✅ deployed live | https://shunt-keeper.irhamtria.workers.dev (`/health` ok) |
| On-chain proof (hashes) | ✅ clickable, testnet | README → *Live on testnet* |
| Contract tests | ✅ 19 unit | `cd contracts/shunt-vault && cargo test` |
| e2e (real testnet) | ✅ 23 specs (infra-flaky; run with port 5173 free) | `npm run test:e2e` |
| Written submission | ✅ complete | `SUBMISSION.md` (local — gitignored) |
| Pitch deck (content) | ✅ MD | `docs/pitch-deck.md` |
| Demo video **script** | ✅ ready | `docs/demo-script.md` + `docs/local-economy-narration.md` |
| **Demo video (recorded)** | ⬜ **YOU** | record ≤3 min, upload unlisted, paste link into `SUBMISSION.md` |

## The only blocking manual step

⬜ **Record & link the demo video.** Everything else is done. Missing video can fail
eligibility regardless of code quality. Use `docs/demo-script.md`; open a terminal
in repo root + the app, keep the honest-boundary lines in, show one real explorer hash.

## Nice-to-have before submitting (optional, fast)

⬜ Run the "local economy" beat once to confirm it's smooth on your machine:
`node scripts/verify-anchor.mjs stellar.moneygram.com` (should print the live SEP-24 endpoint).
⬜ (If you want the keeper origin-locked in prod) set `ALLOWED_ORIGINS=https://shunt-app.vercel.app`
in the worker and `npx wrangler deploy` — currently `*` (safe default, not blocking).
⬜ Skim `SUBMISSION.md` top block: confirm the video link is pasted and network says **testnet**.

## Pre-submit sanity (2 minutes)

⬜ Open https://shunt-app.vercel.app on mobile width — landing renders, "Get Started" → connect.
⬜ Explorer hash in README resolves (click the `distribute` link).
⬜ `https://shunt-keeper.irhamtria.workers.dev/health` returns `{"ok":true,...}`.
⬜ No "mainnet" claim anywhere in what you submit (we standardized to testnet-only).

## What a sharp judge will probe — and where the answer lives

- "Local economy / real anchor?" → `docs/local-economy-narration.md` (MoneyGram live PHP corridor, runnable).
- "Mainnet proof?" → testnet-only, stated plainly; `docs/judging-qa.md` Q5.
- "Invest = volatile XLM vs value-preservation?" → Savings is the safety net; Invest optional (XLM **or** gold/XAUm); `docs/judging-qa.md` Q6.
- "How does a real ID/PH user onboard?" → README *How a real Indonesian / PH user onboards*; `docs/judging-qa.md` Q7.
- "Repo born recently / process?" → `CHANGELOG.md` + your real June evidence; `docs/judging-qa.md` Q8 (**do not fabricate**).
- "init / keeper security?" → README *Honest limitations* (init grief closed on live instance; `/trigger` rate-limited).
- "Unit economics real?" → `docs/unit-economics.md` (labeled illustrative); `docs/judging-qa.md` Q3.
