# Shunt Hackathon Trust, UI, and Fiat Ramp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Shunt look authored rather than generated, and make every fiat-ramp claim match a transaction that the team can prove.

**Architecture:** Keep the SDF test anchor as a labeled integration simulator. Add live ramp providers behind a capability-driven adapter and a server-side session API. Treat a ramp as complete only after a provider callback or a matching on-chain transfer confirms it. Use Alchemy Pay as the first Indonesia on-ramp candidate, MoneyGram Ramps as the preferred cash off-ramp after allowlisting, and dynamic provider discovery as a fallback rather than hardcoded “global” buttons.

**Tech Stack:** React 19, TypeScript 5.9, React Router 7, Zustand, Stellar SDK 14, SEP-1/10/24, Cloudflare Workers, Vitest, Playwright, Soroban, Vite.

## Global constraints

- Preserve the non-custodial model. Shunt must not receive or store a user secret key.
- Preserve the existing React, CSS, Stellar, Soroban, and Cloudflare stacks.
- Keep the SDF test anchor, provider sandboxes, production preview, and production as separate environments in code and copy.
- Never label a session URL, quote, order, or popup as a completed top-up or cash-out.
- Never calculate a provider fee from a hardcoded Shunt percentage. Display provider quotes and Shunt fees as separate rows.
- Never call the SDF test anchor an IDR bank integration. It simulates the SEP lifecycle and moves no rupiah.
- Never record a provider transaction when session creation fails.
- Never claim an Indonesia route until the provider capability API returns the exact country, fiat, asset, network, direction, and payment method for Shunt's partner account.
- Never put provider secrets in `keeper/wrangler.toml`, source control, `VITE_*`, logs, query-string diagnostics, or error responses.
- Keep the main demo path usable when external provider access is unavailable.
- Use sentence case for product copy.
- Use “Stellar testnet simulation”, “provider sandbox”, “production preview”, or “live” as explicit status labels.
- Use “on-ramp” and “off-ramp” in technical documentation. Use “Add money” and “Withdraw” in the consumer UI.
- Support keyboard focus, reduced motion, mobile touch, popup-blocked browsers, refresh recovery, and provider cancellation.
- Keep each implementation commit independently testable.

---

## 1. Executive decision

### Recommended approach: two honest lanes

Ship two separate paths:

1. **Demo lane: Stellar testnet simulation**
   - Uses `testanchor.stellar.org`.
   - Proves SEP-1 discovery, SEP-10 authentication, and SEP-24 session creation.
   - States that no IDR moves and no bank account is charged.
   - Can still prove receipt of test USDC and Shunt's split workflow when the test anchor completes the test transaction.

2. **Live lane: provider route**
   - Creates a real provider session.
   - Uses the provider's live quote, KYC, payment methods, order ID, callbacks, and status.
   - Shows success only after provider confirmation and on-chain reconciliation.
   - Starts with Alchemy Pay for Indonesia on-ramp discovery and MoneyGram Ramps for cash withdrawal after access approval.

This structure answers the jury's criticism without pretending that a test anchor is a bank integration. It also lets the team show real Stellar engineering today.

### Why the product should not call the simulation an “anchor”

“Anchor” is accurate Stellar terminology, but it does not tell a user whether money moved. The interface should name the action and its environment:

| Current label | Replacement |
| --- | --- |
| Simulate Bank Deposit (Testnet) | Try the Stellar test flow |
| Buy USDC via MoonPay (Sandbox) | Try MoonPay sandbox |
| MoneyGram cash deposit (Pending) | MoneyGram cash access · application submitted |
| Top Up via anchor (pending) | Test deposit session created |
| Cash-out via anchor (pending) | Test withdrawal session created |

The technical detail can appear beneath the status: “SEP-24 via the SDF test anchor”.

### Options considered

#### Option A: Relabel the current flow and stop there

**Pros**

- Can ship within hours.
- Removes the “fake anchor” impression.
- Preserves the working testnet demo.

**Cons**

- Does not produce a real fiat transaction.
- The jury can still say Shunt lacks a live corridor.

**Decision:** Required as the baseline, but insufficient as the only response.

#### Option B: Add one direct Indonesia provider and keep MoneyGram as the target off-ramp

**Pros**

- Creates a credible live on-ramp path.
- Keeps the integration surface small.
- Alchemy Pay documents IDR payment methods and USDC on Stellar.

**Cons**

- Partner configuration may differ from public documentation.
- A direct Stellar-to-IDR off-ramp still needs provider confirmation.

**Decision:** Recommended. Run an exact-route capability test before building the UI.

#### Option C: Add an aggregator such as Onramper

**Pros**

- One integration can expose several providers.
- Onramper lists off-ramp providers for Indonesia.
- Provider availability can change without a frontend release.

**Cons**

- Aggregator coverage does not prove `USDC on Stellar → IDR`.
- Adds another commercial dependency and fee layer.
- Provider results still depend on Shunt's account, geography, asset, network, and direction.

**Decision:** Use only if its live API returns the exact route. Do not use the marketing coverage table as proof.

---

## 2. What the audit found

### 2.1 Integration truth gaps

#### P0: provider secrets are present in a tracked configuration file

`keeper/wrangler.toml` currently contains values for:

- `TRANSAK_API_KEY`
- `TRANSAK_API_SECRET`
- `MOONPAY_API_KEY`
- `MOONPAY_SECRET_KEY`

The file is tracked by Git. Even though the current values are in an uncommitted diff, one broad `git add` would publish them. Cloudflare documents that sensitive values belong in Worker secrets, not `[vars]`.

**Required response:** rotate both provider secrets, remove their values from the tracked file, declare required secret names, and set them through Wrangler.

#### P0: test session creation is presented as a fiat request

`web/src/screens/TopUp.tsx`:

- Calculates `IDR` from a display rate.
- Adds a hardcoded `0.35%` fee even though the SDF test anchor `/info` reports `fee.enabled: false`.
- Says “Fund your wallet with IDR”.
- Shows “Deposit request ... sent to the anchor”.

The SDF test anchor accepts test assets in the range `1–10 USDC`; it does not debit an Indonesian bank account. The current copy combines a protocol test with a fiat promise.

#### P0: failure creates fake activity

`web/src/screens/TopUp.tsx:70-75` calls `recordTopUp(usdc)` after an exception and sets `submitted` to `"local"`.

`web/src/screens/SendPay.tsx:179-182` follows the same pattern for cash-out.

The activity feed can therefore show a pending fiat transaction that has no provider transaction ID or hosted session.

#### P0: the integration does not verify completion

`web/e2e/06-onramp-offramp.spec.ts` proves that a hosted URL exists. It does not prove:

- The hosted flow completed.
- Fiat was accepted or paid.
- USDC arrived or left.
- A provider webhook arrived.
- A MoneyGram reference number exists.

The test is useful protocol evidence. The README must not describe it as a complete live in/out lifecycle.

#### P1: status handling is too small for SEP-24

The UI state is `"anchor" | "local" | null`. A ramp needs states such as:

```ts
export type RampStatus =
  | "creating_session"
  | "awaiting_user"
  | "awaiting_fiat"
  | "awaiting_crypto"
  | "processing"
  | "completed"
  | "cancelled"
  | "expired"
  | "refunded"
  | "failed";
```

The current implementation does not persist provider transaction IDs, poll status after refresh, or reconcile with Horizon.

#### P1: `postMessage` trusts every origin

`web/src/screens/TopUp.tsx:58-65` accepts `close` or `success` from any message origin. The comment acknowledges the missing origin check. The listener also remains attached if the popup closes without posting a message.

#### P1: provider endpoints expose avoidable risk

`keeper/src/index.ts`:

- Logs the MoonPay query string, which contains the API key.
- Logs the full signed widget URL.
- Logs Transak provider response bodies.
- Returns slices of upstream error bodies to the browser.
- Accepts any non-empty `walletAddress`.
- Has no endpoint-specific rate limit for session generation.
- Uses `any` for provider payloads.
- Has no unit tests for `/moonpay-url` or `/transak-url`.

#### P1: a single `busy` flag couples unrelated providers

The SDF test flow and MoonPay button share `busy`. Starting MoonPay can change the test-anchor button copy to “Contacting anchor”. Each provider action needs its own request state.

#### P1: popup creation can be blocked

MoonPay's popup opens after an awaited network call. Browsers can classify it as no longer connected to a user gesture. Open a blank controlled window synchronously, then navigate it when the server returns a URL. Close it on failure.

#### P1: capability discovery is incomplete

`getAnchorInfo()` returns default limits even when the requested asset is absent. It should fail when an anchor does not advertise `deposit.USDC` or `withdraw.USDC`.

### 2.2 UI and copy findings

The source contains:

- **579 inline style objects**
- **91 inline style objects in `SendPay.tsx`**
- **67 in `ConfigureShunt.tsx`**
- **66 in `Onboarding.tsx`**
- **49 each in `Home.tsx` and `SavingsVault.tsx`**
- **63 hardcoded hex color occurrences**
- Several screen files between 500 and 1,015 lines

These numbers do not prove bad design by themselves. They explain why spacing, states, buttons, and copy drift between screens.

#### The visual language stacks too many generated-design signals

The landing and wallet screens combine:

- Aurora or Threads WebGL backgrounds.
- Shiny text.
- Reveal animation on most sections.
- Glass cards.
- Bento grids.
- Spotlight hover.
- Cursor tilt.
- Floating cards.
- Animated numbers.
- A trust marquee.
- Lime glow CTAs.

Each effect can work alone. The stack makes the interface feel assembled from effect libraries.

#### The landing page uses a familiar generated template

`web/src/screens/Onboarding.tsx` follows:

1. Sticky nav.
2. Centered hero.
3. Animated product card.
4. Trust marquee.
5. Problem/outcome rows.
6. Four feature cards.
7. Numbered timeline.
8. Proof stats.
9. Fee card.
10. Bottom CTA.

The page explains the technology several times and says little about one specific freelancer using it.

#### Product claims outrun current behavior

Examples:

- “Automated income” while users approve a one-tap split.
- “Money ... out to your bank” while the live integration only opens a test anchor.
- “Cash out through a supported Stellar anchor” without a selected live corridor.
- “Alternative methods (Global)” above a provider that the team observed blocking the intended region/asset.
- A fixed Shunt top-up fee shown before a provider quote exists.

#### Provider status is expressed as disabled controls

The disabled MoneyGram button uses a `title` tooltip. Tooltips do not work well on touch screens and a disabled button cannot explain the next step. Use a provider status row with visible copy and a link to availability details.

#### Navigation and information architecture are overloaded

`SendPay.tsx` contains XLM transfer, payment request, conversion, local settlement, and USDC off-ramp in one 1,015-line screen. Users see technical rails before they choose an intent.

The primary actions should be:

- Add money.
- Send.
- Withdraw.
- Request.

Asset/network selection belongs inside each task.

#### Good foundations worth preserving

- Dark neutral base and readable lime primary action.
- Lane colors communicate allocation semantics.
- Numeric typography uses a dedicated heading family.
- Reduced-motion media queries exist.
- Most form errors use inline `role="alert"` instead of browser alerts.
- Several charts and controls have accessible labels.
- The dashboard prioritizes balances and allocation.

The redesign should subtract effects and clarify task states rather than replace the design system.

### 2.3 Baseline verification on 2026-07-29

The audit ran the current repository before implementation:

| Check | Result |
| --- | --- |
| `web/npm run build` | Passed; Vite transformed 2,725 modules |
| `web/npm test -- --run` | Passed; 17 tests in 2 files |
| `keeper/npm run typecheck` | Passed |
| `keeper/npm test` | Passed; 10 tests in 1 file |
| Ramp Top Up E2E | Failed after 180 seconds |

The focused Playwright failure is specific:

```text
waiting for getByRole('button', { name: /^top up$/i })
```

`web/e2e/06-onramp-offramp.spec.ts:18` still looks for “Top up”, while the current UI renders “Simulate Bank Deposit (Testnet)”. The setup before that failure created and funded test accounts, bought 8 USDC on the testnet DEX, and triggered the keeper. This confirms a UI/test contract regression rather than a failed testnet setup.

The current passing unit suites do not test:

- `/moonpay-url`.
- `/transak-url`.
- Provider response parsing.
- Provider request rate limits.
- Webhook signatures.
- Ramp state transitions.
- Settlement reconciliation.

---

## 3. Provider research and recommendation

Research date: **2026-07-29**. Public coverage can change. The final production check must use the provider API under Shunt's own account.

### 3.1 MoneyGram Ramps

**What is confirmed**

- MoneyGram Ramps supports USDC cash-in and cash-out on Stellar through SEP-10 and SEP-24.
- A non-custodial wallet must host `stellar.toml` and have its wallet domain allowlisted.
- Sandbox uses Stellar testnet.
- Production Preview uses mainnet and real funds with low limits.
- Full production requires certification, KYB, and legal approval.
- Current cash-in and cash-out require a participating MoneyGram location.
- Cash-out produces a reference number for pickup.
- MoneyGram's public Ramps page labels bank, mobile-wallet, and card ramps as coming soon.

**Answer to the BRILink question**

The user journey resembles an agent network, but the user must select a location shown by the MoneyGram Ramps locator. A normal MoneyGram remittance location, a BRILink outlet, or another agent cannot be assumed to support crypto cash-in/out. The product must display the provider's selected location and instructions.

**Indonesia caution**

MoneyGram has a large conventional transfer network in Indonesia. That does not prove every location supports MoneyGram Ramps. The team must confirm the exact Ramps location inside the production-preview flow.

**Recommendation**

- Continue the allowlist request.
- Ask for Production Preview in parallel with staging.
- Use MoneyGram as the preferred cash off-ramp if it returns a participating Indonesia location.
- Do not display “MoneyGram cash deposit” as available before Shunt's domain is approved.

### 3.2 Alchemy Pay

**What is confirmed in public documentation**

- IDR is a supported fiat currency.
- Indonesia payment methods include OVO, DANA, QRIS, and virtual accounts for Permata, CIMB, Mandiri, BRI, and Danamon.
- Public asset documentation lists USDC on XLM/Stellar for on-ramp.
- Public fee examples differ by payment method.

**What is not yet confirmed**

- The exact `IDR → USDC on Stellar` route for Shunt's partner account.
- Whether an Indonesia user can off-ramp `USDC on Stellar → IDR`.
- Production access timing and KYB requirements.
- Current fees and minimums for Shunt.

**Recommendation**

Run this provider first for a live Indonesia on-ramp. Do not build the final UI until a server-side capability request returns:

```json
{
  "country": "ID",
  "fiat": "IDR",
  "asset": "USDC",
  "network": "XLM",
  "direction": "buy",
  "available": true
}
```

If the API returns the route, integrate its hosted checkout, callback, webhook, and transaction lookup. Use the provider quote rather than the current `0.35%` estimate.

### 3.3 Banxa

**What is confirmed**

- Indonesia appears in Banxa's supported-country list.
- Banxa's current asset table lists USDC on XLM as buy-supported.
- The same table lists sell as unsupported for USDC on XLM.
- Banxa warns that asset availability depends on partner configuration.

**Recommendation**

Use Banxa as the second on-ramp candidate. It does not solve direct Stellar off-ramp based on the current public asset table.

### 3.4 MoonPay

**What is confirmed**

- Indonesia is not on MoonPay's current unsupported-country list.
- MoonPay documents USDC on XLM and XLM selling with a required memo.
- Availability varies by region, account, product, and asset.
- The team opened a signed sandbox widget but encountered a route/geography block for `usdc_xlm`.

**Recommendation**

Keep the backend signature work as an integration spike. Remove “Global” from the UI. Hide the option when the supported-country/currency API or widget preflight rejects the route. Do not make it the primary Indonesia demo.

### 3.5 Transak

**What is confirmed**

- The staging asset response lists `USDCstellar`.
- The same response marks `isPayInAllowed: false` for the route captured during research.
- Transak states that unsupported staging chains can create a dummy order without delivering tokens.
- Partner activation and account configuration affect availability.

**Recommendation**

Use Transak only as a provider-sandbox demo. Do not present it as a Stellar
anchor, a USDC ramp, or settlement proof.

**Validated implementation, July 29, 2026**

- Transak's staging lookup identifies Stellar USDC as `USDCstellar` with
  `network=stellar`. The response for Shunt's key reports
  `isPayInAllowed=false`, and the staging wallet verifier rejects the selected
  recipient for this asset.
- The same lookup identifies native XLM as `XLMmainnet` with
  `network=mainnet` and `isPayInAllowed=true`.
- `USD + XLM + mainnet + ID + credit_debit_card` returns a staging quote for
  Shunt's key.
- The staging wallet verifier accepts
  `GACIPGS6ZFHSK5B2UAI7KHO7QONSDVC2USAP7T4KSMWI5LBFV3WN6RYW` for
  `XLM + mainnet`.
- Shunt's Worker creates a secure, single-use Transak session from the backend.
  It supplies the recipient, sets `disableWalletAddressForm=true`, and sets
  `hideExchangeScreen=true`.
- Worker deployment `30b2ba51-a45d-4f89-9899-cdeff4383fa7` returned a fresh
  staging widget session and opened the Transak email-verification screen.
- Transak staging does not deliver native tokens outside the documented test
  networks. A completed widget order proves provider-flow integration, not
  Stellar settlement.

Fradium does not provide a working Stellar precedent. Its Transak configuration
lists Ethereum, Solana, and Bitcoin, then builds a deprecated client-side widget
URL. Shunt must keep the secure backend session flow required by current Transak
documentation.

### 3.6 Ramp Network

Ramp Network's current unsupported-country page includes Indonesia. Exclude it from the Indonesia plan.

### 3.7 Onramper

Onramper's public coverage page lists several off-ramp providers for Indonesia. Its supported-assets API accepts direction and country filters.

**Recommendation**

Run a time-boxed discovery spike. Continue only if the API returns all of:

- `country=ID`
- `type=sell`
- `source=USDC`
- `network=stellar` or the provider's exact equivalent
- `target=IDR`
- At least one enabled provider for Shunt's key

If the route requires bridging, show the bridge as a separate step with its fee and risk. Do not hide it inside “Withdraw”.

### 3.8 Ranked route plan

| Rank | Direction | Route | Status | Decision |
| --- | --- | --- | --- | --- |
| 1 | On-ramp | Alchemy Pay: IDR local method → Stellar USDC | Public docs support the ingredients | Test exact route now |
| 2 | On-ramp | Banxa: fiat → Stellar USDC | Indonesia and buy route documented | Use if partner activation is faster |
| 3 | Off-ramp | MoneyGram Ramps: Stellar USDC → cash | Correct architecture; access pending | Preferred after preview/allowlist |
| 4 | Off-ramp | Onramper dynamic route | Indonesia providers listed; exact route unknown | Continue only after API proof |
| 5 | On/off-ramp | MoonPay | Signed sandbox works; intended route blocked in team test | Keep as hidden spike |
| 6 | On-ramp | Transak staging: USD card → native XLM | Quote, wallet verification, and secure session validated; no token delivery proof | Demo only as provider sandbox |
| Exclude | On/off-ramp | Ramp Network | Indonesia unsupported | Remove from shortlist |

---

## 4. Target user experience

### Add money

```text
Add money
├─ Live methods
│  ├─ Bank transfer / QRIS / e-wallet · provider returned exact route
│  └─ Cash at MoneyGram · shown only after approval and location availability
└─ Developer demo
   └─ Stellar test flow · no fiat moves
```

Each method card shows:

- Environment badge.
- Country and currency.
- Asset and network.
- Payment method.
- Fee source: “Quoted by provider”.
- Availability status.
- One plain-language limitation.

### Withdraw

```text
Withdraw
├─ Cash pickup · MoneyGram Ramps
├─ Bank or card · exact provider route returned by API
└─ Send crypto · wallet/exchange address, not described as fiat withdrawal
```

### Transaction detail

Every provider transaction gets a durable detail page:

- Provider name.
- Shunt transaction ID.
- Provider transaction ID.
- Environment.
- Direction.
- Fiat amount/currency.
- Crypto amount/asset/network.
- Provider fee.
- Shunt fee.
- Created and updated timestamps.
- Current status.
- Next user action.
- On-chain transaction hash when present.
- Cash pickup reference and location when present.

### Copy rules

Use:

- “Test flow ready”
- “Session created”
- “Waiting for payment”
- “Waiting for USDC”
- “USDC received”
- “Cash pickup ready”
- “Provider cancelled the order”

Avoid:

- “Seamless”
- “Global”
- “Instant”
- “Top up complete” before reconciliation
- “Money sent” before settlement
- “Powered by MoneyGram” before partner approval
- “IDR deposited” in a testnet simulation

---

## 5. File structure

### Create

- `web/src/features/ramps/types.ts`  
  Shared provider, capability, quote, session, and status types.
- `web/src/features/ramps/api.ts`  
  Browser calls to Shunt's Worker. No provider secrets or direct secret-bearing provider calls.
- `web/src/features/ramps/copy.ts`  
  Status labels and environment disclosures.
- `web/src/features/ramps/RampMethodCard.tsx`  
  Method selection with visible availability details.
- `web/src/features/ramps/RampStatusPanel.tsx`  
  Transaction progress and next action.
- `web/src/features/ramps/EnvironmentDisclosure.tsx`  
  Consistent live, preview, sandbox, and simulation labels.
- `web/src/screens/RampTransaction.tsx`  
  Refresh-safe transaction detail.
- `web/src/features/ramps/types.test.ts`  
  Parser and state-transition tests.
- `web/src/features/ramps/copy.test.ts`  
  Copy status mapping tests.
- `keeper/src/ramps/types.ts`  
  Worker-side provider contracts.
- `keeper/src/ramps/providers/sdf-test-anchor.ts`  
  Test-anchor metadata only; SEP calls remain in the wallet because signing is client-side.
- `keeper/src/ramps/providers/alchemy-pay.ts`  
  Exact-route lookup and session creation after credentials are available.
- `keeper/src/ramps/providers/banxa.ts`  
  Fallback exact-route lookup and session creation.
- `keeper/src/ramps/providers/moonpay.ts`  
  Move and harden current signing logic.
- `keeper/src/ramps/providers/transak.ts`  
  Move current spike behind a provider adapter.
- `keeper/src/ramps/service.ts`  
  Capability selection, validation, session creation, and status lookup.
- `keeper/src/ramps/webhooks.ts`  
  Signature verification and idempotent updates.
- `keeper/src/ramps/service.test.ts`
- `keeper/src/ramps/webhooks.test.ts`
- `web/e2e/14-ramp-truthfulness.spec.ts`
- `web/e2e/15-ramp-live-contract.spec.ts`

### Modify

- `keeper/wrangler.toml`
- `keeper/src/env.ts`
- `keeper/src/index.ts`
- `keeper/src/index.test.ts`
- `web/src/App.tsx`
- `web/src/screens/TopUp.tsx`
- `web/src/screens/SendPay.tsx`
- `web/src/screens/Activity.tsx`
- `web/src/store.ts`
- `web/src/lib/anchor.ts`
- `web/src/styles/tokens.css`
- `web/src/screens/Onboarding.tsx`
- `web/src/screens/Home.tsx`
- `web/src/screens/ConnectWallet.tsx`
- `web/e2e/06-onramp-offramp.spec.ts`
- `README.md`
- `SUBMISSION.md`
- `docs/anchor-integration.md`
- `docs/demo-script.md`
- `docs/judging-qa.md`

### Keep unchanged during the first ramp pass

- Soroban vault contract.
- Split allocation math.
- Freighter signing.
- Savings goal lifecycle.
- Growth asset execution.

---

## 6. Implementation tasks

### Task 1: Remove and rotate tracked provider secrets

**Files:**

- Modify: `keeper/wrangler.toml`
- Modify: `keeper/src/env.ts`
- Modify: `.gitignore`
- Test: secret scan over tracked files

**Interfaces:**

- Consumes: Cloudflare Worker `env`.
- Produces: `env.MOONPAY_SECRET_KEY`, `env.TRANSAK_API_SECRET`, and future provider secrets as encrypted Worker bindings.

- [ ] **Step 1: Revoke and rotate the current MoonPay and Transak secrets in their partner dashboards**

Record only the rotation date and last four characters in a private credential inventory. Do not put replacement values in this repository or this document.

- [ ] **Step 2: Remove credential values from `[vars]`**

Keep non-secret configuration such as API base URLs in `wrangler.toml`. Do not leave placeholder secret values that can be mistaken for deployed credentials.

- [ ] **Step 3: Declare required secret names**

Use the Wrangler version installed by the project to declare required secrets if its TOML schema supports that field. Otherwise document the required names in `keeper/README.md`.

- [ ] **Step 4: Set encrypted Worker secrets**

Run:

```powershell
npx wrangler secret put MOONPAY_SECRET_KEY
npx wrangler secret put TRANSAK_API_SECRET
```

Set public partner API keys as variables only when the provider documents them as public. Prefer secrets for all provider keys in the Worker to reduce accidental exposure.

- [ ] **Step 5: Add a repository secret scan**

Run:

```powershell
git grep -n -E 'sk_(test|live)_|TRANSAK_API_SECRET\s*=\s*"[^"]+"|MOONPAY_SECRET_KEY\s*=\s*"[^"]+"'
```

Expected: no credential value in a tracked file.

- [ ] **Step 6: Commit**

```powershell
git add keeper/wrangler.toml keeper/src/env.ts .gitignore keeper/README.md
git commit -m "security: move ramp credentials to worker secrets"
```

### Task 2: Define ramp truth and state contracts

**Files:**

- Create: `web/src/features/ramps/types.ts`
- Create: `keeper/src/ramps/types.ts`
- Create: `web/src/features/ramps/types.test.ts`

**Interfaces:**

- Consumes: provider responses and SEP-24 status.
- Produces: `RampCapability`, `RampQuote`, `RampSession`, `RampTransaction`, `RampStatus`, and `RampEnvironment`.

- [ ] **Step 1: Write parser tests**

```ts
import { describe, expect, it } from "vitest";
import { parseRampTransaction } from "./types";

describe("parseRampTransaction", () => {
  it("rejects completed status without settlement evidence", () => {
    expect(() =>
      parseRampTransaction({
        id: "ramp_1",
        provider: "alchemy-pay",
        status: "completed",
        environment: "live",
      }),
    ).toThrow(/settlement evidence/i);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

```powershell
cd web
npx vitest run src/features/ramps/types.test.ts
```

Expected: fail because the module does not exist.

- [ ] **Step 3: Add exact shared types**

```ts
export type RampDirection = "buy" | "sell";
export type RampEnvironment = "simulation" | "sandbox" | "preview" | "live";
export type RampStatus =
  | "creating_session"
  | "awaiting_user"
  | "awaiting_fiat"
  | "awaiting_crypto"
  | "processing"
  | "completed"
  | "cancelled"
  | "expired"
  | "refunded"
  | "failed";

export interface RampCapability {
  provider: string;
  country: string;
  fiat: string;
  asset: string;
  network: string;
  direction: RampDirection;
  environment: RampEnvironment;
  available: boolean;
  paymentMethods: string[];
  reason?: string;
}

export interface SettlementEvidence {
  providerTransactionId: string;
  providerStatus: string;
  stellarTransactionHash?: string;
  cashReference?: string;
}
```

Make `parseRampTransaction()` reject `completed` without `SettlementEvidence`.

- [ ] **Step 4: Run tests**

```powershell
npx vitest run src/features/ramps/types.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add web/src/features/ramps keeper/src/ramps/types.ts
git commit -m "feat: define verifiable ramp transaction states"
```

### Task 3: Harden the SDF test-anchor client

**Files:**

- Modify: `web/src/lib/anchor.ts`
- Create: `web/src/lib/anchor.test.ts`
- Modify: `web/src/screens/TopUp.tsx`
- Modify: `web/src/screens/SendPay.tsx`

**Interfaces:**

- Consumes: SEP-1 TOML, SEP-10 challenge, SEP-24 `/info`, interactive session, transaction status.
- Produces: a simulation session that cannot be confused with a live fiat order.

- [ ] **Step 1: Add tests for missing or disabled assets**

Test that `getAnchorInfo("USDC", "deposit")` throws when:

- `deposit.USDC` is absent.
- `deposit.USDC.enabled` is false.
- Limits are non-numeric.

- [ ] **Step 2: Add a direction parameter**

```ts
export async function getAnchorInfo(
  assetCode: string,
  direction: "deposit" | "withdraw",
): Promise<AnchorAssetInfo>
```

Remove the `1` and `10000` fallback for absent assets.

- [ ] **Step 3: Add origin validation and cleanup**

Allow messages only from the origin derived from the interactive session URL. Remove listeners when the popup closes, the component unmounts, or a terminal transaction state arrives.

- [ ] **Step 4: Poll SEP-24 transaction status**

Persist the session ID and use the existing transaction endpoint. Map SEP-24 states into `RampStatus`. Treat a popup close as `awaiting_user` or `cancelled`, never `completed`.

- [ ] **Step 5: Remove fake local success**

On network or authentication failure:

- Keep the user on the form.
- Show the error.
- Do not call `recordTopUp()` or `offramp()`.
- Do not create an Activity row.

- [ ] **Step 6: Commit**

```powershell
git add web/src/lib/anchor.ts web/src/lib/anchor.test.ts web/src/screens/TopUp.tsx web/src/screens/SendPay.tsx
git commit -m "fix: make test anchor sessions honest and verifiable"
```

### Task 4: Build provider capability and session endpoints

**Files:**

- Create: `keeper/src/ramps/service.ts`
- Create: `keeper/src/ramps/providers/moonpay.ts`
- Create: `keeper/src/ramps/providers/transak.ts`
- Modify: `keeper/src/index.ts`
- Create: `keeper/src/ramps/service.test.ts`

**Interfaces:**

- Consumes: `POST /ramps/capabilities`, `POST /ramps/sessions`, provider adapters.
- Produces: normalized capabilities and sessions without exposing secrets.

- [ ] **Step 1: Write endpoint contract tests**

```ts
it("rejects a malformed Stellar address", async () => {
  const response = await worker.fetch(
    request("/ramps/sessions", {
      provider: "moonpay",
      walletAddress: "not-a-stellar-address",
    }),
    env,
  );
  expect(response.status).toBe(400);
});
```

Add tests for:

- Unsupported origin.
- Unsupported provider.
- Missing exact capability.
- Upstream timeout.
- Redacted upstream error.
- Rate-limited IP.

- [ ] **Step 2: Add request validation**

Use Stellar `StrKey.isValidEd25519PublicKey()` for wallet addresses. Limit request body size and accept only enumerated provider, country, fiat, asset, network, and direction values.

- [ ] **Step 3: Move current MoonPay and Transak code into adapters**

Each adapter implements:

```ts
export interface RampProvider {
  id: string;
  getCapabilities(input: CapabilityInput): Promise<RampCapability[]>;
  createSession(input: CreateSessionInput): Promise<RampSession>;
  getTransaction(id: string): Promise<RampTransaction>;
}
```

- [ ] **Step 4: Remove sensitive logs**

Log:

- Provider.
- Shunt request ID.
- HTTP status.
- Duration.
- Stable provider error code.

Do not log API keys, signed URLs, JWTs, HMAC inputs, raw KYC bodies, wallet-provider response bodies, or upstream HTML.

- [ ] **Step 5: Add route-specific rate limiting**

Rate limit capability checks and session creation independently from `/trigger`. Use the Cloudflare Rate Limiting binding when the installed Wrangler version is upgraded to at least the documented minimum; until then, use the existing KV limiter with distinct keys and conservative quotas.

- [ ] **Step 6: Run Worker tests**

```powershell
cd keeper
npm test
npm run typecheck
```

- [ ] **Step 7: Commit**

```powershell
git add keeper/src keeper/wrangler.toml keeper/package.json keeper/package-lock.json
git commit -m "feat: add capability-driven ramp provider service"
```

### Task 5: Run the Alchemy Pay exact-route spike

**Files:**

- Create: `keeper/src/ramps/providers/alchemy-pay.ts`
- Modify: `keeper/src/env.ts`
- Modify: `keeper/src/ramps/service.ts`
- Test: `keeper/src/ramps/service.test.ts`
- Evidence: `docs/evidence/alchemy-pay-route.json`

**Interfaces:**

- Consumes: Alchemy Pay partner credentials and capability/session APIs.
- Produces: live capability and hosted session for the exact Shunt route.

- [ ] **Step 1: Obtain sandbox and production-partner documentation**

Request:

- Hosted checkout/session API.
- Supported-token API.
- Country and payment-method API.
- Webhook signature specification.
- Transaction status API.
- Partner activation requirements.

- [ ] **Step 2: Query the exact buy route**

Inputs:

```json
{
  "country": "ID",
  "fiat": "IDR",
  "asset": "USDC",
  "network": "XLM",
  "direction": "buy"
}
```

Sanitize the saved evidence. Keep route identifiers, supported methods, limits, fee fields, environment, and timestamp. Remove keys, user identifiers, signatures, and KYC data.

- [ ] **Step 3: Apply the go/no-go rule**

**Go:** the provider returns the exact route for Shunt's account and creates a session addressed to a valid Stellar wallet.

**No-go:** any ingredient is inferred from separate marketing pages, the provider silently changes the network, or the order cannot deliver Stellar USDC.

- [ ] **Step 4: Query the exact sell route**

Repeat with `"direction": "sell"`. Treat buy and sell as independent capabilities.

- [ ] **Step 5: Implement only confirmed directions**

Do not expose a `sell` button if only `buy` passes.

- [ ] **Step 6: Commit**

```powershell
git add keeper/src/ramps docs/evidence/alchemy-pay-route.json
git commit -m "feat: add confirmed Alchemy Pay ramp capabilities"
```

### Task 6: Add Banxa as a controlled on-ramp fallback

**Files:**

- Create: `keeper/src/ramps/providers/banxa.ts`
- Modify: `keeper/src/ramps/service.ts`
- Test: `keeper/src/ramps/service.test.ts`

**Interfaces:**

- Consumes: Banxa live partner configuration.
- Produces: buy capability only when `USDC/XLM` is enabled for `ID`.

- [ ] **Step 1: Query Banxa's live lookup endpoint**

Require the partner-specific response to include buy support for USDC on XLM and Indonesia eligibility.

- [ ] **Step 2: Assert that sell remains hidden**

```ts
expect(capabilities).not.toContainEqual(
  expect.objectContaining({
    provider: "banxa",
    asset: "USDC",
    network: "XLM",
    direction: "sell",
    available: true,
  }),
);
```

- [ ] **Step 3: Add hosted checkout**

Pass the user's Stellar address and no secret-bearing data in the browser URL. Persist the Banxa order ID.

- [ ] **Step 4: Commit**

```powershell
git add keeper/src/ramps
git commit -m "feat: add Banxa Stellar on-ramp fallback"
```

### Task 7: Complete MoneyGram staging and Production Preview

**Files:**

- Modify: `web/public/.well-known/stellar.toml` if the deployed file is generated elsewhere, update that source instead.
- Modify: `web/src/lib/anchor.ts`
- Create: `web/src/features/ramps/moneygram.ts`
- Modify: `docs/anchor-integration.md`
- Evidence: `docs/evidence/moneygram-preview-checklist.md`

**Interfaces:**

- Consumes: approved wallet domain, MoneyGram staging domain, SEP-10, SEP-24, status polling, reference number.
- Produces: a certified staging flow and, if approved, a real low-value preview flow.

- [ ] **Step 1: Verify deployed wallet identity**

Confirm:

- `https://shuntapp.xyz/.well-known/stellar.toml` returns `200`.
- Content type is TOML.
- Network passphrase is testnet for staging.
- `SIGNING_KEY` matches the key submitted to MoneyGram.
- The domain passed as `home_domain` is exactly `shuntapp.xyz`.

- [ ] **Step 2: Get explicit allowlist confirmation**

Record the MoneyGram response date, environment, approved home domain, provided endpoint/domain, test cases, and contact. Do not store private correspondence or PII in the public repo.

- [ ] **Step 3: Run staging lifecycle**

Complete:

1. SEP-10 challenge.
2. Wallet signature.
3. SEP-24 interactive deposit.
4. Status polling.
5. Test USDC receipt.
6. SEP-24 interactive withdrawal.
7. USDC send with exact memo.
8. Reference number retrieval.

- [ ] **Step 4: Test Production Preview**

Use a trivial amount inside MoneyGram's documented preview limits. Confirm the flow returns a participating Ramps location that the tester can access. Stop before presenting it as an Indonesia route if the location is absent.

- [ ] **Step 5: Display cash pickup facts**

The UI must show:

- Selected location.
- Identification requirement.
- Reference number.
- Pickup status.
- Provider limits.
- Provider fee and exchange rate.

- [ ] **Step 6: Commit**

```powershell
git add web/public/.well-known/stellar.toml web/src docs/anchor-integration.md docs/evidence/moneygram-preview-checklist.md
git commit -m "feat: complete MoneyGram ramp lifecycle"
```

### Task 8: Add durable ramp transactions and webhook reconciliation

**Files:**

- Create: `keeper/src/ramps/webhooks.ts`
- Create: `keeper/src/ramps/webhooks.test.ts`
- Modify: `keeper/src/index.ts`
- Modify: `keeper/src/env.ts`
- Create: `web/src/screens/RampTransaction.tsx`
- Modify: `web/src/App.tsx`

**Interfaces:**

- Consumes: signed provider callbacks, provider transaction lookup, Horizon payments.
- Produces: idempotent `RampTransaction` status and settlement evidence.

- [ ] **Step 1: Write webhook signature tests**

Cover:

- Valid signature.
- Invalid signature.
- Replayed event ID.
- Out-of-order status.
- Duplicate completion.
- Completion without matching transaction.

- [ ] **Step 2: Store minimal transaction records**

Store no KYC documents. Persist:

- Shunt transaction ID.
- Provider.
- Provider transaction ID.
- Wallet public key.
- Direction.
- Asset/network.
- Fiat currency and amount.
- Crypto amount.
- Environment.
- Status.
- Event IDs.
- Transaction hash or cash reference.
- Timestamps.

- [ ] **Step 3: Make updates idempotent**

A repeated provider event must return `200` without duplicating activity or settlement.

- [ ] **Step 4: Reconcile on-ramp with Horizon**

Match:

- Destination wallet.
- Expected asset code and issuer.
- Amount tolerance from the quote.
- Provider memo or transaction metadata when available.
- A ledger time after session creation.

- [ ] **Step 5: Reconcile off-ramp**

Confirm the outgoing on-chain transaction uses the provider address and exact memo. Mark `completed` only when the provider reaches a terminal completed state.

- [ ] **Step 6: Add refresh recovery**

Route:

```text
/ramps/:transactionId
```

The page fetches current status and renders the next action after reload.

- [ ] **Step 7: Commit**

```powershell
git add keeper/src/ramps keeper/src/index.ts web/src/screens/RampTransaction.tsx web/src/App.tsx
git commit -m "feat: reconcile ramp sessions with provider and chain evidence"
```

### Task 9: Redesign Add money around capability and trust

**Files:**

- Create: `web/src/features/ramps/RampMethodCard.tsx`
- Create: `web/src/features/ramps/EnvironmentDisclosure.tsx`
- Create: `web/src/features/ramps/RampStatusPanel.tsx`
- Modify: `web/src/screens/TopUp.tsx`
- Modify: `web/src/styles/tokens.css`
- Create: `web/e2e/14-ramp-truthfulness.spec.ts`

**Interfaces:**

- Consumes: normalized capabilities and sessions.
- Produces: one clear live method section and a separate developer-demo section.

- [ ] **Step 1: Write E2E assertions before the UI change**

```ts
test("test anchor never claims to move IDR", async ({ page }) => {
  await page.goto("/topup");
  const demo = page.getByTestId("ramp-method-sdf-test-anchor");
  await expect(demo).toContainText("Stellar testnet simulation");
  await expect(demo).toContainText("No rupiah or real USDC moves");
  await expect(demo).not.toContainText("You pay");
});
```

Add assertions that:

- “Global” is absent.
- Disabled providers have visible explanations.
- Live providers appear only from capability responses.
- Fees are labeled by source.
- A failed session creates no activity row.

- [ ] **Step 2: Replace the form-first layout**

Show method selection first. Ask for an amount only after the user selects a method. A cash provider may need a location before amount confirmation; a card provider may need fiat-first entry.

- [ ] **Step 3: Separate live and demo**

Use:

```text
Available for Indonesia
[provider methods returned by capability API]

Developer demo
[Stellar test flow]
```

- [ ] **Step 4: Remove hardcoded provider economics**

For the SDF simulation, show test limits and no fiat quote. For a live provider, show its quote response. Add Shunt's fee only when Shunt charges one in that environment.

- [ ] **Step 5: Use independent request state**

```ts
type ProviderRequestState = Record<
  string,
  { status: "idle" | "loading" | "error"; message?: string }
>;
```

- [ ] **Step 6: Handle popup blockers**

Open a blank window synchronously from the click. Navigate it after session creation. If the browser blocks the window, render a normal link.

- [ ] **Step 7: Run focused E2E**

```powershell
cd web
npx playwright test e2e/14-ramp-truthfulness.spec.ts
```

- [ ] **Step 8: Commit**

```powershell
git add web/src/features/ramps web/src/screens/TopUp.tsx web/src/styles/tokens.css web/e2e/14-ramp-truthfulness.spec.ts
git commit -m "feat: separate live add-money methods from simulation"
```

### Task 10: Redesign Withdraw by user intent

**Files:**

- Modify: `web/src/screens/SendPay.tsx`
- Create: `web/src/screens/Withdraw.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/components/TabBar.tsx`
- Test: `web/e2e/14-ramp-truthfulness.spec.ts`

**Interfaces:**

- Consumes: sell capabilities, wallet balance, provider session API.
- Produces: `/withdraw` for cash/bank/card and `/send` for crypto transfer.

- [ ] **Step 1: Split fiat withdrawal from crypto sending**

Move USDC off-ramp and local settlement choices out of `SendPay.tsx`. Keep direct crypto transfer and SEP-7 payment in Send.

- [ ] **Step 2: Show methods returned for the wallet's country**

Do not display a bank/card/cash promise when the provider returns no route.

- [ ] **Step 3: Add MoneyGram pickup UX**

When available, show:

- “Cash pickup”.
- Distance/location.
- Opening hours if returned.
- Required identification.
- Preview/live badge.
- Estimated receive amount.

- [ ] **Step 4: Label exchange handoff correctly**

If the only available action is sending USDC or XLM to an exchange deposit address, label it “Send to exchange”. Do not label it “Withdraw to bank”.

- [ ] **Step 5: Add navigation and tests**

Ensure Home has distinct Send and Withdraw actions. Test keyboard navigation and mobile layout.

- [ ] **Step 6: Commit**

```powershell
git add web/src/screens/SendPay.tsx web/src/screens/Withdraw.tsx web/src/App.tsx web/src/components/TabBar.tsx web/e2e/14-ramp-truthfulness.spec.ts
git commit -m "refactor: separate crypto send from fiat withdrawal"
```

### Task 11: Reduce the AI-effect stack

**Files:**

- Modify: `web/src/screens/Onboarding.tsx`
- Modify: `web/src/components/AnimatedBackground.tsx`
- Modify: `web/src/styles/tokens.css`
- Remove only after confirming no remaining imports: `web/src/components/ShinyText.tsx`, `web/src/components/Threads.tsx`, `web/src/components/Aurora.tsx`, `web/src/components/Particles.tsx`

**Interfaces:**

- Consumes: existing brand colors and content.
- Produces: a quieter visual system with one signature motion behavior.

- [ ] **Step 1: Choose one signature effect**

Keep the allocation bar animation because it explains the product. Remove shiny text, cursor tilt, trust marquee, floating card loop, and WebGL background from the main story.

- [ ] **Step 2: Replace the ten-part landing template with four sections**

1. Specific freelancer problem and product action.
2. Interactive income split example.
3. Evidence: signed transaction, vault contract, and test/live labels.
4. One CTA.

- [ ] **Step 3: Preserve lane colors but simplify surfaces**

Use lane colors for data and state. Use lime for the main action. Remove decorative violet/blue accents where they do not encode a lane or state.

- [ ] **Step 4: Reduce glass cards**

Use boundaries only for:

- A distinct transaction.
- A selectable method.
- A grouped balance.
- A warning.

Use spacing and rules for explanatory content.

- [ ] **Step 5: Move repeated inline styles to named classes**

Start with Top Up, Withdraw, Home, and Onboarding. Do not convert all 579 occurrences in one commit. Target the styles that define layout, button states, alerts, status badges, and provider cards.

- [ ] **Step 6: Verify reduced motion**

With `prefers-reduced-motion: reduce`, all nonessential animation stops and the allocation state remains understandable.

- [ ] **Step 7: Commit**

```powershell
git add web/src/screens/Onboarding.tsx web/src/components web/src/styles/tokens.css
git commit -m "design: focus Shunt visuals on allocation and transaction trust"
```

### Task 12: Rewrite product copy around a concrete person and proof

**Files:**

- Create: `web/src/content/product-copy.ts`
- Modify: `web/src/screens/Onboarding.tsx`
- Modify: `web/src/screens/Home.tsx`
- Modify: `web/src/screens/ConnectWallet.tsx`
- Modify: `web/src/screens/TopUp.tsx`
- Modify: `web/src/screens/Withdraw.tsx`
- Modify: `web/src/screens/Activity.tsx`
- Test: `web/src/content/product-copy.test.ts`

**Interfaces:**

- Consumes: feature status and environment.
- Produces: direct English product copy with no unsupported financial claim.

- [ ] **Step 1: Add forbidden-claim tests**

```ts
const forbidden = [
  "seamless",
  "global",
  "instant cash",
  "without leaving Shunt",
  "powered by MoneyGram",
];

for (const phrase of forbidden) {
  expect(JSON.stringify(productCopy).toLowerCase()).not.toContain(phrase);
}
```

- [ ] **Step 2: Replace the hero**

Recommended:

```text
Split freelance income before you spend it.

When USDC lands, Shunt shows the split. You approve once. Savings move into
a timelocked vault; spending money stays in your wallet.
```

Do not call the approval flow automatic.

- [ ] **Step 3: Replace generic proof**

Use:

```text
Built on Stellar testnet
49 Soroban contract tests
SEP-24 test flow
Live fiat provider: [name only when confirmed]
```

Avoid a moving trust marquee.

- [ ] **Step 4: Rewrite activity labels**

Each row must encode:

- Environment.
- Provider.
- State.
- Evidence link when available.

Examples:

```text
Stellar test deposit · waiting for test payment
Alchemy Pay · USDC received
MoneyGram Preview · cash pickup ready
```

- [ ] **Step 5: Score the copy**

Use the Stop Slop dimensions:

- Directness: at least 8/10.
- Rhythm: at least 7/10.
- Trust: at least 9/10.
- Authenticity: at least 8/10.
- Density: at least 8/10.

Minimum total: 40/50.

- [ ] **Step 6: Commit**

```powershell
git add web/src/content web/src/screens
git commit -m "copy: state Shunt actions and ramp status plainly"
```

### Task 13: Build a provider evidence contract test

**Files:**

- Create: `web/e2e/15-ramp-live-contract.spec.ts`
- Modify: `web/e2e/06-onramp-offramp.spec.ts`
- Modify: `web/e2e/README.md`

**Interfaces:**

- Consumes: simulation fixture and optional live-provider fixture.
- Produces: separate test reports for protocol simulation and live settlement.

- [ ] **Step 1: Rename the existing suite**

Use:

```ts
test.describe("SDF test-anchor protocol simulation", () => {
  // SEP-1, SEP-10, SEP-24 session and test status
});
```

- [ ] **Step 2: Add live test gates**

Run live tests only when:

```text
RAMP_LIVE_PROVIDER
RAMP_LIVE_WALLET
RAMP_LIVE_MAX_FIAT
```

are set in the test environment.

- [ ] **Step 3: Require settlement evidence**

For live on-ramp, assert:

- Provider transaction completed.
- Stellar transaction hash exists.
- Destination is the test wallet.
- Asset and issuer match production Stellar USDC.

For live MoneyGram off-ramp, assert:

- Provider reached pickup-ready or completed.
- Cash reference exists.
- Location exists.
- The outgoing Stellar payment has the exact memo.

- [ ] **Step 4: Keep live amounts trivial**

Cap the test through `RAMP_LIVE_MAX_FIAT`. Abort when a provider quote exceeds it.

- [ ] **Step 5: Commit**

```powershell
git add web/e2e
git commit -m "test: separate ramp simulation from live settlement proof"
```

### Task 14: Align README, submission, demo, and jury answers

**Files:**

- Modify: `README.md`
- Modify: `SUBMISSION.md`
- Modify: `docs/demo-script.md`
- Modify: `docs/judging-qa.md`
- Modify: `docs/anchor-integration.md`

**Interfaces:**

- Consumes: verified build and provider evidence.
- Produces: one consistent claim set.

- [ ] **Step 1: Use a claim matrix**

| Claim | Required evidence |
| --- | --- |
| SEP-24 client implemented | SDF test-anchor session and status trace |
| MoneyGram staging integrated | Allowlisted Shunt domain and completed staging lifecycle |
| MoneyGram Production Preview | Mainnet provider transaction and preview reference |
| Live Indonesia on-ramp | Completed provider order and matching Stellar transaction |
| Live Indonesia off-ramp | Completed provider payout/pickup and matching outgoing transaction |

- [ ] **Step 2: Replace “no mocks”**

Recommended:

```text
Shunt's split and vault transactions execute on Stellar testnet. The fiat
protocol demo uses the SDF SEP-24 test anchor. Live provider routes are labeled
separately and appear only when enabled for the user's country and asset.
```

- [ ] **Step 3: Prepare the jury answer**

Recommended:

```text
The earlier build mixed a protocol simulator with a fiat promise. We separated
them. The test lane proves SEP-10 and SEP-24 on Stellar testnet and says that no
rupiah moves. The live lane is capability-driven: Shunt only shows a provider
after its API confirms Indonesia, IDR, USDC, Stellar, and transaction direction.
We then reconcile the provider order with the Stellar transaction before the UI
says it completed.
```

- [ ] **Step 4: Answer the MoneyGram question**

Recommended:

```text
MoneyGram's current Ramps flow is cash pickup or cash deposit at a participating
MoneyGram Ramps location. It resembles an agent flow, but users cannot assume
that any BRILink or any MoneyGram remittance outlet supports it. Shunt must use
the location returned by MoneyGram. Bank and mobile-wallet Ramps are listed by
MoneyGram as upcoming, so we do not claim them today.
```

- [ ] **Step 5: Commit**

```powershell
git add README.md SUBMISSION.md docs
git commit -m "docs: align demo claims with ramp evidence"
```

### Task 15: Run release verification

**Files:**

- No product changes.
- Evidence output goes to the local test report; do not commit KYC or secrets.

**Interfaces:**

- Consumes: completed tasks.
- Produces: a release decision.

- [ ] **Step 1: Run static checks**

```powershell
cd web
npm run build
npm test
```

```powershell
cd ..\keeper
npm run typecheck
npm test
```

- [ ] **Step 2: Run contract tests**

```powershell
cd ..\contracts\shunt-vault
cargo test
```

- [ ] **Step 3: Run focused ramp E2E**

```powershell
cd ..\..\web
npx playwright test e2e/06-onramp-offramp.spec.ts e2e/14-ramp-truthfulness.spec.ts
```

- [ ] **Step 4: Run the full E2E suite**

```powershell
npm run test:e2e
```

- [ ] **Step 5: Run secret and claim scans**

```powershell
git grep -n -E 'sk_(test|live)_|API_SECRET\s*=\s*"[^"]+"|SECRET_KEY\s*=\s*"[^"]+"'
git grep -n -i -E 'powered by moneygram|alternative methods \(global\)|without leaving shunt|no mocks'
```

Expected:

- No secret values.
- Each flagged claim is removed or appears only in an explicit historical explanation.

- [ ] **Step 6: Manual accessibility and visual checks**

Test:

- 320 px, 390 px, 768 px, 1024 px, and 1440 px widths.
- 200% browser zoom.
- Keyboard-only method selection and transaction status.
- Screen reader labels on environment badges and status.
- Reduced motion.
- Popup blocked.
- Provider timeout.
- Provider cancellation.
- Page refresh during `awaiting_fiat`.

- [ ] **Step 7: Apply release gates**

**Release the simulation lane** when:

- Copy states that no fiat moves.
- Failure creates no fake activity.
- Session status survives refresh.
- SDF test-anchor E2E passes.

**Release a live on-ramp provider** when:

- Exact capability is returned for Shunt.
- Session creation passes.
- Webhook signature verification passes.
- One small live order reaches the wallet.
- Horizon reconciliation stores the transaction hash.

**Release MoneyGram cash withdrawal** when:

- Shunt's domain is approved.
- Staging lifecycle passes.
- Preview/live flow returns a participating location.
- The reference number and outgoing memo are verified.

---

## 7. Hackathon execution order

### First 2 hours

1. Rotate and remove secrets.
2. Correct simulation copy and remove fake fallback activity.
3. Update README/demo claims.
4. Fix E2E selectors broken by the current button label.

### Hours 3–6

1. Add normalized capability and session types.
2. Harden MoonPay/Transak Worker endpoints.
3. Run Alchemy Pay and Banxa exact-route checks.
4. Continue MoneyGram allowlist and Production Preview request.

### Hours 7–12

1. Integrate the first provider that passes the exact-route gate.
2. Add transaction persistence and callback handling.
3. Reconcile one low-value order with Horizon.
4. Capture sanitized evidence.

### After the ramp proof

1. Split Withdraw from Send.
2. Remove the landing-page effect stack.
3. Consolidate repeated styles in the four demo-critical screens.
4. Run the full release gate.

If no live provider passes within the time box, stop provider coding. Present the SDF flow as a simulator and show the capability architecture plus written provider evidence. A truthful protocol demo is stronger than a hosted checkout that cannot settle.

---

## 8. Demo narrative

### If Alchemy Pay live on-ramp succeeds

```text
This first route is live for this test user. Shunt asked the provider for the
exact Indonesia, IDR, USDC, and Stellar capability. The provider returned the
payment methods and quote. After checkout, Shunt waits for both the provider
status and the matching Stellar payment. Only then does it offer the income
split.
```

### If MoneyGram Preview succeeds

```text
This is MoneyGram Production Preview on Stellar mainnet with a capped amount.
The provider handles identity and cash settlement. Shunt handles wallet signing,
status, the exact memo, and the pickup reference. A user must visit the
participating location returned by MoneyGram.
```

### If only simulation is ready

```text
This is the SDF test anchor. It proves our SEP-10 and SEP-24 wallet integration;
it does not move rupiah. We separated that simulator from live providers after
the earlier demo made the boundary unclear. Live methods now appear only after
the provider confirms the exact route.
```

---

## 9. Acceptance criteria

### Trust

- [ ] No tracked provider secret.
- [ ] No provider secret or signed URL in logs.
- [ ] No fake Activity row on session failure.
- [ ] No “completed” state without settlement evidence.
- [ ] No “global” provider claim.
- [ ] No testnet screen claims to charge IDR.
- [ ] No MoneyGram partnership branding before approval.

### Integration

- [ ] SDF test anchor is labeled simulation.
- [ ] Capability checks include country, fiat, asset, network, and direction.
- [ ] Live provider sessions persist provider transaction IDs.
- [ ] Webhooks verify signatures and replay IDs.
- [ ] On-ramp completion reconciles with Horizon.
- [ ] Off-ramp completion reconciles provider status and outgoing Stellar payment.
- [ ] MoneyGram cash flow shows a participating location and reference number.

### UI/UX

- [ ] Add money and Withdraw are separate user intents.
- [ ] Live and demo methods occupy separate sections.
- [ ] Provider limitations are visible without hover.
- [ ] Method cards use one consistent component.
- [ ] Top Up, Withdraw, Home, and Onboarding use named layout classes.
- [ ] One signature product animation remains.
- [ ] Reduced motion and keyboard operation work.
- [ ] Copy says what happened and what the user must do next.

### Evidence

- [ ] Test-anchor E2E proves protocol behavior and says so.
- [ ] Live-provider E2E runs only with explicit live configuration.
- [ ] Sanitized evidence contains no secrets or KYC data.
- [ ] README, submission, demo script, and UI use the same status terms.

---

## 10. Sources

### Stellar and MoneyGram

- [Stellar anchors overview](https://developers.stellar.org/docs/learn/fundamentals/anchors)
- [Stellar ramps documentation](https://developers.stellar.org/docs/tools/ramps)
- [MoneyGram Ramps integration guide](https://developer.moneygram.com/moneygram-developer/docs/integrate-moneygram-ramps)
- [MoneyGram Ramps cash-in test location model](https://developer.moneygram.com/moneygram-developer/docs/on-ramp-cash-in-location-test-data)
- [MoneyGram Indonesia location finder](https://www.moneygram.com/locations/id/en)
- [MoneyGram Ramps product page](https://www.moneygram.com/intl/stellar/stellar-faq?terms=2025)

### Alternative providers

- [Alchemy Pay Indonesia payment methods and IDR](https://support.alchemypay.org/hc/en-us/articles/23455052460443-What-payment-methods-and-currencies-are-supported-on-Alchemy-Pay)
- [Alchemy Pay supported assets and networks](https://support.alchemypay.org/hc/en-us/articles/23559445456923-B2B-What-crypto-currencies-does-Alchemy-Pay-support)
- [Banxa supported countries](https://support.banxa.com/en/support/solutions/articles/44002216505-what-countries-are-supported-by-banxa-)
- [Banxa supported cryptocurrencies and blockchains](https://docs.banxa.com/products/native-api/docs/how-it-works/supported-cryptocurrencies-and-blockchains)
- [MoonPay unsupported countries](https://support.moonpay.com/en/articles/380968-moonpay-s-unsupported-countries)
- [MoonPay Stellar memo requirements](https://support.moonpay.com/en/articles/384513-about-destination-tags-and-memos)
- [Transak staging behavior](https://docs.transak.com/guides/sandbox-credentials)
- [Transak supported cryptocurrency lookup](https://docs.transak.com/api/public/get-crypto-currencies)
- [Ramp Network unsupported countries](https://support.rampnetwork.com/en/articles/433-which-countries-and-us-states-are-unsupported-for-buying-and-selling-crypto)
- [Onramper supported-assets API](https://docs.onramper.com/reference/get_supported)

### Cloudflare

- [Cloudflare Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Cloudflare environment variables](https://developers.cloudflare.com/workers/configuration/environment-variables/)
- [Cloudflare Worker rate-limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)

---

## 11. Plan self-review

- **Spec coverage:** The plan covers the two stated problems: generated-looking UI/copy and a ramp integration that judges can dismiss as a mock.
- **Provider decision:** The plan ranks concrete candidates and defines exact go/no-go evidence.
- **MoneyGram answer:** The plan distinguishes conventional MoneyGram locations from participating MoneyGram Ramps locations and does not equate them with BRILink.
- **Truth model:** Simulation, sandbox, preview, and live have separate labels and release gates.
- **Security:** The tracked-secret issue is the first task.
- **Type consistency:** `RampDirection`, `RampEnvironment`, `RampStatus`, `RampCapability`, `RampSession`, `RampTransaction`, and `SettlementEvidence` use the same names across frontend and Worker tasks.
- **Scope:** The plan avoids Soroban and split-engine refactors because they do not solve the jury feedback.
- **Placeholders:** Provider-specific code waits behind an exact capability response rather than invented endpoint fields.
