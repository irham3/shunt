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

/**
 * Scene 2 — an incoming payment lands. The card springs up and the amount
 * counts to +1,000 USDC.
 */
export const IncomingPayment: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardIn = spring({ frame, fps, config: { damping: 200, mass: 0.9 } });
  const amount = interpolate(frame, [8, 42], [0, 1000], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(cardIn, [0, 1], [40, 0]);

  return (
    <GlassCard
      glow="rgba(56,189,248,0.16)"
      style={{
        width: 620,
        padding: "44px 48px",
        opacity: cardIn,
        transform: `translateY(${y}px)`,
      }}
    >
      {/* header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              background: "rgba(56,189,248,0.14)",
              border: `1px solid ${COLORS.spend}55`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <path d="M12 4v14M12 18l-6-6M12 18l6-6" stroke={COLORS.spend} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span
            style={{
              fontFamily: FONT_BODY,
              fontWeight: 500,
              fontSize: 22,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: COLORS.textSecondary,
            }}
          >
            Incoming
          </span>
        </div>
        <span
          style={{
            fontFamily: FONT_BODY,
            fontWeight: 600,
            fontSize: 18,
            letterSpacing: 1,
            color: COLORS.textSecondary,
            border: `1px solid ${COLORS.hairline}`,
            borderRadius: 999,
            padding: "6px 16px",
          }}
        >
          USDC · Stellar
        </span>
      </div>

      {/* amount */}
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 800,
          fontSize: 108,
          letterSpacing: -2,
          color: COLORS.textPrimary,
          marginTop: 30,
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span style={{ color: COLORS.save }}>+</span>
        {fmt(amount)}
        <span style={{ fontSize: 44, color: COLORS.textSecondary, marginLeft: 14, letterSpacing: 0 }}>
          USDC
        </span>
      </div>

      <div
        style={{
          fontFamily: FONT_BODY,
          fontWeight: 500,
          fontSize: 22,
          color: COLORS.textSecondary,
          marginTop: 18,
        }}
      >
        Payment received — routing automatically
      </div>
    </GlassCard>
  );
};
