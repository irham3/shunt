import { defineConfig } from "@playwright/test";

/**
 * Shunt E2E — real testnet, no mocks (see e2e/README.md).
 *
 * Specs are numbered and run serially in one worker: they walk the README's
 * money loop in order (fund → rules → income → split → vault → out) against
 * the live testnet contract, keeper, and anchor, sharing one throwaway
 * account created in global-setup.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // Testnet ledgers close ~every 5s and some flows chain 2-3 transactions.
  timeout: 180_000,
  expect: { timeout: 20_000 },
  globalSetup: "./e2e/global-setup.ts",
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
