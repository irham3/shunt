import { describe, expect, test } from "vitest";
import { createRampActivity } from "./ramp-activity";

describe("ramp activity copy", () => {
  test("labels SDF deposits as Stellar testnet simulation sessions", () => {
    expect(createRampActivity("deposit", 5)).toMatchObject({
      kind: "deposit",
      title: "Stellar test deposit · waiting for test payment",
      amountUsdc: 5,
    });
  });

  test("labels SDF withdrawals as Stellar testnet simulation sessions", () => {
    expect(createRampActivity("withdraw", 3)).toMatchObject({
      kind: "offramp",
      title: "Stellar test withdrawal · waiting for test transfer",
      amountUsdc: 3,
      bucket: "needs",
    });
  });
});
