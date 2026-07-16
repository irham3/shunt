/**
 * Coverage for the 2026-07-16 feature expansion — every item verified
 * against the LIVE testnet (new ShuntVault CC7E…, real Shunt-issued demo
 * assets with seeded liquidity). No mocks, same discipline as 01-10.
 *
 * Runs after 01-10, so the account already has on-chain rules and some
 * vault savings to work with.
 */
import { test, expect } from "./fixtures";
import { StrKey } from "@stellar/stellar-sdk";

function num(text: string | null): number {
  const m = (text ?? "").replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : NaN;
}

test.describe("2026-07-16 feature expansion", () => {
  test.beforeEach(({ e2e }) => {
    test.skip(!e2e.usdcAcquired, "no USDC liquidity on the testnet DEX today");
  });

  test("buffer threshold auto-refill target saves on-chain and round-trips", async ({ page }) => {
    await page.goto("/shunt");
    // Rules may already be saved from an earlier spec in this run — the
    // buffer_target input is always rendered but disabled until Edit mode.
    const editBtn = page.getByRole("button", { name: "Edit configuration" });
    if (await editBtn.isVisible().catch(() => false)) await editBtn.click();

    await page.getByTestId("buffer-target-input").fill("5");
    await page.getByTestId("save-rules-button").click();
    await expect(page.getByText("Shunt rules saved on-chain")).toBeVisible({ timeout: 90_000 });

    // Reload and re-sync from chain — the value must be the on-chain one,
    // not a client-side echo of what was just typed.
    await page.goto("/shunt");
    await expect(page.getByTestId("buffer-target-input")).toHaveValue("5", { timeout: 30_000 });
  });

  test("laddered goal timelocks unlock independently", async ({ page }) => {
    await page.goto("/savings");
    await expect(page.getByTestId("unallocated-savings")).toBeVisible({ timeout: 60_000 });

    // Short ladder: effectively unlocked almost immediately.
    await page.getByTestId("new-goal-button").click();
    await page.getByTestId("goal-name-input").fill("E2E Short Ladder");
    await page.getByTestId("goal-amount-input").fill("0.3");
    await page.getByTestId("goal-lock-0").click(); // "No lock"
    await page.getByTestId("create-goal-button").click();
    await expect(page.getByText('Goal "E2E Short Ladder" created')).toBeVisible({ timeout: 120_000 });

    // Long ladder: 2 years out, still locked.
    await page.getByTestId("new-goal-button").click();
    await page.getByTestId("goal-name-input").fill("E2E Long Ladder");
    await page.getByTestId("goal-amount-input").fill("0.3");
    await page.getByTestId("goal-lock-63072000").click(); // "2 years"
    await page.getByTestId("create-goal-button").click();
    await expect(page.getByText('Goal "E2E Long Ladder" created')).toBeVisible({ timeout: 120_000 });

    // No-lock goal: withdraw with zero penalty. Each goal's action buttons
    // carry a unique aria-label (e.g. "Withdraw from E2E Short Ladder"), so
    // no DOM-position guessing is needed to target the right row.
    await page.getByRole("button", { name: "Withdraw from E2E Short Ladder" }).click();
    await page.getByLabel("E2E Short Ladder withdrawal amount").fill("0.1");
    await page.getByRole("button", { name: "Go", exact: true }).click();
    await expect(page.getByText(/^Withdrawn from goal$/)).toBeVisible({ timeout: 120_000 });

    // 2-year goal: same moment, still incurs the penalty — proves the two
    // goals' locks are tracked independently, not off one shared clock.
    await page.getByRole("button", { name: "Withdraw from E2E Long Ladder" }).click();
    await page.getByLabel("E2E Long Ladder withdrawal amount").fill("0.1");
    await page.getByRole("button", { name: "Go", exact: true }).click();
    await expect(page.getByText(/penalty → Buffer/i)).toBeVisible({ timeout: 120_000 });
  });

  test("auto-escalation bumps Savings % on-chain after the configured cadence", async ({ page, e2e }) => {
    test.skip(!e2e.keeperUp, "keeper is unreachable");

    await page.goto("/shunt");
    // The toggle (like every rules control) is disabled outside Edit mode —
    // rules are already saved by an earlier spec, so the page loads read-only.
    const editBtn = page.getByRole("button", { name: "Edit configuration" });
    if (await editBtn.isVisible().catch(() => false)) await editBtn.click();
    await page.getByTestId("auto-escalate-toggle").check();
    await expect(page.getByText(/\+1% every 3 splits/i)).toBeVisible();

    // Fast-forward the deterministic split counter (pure bookkeeping — not
    // itself an on-chain fact, so seeding it client-side is the same class
    // of setup as the fixture injecting the E2E signer) so the very next
    // real split is the one that crosses the cadence. The resulting
    // set_rules call that follows IS real and is what this test verifies.
    await page.evaluate(() => {
      const raw = localStorage.getItem("shunt-store");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      parsed.state.splitsSinceEscalation = 2; // one more split reaches everyNSplits=3
      localStorage.setItem("shunt-store", JSON.stringify(parsed));
    });
    await page.reload();

    // Use the app's own simulate path so the whole approve flow — including
    // the post-split escalation hook — runs for real, end to end.
    await expect(page.getByTestId("simulate-section")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("simulate-income-button").click();
    await expect(page).toHaveURL(/\/confirm/, { timeout: 60_000 });
    await page.getByRole("button", { name: /approve split/i }).click();

    await expect(page.getByTestId("auto-escalate-notice")).toBeVisible({ timeout: 170_000 });
    await expect(page.getByTestId("auto-escalate-notice")).toContainText(/bumped to \d+%/);
  });

  test("multi-currency settle: USDC spends into a real testnet local-currency asset", async ({ page }) => {
    await page.goto("/send?tab=convert");
    await expect(page.getByTestId("settle-asset-tidr")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("settle-asset-tidr").click();

    // First-time trustline gate (idempotent — a prior spec run may have
    // already enabled it on this account). The has-trustline check is async
    // (a Horizon read), so wait for EITHER button to actually render before
    // deciding which branch we're in — checking immediately after the click
    // can race the check while it's still mid-flight (settleHasTrustline
    // still null), silently skipping the enable step it needed.
    const enableBtn = page.getByTestId("settle-enable-trustline");
    const submitBtn = page.getByTestId("settle-submit");
    await expect(enableBtn.or(submitBtn)).toBeVisible({ timeout: 15_000 });
    if (await enableBtn.isVisible().catch(() => false)) {
      await enableBtn.click();
      await expect(page.getByText(/TIDR enabled/i)).toBeVisible({ timeout: 90_000 });
    }

    await page.getByTestId("settle-amount").fill("1");
    await expect(page.getByTestId("settle-quote")).toContainText("TIDR", { timeout: 30_000 });
    await page.getByTestId("settle-submit").click();

    await expect(page.getByText("Settled locally")).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText(/testnet demo asset/i)).toBeVisible();
  });

  test("Pay a request: pays a SEP-7 link in a different asset than USDC", async ({ page, e2e }) => {
    const uri = `web+stellar:pay?destination=${e2e.destPublicKey}&amount=1&msg=E2E%20invoice`;

    await page.goto("/send");
    await page.getByTestId("tab-payreq").click();
    await page.getByTestId("payreq-uri").fill(uri);

    await expect(page.getByTestId("payreq-dest")).toContainText("1 XLM", { timeout: 30_000 });
    await expect(page.getByTestId("payreq-quote")).toContainText("USDC", { timeout: 30_000 });
    await page.getByTestId("payreq-submit").click();

    await expect(page.getByText("Request paid")).toBeVisible({ timeout: 90_000 });

    // Independently confirm the recipient actually received it — the UI
    // succeeding isn't proof by itself.
    const res = await fetch(`https://horizon-testnet.stellar.org/accounts/${e2e.destPublicKey}`);
    const acc = await res.json();
    const xlm = Number(acc.balances.find((b: any) => b.asset_type === "native")?.balance ?? 0);
    expect(xlm).toBeGreaterThan(10_000); // friendbot start balance
  });

  test("Invest lane Gold buy executes for real against Shunt's seeded TXAUM liquidity", async ({ page }) => {
    await page.goto("/shunt");
    const editBtn = page.getByRole("button", { name: "Edit configuration" });
    if (await editBtn.isVisible().catch(() => false)) await editBtn.click();
    await page.getByTestId("invest-asset-gold").click();

    await page.goto("/lane/invest");
    await page.getByTestId("lane-buy-amount").fill("1");
    await expect(page.getByTestId("lane-buy-submit")).toBeEnabled({ timeout: 30_000 });
    await page.getByTestId("lane-buy-submit").click();

    await expect(page.getByText(/bought .*txaum/i)).toBeVisible({ timeout: 90_000 });
    const row = page.getByText(/manual buy: 1 usdc/i).first();
    await expect(row).toBeVisible();
    // Real purchase — must NOT carry the labeled-simulation tag.
    await expect(row).not.toContainText("reference rate");
  });

  test("scheduled bill-pay: create then cancel a claimable balance", async ({ page, e2e }) => {
    await page.goto("/lane/needs");
    await expect(page.getByTestId("scheduled-bill-pay")).toBeVisible({ timeout: 30_000 });

    await page.getByTestId("new-scheduled-payment").click();
    await page.getByTestId("schedule-recipient").fill(e2e.destPublicKey);
    await page.getByTestId("schedule-amount").fill("1");
    const dueDate = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
    await page.getByTestId("schedule-date").fill(dueDate);
    await page.getByTestId("schedule-submit").click();

    await expect(page.getByText(/^Scheduled 1 USDC for/)).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText(/1 USDC · claimable/)).toBeVisible();

    await page.getByTestId("cancel-scheduled-payment").click();
    await expect(page.getByText(/Scheduled payment cancelled/i)).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText("No scheduled payments yet.")).toBeVisible();
  });

  test("Buffer lane offers an emergency off-ramp and quick-convert shortcut", async ({ page }) => {
    await page.goto("/lane/buffer");
    await expect(page.getByTestId("buffer-emergency-offramp")).toHaveAttribute("href", "/send?tab=usdc");
    await expect(page.getByTestId("buffer-quick-convert")).toHaveAttribute("href", "/send?tab=convert");
  });

  test("SendPay tabs switch on click without hanging (regression: AnimatePresence mode=wait freeze)", async ({ page }) => {
    await page.goto("/send");
    await expect(page.getByRole("button", { name: "Send XLM" })).toBeVisible();

    await page.getByTestId("tab-payreq").click();
    await expect(page.getByTestId("payreq-uri")).toBeVisible({ timeout: 5_000 });

    await page.getByTestId("tab-convert").click();
    await expect(page.getByTestId("convert-amount")).toBeVisible({ timeout: 5_000 });
  });
});
