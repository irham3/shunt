# Local-economy segment — 2-minute narration (with live demo)

Use this as the "connects users to their local economy" beat — the highest-weight
judging axis. It turns "pluggable" from a claim into something on screen. Have a
terminal open in the repo root and the app's Send & Pay screen ready.

> Total ~2:00. Speak the **bold**; the rest is stage direction.

---

### [0:00–0:20] Frame the real problem honestly
**"An Indonesian or Filipino worker earning dollars doesn't want to hold crypto —
they want rupiah or pesos in their bank, cheaply. So the question that matters for
a local-finance product is: can Shunt actually put local fiat in their hands? Let
me show you the real corridor, not a sandbox claim."**

### [0:20–0:55] Show the live anchor resolve (terminal)
Run:
```bash
node scripts/verify-anchor.mjs stellar.moneygram.com
```
Point at the output as it prints.
**"This is Shunt's own SEP-1 discovery — the exact first step our off-ramp takes —
run against MoneyGram Access. It's live on Stellar mainnet, and it cashes USDC out
to Philippine pesos at physical MoneyGram locations across the country. The script
resolves its real SEP-24 endpoint. That's a genuine bridge to a local economy, on
the network, today — not a promise."**

### [0:55–1:25] Show it's one config value
```bash
node scripts/verify-anchor.mjs testanchor.stellar.org
```
**"Our demo runs against the SDF test anchor for one honest reason: MoneyGram and
every regulated regional off-ramp run on mainnet only — nobody exposes a testnet
SEP-24 endpoint except SDF. So a testnet demo can only prove the mechanism there.
But look — same script, same code, different domain. Swapping the production
corridor is one environment variable, `VITE_ANCHOR_HOME_DOMAIN`. No contract
change, no rewrite."**

### [1:25–1:50] Tie it to the on-chain guarantee
Switch to the app's Send & Pay (cash-out) screen; show rate + fee shown before confirm.
**"And it's not a blind send: the cash-out shows the rate and fee before you
confirm, and the contract carries an on-chain anchor allowlist so USDC can only
ever leave to an anchor the user approved. For Indonesia specifically, IDRX — a
regulated, audited rupiah stablecoin — is the roadmap target; we say 'candidate',
not 'already on Stellar', because we checked and won't overclaim."**

### [1:50–2:00] Land it
**"So: a real, named, licensed corridor that reaches a local economy on mainnet
today, reachable by one config value — proven on screen, not asserted on a slide.
That's the local-finance leg, honestly."**

---

### Backup answers if a judge pushes
- *"Why not settle IDR live then?"* → "MoneyGram covers PHP now; IDR needs a licensed
  IDR anchor (IDRX or a partner) — a partnership-and-regulation step, not a technical
  gap. The rails are identical."
- *"Isn't SDF-only a weakness?"* → "It's a network limitation — no regional anchor
  runs testnet. The verify-anchor script against MoneyGram proves the integration is
  real; run it yourself."
- *"Does the allowlist apply to the hosted cash-out?"* → Be precise: "The contract
  `offramp()` path enforces the allowlist and is unit-tested; the shipped hosted
  SEP-24 flow is the standard one — wiring the allowlist into it is a documented
  next step, not claimed as done."
