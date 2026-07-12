# Shunt E2E — real testnet, no mocks

```bash
cd web
npm install
npx playwright install chromium   # once
npm run test:e2e                  # or test:e2e:headed / test:e2e:report
```

## What actually runs

Every spec talks to the **live testnet services** — Horizon, Soroban RPC, the
deployed ShuntVault contract, the Cloudflare keeper, and the SDF test anchor.
Nothing is stubbed.

`global-setup.ts` provisions a throwaway identity per run:

1. fresh keypair (+ a second funded account for the transfer spec)
2. Friendbot funding (10,000 XLM each)
3. USDC trustline
4. **real USDC bought on the testnet DEX** (path payment, XLM → USDC)

The only seam is signing: wallet extensions can't run headless, so the app's
central signer (`src/lib/signer.ts`) accepts a testnet keypair injected on
`window.__SHUNT_E2E_SECRET__`. Every flow after that signature — simulation,
submission, confirmation, contract state — is the real thing.

| Spec | README flow covered | On-chain? |
| --- | --- | --- |
| 01-onboarding | landing → connect | – |
| 02-configure-rules | allocation UX (≤100% hard-guaranteed), nominal preview, `set_rules` | ✅ real tx |
| 03-home-balances | wallet USDC + XLM + vault reads, USDC/XLM/IDR selector, unsplit detection | reads |
| 04-split-flow | keeper-prepared `distribute`, one-tap approve, vault balance grows | ✅ real tx |
| 05-vault-goals | labeled sub-vaults: create / rename / withdraw (10% penalty → Buffer credit) / delete | ✅ 4 real txs |
| 06-onramp-offramp | SEP-10 auth + SEP-24 deposit (Top Up) & withdraw (cash-out), fee disclosure | anchor API |
| 07-send-xlm | native XLM payment + hash + explorer link | ✅ real tx |
| 08-activity | Horizon transfers (in/out/self-conversion) merged into the feed, filters | reads |
| 09-convert | in-app XLM ⇄ USDC (live strict-send quote → DEX path payment) | ✅ real tx |

## Flakiness honesty

- If the testnet DEX has **no USDC liquidity** at run time, setup records
  `usdcAcquired: false` and the specs that need real USDC skip with a note
  (the rest still run).
- If the **keeper** is down, the split spec skips and the demo-fallback path
  is asserted instead.
- Specs run **serially in one worker** because they walk one account through
  the money loop in order.
