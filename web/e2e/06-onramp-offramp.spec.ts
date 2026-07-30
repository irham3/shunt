/**
 * SDF test-anchor protocol simulation: SEP-1 discovery -> SEP-10 web auth
 * -> SEP-24 hosted flow. This proves the Stellar protocol path on testnet.
 * It does not prove a live fiat deposit or cash payout.
 */
import { test, expect } from "./fixtures";

test.describe("SDF test-anchor protocol simulation", () => {
  test("Add money opens an SDF SEP-24 deposit session with simulation copy", async ({ page }) => {
    await page.goto("/topup");

    await expect(page.getByText(/Live fiat routes appear only after/i)).toBeVisible();
    await expect(page.getByText("Stellar testnet simulation")).toBeVisible();
    await expect(page.getByText(/No bank account is charged/i)).toBeVisible();

    await page.getByLabel(/test usdc amount/i).fill("5");
    await page.getByRole("button", { name: /^start stellar test flow$/i }).click();

    await expect(page.getByRole("heading", { name: "Test deposit session created" })).toBeVisible({ timeout: 90_000 });
    const reopen = page.getByRole("link", { name: /reopen the sdf test flow/i });
    await expect(reopen).toBeVisible();
    await expect(reopen).toHaveAttribute("href", /^https:\/\//);
  });

  test("Transak does not fall back to a manual wallet form when locked setup fails", async ({ page }) => {
    let transakRequests = 0;
    await page.route("**/transak-url", async (route) => {
      transakRequests += 1;
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "Transak needs a funded Stellar mainnet recipient." }),
      });
    });

    await page.goto("/topup");
    await expect(page.getByText(/USD card to Stellar XLM/i)).toBeVisible();
    await page.getByRole("button", { name: /^try transak$/i }).click();

    await expect(page.getByRole("alert")).toContainText(/funded Stellar mainnet recipient/i);
    expect(transakRequests).toBe(1);
  });

  test("Test withdrawal opens an SDF SEP-24 withdraw session when the wallet has USDC", async ({ page, e2e }) => {
    await page.goto("/send");
    await page.getByRole("button", { name: "Test Withdrawal" }).click();

    await expect(page.getByText(/Create a Stellar testnet withdrawal session/i)).toBeVisible();
    await expect(page.getByText(/does not quote IDR or provider fees/i)).toBeVisible();

    await page.getByLabel(/amount \(usdc\)/i).fill("1");
    await page.getByRole("button", { name: "Continue" }).click();

    if (e2e.usdcAcquired) {
      await expect(page.getByRole("heading", { name: "Test withdrawal session created" })).toBeVisible({ timeout: 90_000 });
      const reopen = page.getByRole("link", { name: /reopen the sdf test flow/i });
      await expect(reopen).toBeVisible();
      await expect(reopen).toHaveAttribute("href", /^https:\/\//);
    } else {
      await expect(page.getByRole("alert")).toContainText(/exceeds your wallet USDC/i);
    }
  });
});
