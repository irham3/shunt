/**
 * Configure Shunt (README step 2) — allocation UX guarantees + a REAL
 * on-chain `set_rules` transaction signed by the E2E keypair.
 */
import { test, expect } from "./fixtures";

test.describe("configure shunt rules", () => {
  test("allocation can never exceed 100% and gives feedback", async ({ page }) => {
    await page.goto("/shunt");

    // Defaults sum to exactly 100%
    await expect(page.getByTestId("allocation-status")).toContainText("Fully allocated");
    await expect(page.getByTestId("donut-total-pct")).toHaveText("100%");

    // Trying to push a lane up when nothing is left must not change the total
    // (the + stepper is disabled at 100%)
    const needsPlus = page.getByRole("button", { name: "Increase Needs" });
    await expect(needsPlus).toBeDisabled();

    // Force the slider beyond the available room — the store clamps it
    await page.getByLabel("Savings percent").fill("90");
    await expect(page.getByTestId("clamp-hint")).toBeVisible();
    await expect(page.getByTestId("allocation-status")).toContainText("Fully allocated");

    // Free up 20% → status flips to "left to allocate" and save is blocked
    await page.getByLabel("Needs percent").fill("30");
    await expect(page.getByTestId("allocation-status")).toContainText("20% left to allocate");
    await expect(page.getByTestId("save-rules-button")).toBeDisabled();

    // One-tap fix routes the remainder into Needs
    await page.getByTestId("allocate-remaining-button").click();
    await expect(page.getByTestId("allocation-status")).toContainText("Fully allocated");
    await expect(page.getByTestId("save-rules-button")).toBeEnabled();
  });

  test("shows total balance and nominal preview per lane", async ({ page }) => {
    await page.goto("/shunt");
    await expect(page.getByTestId("config-total-balance")).toContainText("USDC");
    // Preview defaults to a concrete income and every lane shows its slice
    await page.getByTestId("preview-amount-input").fill("1000");
    await expect(page.getByTestId("lane-nominal-needs")).toContainText("500 USDC");
    await expect(page.getByTestId("lane-nominal-savings")).toContainText("250 USDC");
    await expect(page.getByTestId("lane-nominal-buffer")).toContainText("150 USDC");
    await expect(page.getByTestId("lane-nominal-invest")).toContainText("100 USDC");
  });

  test("saves rules on-chain (real set_rules transaction)", async ({ page }) => {
    await page.goto("/shunt");
    await expect(page.getByTestId("save-rules-button")).toBeEnabled();
    await page.getByTestId("save-rules-button").click();

    // Real testnet round-trip: simulate → sign locally → submit → confirm.
    await expect(page.getByText("Shunt rules saved on-chain")).toBeVisible({ timeout: 90_000 });
    await expect(page.getByTestId("post-save-panel")).toBeVisible();
    await expect(page.getByTestId("post-save-panel")).toContainText("what happens next");
  });
});
