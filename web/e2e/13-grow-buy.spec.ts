/**
 * Grow — REAL testnet buy (opt-in). Performs an actual USDC→TXAUM path payment
 * signed by the throwaway e2e key and asserts the tx hash surfaces, linked to
 * stellar.expert. This is the money-movement proof the fast spec (12) omits.
 *
 * Gated behind RUN_GROW_BUY so it NEVER runs in the default blocking suite —
 * it chains 2-3 signed testnet txs (trustline + path payment) and depends on
 * live TXAUM/USDC DEX liquidity, either of which can make it slow or flaky.
 *
 *   Run it explicitly:
 *     bash:        RUN_GROW_BUY=1 npx playwright test 13-grow-buy
 *     PowerShell:  $env:RUN_GROW_BUY=1; npx playwright test 13-grow-buy
 */
import { test, expect } from "./fixtures";

test.describe("Grow real buy (opt-in, real testnet tx)", () => {
  test.skip(!process.env.RUN_GROW_BUY, "set RUN_GROW_BUY=1 to run this real-money spec");

  test.beforeEach(({ e2e }) => {
    test.skip(!e2e.usdcAcquired, "no USDC acquired in global-setup — nothing to spend");
  });

  test("USDC → TXAUM path payment surfaces a stellar.expert tx hash", async ({ page }) => {
    await page.goto("/grow");

    const buy = page.getByTestId("grow-buy-xaum-demo");
    // The gold card must be live (env issuer resolved) to buy against.
    await expect(buy).toBeVisible();

    // Spend a small slice of the ~8 USDC global-setup acquired.
    await page.getByTestId("grow-amount-xaum-demo").fill("1");
    await expect(buy).toBeEnabled();
    await buy.click();

    // First buy also signs a one-time TXAUM trustline, then the path payment —
    // give the chained testnet txs room to confirm.
    const hashLink = page.getByTestId("grow-txhash-xaum-demo");
    await expect(hashLink).toBeVisible({ timeout: 150_000 });

    const href = await hashLink.getAttribute("href");
    expect(href).toContain("stellar.expert");
    expect(href).toMatch(/\/tx\/[0-9a-f]{64}/i);
  });
});
