/**
 * The core loop (README steps 3-5): real USDC in the wallet → keeper
 * prepares an unsigned `distribute` → the user reviews the exact breakdown
 * and signs → one atomic on-chain split. Savings land in the vault; the
 * invest slice converts to XLM via a follow-up path payment.
 *
 * This spec moves REAL testnet USDC through the deployed contract.
 */
import { test, expect } from "./fixtures";

test.describe("one-tap split", () => {
  test("splits real USDC through the vault contract", async ({ page, e2e }) => {
    test.skip(!e2e.usdcAcquired, "no USDC liquidity on the testnet DEX today");
    test.skip(!e2e.keeperUp, "keeper is unreachable — cannot prepare distribute XDR");

    await page.goto("/home");
    await expect(page.getByTestId("unsplit-banner")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("split-now-button").click();

    // Confirm screen shows the exact breakdown before anything moves
    await expect(page).toHaveURL(/\/confirm/, { timeout: 30_000 });
    await expect(page.getByText("Income landed")).toBeVisible();
    await expect(page.getByText("Needs → wallet")).toBeVisible();
    await expect(page.getByText("Savings → vault (timelock)")).toBeVisible();
    await expect(page.getByText("Buffer → wallet")).toBeVisible();
    await expect(page.getByText("Invest → XLM (DCA)")).toBeVisible();

    // One tap: sign + submit the atomic split (real transaction)
    await page.getByRole("button", { name: /approve split/i }).click();
    await expect(page.getByRole("link", { name: /view on explorer/i })).toBeVisible({ timeout: 120_000 });

    await page.getByRole("button", { name: "Done" }).click();
    await expect(page).toHaveURL(/\/home/);

    // The vault (contract read) now holds the savings share: 25% of 8 = 2 USDC
    const expectedSavings = (Number(e2e.usdcAmount) * 0.25).toFixed(2);
    await expect(page.getByTestId("row-vault-savings")).toContainText(`${expectedSavings} USDC`, { timeout: 90_000 });
  });

  test("demo fallback is honest when the keeper can't prepare a split", async ({ page, e2e }) => {
    test.skip(e2e.keeperUp && e2e.usdcAcquired, "covered by the real-split test above");

    // The simulate section only renders once rules are saved on-chain — do
    // the real set_rules first (works without the keeper), then simulate.
    await page.goto("/shunt");
    const save = page.getByTestId("save-rules-button");
    if (await save.isVisible().catch(() => false)) {
      await save.click();
      await expect(page.getByTestId("simulate-section")).toBeVisible({ timeout: 90_000 });
    }
    await page.getByTestId("simulate-income-button").click();
    await expect(page).toHaveURL(/\/confirm/, { timeout: 60_000 });
    await expect(page.getByText("Income landed")).toBeVisible();
  });
});
