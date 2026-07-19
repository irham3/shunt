/**
 * Shunt brand tokens, mirrored from `web/src/styles/tokens.css`.
 * Keeping the video palette identical to the app makes the hero read as the
 * product itself rather than a generic fintech mock.
 */
export const COLORS = {
  bgBase: "#060707", // near-black brand ground
  bgNavy: "#0a0f1c", // deep navy used for the radial depth wash
  bgElevated: "#101112",

  // Lane semantics — same hues the app uses in its allocation bar.
  spend: "#38bdf8", // sky-blue   — Needs / Spend
  save: "#cdf14a", // live-wire lime — Savings (the single hero accent)
  invest: "#a78bfa", // soft violet — Invest
  amber: "#f59e0b", // warm amber  — vault / Buffer glow

  textPrimary: "#f4f5f6",
  textSecondary: "#8c9099",
  textOnAccent: "#0a0c07", // near-black text on lime/amber surfaces (WCAG)

  glassFill: "rgba(18, 19, 21, 0.72)",
  glassBorder: "rgba(255, 255, 255, 0.09)",
  hairline: "rgba(255, 255, 255, 0.06)",
} as const;

export type LaneKey = "spend" | "save" | "invest";

export interface Lane {
  key: LaneKey;
  label: string;
  amount: number;
  color: string;
}

/** The 1,000 USDC split, matching the storyboard. */
export const LANES: Lane[] = [
  { key: "spend", label: "Spend", amount: 500, color: COLORS.spend },
  { key: "save", label: "Save", amount: 300, color: COLORS.save },
  { key: "invest", label: "Invest", amount: 200, color: COLORS.invest },
];

export const VIDEO = {
  width: 1080,
  height: 1080,
  fps: 30,
  durationInFrames: 240,
} as const;
