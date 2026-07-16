/**
 * Full-coverage sweep — every remaining interactive path that specs 01-09
 * don't reach, each against the LIVE testnet (no mocks):
 *
 *  - Home "Swap 1000 XLM for testnet USDC" (real DEX path payment)
 *  - batch split: two keeper-detected incomes → "Split all 2" (two real
 *    distribute txs in one approval flow)
 *  - Buffer-credit withdraw (vault → wallet, real withdraw_buffer)
 *  - USDC transfer: friendly error for a recipient without a trustline,
 *    then a real successful USDC payment
 *  - Convert USDC → XLM executes (reverse direction of spec 09)
 *  - Invest lane manual buy — XLM (real DEX) and Gold/XAUm (labeled
 *    reference-rate simulation, no fake explorer link)
 *  - Configure Shunt "Reallocate" prepares a real split and lands on /confirm
 *  - cross-menu consistency: the vault balance shown on Home equals the
 *    Savings Vault page (both are independent contract reads)
 *
 * Runs after 01-09, so the account already has on-chain rules, vault savings,
 * and buffer credit from the earlier specs.
 */
import { test, expect } from "./fixtures";

const KEEPER_URL = "https://shunt-keeper.irhamtria.workers.dev";

function randomHash(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Parse "1,234.56 USDC" style text into a number. */
function num(text: string | null): number {
  const m = (text ?? "").replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : NaN;
}

test.describe("full coverage — remaining buttons", () => {
  test.beforeEach(({ e2e }) => {
    test.skip(!e2e.usdcAcquired, "no USDC liquidity on the testnet DEX today");
  });

  test("Home swap button buys real USDC with 1000 XLM", async ({ page }) => {
    await page.goto("/home");
    const row = page.getByTestId("row-wallet-usdc");
    await expect(row).toBeVisible();
    // wait for the real Horizon read to land before capturing the baseline
    await page.waitForTimeout(4000);
    const before = num(await row.textContent());

    await page.getByTestId("swap-xlm-usdc").click();
    await expect(page.getByText(/swapped 1000 xlm/i)).toBeVisible({ timeout: 90_000 });
    await expect
      .poll(async () => num(await row.textContent()), { timeout: 60_000 })
      .toBeGreaterThan(before + 10);
  });

  test("two detected incomes split in one batch approval (real txs)", async ({ page, e2e }) => {
    test.skip(!e2e.keeperUp, "keeper is unreachable");

    // Simulate two real detections: the keeper prepares + persists both
    // pending entries exactly as its Horizon cron would.
    for (const amount of ["1.5", "1"]) {
      const res = await fetch(`${KEEPER_URL}/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: e2e.publicKey, amount, txHash: randomHash() }),
      });
      expect(res.ok).toBeTruthy();
      const entry = (await res.json()) as { xdr: string | null; error?: string };
      expect(entry.xdr, entry.error).toBeTruthy();
    }

    // Cloudflare KV is eventually consistent — a /trigger write isn't always
    // readable via /pending from the very next request (docs: up to ~60s).
    // Home's own poll interval is 8s and runs indefinitely, so give this the
    // same real-world patience instead of asserting on the first check.
    await page.goto("/home");
    const banner = page.getByTestId("income-detected-banner");
    await expect(banner).toBeVisible({ timeout: 75_000 });
    await expect(banner).toContainText("2 incomes detected");

    await page.getByTestId("split-all-button").click();
    await expect(page).toHaveURL(/\/confirm/);
    await expect(page.getByText("2 incomes landed")).toBeVisible();
    await expect(page.getByText("2.50 USDC")).toBeVisible();

    // One flow, two sequential real distribute transactions
    await page.getByRole("button", { name: /approve all 2 splits/i }).click();
    await expect(page.getByText("All splits complete")).toBeVisible({ timeout: 170_000 });
    await expect(page.getByRole("link", { name: /view on explorer/i })).toHaveCount(2);

    await page.getByRole("button", { name: "Done" }).click();
    await expect(page).toHaveURL(/\/home/);
  });

  test("buffer credit withdraws from the vault to the wallet", async ({ page }) => {
    // Spec 05's early goal-withdrawal left a 10% penalty as buffer credit.
    await page.goto("/savings");
    const card = page.getByTestId("buffer-credit-card");
    await expect(card).toBeVisible({ timeout: 60_000 });

    await page.getByTestId("withdraw-buffer-credit").click();
    await expect(page.getByText(/buffer credit withdrawn/i)).toBeVisible({ timeout: 120_000 });

    // The withdrawal is recorded in Activity (bookkeeping, not just a toast)
    await page.goto("/activity");
    await expect(page.getByText("Buffer credit withdrawn to wallet").first()).toBeVisible();
  });

  test("USDC send refuses a recipient without a trustline, then succeeds to a valid one", async ({ page, e2e }) => {
    await page.goto("/send");
    await page.getByTestId("send-asset-usdc").click();

    // destPublicKey was funded by setup but has NO USDC trustline
    await page.getByPlaceholder("GABC…XYZ").fill(e2e.destPublicKey);
    await page.getByTestId("send-amount").fill("0.5");
    await page.getByTestId("send-submit").click();
    await expect(page.getByRole("alert")).toContainText(/trustline/i, { timeout: 90_000 });

    // Self-payment is a valid Stellar op — proves the full sign+submit path
    await page.getByPlaceholder("GABC…XYZ").fill(e2e.publicKey);
    await page.getByTestId("send-submit").click();
    await expect(page.getByText("Transaction Successful")).toBeVisible({ timeout: 90_000 });
    await expect(
      page.getByRole("link", { name: /view on stellar expert/i }),
    ).toHaveAttribute("href", /stellar\.expert\/explorer\/testnet\/tx\//);
  });

  test("Convert executes USDC → XLM (reverse of spec 09)", async ({ page }) => {
    await page.goto("/send?tab=convert");
    await page.getByTestId("convert-switch").click();
    await expect(page.getByTestId("convert-switch")).toContainText("USDC → XLM");

    await page.getByTestId("convert-amount").fill("1");
    await expect(page.getByTestId("convert-quote")).toContainText("XLM", { timeout: 30_000 });

    await page.getByTestId("convert-submit").click();
    await expect(page.getByText("Conversion Successful")).toBeVisible({ timeout: 90_000 });
    await expect(
      page.getByRole("link", { name: /view on stellar expert/i }),
    ).toHaveAttribute("href", /stellar\.expert\/explorer\/testnet\/tx\//);
  });

  test("Invest lane manual buy purchases XLM on the real DEX", async ({ page }) => {
    await page.goto("/lane/invest");
    await page.getByTestId("lane-buy-amount").fill("1");
    await expect(page.getByTestId("lane-buy-submit")).toBeEnabled({ timeout: 30_000 });
    await page.getByTestId("lane-buy-submit").click();

    await expect(page.getByText(/bought ≈.*xlm/i)).toBeVisible({ timeout: 90_000 });
    // Real purchase — the activity row must NOT be a labeled simulation
    const row = page.getByText(/manual buy: 1 usdc/i).first();
    await expect(row).toBeVisible();
    await expect(row).not.toContainText("reference rate");
  });

  test("Invest lane set to Gold records a labeled reference-rate buy", async ({ page }) => {
    // Fresh context starts in editing mode (rules mirror seeded false), so
    // the asset picker is enabled straight away.
    await page.goto("/shunt");
    await page.getByTestId("invest-asset-gold").click();

    await page.goto("/lane/invest");
    await page.getByTestId("lane-buy-amount").fill("0.5");
    await expect(page.getByTestId("lane-buy-submit")).toBeEnabled({ timeout: 30_000 });
    await page.getByTestId("lane-buy-submit").click();

    await expect(page.getByText(/bought .*xaum/i)).toBeVisible({ timeout: 60_000 });
    // Honest labeling: simulated purchase carries the reference-rate tag
    await expect(page.getByText(/manual buy: 0\.5 usdc/i).first()).toBeVisible();
    await expect(page.getByText(/reference rate/i).first()).toBeVisible();
  });

  test("Reallocate prepares a real split for the whole wallet balance", async ({ page }) => {
    // Home first: syncFromChain flips the local rules mirror back to "saved",
    // which is what unlocks the Test-your-rules card on Configure Shunt.
    await page.goto("/home");
    await expect(page.getByTestId("row-wallet-usdc")).toBeVisible();
    await expect(page.getByTestId("setup-rules-nudge")).toHaveCount(0, { timeout: 30_000 });

    await page.goto("/shunt");
    await expect(page.getByTestId("simulate-section")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("reallocate-balance").click();

    await expect(page).toHaveURL(/\/confirm/, { timeout: 60_000 });
    await expect(page.getByText("Income landed")).toBeVisible();
    // Dismiss path: "Later" returns home without signing anything
    await page.getByRole("button", { name: "Later" }).click();
    await expect(page).toHaveURL(/\/home/);
  });

  test("vault balance is identical on Home and the Savings Vault page", async ({ page }) => {
    // Home and Savings Vault both render the SAME store field (balances.savings)
    // — verified in source, not two independent reads — so this test's real
    // job is confirming that fact stays true, not racing an in-flight
    // syncFromChain correction left over from the batch-split test above.
    // Wait for two consecutive polls on Home to agree before treating the
    // number as settled, or an async correction landing mid-read produces a
    // false mismatch against nothing but its own earlier, stale self.
    await page.goto("/home");
    const homeRow = page.getByTestId("row-vault-savings");
    await expect(homeRow).toBeVisible();
    await expect.poll(async () => num(await homeRow.textContent()), { timeout: 30_000 }).toBeGreaterThan(0);
    let homeVault = num(await homeRow.textContent());
    await expect
      .poll(
        async () => {
          const current = num(await homeRow.textContent());
          const stable = current === homeVault;
          homeVault = current;
          return stable;
        },
        { timeout: 30_000, intervals: [6_000] },
      )
      .toBe(true);

    await page.goto("/savings");
    const vaultBalance = page.getByTestId("vault-balance");
    await expect(vaultBalance).toBeVisible();
    await expect
      .poll(async () => num(await vaultBalance.textContent()), { timeout: 30_000 })
      .toBeCloseTo(homeVault, 1);
  });
});
