/** Unauthenticated landing → connect flow (README "How it works" step 1). */
import { test, expect } from "@playwright/test";

test.describe("onboarding", () => {
  test("landing page pitches the split and routes to connect", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /instantly split/i })).toBeVisible();
    await page.getByRole("button", { name: /get started/i }).click();
    await expect(page).toHaveURL(/\/connect/);
    await expect(page.getByText("Connect your wallet")).toBeVisible();
    // All three supported wallets are offered (Level 2 requirement)
    await expect(page.getByText(/freighter · albedo · xbull/i)).toBeVisible();
  });

  test("authenticated routes redirect to landing when no wallet", async ({ page }) => {
    await page.goto("/home");
    await expect(page).toHaveURL(/\/$/);
  });
});
