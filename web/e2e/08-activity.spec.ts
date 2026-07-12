/**
 * Activity tab — the feed merges local app events with REAL on-chain
 * transfers from Horizon, so money that moved outside the app (Friendbot
 * funding, DEX purchases, direct sends) is always visible.
 */
import { test, expect } from "./fixtures";

test.describe("activity — on-chain transfers", () => {
  test("incoming and outgoing on-chain transfers appear in the feed", async ({ page, e2e }) => {
    await page.goto("/activity");

    // Friendbot funding (create_account) — guaranteed incoming XLM
    await expect(page.getByText("Received XLM").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/\+10,000 XLM/).first()).toBeVisible();

    // The XLM sent in the previous spec — outgoing, signed amount
    await expect(page.getByText("Sent XLM").first()).toBeVisible();

    if (e2e.usdcAcquired) {
      // The setup's DEX purchase is a self path payment → labeled honestly
      await expect(page.getByText(/converted to usdc/i).first()).toBeVisible();
    }

    // Every on-chain row links to the explorer
    await expect(page.getByRole("link", { name: /on-chain/i }).first()).toHaveAttribute(
      "href",
      /stellar\.expert\/explorer\/testnet\/tx\//,
    );
  });

  test("the Transfers filter isolates on-chain movements", async ({ page }) => {
    await page.goto("/activity");
    await expect(page.getByText("Received XLM").first()).toBeVisible({ timeout: 30_000 });

    await page.getByTestId("filter-transfer").click();
    await expect(page.getByText("Received XLM").first()).toBeVisible();

    // A filter with no matches states it plainly
    await page.getByTestId("filter-offramp").click();
    await expect(
      page.getByTestId("activity-empty").or(page.getByTestId("activity-row-offramp").first()),
    ).toBeVisible();
  });
});
