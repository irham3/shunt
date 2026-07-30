# Shunt — three-minute judge pitch

Six slides. Total target: **3:00 including the live demo**.

The slide copy below is deliberately short. The `Say` sections contain the
spoken detail; the `Show` sections are the presenter and demo cues.

## 1. Title — 0:00–0:10

### Slide

**Shunt**

**Split freelance income before you spend it.**

Set rules once. Review the split. Sign with your wallet.

`USDC` · `Non-custodial` · `Built on Stellar`

### Say

“A freelancer gets paid once, but that single balance has four jobs. Shunt
turns payday into one deliberate decision: split the income before it becomes
spending money.”

### Show

Open on the title slide. Point to the incoming USDC line branching into Needs,
Savings, Buffer, and Invest. Do not explain the technology yet.

---

## 2. Problem — 0:10–0:30

### Slide

**One balance. Four jobs.**

`NEEDS 50%` · `SAVINGS 25%` · `BUFFER 15%` · `INVEST 10%`

**The decision repeats every payday.**

### Say

“Irregular income makes every payday an allocation exercise. Bills feel urgent;
savings and investing happen only if something remains. These percentages are
illustrative. The real problem is repeating the decision after the money already
feels available.”

### Show

Follow one incoming payment into the four lanes. Keep the audience focused on
timing: the decision happens when income lands, not at the end of the month.

---

## 3. Product loop — 0:30–0:50

### Slide

**The split happens before spending does.**

`DETECT → REVIEW → ROUTE → VERIFY`

`SEP-7` · `SOROBAN VAULT` · `DEX PATH PAYMENT` · `SEP-24`

**Your wallet approves every state change.**

### Say

“A client pays USDC directly or through SEP-7. Shunt detects the income and
shows the saved split before the wallet signs. Savings stays USDC in the Soroban
vault. Grow is separate and opt-in: testnet can buy XLM or TXAUM, a demo
stand-in for XAUm gold. Users can then send assets or open an anchor’s SEP-24
flow.”

### Show

Trace the four steps from left to right. Briefly point out that an optional
Invest conversion needs its own wallet approval. Do not list every roadmap
asset aloud.

---

## 4. Live demo — 0:50–2:30

### Slide

**Watch one payday move.**

`CONNECT → SET RULES → REVIEW → SIGN → PROTECT / GROW → VERIFY`

**Stellar testnet · real wallet signatures · inspectable hashes**

### Say and show

#### 0:50–1:05 — Connect

Connect Freighter, Albedo, or xBull.

Say:

“No account and no custody. The keeper holds no key; the wallet remains the
signing authority.”

#### 1:05–1:25 — Set rules

Open Configure Shunt. Adjust Needs, Savings, Buffer, and optional Invest. Set the
Savings lock. Save and sign `set_rules`. Point to **Active on-chain**.

Say:

“The rule is stored on-chain. Grow can be zero; protected Savings never depends
on investing.”

#### 1:25–1:55 — Review and split

Open the detected income or use **Simulate incoming income** if no payment is
queued. Review the exact amounts and destinations, then sign `distribute`.

Say:

“Horizon detects the inflow. I see every destination before signing. Needs and
Buffer remain liquid; Savings enters the vault and starts its lock. The core
allocation is one Soroban transaction.”

#### 1:55–2:10 — Protect

Open Savings Vault. Show the locked balance, unlock time, and Buffer credit.

Say:

“The vault checks owner and unlock time. Early exit redirects ten percent to the
same user’s Buffer—never to Shunt.”

#### 2:10–2:22 — Grow

Open Grow from the Invest lane. Show the separation banner and the asset cards. If testnet liquidity
is available, buy a very small amount of TXAUM or XLM and sign the path payment.

Say:

“Grow is a separate spot purchase and can lose value. TXAUM and XLM execute on
testnet; the other asset cards remain visibly roadmap.”

If a buy cannot execute, do not retry during the pitch. Point to the status
labels and continue.

#### 2:22–2:30 — Exit and proof

Open Send & Pay or Add Money just long enough to show the route labels, then
open the `distribute` hash in Stellar Expert.

Say:

“Send works for USDC and XLM. The SDF SEP-24 flow is labeled testnet; provider
sandboxes remain separate. Here is the split hash anyone can inspect.”

---

## 5. Grow and cash rails — 2:30–2:42

### Slide

**Grow and cash rails stay explicit.**

`LIVE TESTNET — XLM + TXAUM`

`ROADMAP — BLEND + BENJI + USDY + BONDS + ETFs`

`RAMP — SEP-24 TEST FLOW + PROVIDER STATUS`

### Say

“The loop continues after the split. Grow stays separate from protected
Savings: XLM and demo-gold TXAUM are live testnet spot purchases, while Blend,
BENJI, USDY, Stablebonds, and tokenized ETFs remain visibly roadmap. Add Money
shows SEP-24 working as a test flow while the Indonesia production route still
requires a confirmed provider.”

### Show

Point first to the live labels on Grow, then to the environment labels on Add
Money. Do not read every roadmap product.

---

## 6. Why Stellar + close — 2:42–3:00

### Slide

**The loop works. Now connect the corridor.**

`USDC` · `SOROBAN + SAC` · `HORIZON` · `WALLETS KIT`

`DEX PATH PAYMENTS` · `SEP-7` · `SEP-10` · `SEP-24`

`ASK — ramp partner + pilot communities`

**Split freelance income before you spend it.**

### Say

“Every product promise maps to a Stellar rail: USDC carries value, Horizon
detects it, Soroban and SAC enforce the split, Wallets Kit keeps control with
the user, path payments execute optional Grow, and the SEPs connect payments
and anchors. The testnet loop works. Now we need a ramp partner and pilot
communities already earning cross-border USDC.”

### Show

End on the product mark and the ask. Do not reopen the application.

---

## Claim guardrails

- Contracts, balances, hashes, TXAUM, and the SDF anchor demonstration are
  **Stellar testnet**.
- TXAUM is an unbacked demo asset and only a stand-in for Matrixdock XAUm.
- XLM and TXAUM are the executable Grow assets in the current testnet build.
- BENJI, USDY, Blend, Etherfuse Stablebonds, and tokenized ETFs are roadmap
  cards, not live Shunt products.
- MoonPay and Transak remain sandbox/provider staging.
- MoneyGram remains onboarding pending.
- Do not claim live IDR cash-in or cash-out, provider approval, an audit,
  production readiness, automatic signing, user traction, or sharia compliance.
- If testnet liquidity or a provider sandbox fails during the pitch, show the
  honest status label and continue. Never improvise a success claim.
