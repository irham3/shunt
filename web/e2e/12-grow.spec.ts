/**
 * Grow lane — registry-driven catalog behaviours, verified against the LIVE
 * app (no mocks). These assertions are non-transactional (render, tiering,
 * roadmap gating, banner persistence) so they run fast and deterministically.
 *
 * The real testnet BUY flow (USDC → XLM / TXAUM path payment, tx hash) is
 * intentionally NOT in this blocking spec — it depends on live DEX liquidity
 * and wallet signing latency. It belongs in a separate, non-blocking real-tx
 * run so a thin orderbook can never flake the main suite.
 */
import { test, expect } from "./fixtures";

test.describe("Grow lane", () => {
  test("renders the four registry tiers", async ({ page }) => {
    await page.goto("/grow");
    await expect(page.getByRole("heading", { name: "Value hedge" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Yield-bearing (interest)" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Crypto" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Coming to Stellar" })).toBeVisible();
  });

  test("live cards are buyable, roadmap cards are not", async ({ page }) => {
    await page.goto("/grow");
    // Live testnet assets expose a Buy control.
    await expect(page.getByTestId("grow-buy-xlm")).toBeVisible();
    await expect(page.getByTestId("grow-buy-xaum-demo")).toBeVisible();
    // Roadmap assets are non-purchasable.
    await expect(page.getByTestId("grow-unavailable-blend-usdc")).toBeDisabled();
    await expect(page.getByTestId("grow-unavailable-benji")).toBeDisabled();
    await expect(page.getByTestId("grow-buy-benji")).toHaveCount(0);
  });

  test("the Savings-separation banner persists dismissal", async ({ page }) => {
    await page.goto("/grow");
    const banner = page.getByTestId("grow-banner");
    await expect(banner).toBeVisible();
    await page.getByTestId("grow-banner-dismiss").click();
    await expect(banner).toHaveCount(0);
    // Persisted in localStorage — still gone after a reload.
    await page.reload();
    await expect(page.getByTestId("grow-banner")).toHaveCount(0);
  });
});
