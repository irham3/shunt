<p align="center">
  <img src="design/hero.svg" alt="Shunt — income lands, instantly split" width="900">
</p>

<p align="center">
  <img alt="Stellar" src="https://img.shields.io/badge/Stellar-Testnet_live-BEF264?style=flat-square&logo=stellar&logoColor=white&labelColor=0B0F14">
  <img alt="Soroban" src="https://img.shields.io/badge/Soroban-Rust-F46623?style=flat-square&logo=rust&logoColor=white&labelColor=0B0F14">
  <img alt="React" src="https://img.shields.io/badge/React-TypeScript-38BDF8?style=flat-square&logo=react&logoColor=white&labelColor=0B0F14">
  <img alt="PWA" src="https://img.shields.io/badge/PWA-mobile--first-A78BFA?style=flat-square&labelColor=0B0F14">
  <img alt="Tests" src="https://img.shields.io/badge/contract_tests-19_passing-BEF264?style=flat-square&labelColor=0B0F14">
</p>

<p align="center">
  <b>🌐 Live app: <a href="https://shunt-app.vercel.app">shunt-app.vercel.app</a></b> · testnet · connect Freighter and try the loop
</p>

**Get paid in dollars. Keep them worth something. Never watch a month's income evaporate again.**

Shunt is a financial autopilot for people who earn from abroad. The moment USDC lands in your Stellar wallet, one tap splits it by rules you set once: spending money stays liquid, an emergency buffer builds itself, savings get **locked by code** in hard value the rupiah can't erode, and a slice is **dollar-cost-averaged into assets** — automatically, at the one moment discipline is easy: payday.

> *Shunt* (electronics): a component that diverts current into parallel paths so no single path overloads. Shunt does the same for your income.

---

## Why people use it

Freelancers and overseas workers who invoice in dollars face three quiet leaks:

1. **The single-balance trap.** When $2,000 lands as one number, all of it *feels* spendable — and two weeks later it's gone. Savings become whatever's left over, which rounds to zero.
2. **Rupiah erosion.** Money parked in IDR loses value year after year (~Rp18,000/USD and weakening). Saving in your local currency is running up a down escalator.
3. **No salary, no automation.** Irregular income defeats every payroll-based savings tool. The only clean moment to set money aside is *the instant it arrives* — exactly the moment Shunt captures.

What you get is not "an app that splits money into pockets." It's four concrete outcomes:

| Outcome                                     | How                                                                                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 💵**Savings that hold value**         | Kept in USDC, not IDR — your safety net stops shrinking                                                                                    |
| 🔒**Savings you can't sabotage**      | Locked by a Soroban contract with a timelock, not by a label in an app. Early exit costs 10% — which goes to*your own* buffer, not to us |
| 📈**Investing that actually happens** | A slice of every income is spot-converted (DCA) the moment it lands — the strategy everyone knows and nobody sticks to                     |
| 🔁**One app for the whole loop**      | Money in, structured, and out to your bank — anchors and partners handle fiat; you never leave Shunt                                       |

## One app, the whole money loop

<p align="center">
  <img src="design/money-loop.svg" alt="Animated loop: payment link and top-up in, one-tap split into four lanes, anchor cash-out" width="920">
</p>

| Direction           | Feature                                                                                                                                                                                                | Status                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| **In**        | **Payment request links (SEP-7)** — send a link or QR, get paid in USDC from anywhere; no "do you have crypto?" conversation. Card checkout for non-crypto payers lands with an on-ramp partner | ✅ shipped (card checkout 🔜) |
| **In**        | **Top Up (SEP-24 deposit)** — IDR in through a licensed anchor's hosted flow, lands as USDC                                                                                                     | ✅ shipped (testnet anchor)   |
| **Structure** | **One-tap split** into Needs / Savings / Buffer / Invest, atomic on-chain                                                                                                                        | ✅ shipped                    |
| **Structure** | **Invest lane** — spot DCA to XLM via path payment after each split                                                                                                                             | ✅ shipped                    |
| **Structure** | **In-app Convert** — XLM ⇄ USDC swap on the Stellar DEX (live quote, slippage floor), no third party                                                                                            | ✅ shipped                    |
| **Structure** | **Code-custody savings** with timelock + penalty-to-your-buffer                                                                                                                                  | ✅ shipped                    |
| **Out**       | **Cash-out (SEP-24 withdraw)** — Needs lane to IDR/PHP bank via allowlisted anchors, rate & fee shown first                                                                                     | ✅ shipped                    |

Shunt never touches fiat and never holds your keys — licensed anchors do fiat, your wallet and the vault contract do custody. That's what makes the loop possible without Shunt becoming a bank or a remittance company.

## How it works

<p align="center">
  <img src="design/how-it-works.svg" alt="Five steps: connect, set rules, income lands, one tap, auto-split" width="920">
</p>

|   | Step                   | What happens under the hood                                                                                                                                                                                                                                           |
| - | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | **Connect**      | Freighter browser wallet, one click. No app install, no sign-up, no custody.                                                                                                                                                                                          |
| 2 | **Set rules**    | Sliders for Needs / Savings / Buffer / Invest + a savings timelock. Saved on-chain via`set_rules` — the contract is the single source of truth.                                                                                                                    |
| 3 | **Income lands** | Via your payment link, a Top Up, or any direct USDC transfer. The keeper streams Horizon and detects it within seconds.                                                                                                                                               |
| 4 | **One tap**      | The keeper prepares an unsigned`distribute` transaction. You review the exact breakdown and sign. *Nothing moves without your signature.*                                                                                                                         |
| 5 | **Auto-split**   | One atomic Soroban transaction: Needs & Buffer stay in your wallet, Savings moves into the vault and the timelock starts. The Invest slice is then spot-converted to XLM by a follow-up path payment you approve in the same flow. Sub-cent fees, settled in seconds. |

**Where each lane lives — and why:**

| Lane                | Lives in           | Access             | Purpose                                                                                               |
| ------------------- | ------------------ | ------------------ | ----------------------------------------------------------------------------------------------------- |
| 🟡**Needs**   | Your wallet        | Anytime            | Daily spending; cash out to IDR/PHP via anchor when*you* choose                                     |
| 🟢**Savings** | The vault contract | After the timelock | Value-holding savings in USDC. Held by code — because a timelock in your own wallet would be fiction |
| 🔵**Buffer**  | Your wallet        | Instantly          | Emergency fund — no lock, no penalty, no questions                                                   |
| 🟣**Invest**  | Your wallet        | Anytime            | Spot DCA into XLM via Stellar path payment — an asset purchase, not a yield product                  |

Early savings withdrawals are possible but cost a **10% penalty — which isn't lost:** it's redirected into your Buffer credit inside the vault, withdrawable anytime. Discipline with a safety valve.

## Live on testnet

| Item                  | Value                                                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Vault contract (USDC) | [`CB27KRLQAJCQRW2GTH4ETXDSS2STMUU4K4QABIY5QEWGAGQQRJBKPW7K`](https://stellar.expert/explorer/testnet/contract/CB27KRLQAJCQRW2GTH4ETXDSS2STMUU4K4QABIY5QEWGAGQQRJBKPW7K) |
| USDC SAC (testnet)    | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`                                                                                                             |
| Keeper (Cloudflare Worker) | [`shunt-keeper.irhamtria.workers.dev`](https://shunt-keeper.irhamtria.workers.dev/health)                                                                        |

The vault ran the **complete lifecycle on-chain with real testnet USDC** (acquired on the DEX via path payment), including the savings-goals feature — every hash below is clickable proof:

```text
init (USDC SAC)                                         ✓ contract initialized
set_rules  60/25/15, 1-day timelock                     ✓ stored on-chain
distribute 10 USDC                                      ✓ split exactly 6 / 2.5 / 1.5, `split` event emitted
create_savings_goal "Emergency fund" 1.5 USDC            ✓ drawn from unallocated, aggregate untouched
withdraw_from_goal 0.5 (still locked)                   ✓ paid 0.45 — 10% penalty → Buffer credit, goal decrements
rename_savings_goal → "Dana Darurat"                    ✓ cosmetic only, amount unchanged
delete_savings_goal                                     ✓ 1.0 USDC principal released back to unallocated
```

Proof transactions: [deploy](https://stellar.expert/explorer/testnet/tx/25122644dc58ce1b041d72aac91d2885b208bc56042fb43d2e04bbff19d31cc2) · [init](https://stellar.expert/explorer/testnet/tx/eae9a0f8959db28603a0f2662d0b5bb9b529eb467de6d414f531c21c2dd42e19) · [set_rules](https://stellar.expert/explorer/testnet/tx/2ef8083f38e14c379812b593f795253322c22f84f55e9062fbb483ad04f11068) · [distribute](https://stellar.expert/explorer/testnet/tx/ce3ce8010df371369f0350b42b3a3fb973fd66d2feac747b208933b2beae5a11) · [create_savings_goal](https://stellar.expert/explorer/testnet/tx/698b60e1f87ab16dbe817e4efc7f046fc86427aefc9940dc82ee5cd64116209f) · [withdraw_from_goal](https://stellar.expert/explorer/testnet/tx/910b71a337e7d9843f65e3923e6870ec11efb67fa05e21f3359f103f0c2ef898) · [rename_savings_goal](https://stellar.expert/explorer/testnet/tx/73aaf921551e8ff41cd4d83a807c0a7b5b745734779cb96df8b3afd3f9523abe) · [delete_savings_goal](https://stellar.expert/explorer/testnet/tx/0e5faa0d837a07e1dfb492fd86e9e70b4bb456e44e34c25158f01c6e7a069906)

An earlier lifecycle proof (trustline, DEX purchase, basic split/withdraw) ran on the prior contract instance before the goals feature was added — same code path, same 7-decimal arithmetic, superseded by the deployment above.

## The app

Mobile-first (~390px column, PWA-installable), scaling to a desktop nav rail at ≥1024px.

| | | |
|:---:|:---:|:---:|
| <img src="design/screens/onboarding.png" width="260"><br>**Onboarding** | <img src="design/screens/connect_wallet.png" width="260"><br>**Connect wallet** | <img src="design/screens/home_dashboard.png" width="260"><br>**Home** |
| <img src="design/screens/configure_shunt.png" width="260"><br>**Configure Shunt** | <img src="design/screens/autosplit_confirm.png" width="260"><br>**Auto-split confirm** | <img src="design/screens/savings_vault.png" width="260"><br>**Savings vault** |
| <img src="design/screens/send_pay.png" width="260"><br>**Send & Pay** | <img src="design/screens/activity_history.png" width="260"><br>**Activity** | <img src="design/screens/settings_profile.png" width="260"><br>**Settings** |

### Level 1 — White Belt (testnet proof)

All four requirements are live in the app: wallet connect, XLM balance fetched from Horizon (visible on Home with a Friendbot fund button for empty accounts), native XLM transfer from the Send & Pay screen, and the resulting hash with a Stellar Expert explorer link. The on-chain lifecycle proof in [Live on testnet](#live-on-testnet) is independently verifiable on the explorer.

### Level 2 — Blue Belt (multi-wallet + events)

| Requirement | Screenshot |
|---|---|
| **Multi-Wallet Options**<br>Showing Freighter, Albedo, xBull | <img src="design/screenshots/blue-1-wallets.png" width="300" alt="Wallet options"> |
| **Real-time Event Toast**<br>Soroban split event detected | <img src="design/screenshots/blue-2-events.png" width="300" alt="Event listening"> |

## Architecture

<p align="center">
  <img src="design/architecture.svg" alt="Animated architecture: payer, wallet, keeper, web app, vault, anchor" width="920">
</p>

Three deliberate design principles:

- **The keeper holds zero keys — and is now optional for detection.** It only *watches* (Horizon payment stream, cursor-resumed reconnects) and *prepares* (unsigned XDR). Every fund movement requires your signature. Detection no longer depends on it at all: the app polls Horizon itself and flags un-split income client-side. The keeper's only remaining job is preparing the split XDR — stateless, replaceable, and open-API, so the in-app manual trigger does the identical thing and anyone can run their own. If it dies mid-demo, worst case is a short delay, never a fund risk.
- **Savings must be held by code.** A timelock on funds in your own wallet is theater — you could just transfer them out. `ShuntVault` holds the Savings lane and enforces the lock on-chain; `withdraw_savings` answers to your address and no one else's. Not third-party custody — code custody, owner-only.
- **Double idempotency.** The keeper deduplicates by transaction hash *and* the contract rejects repeated `inflow_key`s. A retry, a reconnect, or a hostile replay all hit the same wall: one income, one split, ever.

### `ShuntVault` contract API

| Function                                                                    | Auth | Description                                                                                       |
| --------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------- |
| `init(token)`                                                             | —   | One-time: binds the USDC SAC address.                                                             |
| `set_rules(user, needs_bps, savings_bps, buffer_bps, lock_secs, anchors)` | user | Split rules in basis points (must total 10,000) + off-ramp anchor allowlist.                      |
| `distribute(user, amount, inflow_key)`                                    | user | Atomic 3-lane split. Dust from 7-decimal rounding lands in Needs. Replay-proof via`inflow_key`. |
| `deposit(user, amount)`                                                   | user | Voluntary top-up into the savings vault.                                                          |
| `withdraw_savings(user, amount)`                                          | user | Free after the timelock; 10% penalty → Buffer credit before it.                                  |
| `withdraw_buffer(user, amount)`                                           | user | Withdraw Buffer credit — never locked.                                                           |
| `offramp(user, anchor, amount)`                                           | user | Sends USDC only to**allowlisted** anchor addresses.                                         |
| `create_savings_goal(user, label, initial_amount)`                        | user | Names a sub-allocation, drawn from the unallocated Savings pool. No funds move — bookkeeping only. |
| `withdraw_from_goal(user, goal_id, amount)`                               | user | Same penalty/timelock as `withdraw_savings`, scoped to one goal.                                  |
| `rename_savings_goal(user, goal_id, new_label)`                           | user | Cosmetic — no balance change.                                                                      |
| `delete_savings_goal(user, goal_id)`                                      | user | Removes the goal; its principal simply becomes unallocated again.                                 |
| `get_rules / get_savings / get_buffer_credit / get_lock`                  | —   | Read-only views.                                                                                  |
| `get_savings_goals / get_unallocated_savings`                             | —   | Read-only views for the goals feature.                                                            |

Errors are explicit (`NotInitialized`=1 … `LabelTooLong`=12); penalty and denominators are named constants (`PENALTY_BPS = 1_000`, `BPS_DENOM = 10_000`), not magic numbers. Nineteen unit tests (the original eleven, untouched, plus eight new ones) cover the exact split, dust (no stroop lost, ever), replay rejection, rules validation, timelock behavior, the allowlist, and the full goals lifecycle. **The Invest lane still does not touch this contract** — the invest share stays wallet-side and converts via a classic path payment. The savings-goals functions were added additively: they only read/write a new `Goals(Address)` key and never touch the existing `Savings`/`LockUntil`/`BufferCredit` logic those eleven original tests exercise, so the contract's core split-and-lock guarantees are unchanged even though it's no longer literally frozen.

## Money in, money out (the anchor stack)

Both directions run on the standard Stellar anchor rails, implemented in [`web/src/lib/anchor.ts`](web/src/lib/anchor.ts):

1. **SEP-1** — discover the anchor's endpoints from its `stellar.toml`.
2. **SEP-10** — prove wallet ownership by signing a challenge (no password, no account).
3. **SEP-24** — the anchor's hosted flow opens for KYC and bank details; Shunt polls the transaction status. `withdraw` = cash-out, `deposit` = Top Up — same stack, mirrored.

Plus **SEP-7** payment request links: a `web+stellar:pay` URI + QR any compatible wallet can open — the payee never explains crypto to a client again.

Rate and fee are always shown **before** confirmation. The default anchor is SDF's test anchor. **The corridor is pluggable, not hard-wired:** because off-ramp is generic SEP-24 plus an on-chain anchor allowlist, swapping to a production corridor is configuration, not a contract change. A regulated IDR stablecoin (IDRX is one candidate) or a PHP anchor are the corridors we'd target — which one settles fiat in production is a partnership-and-regulation question, not an unsolved technical one. The shipped cash-out uses the anchor's standard SEP-24 hosted withdraw; the contract also ships a separate `offramp()` path gated by an on-chain anchor allowlist (unit-tested) for contract-enforced destination control, which a future release wires into the hosted flow. Settlement time is the anchor's (KYC involved) — Shunt reports it honestly instead of pretending it's instant.

## Business model — service fees, never interest

Every revenue line is a transparent fee on a service the user *wants*: 0.4% on Needs-lane cash-out, a similar fee on Top Up and on Invest conversions. **No lending, no yield products, no cut of your savings** — by design, not by omission: interest-based yield would add unnecessary smart-contract risk. The 10% early-withdrawal penalty goes to *your own* buffer, not to us. Savings deposits and post-lock withdrawals are free, forever.

Blended take-rate is ~0.29% of processed volume — **15–20× cheaper than the 5–7% remittance/bank conversion** it replaces, so the fee is headroom, not a barrier. A full illustrative model (ARPU, CAC, payback, LTV, break-even, and the assumptions that would break it) lives in [`docs/unit-economics.md`](docs/unit-economics.md).

## Quickstart

```bash
# 1. Contracts — test & build (Rust + stellar CLI)
cd contracts/shunt-vault
cargo test                      # 19 tests
stellar contract build

#    Deploy your own instance (or use the testnet one above)
stellar contract deploy --wasm target/wasm32v1-none/release/shunt_vault.wasm \
  --source <IDENTITY> --network testnet
stellar contract invoke --id <CONTRACT_ID> --source <IDENTITY> --network testnet \
  -- init --token CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA

# 2. Keeper — inflow detection + tx preparation (Cloudflare Worker)
cd keeper
npm install
npx wrangler dev --local        # http://localhost:8787
#   Config lives in wrangler.toml (no .env file). Deploy with `npx wrangler deploy`.

# 3. Web app
cd web
cp .env.example .env            # VITE_VAULT_CONTRACT_ID (+ anchor domain, keeper URL)
npm install && npm run dev      # http://localhost:5173

# 4. End-to-end tests — REAL testnet, no mocks (see web/e2e/README.md)
npx playwright install chromium # once
npm run test:e2e                # funds a throwaway account via Friendbot, buys real
                                # USDC on the DEX, then walks the whole loop:
                                # rules → split → vault & goals → anchor in/out → send
```

No contract configured? The app runs in **local demo mode** — the full flow (connect → rules → simulated income → one-tap split → vault → cash-out) works with local state, so you can feel the product before touching a faucet. The "Simulate incoming income" button lives in Settings.

## Repository layout

```
contracts/shunt-vault/   Soroban contract — split engine + savings vault (Rust)
web/                     React + TypeScript app, mobile-first, PWA-ready (Vite)
keeper/                  Cloudflare Worker — 1-min cron poll of Horizon, prepares distribute XDR
design/                  Diagrams (animated SVG) + app screenshots
```

## Honest limitations

- **One tap per income, by design.** Soroban's `require_auth` wants a signature per invocation — and the Invest conversion is a second signature (a Soroban tx is single-operation by protocol). Never over-claimed as hands-free.
- **The keeper is centralized** in this version — but it holds zero keys, income detection now runs client-side from Horizon (so the keeper isn't needed to *notice* income), and a manual trigger replaces its one remaining job. A single point of *convenience*, never of custody or fund safety.
- **The keeper watches an explicit account list** (`WATCH_ACCOUNTS`), not every user automatically — its cron poll is demo-scoped. Per-user auto-detection at scale runs client-side today; a subscription/index model for the keeper is roadmap.
- **The keeper's `/trigger` endpoint is open** (CORS `*`) — by design it only *builds an unsigned XDR* that is worthless without the owner's signature, so it is not a fund risk, but it is unauthenticated and could be spammed; origin-allowlisting and rate-limiting are roadmap hardening.
- **Anchor settlement is not instant** — KYC is involved, and the UI says so instead of hiding it.
- **The vault is unaudited and not upgradeable**, and `init` has no admin gate (first caller binds the token, one-time). Keep real amounts trivial until an audit; an upgradeable admin-gated redeploy is a pre-mainnet step.
- **Off-ramp destination control:** the shipped cash-out is the anchor's standard SEP-24 hosted withdraw; the contract's allowlisted `offramp()` path exists and is unit-tested but is not yet wired into that hosted flow.
- **Mainnet:** all on-chain proof today is testnet (with real testnet USDC). A trivial mainnet split is a pre-launch step, not claimed as done.

## Roadmap

|                 |                                                                                                                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Next**  | Production IDR corridor (IDRX) · card checkout on payment links (on-ramp partner) · anchor status webhooks                                                                              |
| **Later** | Session keys — truly hands-free splits · split + invest in one signature (AMM router) · allocated-gold invest option · goal-based savings · native mobile · keeper decentralization |

---

<p align="center">
  <sub>⑃ money in · structured by code · money out — and the savings lane never lies to you</sub>
</p>
