import type { ActivityItem } from "../store";

export type TestRampDirection = "deposit" | "withdraw";

export function createRampActivity(direction: TestRampDirection, amountUsdc: number): ActivityItem {
  const isDeposit = direction === "deposit";

  return {
    id: `${Date.now()}-${direction}`,
    kind: isDeposit ? "deposit" : "offramp",
    title: isDeposit
      ? "Stellar test deposit · waiting for test payment"
      : "Stellar test withdrawal · waiting for test transfer",
    amountUsdc,
    at: new Date().toISOString(),
    ...(isDeposit ? {} : { bucket: "needs" }),
  };
}
