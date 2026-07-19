import { describe, expect, it } from "vitest";
import {
  GROWTH_ASSETS,
  GROWTH_TIER_LABEL,
  GROWTH_TIER_ORDER,
  growthAssetById,
  isPurchasable,
  type GrowthAsset,
} from "./growth-assets";

describe("growth-assets registry invariants", () => {
  it("has unique ids", () => {
    const ids = GROWTH_ASSETS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every yield-defi asset is interest-based", () => {
    for (const a of GROWTH_ASSETS.filter((a) => a.tier === "yield-defi")) {
      expect(a.interestBased, `${a.id} must be interestBased`).toBe(true);
    }
  });

  it("every roadmap-status asset has no execution (non-purchasable)", () => {
    for (const a of GROWTH_ASSETS.filter((a) => a.status === "roadmap")) {
      expect(a.execution, `${a.id} (roadmap) must have no execution`).toBeUndefined();
      expect(isPurchasable(a), `${a.id} (roadmap) must not be purchasable`).toBe(false);
    }
  });

  it("every live-testnet asset has an execution type", () => {
    for (const a of GROWTH_ASSETS.filter((a) => a.status === "live-testnet")) {
      expect(a.execution, `${a.id} (live-testnet) must have an execution`).toBeDefined();
    }
  });

  it("dex-path-payment assets carry a demoAsset code (issuer may be env-resolved)", () => {
    for (const a of GROWTH_ASSETS.filter((a) => a.execution === "dex-path-payment")) {
      // XLM is native (no issuer); classic demo assets must name a code.
      if (a.id !== "xlm") {
        expect(a.demoAsset?.code, `${a.id} needs a demoAsset code`).toBeTruthy();
      }
    }
  });

  it("honest notes have no trailing period (house copy rule)", () => {
    for (const a of GROWTH_ASSETS) {
      expect(a.honestNote.endsWith("."), `${a.id} honestNote should not end with a period`).toBe(false);
    }
  });

  it("every tier in the registry has a label and a place in the section order", () => {
    for (const a of GROWTH_ASSETS) {
      expect(GROWTH_TIER_LABEL[a.tier]).toBeTruthy();
      expect(GROWTH_TIER_ORDER).toContain(a.tier);
    }
  });

  it("growthAssetById round-trips", () => {
    for (const a of GROWTH_ASSETS) {
      expect(growthAssetById(a.id)).toBe(a);
    }
    expect(growthAssetById("does-not-exist")).toBeUndefined();
  });

  it("isPurchasable rejects a live asset with an unresolved issuer", () => {
    const noIssuer: GrowthAsset = {
      id: "x",
      name: "x",
      symbol: "X",
      tier: "value-hedge",
      status: "live-testnet",
      execution: "dex-path-payment",
      demoAsset: { code: "X", issuer: "" },
      returnSource: "price-appreciation",
      interestBased: false,
      riskLevel: "medium",
      shortDescription: "x",
      honestNote: "x",
    };
    expect(isPurchasable(noIssuer)).toBe(false);
  });
});
