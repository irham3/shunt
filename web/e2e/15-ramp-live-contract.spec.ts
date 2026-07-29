import { test, expect } from "@playwright/test";

const required = ["RAMP_LIVE_PROVIDER", "RAMP_LIVE_WALLET", "RAMP_LIVE_MAX_FIAT"] as const;
const configured = required.every((key) => Boolean(process.env[key]));

test.describe("live ramp settlement evidence", () => {
  test.skip(!configured, "Set RAMP_LIVE_PROVIDER, RAMP_LIVE_WALLET, and RAMP_LIVE_MAX_FIAT to run live settlement checks.");

  test("requires provider completion and a matching Stellar mainnet transaction", async () => {
    const maxFiat = Number(process.env.RAMP_LIVE_MAX_FIAT);

    expect(process.env.RAMP_LIVE_PROVIDER).toBeTruthy();
    expect(process.env.RAMP_LIVE_WALLET).toMatch(/^G[A-Z2-7]{55}$/);
    expect(Number.isFinite(maxFiat) && maxFiat > 0 && maxFiat <= 250_000).toBe(true);

    test.fail(true, "Wire this to the selected provider's live order API after KYB/preview access is approved.");
  });
});
