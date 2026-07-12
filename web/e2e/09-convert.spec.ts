/**
 * In-app XLM ⇄ USDC converter — a REAL path payment through the testnet
 * DEX orderbook, quoted live via Horizon strict-send pathfinding. No third
 * party involved: the exchange is part of the Stellar protocol.
 */
import { test, expect } from "./fixtures";

test.describe("convert — XLM ⇄ USDC on the DEX", () => {
  test("quotes and executes a real XLM → USDC conversion", async ({ page }) => {
    await page.goto("/send?tab=convert");

    // Live quote for 10 XLM appears before anything is signed
    await page.getByTestId("convert-amount").fill("10");
    await expect(page.getByTestId("convert-quote")).toContainText("USDC", { timeout: 30_000 });

    // Rate + minimum-received floor are disclosed up front
    await expect(page.getByText(/min\. received/i)).toBeVisible();

    await page.getByTestId("convert-submit").click();

    // Real DEX execution → hash + explorer proof
    await expect(page.getByText("Conversion Successful")).toBeVisible({ timeout: 90_000 });
    const explorer = page.getByRole("link", { name: /view on stellar expert/i });
    await expect(explorer).toHaveAttribute("href", /stellar\.expert\/explorer\/testnet\/tx\//);

    // The conversion lands in Activity (same session)
    await page.getByTestId("convert-again").click();
    await page.goto("/activity");
    await expect(page.getByText(/converted 10 xlm/i).first()).toBeVisible();
  });

  test("direction can be flipped to USDC → XLM with its own quote", async ({ page }) => {
    await page.goto("/send?tab=convert");
    await page.getByTestId("convert-switch").click();
    await expect(page.getByTestId("convert-switch")).toContainText("USDC → XLM");

    await page.getByTestId("convert-amount").fill("1");
    await expect(page.getByTestId("convert-quote")).toContainText("XLM", { timeout: 30_000 });
  });
});
