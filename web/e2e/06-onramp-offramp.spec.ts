/**
 * Money in / money out (README "the anchor stack"): SEP-1 discovery →
 * SEP-10 web auth (challenge signed by the E2E keypair) → SEP-24 hosted
 * flow — against the LIVE SDF test anchor. The hosted KYC UI itself is the
 * anchor's own web app; the loop is proven once it hands us a session URL.
 */
import { test, expect } from "./fixtures";

test.describe("anchor on-ramp / off-ramp", () => {
  test("Top Up (SEP-24 deposit) reaches the anchor's hosted flow", async ({ page }) => {
    await page.goto("/topup");
    await page.getByLabel(/amount to receive/i).fill("5");

    // Rate + fee are disclosed before confirmation (business model: 0.35%)
    await expect(page.getByText(/on-ramp fee \(0.35%\)/i)).toBeVisible();
    await expect(page.getByText(/you pay/i)).toBeVisible();

    await page.getByRole("button", { name: /^top up$/i }).click();

    // Real SEP-10 + SEP-24 round-trip → interactive session URL
    await expect(page.getByText("Top Up in progress")).toBeVisible({ timeout: 90_000 });
    const reopen = page.getByRole("link", { name: /reopen the anchor/i });
    await expect(reopen).toBeVisible();
    await expect(reopen).toHaveAttribute("href", /^https:\/\//);
  });

  test("Cash-out (SEP-24 withdraw) shows rate & fee first, then reaches the anchor", async ({ page, e2e }) => {
    await page.goto("/send");
    await page.getByRole("button", { name: "USDC Off-Ramp" }).click();

    // Real on-chain wallet balance is what gates the withdrawal
    await expect(page.getByText(/wallet holds/i)).toBeVisible();

    await page.getByLabel(/amount \(usdc\)/i).fill("1");
    // Fee disclosure before confirm (business model: 0.4% on Needs cash-out)
    await expect(page.getByText(/off-ramp fee \(0.4%\)/i)).toBeVisible();
    await expect(page.getByText(/you receive/i)).toBeVisible();

    await page.getByRole("button", { name: "Continue" }).click();

    if (e2e.usdcAcquired) {
      await expect(page.getByText("Cash-out in progress")).toBeVisible({ timeout: 90_000 });
      const reopen = page.getByRole("link", { name: /reopen the anchor/i });
      await expect(reopen).toBeVisible();
      await expect(reopen).toHaveAttribute("href", /^https:\/\//);
    } else {
      // Without wallet USDC the app must refuse honestly, not pretend
      await expect(page.getByRole("alert")).toContainText(/exceeds your wallet USDC/i);
    }
  });
});
