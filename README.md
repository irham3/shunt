# Shunt

> **Ramp status, July 2026:** Shunt's Stellar split and vault flows run on testnet. The SDF SEP-24 flow is a labeled Stellar testnet simulation. Provider sandboxes are shown separately. A route is called live only after a licensed provider returns the exact country, fiat, asset, network, direction, order status, and matching Stellar mainnet settlement.

<p align="center">
  <img src="design/hero.svg" alt="Shunt — Automated money routing" width="900">
</p>

<p align="center">
  <img alt="Stellar" src="https://img.shields.io/badge/Stellar-Testnet_live-BEF264?style=flat-square&logo=stellar&logoColor=white&labelColor=0B0F14">
  <img alt="Soroban" src="https://img.shields.io/badge/Soroban-Rust-F46623?style=flat-square&logo=rust&logoColor=white&labelColor=0B0F14">
  <img alt="React" src="https://img.shields.io/badge/React-TypeScript-38BDF8?style=flat-square&logo=react&logoColor=white&labelColor=0B0F14">
  <img alt="PWA" src="https://img.shields.io/badge/PWA-mobile--first-A78BFA?style=flat-square&labelColor=0B0F14">
  <img alt="Tests" src="https://img.shields.io/badge/contract_tests-49_passing-BEF264?style=flat-square&labelColor=0B0F14">
</p>

<p align="center">
  <b>🌐 Live app: <a href="https://shuntapp.xyz">shuntapp.xyz</a></b> &bull; testnet &bull; connect Freighter and try the loop<br>
  <i>(Includes 1-click testnet USDC funding directly on the Home screen)</i>
</p>

**Get paid in dollars. Keep them worth something. Never watch a month's income evaporate again.**

Shunt is a programmable **USDC income router** for people who earn from abroad. The moment a payment lands in your Stellar wallet, **one tap** distributes it across dedicated reserves by rules you set once: everyday spending stays liquid, an emergency buffer fills, and savings get **locked by code** in hard USDC value that local inflation cannot erode. No volatile yields, no rehypothecation. One tap per deposit, at the one moment financial discipline is effortless: payday.

> *Shunt* (electronics): a component that diverts current into parallel paths so no single line overloads. Shunt does the same for your cashflow.

### Built real, not slideware

* **49 Soroban unit tests** covering split exactness (stroop precision), rounding conservation, replay prevention, timelocks, penalties, laddered savings lots, unallocated withdrawal guards, per-user goal caps, authorization boundaries, and solvency invariants. Backed by a **real-testnet end-to-end suite** (Playwright).
* **Non-custodial by construction**: The automated keeper holds **zero keys**. All protected savings reserves are held directly in contract code that only the wallet owner can authorize for withdrawal.
* **Recoverable keeper lifecycle**: Detected incoming transfers move through explicit `detected -> prepared -> confirmed` states. Preparing an unsigned XDR does not mark a task complete; completion occurs only after the keeper verifies a successful transaction on Soroban.
* **Signed Payment Links & Verifiable Receipts**: Public checkouts generate deterministic Ed25519-signed request URIs, binding payments directly to recipient policy revisions. Every executed routing is logged as a globally verifiable receipt synced to the ledger.

---

## Why people use it

Freelancers and overseas contractors who invoice in foreign currency face three quiet cashflow leaks:

1. **The single-balance trap.** When $2,000 lands in an ordinary wallet as a single balance, all of it feels spendable. Within two weeks, it leaks into daily spending. Savings become whatever is left over, which reliably rounds to zero.
2. **Local currency erosion.** Capital held in depreciating fiat currencies loses purchasing power annually. Saving in an eroding currency is running up a descending escalator.
3. **No fixed salary, no existing automation.** Irregular income schedules defeat traditional payroll savings accounts. The only reliable moment to separate capital is *the exact second it lands*—precisely the window Shunt captures.

Shunt converts raw lump-sum payments into three concrete financial outcomes:

| Outcome | How It Works |
| :--- | :--- |
| **💵 Savings that maintain purchasing power** | Reserves stay in on-chain USDC rather than volatile local fiat, protecting hard-earned safety nets against devaluation. Strictly no-yield to preserve principal safety. |
| **🔒 Savings you cannot impulsively sabotage** | Protected by Soroban contract timelocks and cooldown timers rather than a mere UI label. Early emergency withdrawal incurs a 10% penalty—**which redirects directly into your own accessible buffer**, never taken by the protocol. |
| **🔁 Integrated loop from arrival to payout** | Income routes strictly on-chain to your designated pools, with every execution producing a globally verifiable accounting receipt. |

### How Shunt differs from standard vaults (Vaquita, Piggy Wallet, Microvault)

Standard smart vaults demand ongoing willpower. You receive money, open an app, navigate to a vault, and manually send a deposit transaction. For freelancers with irregular cashflow, this voluntary friction leads to procrastination.

Shunt removes willpower from the loop. It operates as an **income router**, not a static storage container. It intercepts cashflow at the initial entry point. When an invoice pays out or a client transfer settles, Shunt detects the inflow immediately. One single tap splits and distributes the complete arrival into spending pools, emergency cash, tax reserves, and timelocked positions simultaneously before funds leak into casual spending.

---

## 🏛️ Architecture & Waterfall Hierarchy

```text
       [ Incoming Invoice / Payer Payment ($ Gross USDC) ]
                                │
                        ( Shunt Router )
                     [ Atomic Split Engine ]
                                │
       ┌───────────────┬────────┴────────┬───────────────┐
       ▼               ▼                 ▼               ▼
 🚨 Emergency    📋 Obligation       🔒 Goal Lots     💳 Spendable
   Reserve          & Taxes           Timelocked        Wallet Pool
 (Priority #1)    (Tier 2 % Cut)      (Tier 3 Lots)   (Residual Liquid)
```

Shunt calculates fund distributions through a strictly ordered waterfall hierarchy that guarantees mathematical value conservation:

$$\text{Gross Inflow} \equiv \text{Emergency} + \text{Obligation} + \text{Goal Lots} + \text{Spendable}$$

1. **Emergency Reserve (Priority Tier 1)**: Fills first up to an explicit user-configured cap (e.g., $5,000 USDC), subject to a maximum refill percentage per inflow. Available immediately with zero timelocks or penalty deductions. Once capped, 100% of incoming allocations overflow directly to the next tier.
2. **Obligation & Tax Reserve (Tier 2)**: Automatically segregates capital for upcoming taxes or contracted debts. Protected by an on-chain cooldown request period (e.g., 3 days) to block impulsive spending of mandatory obligations.
3. **Timelocked Goal Lots (Tier 3)**: Each routed deposit generates an independent on-chain savings position locked until an explicit block maturity timestamp (e.g., 180 days). Early withdrawal incurs the internal buffer redirection penalty.
4. **Spendable Wallet Pool (Residual Liquid)**: Receives all remaining operational capital and rounding fractional remainders, sending funds immediately to your accessible spending address.

---

## 🔐 Cryptographically Signed Checkouts & Policy Revision Lock

Standard public checkout links remain vulnerable to mid-transit parameter manipulation, such as a merchant or recipient altering split proportions after issuing an invoice to bypass tax reserves. Shunt secures payment parameters through on-chain revision binding:

1. Every rule modification monotonically increments an on-chain revision counter (Revision #1 &rarr; Revision #2 &rarr; Revision #3).
2. Payment requests and QR invoices generate a canonical buffer payload mathematically signed via Ed25519 (`@stellar/stellar-sdk`).
3. During execution, the smart contract verifies that the live policy revision matches the invoice payload's `expected_policy_version`. Any discrepancy blocks the settlement immediately, ensuring payer transparency and absolute audit fidelity.

---

## 💻 TypeScript SDK Integration (`@shunt/sdk`)

Shunt provides a universal TypeScript client package for frontend checkouts, corporate dashboards, and automated verification workers.

```typescript
import { ShuntClient, calculateWaterfall } from "@shunt/sdk";

// 1. Calculate offline deterministic split breakdowns
const grossPayment = 5000; // 5,000 USDC
const breakdown = calculateWaterfall(
  grossPayment,
  1500, // Current Emergency Balance
  5000, // Emergency Cap Target
  3500, // 35% Max Refill Rate (bps)
  2000, // 20% Obligation Allocation (bps)
  2000  // 20% Timelocked Goal Allocation (bps)
);
console.log("Verified Spendable Liquid Pool:", breakdown.spendable);

// 2. Verify and build on-chain routing transactions
const client = new ShuntClient({
  networkPassphrase: "Test SDF Network ; September 2015",
  rpcUrl: "https://soroban-testnet.stellar.org",
  contractId: "CC_SHUNT_ROUTER_CONTRACT_ID",
});

const tx = await client.buildRoutePaymentTx(
  "GA_PAYER_WALLET_ADDRESS",
  "GB_RECIPIENT_ADDRESS",
  5000,
  "INV-2026-Q3-891",
  2 // Expected Policy Revision Number
);
```

---

## ⚡ Durable Event Indexer (Keeper Service)

To power real-time settlement receipts without saturating public Soroban RPC nodes, Shunt ships an edge-deployed event indexer operating on Cloudflare Workers and KV storage.
* **Real RPC Polling**: Uses authentic `getEvents` JSON-RPC POST querying against `https://soroban-testnet.stellar.org`. 
* **Persistent Cursors**: Automatically stores the latest verified ledger sequence to Cloudflare KV (`indexer:durable_cursor`).
* **Resilient Recovery**: Resumes index synchronization precisely from the checkpoint following network congestion or maintenance.
* **Public Endpoints**: Query `/indexer/events/:account` to retrieve verified routing records and conservation invariants in milliseconds.

---

## Live on testnet

| Item | Value |
| :--- | :--- |
| **Vault Contract (USDC)** | [`CDMFJZ6VRD2JEV7J2W7KMZZ3AXNSOST2C6L2KYRJAYIN7ULWJEOCWO5B`](https://stellar.expert/explorer/testnet/contract/CDMFJZ6VRD2JEV7J2W7KMZZ3AXNSOST2C6L2KYRJAYIN7ULWJEOCWO5B) — Current security-hardened deployment. |
| **USDC SAC (Testnet)** | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |
| **Keeper Worker** | [`shunt-keeper.irhamtria.workers.dev`](https://shunt-keeper.irhamtria.workers.dev/health) |

The contract ran its complete financial lifecycle on-chain using real testnet USDC acquired via DEX path payment. Click any transaction hash below for ledger verification:

* [Contract Deploy](https://stellar.expert/explorer/testnet/tx/4f31657d92242ad75502cc4881613693a003aa4fe68866af2b23e0c239850f09) &bull; [Initialize against USDC SAC](https://stellar.expert/explorer/testnet/tx/50e46cb3c001b9de470f80963461c5649d576a6383733e89873a758a261f533d)

---

## How a real regional user onboards (honest go-to-market)

Shunt's split engine assumes USDC resides on Stellar. 

| User Target | Onboarding Pathway | Status |
| :--- | :--- | :--- |
| **Wedge: Crypto-aware freelancer / DAO worker** | Already receiving international USDC; connects Freighter directly. | ✅ Operational today |
| **Contractor billing a foreign enterprise** | Issues a Shunt **Signed Payment Link**; client pays via standard crypto wallets or integrated card on-ramps. | ✅ Shipped for crypto checkouts |

**Rupiah is the story; the Philippines is the live beachhead.** Our primary target market is Indonesia, addressing the currency devaluation problem that inspired the protocol. However, the fiat corridor live on Stellar today is **PHP via MoneyGram**, not IDR. There is currently no production IDR off-ramp on Stellar; IDRX is a target regulated stablecoin awaiting ecosystem availability. We demonstrate operational engine reliability in live APAC corridors now without inventing unreleased cash-out integrations.

---

## Business model — service fees, never interest

Every revenue line represents a transparent fee on an automated utility: 0.4% on immediate spending payouts. 

**Zero lending, zero yield products, and zero rehypothecation.** This is an explicit design choice: interest-bearing yield strategies introduce unacceptable counterparty and smart-contract protocol risks to an individual's emergency safety net. Savings deposits and post-maturity lot withdrawals remain completely free of service charges, forever. Shunt's operational take is a blended **~0.29% of processed routing volume**.

---

## Quickstart & Verification

```bash
# 1. Smart Contracts — Verify 100% test suite pass rate
cd contracts/shunt-vault
cargo test
stellar contract build

# 2. Durable Keeper Worker — Cloudflare Worker Event Indexer
cd ../../keeper
npm install
npm test
npx wrangler dev --local        # Runs edge listener on http://localhost:8787

# 3. Web Application — Run interactive UI & Payer Checkout locally
cd ../web
cp .env.example .env
npm install
npm run dev                     # Accessible at http://localhost:5173
npm test                        # Vitest verification of UI math & components
```
