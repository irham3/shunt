/**
 * Home dashboard — every number is a live on-chain read (no mockups):
 * wallet USDC + XLM from Horizon, vault savings from the contract, and the
 * user can flip the total between USDC / XLM / IDR denominations.
 */
import { test, expect } from "./fixtures";

test.describe("home balances", () => {
  test("shows real on-chain balances with an asset selector", async ({ page, e2e }) => {
    await page.goto("/home");

    // Total is denominated — home defaults to XLM (2fc6571: "prioritize XLM").
    const totalCard = page.getByTestId("total-balance-card");
    await expect(totalCard).toContainText("Total balance");
    await expect(page.getByTestId("total-balance-value")).toContainText("XLM");

    // Breakdown rows: all live Horizon/contract reads
    await expect(page.getByTestId("row-wallet-usdc")).toContainText("USDC");
    await expect(page.getByTestId("row-vault-savings")).toContainText("USDC");
    // Friendbot funded → XLM row must be non-zero
    await expect(page.getByTestId("row-wallet-xlm")).not.toContainText("0.00 XLM", { timeout: 30_000 });

    if (e2e.usdcAcquired) {
      // The DEX purchase from setup is visible as real wallet USDC
      await expect(page.getByTestId("row-wallet-usdc")).toContainText(`${Number(e2e.usdcAmount).toFixed(2)} USDC`, { timeout: 30_000 });
    }

    // Flip the denomination: USDC view
    await page.getByTestId("asset-toggle-usdc").click();
    await expect(page.getByTestId("total-balance-value")).toContainText("USDC");
    // IDR view
    await page.getByTestId("asset-toggle-idr").click();
    await expect(page.getByTestId("total-balance-value")).toContainText("Rp");
    // and back to the default
    await page.getByTestId("asset-toggle-xlm").click();
    await expect(page.getByTestId("total-balance-value")).toContainText("XLM");
  });

  test("each lane card shows percentage and nominal amount", async ({ page }) => {
    await page.goto("/home");
    for (const lane of ["needs", "savings", "buffer", "invest"]) {
      const card = page.getByTestId(`bucket-card-${lane}`);
      await expect(card).toContainText("% of each income");
      await expect(card).toContainText("USDC");
    }
  });

  test("USDC received directly is flagged as unsplit with a one-tap CTA", async ({ page, e2e }) => {
    test.skip(!e2e.usdcAcquired, "no USDC liquidity on the testnet DEX today");
    await page.goto("/home");
    // 8 USDC arrived outside the app (DEX purchase) — Home must notice it
    await expect(page.getByTestId("unsplit-banner")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("unsplit-banner")).toContainText("isn't split yet");
    await expect(page.getByTestId("split-now-button")).toBeVisible();
  });
});
