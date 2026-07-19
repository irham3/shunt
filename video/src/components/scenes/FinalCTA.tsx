import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, LANES } from "../../theme";
import { FONT_BODY, FONT_DISPLAY } from "../../fonts";

/**
 * Scene 5 — final lockup. The three lane dots settle under the Shunt wordmark
 * and the tagline resolves.
 */
export const FinalCTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const wordIn = spring({ frame, fps, config: { damping: 200, mass: 0.8 } });
  const lineWidth = interpolate(frame, [10, 30], [0, 240], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subOpacity = interpolate(frame, [16, 32], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ textAlign: "center", transform: `translateY(${interpolate(wordIn, [0, 1], [18, 0])}px)` }}>
      {/* three lane dots */}
      <div style={{ display: "flex", gap: 18, justifyContent: "center", marginBottom: 30 }}>
        {LANES.map((lane, i) => (
          <div
            key={lane.key}
            style={{
              width: 16,
              height: 16,
              borderRadius: 999,
              background: lane.color,
              boxShadow: `0 0 18px ${lane.color}`,
              opacity: interpolate(frame, [i * 4, i * 4 + 12], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          />
        ))}
      </div>

      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 800,
          fontSize: 148,
          letterSpacing: -4,
          color: COLORS.textPrimary,
          opacity: wordIn,
          lineHeight: 1,
        }}
      >
        Shunt
      </div>

      {/* lime underline */}
      <div
        style={{
          height: 6,
          width: lineWidth,
          background: COLORS.save,
          borderRadius: 999,
          margin: "26px auto 0",
          boxShadow: `0 0 24px ${COLORS.save}`,
        }}
      />

      <div
        style={{
          fontFamily: FONT_BODY,
          fontWeight: 500,
          fontSize: 34,
          letterSpacing: 1,
          color: COLORS.textSecondary,
          opacity: subOpacity,
          marginTop: 30,
        }}
      >
        Automated money routing on{" "}
        <span style={{ color: COLORS.textPrimary, fontWeight: 600 }}>Stellar</span>
      </div>
    </div>
  );
};
