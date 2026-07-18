Shunt — Submission Overview


DELIVERABLES (quick reference)

- Network: Stellar TESTNET only (no mainnet claims)
- Live app: https://shunt-app.vercel.app
- Repo: https://github.com/irham3/shunt
- Demo video: <PASTE UNLISTED LINK HERE — see docs/demo-script.md>
- Vault contract (testnet): CDMFJZ6VRD2JEV7J2W7KMZZ3AXNSOST2C6L2KYRJAYIN7ULWJEOCWO5B (current security-hardened deployment; supersedes CC7E…)
- Keeper (Cloudflare Worker): https://shunt-keeper.irhamtria.workers.dev
- On-chain proof: clickable testnet hashes for the full split + savings-goals lifecycle (see On-chain proof section below)
- Tests: 49 Soroban unit tests (incl. the unallocated-withdrawal guard, per-user goal cap, authorization boundaries, input validation, goal-vs-aggregate timelock, and a solvency/conservation invariant) + real-testnet Playwright e2e (41 specs: 40 passing, 1 conditional skip that only runs when the keeper is down)


PROJECT TRACK

Local Finance — APAC Stellar Hackathon 2026

Shunt solves a local financial problem: Indonesian freelancers and overseas workers losing value to rupiah depreciation and the single-balance spending trap. It auto-splits USDC income on arrival into structured lanes, with fiat cash-out to IDR/PHP through licensed local anchors (SEP-24). Not DeFi (no lending/AMM/yield), not RWA (no asset tokenization) — purely a local finance layer that gives structure and value-protection to cross-border income.


TARGET USER

Wedge (MVP): Crypto-aware freelancers and diaspora already receiving USDC on Stellar. Their core pain is that money lands as one balance, feels spendable, and savings end up at zero.

Mainstream (post-MVP): Indonesian freelancers and migrant workers earning in USD or foreign currency. Same leakage problem, compounded by rupiah erosion (~Rp18,000/USD) and no payroll-based automation for irregular income.

Persona: Dina, 27 — freelance illustrator in Bandung, ~$2,000/mo from foreign clients. Income irregular, no fixed salary, savings always "whatever's left."


PROBLEM STATEMENT

1. Single-balance trap — all income in one number feels spendable; savings = leftover = zero.
2. Rupiah erosion — saving in IDR loses value year after year.
3. No salary, no automation — irregular income defeats every payroll-based savings tool. The only clean moment to save is the instant income arrives.


PROPOSED SOLUTION

A "set once, confirm once per income" autopilot:

1. User sets split rules once (e.g. Needs 60% / Savings 25% / Buffer 15%).
2. USDC income lands — keeper detects it in seconds.
3. User approves with one tap — atomic on-chain split via ShuntVault contract.
4. Savings locked in USDC (value-holding) inside the vault with an enforced timelock; Needs and Buffer stay in the user's wallet.
5. Needs lane cashes out to IDR/PHP through a licensed anchor (SEP-24).

Non-custodial: the keeper holds zero keys; savings are held by smart contract code (only the owner can withdraw), not by any third party.


CORE FEATURES

F1 — Connect Wallet: Freighter, one click, no sign-up. Shipped.
F2 — Income Detection: keeper cron poll of Horizon (cursor-resumed) plus client-side Horizon polling that flags un-split income even with the keeper down. Shipped.
F3 — Set Shunt Rules: percentage sliders, saved on-chain via set_rules. Shipped.
F4 — Auto-Split Engine: atomic distribute + manual trigger fallback. Shipped.
F5 — Savings Vault: USDC locked in contract, timelock enforced, 10% early-withdrawal penalty goes to Buffer. Shipped.
F6 — Dashboard: total value, lane composition, recent activity. Shipped.
F7 — Transaction History: on-chain explorer links. Shipped.
F8 — Off-Ramp (SEP-24): anchor-hosted cash-out to IDR/PHP, rate and fee shown before confirm. Shipped.
F9 — IDR Value Display: forex API with 10-min cache. Shipped.
F10 — On-Ramp / Top Up (SEP-24 deposit): fund Shunt with IDR through the anchor's hosted deposit flow without leaving the app — reuses the shipped SEP-1/10 stack. Shipped.
F11 — Invest Lane (auto-DCA): a 4th split lane converted USDC→XLM via classic path payment right after each split — spot purchase, no lending, no yield products. Falls back to a labeled simulated rate when DEX liquidity is unavailable. Shipped.
F12 — Payment Request Link (SEP-7): request payment from inside Shunt via a web+stellar:pay link/QR any SEP-7 wallet can open, plus a public payer landing page; card checkout for non-crypto payers via an on-ramp partner is roadmap. Shipped.
F13 — Savings Goals: named, on-chain sub-allocations of the Savings balance (e.g. "Emergency fund", "Wedding") via create/withdraw/rename/delete_savings_goal on ShuntVault — bookkeeping only, drawn from and released back to the same aggregate balance, no separate custody. Shipped.
F14 — Laddered Goal Timelocks: each savings goal gets its own independent unlock date (contract field `Goal.unlock_at`), instead of sharing one aggregate lock — proven live with a 60-second and a 2-year goal withdrawn seconds apart, one penalty-free, one not. Shipped.
F15 — Buffer Threshold Auto-Refill: an on-chain `distribute(..., buffer_topup)` param prioritizes topping Buffer up to a user-set target before the normal % split applies to the rest — the shortfall itself is computed client-side from a real wallet-balance read (the contract can't see wallet-side Buffer balance) but the priority arithmetic is enforced on-chain. Shipped.
F16 — Pay a Request (SEP-7, any asset): pay someone else's `web+stellar:pay` link from USDC even when they asked for a different asset, via `pathPaymentStrictReceive` — one signature, atomic conversion + delivery. Shipped.
F17 — Multi-Currency Settle: spend USDC directly into a local-currency demo asset (Shunt-issued testnet TIDR/TPHP with real seeded DEX liquidity) via live-quoted path payment. Shipped.
F18 — Scheduled Bill-Pay: a native Stellar `createClaimableBalance` with a future-dated claim predicate for the recipient (and an unconditional one for the sender, so it's cancellable) — schedules rent/cicilan without a custom contract or any "signs itself later" claim. Shipped.
F19 — Savings Auto-Escalation: opt-in toggle that bumps the Savings % by 1 point every 3 splits (capped at 50%) via a real follow-up `set_rules` call, shown explicitly in the confirmation UI. Shipped.
F20 — Real Gold DCA (TXAUM): the Invest lane's Gold option now executes a genuine path payment against Shunt's own seeded testnet gold-demo-asset liquidity instead of always falling back to a labeled reference-rate simulation. Shipped.

Together F8+F10+F12 make Shunt a single touchpoint: money comes in (payment link / Top Up), gets structured (split, lock, DCA), and goes out (anchor cash-out) — the user never opens another app; licensed anchors and partners handle all fiat.


BUSINESS MODEL

Every revenue line is a transparent service fee (ujrah) — never interest, never a cut of lending yield (excluded by design: it is riba for the Indonesian majority market and stacks smart-contract risk):

1. Off-ramp fee 0.3–0.5% on Needs-lane cash-out (live in UI today at 0.4%).
2. On-ramp fee 0.3–0.4% on Top Up.
3. Invest-conversion fee 0.3–0.5% on DCA conversions (brokerage model — Shunt earns when users build assets).
4. Later: premium subscription (multi-goal, session keys, analytics) and a B2B "pay & split" API for platforms paying remote contractors.

Fees never touch Savings deposits or post-lock withdrawals; the 10% early-withdrawal penalty goes to the user's own Buffer, not to Shunt. Sketch: a $1,000/mo freelancer generates ~$45–60/yr; 10k active users ≈ $500k/yr.


GO-TO-MARKET

Wedge sequencing:
1. First 100 users — web3-native freelancers and DAO contributors already paid in USDC (zero wallet education needed), via hackathon visibility + Stellar Community Fund ecosystem.
2. First 1,000 — the F12 payment link turns "must already have USDC" into the acquisition funnel itself: freelancers adopt Shunt to *get paid in dollars* (the split is the retention hook); content marketing on existing search pain ("PayPal fees", "kurs Wise") in Indonesian; IDRX partnership for seamless bank cash-out.
3. Scale — B2B embed: freelance platforms, outsourcing agencies, and web3 payroll paying Indonesian/Filipino contractors through the pay-&-split API.

Positioning: "behavioral savings layer on Stellar", designed without interest-based revenue (service fees only, spot asset conversion only, no lending or yield, penalty returns to the user's own Buffer) — a wedge no interest-based digital bank can copy. A formal sharia-compliance claim would require external review and is not asserted here.

Corridor honesty (stated up front): the value story is Indonesian rupiah erosion — our primary market — but the off-ramp that is LIVE on Stellar today is PHP via MoneyGram (verified mainnet SEP-24 anchor; run `node scripts/verify-anchor.mjs stellar.moneygram.com`). There is no production IDR off-ramp on Stellar yet — IDRX's Stellar availability is unconfirmed and MoneyGram's Indonesia payout isn't a listed Stellar corridor. So go-to-market is Philippines-first (the rail exists) and Indonesia-next as the IDR corridor lands. The engine + SEP-24 off-ramp mechanism are corridor-agnostic and proven live in an APAC country; we do not claim a live rupiah cash-out we don't have. (MoneyGram is a global remittance on/off-ramp, a legitimate fiat rail — not framed as grassroots local-ecosystem integration.)


MVP PLAN

Deadline: July 15, 2026
Principle: one perfect flow over many half-built features.

Goal: prove the split-on-income engine end-to-end — a real on-chain split on testnet (executed with real testnet USDC, hashes below), savings entering the vault with an enforced timelock, and one cash-out path to fiat through a licensed anchor. A trivial mainnet split is a pre-launch step, not claimed as done today.

User flow (end-to-end):
1. User opens the web app URL, sees the value prop (3-slide onboarding), connects Freighter browser wallet — no app install, no sign-up, no custody handover.
2. User adjusts lane sliders (Needs / Savings / Buffer, e.g. 60/25/15) and sets a savings timelock (e.g. 30 days). Taps "Save rules" — this calls set_rules on the ShuntVault contract and stores the rules on-chain. The contract is the single source of truth; the frontend reads from it.
3. USDC income arrives in the user's wallet. The keeper (Cloudflare Worker, 1-minute Cron Trigger poll of Horizon) detects the inflow, and the app itself also polls Horizon and flags un-split USDC client-side. If the keeper is down, the "Simulate incoming income" button on the Configure Shunt page acts as a manual fallback for the demo.
4. The keeper prepares an unsigned distribute transaction (XDR) and hands it to the frontend. The user sees the exact breakdown (e.g. $1,200 Needs / $500 Savings / $300 Buffer) and approves with one tap. Freighter signs. Nothing moves without the user's signature.
5. One atomic Soroban transaction executes: Needs and Buffer go to the user's wallet (freely accessible), Savings moves into the ShuntVault contract and the timelock starts. Sub-cent network fees, settled in seconds. The split event is emitted on-chain.
6. Dashboard updates: total portfolio value, 3-lane allocation bar, lane cards, and recent activity feed. Savings shown in USD (native) and IDR (via forex API, 10-min cache).
7. User can cash out the Needs lane to fiat: the Send and Pay screen opens the anchor's hosted SEP-24 flow (KYC and bank details handled by the anchor, not by Shunt). Rate and fee are shown before confirmation. Default anchor is SDF's test anchor; production target is IDRX (regulated IDR stablecoin) or a PHP corridor partner.
8. Savings withdrawal: free after the timelock expires. Early withdrawal is possible but costs a 10% penalty — the penalty is not lost, it's credited to the user's Buffer inside the vault, withdrawable anytime. Buffer withdrawal is always instant, no lock, no penalty.

Architecture:
- Smart contract (ShuntVault, Rust/Soroban): handles set_rules (now also carries `buffer_target`), distribute (atomic 3-lane split with 7-decimal dust rounding into Needs, plus F15's `buffer_topup` priority param), deposit, withdraw_savings (timelock + penalty logic), withdraw_buffer, offramp (USDC only to allowlisted anchor addresses), the F13 savings-goals functions (create/withdraw_from/rename/delete_savings_goal — an additive bookkeeping layer over the same Savings balance) extended for F14 with each goal's own `unlock_at` (laddered timelocks, independent of the aggregate lock). Errors are explicit named codes (1-13). Penalty and denominators are named constants (PENALTY_BPS = 1000, BPS_DENOM = 10000). 49 unit tests cover exact split arithmetic, dust (no stroop lost), replay rejection, rules validation, timelock behavior, the anchor allowlist, the full goals lifecycle, threshold auto-refill priority, independent per-goal unlock dates, and a hardening set: the goal-vs-aggregate timelock rule (a zero-lock goal can't escape the aggregate Savings lock or its penalty), the unallocated-withdrawal guard (generic withdraw_savings can't drain goal principal), zero-value goals rejected, a per-user goal cap (MAX_GOALS_PER_USER = 20), authorization boundaries (no account can touch another's Savings, Buffer, rules, or goals), input validation, init-cannot-be-recalled, and a solvency/conservation invariant. Deployed as a fresh security-hardened instance (CDMFJZ…, supersedes CC7E…) — additive redeploy, same pattern as prior migrations.
- Web app (Vite + React + TypeScript): mobile-first (~390px column), PWA-installable, scales to desktop nav rail at 1024px+. 13 screens: onboarding/landing, connect wallet, home/dashboard, per-lane detail, configure shunt, auto-split confirmation, savings vault detail, send/pay (transfer + convert + off-ramp), top up, request payment, public payer page, activity/history, settings. Uses stellar-sdk + Stellar Wallets Kit (Freighter, Albedo, xBull).
- Keeper (`keeper/`, Cloudflare Workers): detects USDC inflows and prepares an unsigned distribute XDR for the frontend. Never holds keys or funds. Idempotency: deduplicates by transaction hash AND the contract rejects duplicate inflow_keys — double-splits are impossible from both sides. A 1-minute Cron Trigger polls Horizon for new payments; state (processed hashes, per-account cursor, pending splits) lives in Workers KV. Deployed at https://shunt-keeper.irhamtria.workers.dev — free tier, no credit card, no idle sleep (unlike container-host free tiers).
- Off-ramp (SEP-1/10/24): SEP-1 discovers the anchor's endpoints from stellar.toml, SEP-10 proves wallet ownership by signing a challenge with Freighter, SEP-24 opens the anchor's hosted withdrawal flow. The shipped cash-out UX uses this standard SEP-24 hosted transfer. Separately, the contract exposes a `offramp(user, anchor, amount)` path gated by an on-chain anchor allowlist (implemented + unit-tested) for callers who want contract-enforced destination control; wiring it into the SEP-24 UX (whose per-transaction deposit address is anchor-provided) is a follow-up, so the allowlist guarantee applies to the contract path, not to today's hosted-withdraw demo.
- Oracle: display-only. IDR rate from a forex API with 10-min cache and labeled fallback. Funds stay in USDC — no synthetic conversion. Gold toggle visible but disabled until a viable allocated-gold feed exists.

Custody model (two-tier, non-custodial):
- Wallet tier (Needs + Buffer): stays in the user's own Stellar wallet. Freely accessible. Purely non-custodial.
- Vault tier (Savings): USDC is moved into the ShuntVault contract via deposit. The timelock and penalty are enforced on-chain. Withdrawal requires the owning user's auth (require_auth). The keeper cannot withdraw anything. This is code custody, not third-party custody — only the owner's address can call withdraw_savings.

On-chain proof (testnet, executed with REAL testnet USDC, 2026-07-12, against the vault instance current at that time, CB27… — superseded 2026-07-16 by CC7E…, see Testnet deployment below):
- init (USDC SAC) — tx eae9a0f8…
- set_rules 60/25/15 with 1-day timelock — tx 2ef8083f…
- distribute 10 USDC — split exactly 6 / 2.5 / 1.5, split event emitted — tx ce3ce801…
- create_savings_goal "Emergency fund" 1.5 USDC — drawn from unallocated, aggregate untouched — tx 698b60e1…
- withdraw_from_goal 0.5 while still locked — paid 0.45, 10% penalty → Buffer credit, goal decremented — tx 910b71a3…
- rename_savings_goal → "Dana Darurat" — cosmetic only — tx 73aaf921…
- delete_savings_goal — 1.0 USDC principal released back to unallocated — tx 0e5faa0d…
(A prior lifecycle proof — trustline, DEX purchase, basic split/withdraw — ran on the previous contract instance before the goals feature was added.)

Live app: https://shunt-app.vercel.app
Keeper: https://shunt-keeper.irhamtria.workers.dev

Testnet deployment:
- Vault (USDC): CDMFJZ6VRD2JEV7J2W7KMZZ3AXNSOST2C6L2KYRJAYIN7ULWJEOCWO5B (current; supersedes CC7E…)
- USDC SAC (testnet): CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA

What MVP explicitly is NOT:
- Not fully hands-free. Soroban's require_auth needs a signature per invocation; safe unattended delegation (session keys / smart accounts) is on the roadmap, not over-claimed today. "Automatic" means automatic detection + tx preparation, one-touch confirmation.
- Not native mobile. Web/PWA first; native mobile comes after validation.
- Not a domestic payment tool. Positioned as store-of-value + cross-border settlement. Avoids claiming to be a transfer service or domestic payment processor.
- No lending, no yield. Savings are held in USDC at face value — deliberately (see Business Model). The Invest lane is spot asset purchase (DCA), not a yield product.
- The vault is unaudited. Keep real mainnet amounts trivial until a proper audit is done.
- The keeper is centralized in this version. Mitigations: idempotency, cursor-resumed reconnects, manual trigger fallback. Decentralization comes later.
