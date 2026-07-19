import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { COLORS } from "../theme";

/**
 * Persistent dark-navy ground shared by every scene. A slow radial breath and
 * faint circuit traces give the "current" a place to live without ever
 * competing with the foreground. This element never unmounts, so it carries
 * visual continuity across scene crossfades.
 */
export const Background: React.FC = () => {
  const frame = useCurrentFrame();

  // A very slow, low-amplitude glow drift — motion that supports, not distracts.
  const glow = interpolate(frame, [0, 120, 240], [0.55, 0.72, 0.55], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgBase }}>
      {/* Deep navy depth wash, brightest just above center where the flow lives */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(120% 90% at 50% 34%, ${COLORS.bgNavy} 0%, ${COLORS.bgBase} 62%)`,
          opacity: glow,
        }}
      />

      {/* Faint circuit lattice — the electrical-shunt motif, kept near-invisible */}
      <svg
        width={1080}
        height={1080}
        viewBox="0 0 1080 1080"
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <linearGradient id="bgtrace" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.spend} stopOpacity={0} />
            <stop offset="50%" stopColor={COLORS.spend} stopOpacity={0.14} />
            <stop offset="100%" stopColor={COLORS.spend} stopOpacity={0} />
          </linearGradient>
        </defs>
        {[190, 380, 700, 890].map((x) => (
          <line
            key={x}
            x1={x}
            y1={0}
            x2={x}
            y2={1080}
            stroke="url(#bgtrace)"
            strokeWidth={1}
          />
        ))}
        {[300, 540, 780].map((y) => (
          <line
            key={y}
            x1={0}
            y1={y}
            x2={1080}
            y2={y}
            stroke="rgba(255,255,255,0.03)"
            strokeWidth={1}
          />
        ))}
      </svg>

      {/* Subtle vignette to seat the square in the frame */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(90% 90% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
