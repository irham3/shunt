import { describe, expect, it } from "vitest";
import { computeLandingRoute, HERO_SUBTEXT, PROOF_ITEMS, heroSubtextWordCount } from "./landing";

describe("landing content", () => {
  it("keeps the hero sentence scannable", () => expect(heroSubtextWordCount()).toBeLessThanOrEqual(20));
  it("contains only verifiable proof labels", () => {
    const text = PROOF_ITEMS.map((item) => `${item.label} ${item.value}`).join(" ");
    expect(text).not.toMatch(/Stellar Community Fund Build Award|Atomic Settlement|Self-Custodial Architecture/i);
    expect(HERO_SUBTEXT).not.toMatch(/atomically|yield|guaranteed/i);
  });
  it("conserves the route amount and reacts to reserve state", () => {
    const open = computeLandingRoute(100);
    const full = computeLandingRoute(100, true);
    expect(open.emergency + open.obligation + open.goal + open.spendable).toBe(open.gross);
    expect(full.emergency + full.obligation + full.goal + full.spendable).toBe(full.gross);
    expect(open.emergency).toBeGreaterThan(full.emergency);
  });
});
