import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { GlassCard } from "../GlassCard";
import { COLORS } from "../../theme";
import { FONT_BODY, FONT_DISPLAY } from "../../fonts";

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

// Deterministic horizontal offsets for the falling tokens (no Math.random).
const COINS = [-70, -34, 4, 40, 76];

/**
 * Scene 4 — the Save allocation pours into the savings vault. Lime tokens fall
 * from the Save chip into a glass vault whose fill rises and balance counts to
 * 300 USDC, sealed with a timelock badge.
 */
export const VaultScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fill = interpolate(frame, [10, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const balance = interpolate(frame, [10, 40], [0, 300], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const vaultIn = spring({ frame, fps, config: { damping: 200 } });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 620 }}>
      {/* Save source chip */}
      <div
        style={{
          fontFamily: FONT_BODY,
          fontWeight: 600,
          fontSize: 22,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: COLORS.textOnAccent,
          background: COLORS.save,
          borderRadius: 999,
          padding: "12px 26px",
          boxShadow: `0 0 40px ${COLORS.save}55`,
        }}
      >
        Save · 300 USDC
      </div>

      {/* falling tokens */}
      <svg width={620} height={150} viewBox="0 0 620 150" style={{ overflow: "visible" }}>
        {COINS.map((dx, i) => {
          const delay = i * 4;
          const t = interpolate(frame - delay, [6, 30], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const cy = interpolate(t, [0, 1], [-6, 150]);
          const op = interpolate(t, [0, 0.1, 0.85, 1], [0, 1, 1, 0]);
          return (
            <circle
              key={i}
              cx={310 + dx}
              cy={cy}
              r={9}
              fill={COLORS.save}
              opacity={op}
              style={{ filter: `drop-shadow(0 0 8px ${COLORS.save})` }}
            />
          );
        })}
      </svg>

      {/* vault */}
      <GlassCard
        glow="rgba(245,158,11,0.18)"
        style={{
          width: 560,
          padding: "34px 40px 38px",
          transform: `scale(${interpolate(vaultIn, [0, 1], [0.95, 1])})`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: "rgba(245,158,11,0.14)",
                border: `1px solid ${COLORS.amber}55`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                <rect x={4} y={10} width={16} height={10} rx={2.5} stroke={COLORS.amber} strokeWidth={2} />
                <path d="M8 10V8a4 4 0 0 1 8 0v2" stroke={COLORS.amber} strokeWidth={2} strokeLinecap="round" />
              </svg>
            </div>
            <span
              style={{
                fontFamily: FONT_BODY,
                fontWeight: 600,
                fontSize: 24,
                letterSpacing: 1,
                color: COLORS.textPrimary,
              }}
            >
              Savings vault
            </span>
          </div>
          <span
            style={{
              fontFamily: FONT_BODY,
              fontWeight: 600,
              fontSize: 16,
              letterSpacing: 1,
              color: COLORS.amber,
              border: `1px solid ${COLORS.amber}55`,
              borderRadius: 999,
              padding: "6px 14px",
            }}
          >
            Timelocked
          </span>
        </div>

        {/* balance */}
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 800,
            fontSize: 76,
            letterSpacing: -1,
            color: COLORS.textPrimary,
            marginTop: 22,
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {fmt(balance)}
          <span style={{ fontSize: 30, color: COLORS.textSecondary, marginLeft: 12 }}>USDC</span>
        </div>

        {/* fill meter */}
        <div
          style={{
            height: 12,
            borderRadius: 999,
            background: "rgba(255,255,255,0.07)",
            marginTop: 26,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${fill * 100}%`,
              borderRadius: 999,
              background: `linear-gradient(90deg, ${COLORS.save}, ${COLORS.amber})`,
              boxShadow: `0 0 20px ${COLORS.save}88`,
            }}
          />
        </div>
      </GlassCard>
    </div>
  );
};
