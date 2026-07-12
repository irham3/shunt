/**
 * Send & Pay — native XLM transfer (Level 1 requirement): build, sign with
 * the E2E keypair, submit via Horizon, and surface the hash + explorer link.
 * REAL testnet transaction to the funded destination account from setup.
 */
import { test, expect } from "./fixtures";

test.describe("send & pay — XLM transfer", () => {
  test("sends XLM on-chain and records it in Activity", async ({ page, e2e }) => {
    await page.goto("/send");

    await page.getByPlaceholder("GABC…XYZ").fill(e2e.destPublicKey);
    await page.getByLabel(/amount \(xlm\)/i).fill("5");
    await page.getByRole("button", { name: "Send XLM" }).click();

    // Real Horizon submission → success screen with the transaction hash
    await expect(page.getByText("Transaction Successful")).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText("Transaction Hash")).toBeVisible();
    const explorer = page.getByRole("link", { name: /view on stellar expert/i });
    await expect(explorer).toBeVisible();
    await expect(explorer).toHaveAttribute("href", /stellar\.expert\/explorer\/testnet\/tx\//);

    // Outgoing transfer must land in the Activity tab (same session)
    await page.goto("/activity");
    await expect(page.getByText(/sent xlm to/i).first()).toBeVisible();
  });

  test("rejects an invalid destination address", async ({ page }) => {
    await page.goto("/send");
    await page.getByPlaceholder("GABC…XYZ").fill("not-a-stellar-address");
    await page.getByLabel(/amount \(xlm\)/i).fill("1");
    await page.getByRole("button", { name: "Send XLM" }).click();
    await expect(page.getByRole("alert")).toContainText(/invalid destination/i);
  });
});
