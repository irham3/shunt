import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { GlassCard } from "../GlassCard";
import { COLORS, LANES, Lane } from "../../theme";
import { FONT_BODY, FONT_DISPLAY } from "../../fonts";

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

/** X positions (in the 900-wide connector viewBox) of the three lane columns. */
const COLS = [150, 450, 750];

/**
 * Scene 3 — the 1,000 USDC current splits down three circuit traces into the
 * Spend / Save / Invest lanes. Traces draw in, a bright pulse travels each
 * path, then the pills spring up and their amounts count to target.
 */
export const SplitScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const draw = interpolate(frame, [2, 22], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // A continuously travelling dash = money flowing down the traces.
  const flowOffset = -frame * 1.4;

  return (
    <div style={{ width: 900, display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* source total */}
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 700,
          fontSize: 30,
          color: COLORS.textSecondary,
          letterSpacing: 1,
          marginBottom: 6,
        }}
      >
        <span style={{ color: COLORS.textPrimary }}>1,000</span> USDC
      </div>

      {/* connector traces */}
      <svg width={900} height={190} viewBox="0 0 900 190" style={{ overflow: "visible" }}>
        <circle cx={450} cy={8} r={9} fill={COLORS.textPrimary} />
        {LANES.map((lane, i) => {
          const d = `M450 12 C 450 90, ${COLS[i]} 90, ${COLS[i]} 182`;
          return (
            <g key={lane.key}>
              {/* base trace */}
              <path
                d={d}
                fill="none"
                stroke={lane.color}
                strokeOpacity={0.28}
                strokeWidth={4}
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={draw}
              />
              {/* travelling current pulse */}
              <path
                d={d}
                fill="none"
                stroke={lane.color}
                strokeWidth={4}
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray="0.12 0.88"
                strokeDashoffset={flowOffset}
                opacity={interpolate(frame, [14, 24], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })}
              />
            </g>
          );
        })}
      </svg>

      {/* lane pills */}
      <div style={{ display: "flex", gap: 26, marginTop: 8 }}>
        {LANES.map((lane, i) => (
          <LanePill key={lane.key} lane={lane} index={i} frame={frame} fps={fps} />
        ))}
      </div>
    </div>
  );
};

const LanePill: React.FC<{
  lane: Lane;
  index: number;
  frame: number;
  fps: number;
}> = ({ lane, index, frame, fps }) => {
  const start = 20 + index * 7;
  const enter = spring({
    frame: frame - start,
    fps,
    config: { damping: 200, mass: 0.8 },
  });
  const amount = interpolate(
    frame,
    [start + 2, start + 26],
    [0, lane.amount],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const y = interpolate(enter, [0, 1], [34, 0]);

  return (
    <GlassCard
      glow={`${lane.color}22`}
      style={{
        width: 258,
        padding: "30px 30px 34px",
        opacity: enter,
        transform: `translateY(${y}px)`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: 999,
            background: lane.color,
            boxShadow: `0 0 16px ${lane.color}`,
          }}
        />
        <span
          style={{
            fontFamily: FONT_BODY,
            fontWeight: 600,
            fontSize: 22,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: COLORS.textSecondary,
          }}
        >
          {lane.label}
        </span>
      </div>
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 800,
          fontSize: 62,
          letterSpacing: -1,
          color: COLORS.textPrimary,
          marginTop: 18,
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {fmt(amount)}
      </div>
      <div
        style={{
          fontFamily: FONT_BODY,
          fontWeight: 500,
          fontSize: 18,
          color: COLORS.textSecondary,
          marginTop: 8,
        }}
      >
        USDC
      </div>
      {/* allocation underline */}
      <div
        style={{
          height: 4,
          borderRadius: 999,
          background: lane.color,
          marginTop: 20,
          width: `${interpolate(enter, [0, 1], [0, (lane.amount / 500) * 100])}%`,
          opacity: 0.9,
        }}
      />
    </GlassCard>
  );
};
