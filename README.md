# Shunt

**Incomes in, instantly split.** Financial autopilot for USDC income on Stellar — auto-splits to Needs / Savings / Buffer routes as soon as the income lands. Built for APAC Stellar Hackathon 2026.

## Repo Structure

```
contracts/shunt-vault/   Soroban contracts (Rust) — split engine + savings vault
web/                     Vite + React + TS web app (mobile-first, PWA-ready)
keeper/                  Node/TS keeper — detects Horizon inflows + prepares distribute tx
```

## Architecture

1. USDC enters user's wallet → **keeper** (Horizon payments stream, reconnect + cursor resume) detects it.
2. Keeper prepares a `distribute` transaction **without holding any keys** — unsigned XDR is handed to the frontend.
3. User approves with one tap in the **web app** (Freighter signs) → atomic on-chain split:
   - Needs + Buffer stay in user's wallet (purely non-custodial).
   - Savings are moved to **ShuntVault** so the timelock is strictly enforced by code.
4. Double idempotency: keeper stores processed tx hashes **and** the contract rejects duplicate `inflow_key`s — zero double-splits.
5. Demo fallback: "Simulate incoming income" button in Settings (manual trigger F4).

## `ShuntVault` Contract

| Function | Description |
|---|---|
| `init(token)` | Sets the USDC SAC address (once). |
| `set_rules(user, needs_bps, savings_bps, buffer_bps, lock_secs, anchors)` | Saves split rules (must total 10,000 bps) + anchor allowlist. |
| `distribute(user, amount, inflow_key)` | Atomic split; dust rounds into Needs; rejects duplicate inflow_key. |
| `deposit(user, amount)` | Voluntary deposit to the vault. |
| `withdraw_savings(user, amount)` | Withdraw savings; before timelock incurs a 10% penalty → Buffer credit in vault. |
| `withdraw_buffer(user, amount)` | Withdraw Buffer credit (no timelock). |
| `offramp(user, anchor, amount)` | Sends USDC from wallet to **allowlisted anchors only**. |

11 unit tests covering: exact 60/25/15 split, 7-decimal dust (no stroop lost), anti double-split, 100% validation, timelock penalty, anchor allowlist.

## Testnet Deployment (live)

| Item | Value |
|---|---|
| Main vault (USDC) | `CA65BKKNEZEXOXK54G6BAVE3O4QMTCXGSA7YULHADELX5HOIOZPO7JUM` |
| Dev vault (XLM, E2E proof) | `CADI23I2J2DMRB4YS63MGXJQCIN7QYYBCOIH6YSXJZFY63SPRNJDCMNL` |
| Deployer/test account | `GC4IUJPBQZKXYONI6UABEXE7EA6QXT4OYV2JYJA5GTPMXSMEKDL6AGDZ` (alias `shunt-dev`) |
| USDC SAC (testnet) | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |

**On-chain E2E proof executed on testnet** (dev vault, XLM SAC so funds were available without a USDC faucet):
`set_rules` 60/25/15 + 1-day lock → `distribute` 10 XLM split exactly into 6 / 2.5 / 1.5 with the `split` event emitted → duplicate `inflow_key` rejected with `Error #6` (no double-split) → early `withdraw_savings` of 2.5 paid out 2.25 (10% penalty) → `get_buffer_credit` = 0.25 → `withdraw_buffer` cleared it → final savings balance 0.

## SEP-24 Off-ramp (P1, implemented)

`web/src/lib/anchor.ts` implements SEP-1 TOML discovery → SEP-10 web auth (challenge signed with Freighter) → SEP-24 interactive withdraw + status polling, targeting the SDF test anchor (`testanchor.stellar.org`, configurable via `VITE_ANCHOR_HOME_DOMAIN`). The Send & Pay screen opens the anchor's hosted flow; if Freighter or the anchor is unavailable it degrades to the sketched request (F8).

## Running

```bash
# Contracts — test + build wasm
cd contracts/shunt-vault
cargo test
stellar contract build

# Deploy (testnet) then init with USDC SAC address
stellar contract deploy --wasm target/wasm32v1-none/release/shunt_vault.wasm \
  --source <IDENTITY> --network testnet
stellar contract invoke --id <CONTRACT_ID> --source <IDENTITY> --network testnet \
  -- init --token <USDC_SAC_ADDRESS>

# Keeper
cd keeper && cp .env.example .env   # fill VAULT_CONTRACT_ID + WATCH_ACCOUNTS
npm install && npm run dev

# Web
cd web && cp .env.example .env      # fill VITE_VAULT_CONTRACT_ID
npm install && npm run dev
```

Without a deployed contract, the web app still runs in **local demo mode** (splits recorded in local state) so the flow can be seen end-to-end.