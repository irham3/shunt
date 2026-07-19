import { describe, expect, it, vi } from "vitest";

// Mock the wallet-heavy module so importing growth.ts stays a pure unit test
// (stellar.ts runs StellarWalletsKit.init at import time — browser-only).
vi.mock("./stellar", () => ({
  HORIZON_URL: "https://horizon-testnet.stellar.org",
  USDC_CODE: "USDC",
  USDC_ISSUER: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  DEMO_ASSET_ISSUER: "GBYYFRNZ3CPZRM7QAV6ATNZGZ37EAZLWI2VO2D7QHKJ6VYEDC5MEUTJM",
}));

import { Asset } from "@stellar/stellar-sdk";
import {
  aggregateGrowthBuys,
  growthMarketAsset,
  type HorizonPaymentRecord,
} from "./growth";

const ME = "GCMXMZJIGK52T74W2NMEGIVFXLXW56FZNOONVYWUK4CAD4W6ETGW3DUO";
const USDC = { source_asset_type: "credit_alphanum4", source_asset_code: "USDC", source_asset_issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5" };

describe("growthMarketAsset", () => {
  it("maps xlm to native", () => {
    expect(growthMarketAsset("xlm")?.isNative()).toBe(true);
  });
  it("maps xaum-demo to the env issuer", () => {
    const a = growthMarketAsset("xaum-demo");
    expect(a?.getCode()).toBe("TXAUM");
    expect(a?.getIssuer()).toBe("GBYYFRNZ3CPZRM7QAV6ATNZGZ37EAZLWI2VO2D7QHKJ6VYEDC5MEUTJM");
  });
  it("returns null for unknown/roadmap ids", () => {
    expect(growthMarketAsset("benji")).toBeNull();
  });
});

describe("aggregateGrowthBuys", () => {
  const xlm = Asset.native();

  it("sums USDC-funded self conversions into XLM", () => {
    const records: HorizonPaymentRecord[] = [
      { type: "path_payment_strict_send", from: ME, to: ME, asset_type: "native", amount: "250", ...USDC, source_amount: "100" },
      { type: "path_payment_strict_send", from: ME, to: ME, asset_type: "native", amount: "120", ...USDC, source_amount: "50" },
    ];
    const agg = aggregateGrowthBuys(records, xlm, ME);
    expect(agg.unitsBought).toBe(370);
    expect(agg.usdcSpent).toBe(150);
  });

  it("ignores payments to a different destination account", () => {
    const records: HorizonPaymentRecord[] = [
      { type: "path_payment_strict_send", from: ME, to: "GDNSSUQX7Z75YPBTB7NLUKFXVQNMB4CE5PSFYD3QNVQ2R2XGO4G5CBMH", asset_type: "native", amount: "250", ...USDC, source_amount: "100" },
    ];
    expect(aggregateGrowthBuys(records, xlm, ME).usdcSpent).toBe(0);
  });

  it("ignores non-USDC-funded conversions (can't pollute cost basis)", () => {
    const records: HorizonPaymentRecord[] = [
      { type: "path_payment_strict_send", from: ME, to: ME, asset_type: "native", amount: "250", source_asset_type: "native", source_amount: "100" },
    ];
    expect(aggregateGrowthBuys(records, xlm, ME).usdcSpent).toBe(0);
  });

  it("ignores plain payments and trustline ops", () => {
    const records: HorizonPaymentRecord[] = [
      { type: "payment", from: ME, to: ME, asset_type: "native", amount: "999" },
      { type: "change_trust" } as HorizonPaymentRecord,
    ];
    expect(aggregateGrowthBuys(records, xlm, ME).unitsBought).toBe(0);
  });

  it("filters by the growth asset (TXAUM buys don't count toward XLM)", () => {
    const txaum = new Asset("TXAUM", "GBYYFRNZ3CPZRM7QAV6ATNZGZ37EAZLWI2VO2D7QHKJ6VYEDC5MEUTJM");
    const records: HorizonPaymentRecord[] = [
      { type: "path_payment_strict_send", from: ME, to: ME, asset_code: "TXAUM", asset_issuer: "GBYYFRNZ3CPZRM7QAV6ATNZGZ37EAZLWI2VO2D7QHKJ6VYEDC5MEUTJM", amount: "2", ...USDC, source_amount: "170" },
    ];
    expect(aggregateGrowthBuys(records, xlm, ME).usdcSpent).toBe(0);
    const goldAgg = aggregateGrowthBuys(records, txaum, ME);
    expect(goldAgg.unitsBought).toBe(2);
    expect(goldAgg.usdcSpent).toBe(170);
  });
});
