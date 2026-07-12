/**
 * Savings vault + custom labels (README: code-custody savings, goals
 * lifecycle) — create / rename / withdraw-with-penalty / delete, each a
 * REAL transaction against the deployed ShuntVault contract.
 */
import { test, expect } from "./fixtures";

const LABEL = "E2E Dana darurat";
const RENAMED = "E2E Renamed";

test.describe("savings vault — labeled sub-vaults", () => {
  test.beforeEach(({ e2e }) => {
    test.skip(!e2e.usdcAcquired || !e2e.keeperUp, "vault is only funded when the real split ran");
  });

  test("vault shows the on-chain savings balance and lock state", async ({ page, e2e }) => {
    await page.goto("/savings");
    const expected = (Number(e2e.usdcAmount) * 0.25).toFixed(2);
    await expect(page.getByTestId("vault-balance")).toContainText(expected, { timeout: 60_000 });
    // The split started the timelock → early exits carry the 10% penalty
    await expect(page.getByText(/locked until/i)).toBeVisible();
  });

  test("user can create a custom-labeled sub-vault (on-chain)", async ({ page }) => {
    await page.goto("/savings");
    await expect(page.getByTestId("unallocated-savings")).not.toContainText("0.00", { timeout: 60_000 });

    await page.getByTestId("new-goal-button").click();
    await page.getByTestId("goal-name-input").fill(LABEL);
    await page.getByTestId("goal-amount-input").fill("1");
    await page.getByTestId("create-goal-button").click();

    await expect(page.getByText(`Goal "${LABEL}" created`)).toBeVisible({ timeout: 120_000 });
    await expect(page.getByTestId("savings-goals-card")).toContainText(LABEL);
    // 1 USDC moved from unallocated into the labeled slice — total unchanged
    await expect(page.getByTestId("savings-goals-card")).toContainText("1.00 USDC");
  });

  test("user can rename the label (cosmetic, on-chain)", async ({ page }) => {
    await page.goto("/savings");
    await expect(page.getByTestId("savings-goals-card")).toContainText(LABEL, { timeout: 60_000 });

    await page.getByRole("button", { name: `Rename ${LABEL}` }).click();
    await page.getByLabel("New goal name").fill(RENAMED);
    await page.getByRole("button", { name: "Save", exact: true }).click();

    await expect(page.getByText("Goal renamed")).toBeVisible({ timeout: 120_000 });
    await expect(page.getByTestId("savings-goals-card")).toContainText(RENAMED);
  });

  test("early withdrawal from a goal pays the 10% penalty into Buffer credit", async ({ page }) => {
    await page.goto("/savings");
    await expect(page.getByTestId("savings-goals-card")).toContainText(RENAMED, { timeout: 60_000 });

    await page.getByRole("button", { name: `Withdraw from ${RENAMED}` }).click();
    await page.getByLabel(`${RENAMED} withdrawal amount`).fill("0.2");
    await page.getByRole("button", { name: "Go", exact: true }).click();

    await expect(page.getByText(/penalty → Buffer/i)).toBeVisible({ timeout: 120_000 });
    // The penalty is not lost: it shows up as withdrawable Buffer credit
    await expect(page.getByTestId("buffer-credit-card")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("buffer-credit-card")).toContainText("0.02 USDC");
  });

  test("deleting the label releases its balance back to unallocated", async ({ page }) => {
    await page.goto("/savings");
    await expect(page.getByTestId("savings-goals-card")).toContainText(RENAMED, { timeout: 60_000 });

    await page.getByRole("button", { name: `Delete ${RENAMED}` }).click();
    await expect(page.getByText(/deleted — funds released/i)).toBeVisible({ timeout: 120_000 });
    await expect(page.getByTestId("savings-goals-card")).not.toContainText(RENAMED);
  });
});
