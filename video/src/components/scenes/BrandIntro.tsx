import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, LANES } from "../../theme";
import { FONT_BODY, FONT_DISPLAY } from "../../fonts";

/**
 * Scene 1 — Brand intro. The split-node motif draws itself (one current in,
 * three branches out) and the Shunt wordmark springs up beneath it.
 */
export const BrandIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const markIn = spring({ frame, fps, config: { damping: 200 } });
  const wordIn = spring({
    frame: frame - 8,
    fps,
    config: { damping: 200, mass: 0.7 },
  });

  // Draw the incoming trace, then the three branches, in sequence.
  const trunkDraw = interpolate(frame, [4, 22], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const branchDraw = interpolate(frame, [16, 34], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const wordY = interpolate(wordIn, [0, 1], [26, 0]);
  const subOpacity = interpolate(frame, [24, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const branchTargets = [
    { x: 150, color: LANES[0].color },
    { x: 260, color: LANES[1].color },
    { x: 370, color: LANES[2].color },
  ];

  return (
    <div style={{ textAlign: "center", transform: `scale(${interpolate(markIn, [0, 1], [0.94, 1])})` }}>
      <svg width={520} height={230} viewBox="0 0 520 230" style={{ overflow: "visible" }}>
        {/* incoming current */}
        <line
          x1={260}
          y1={0}
          x2={260}
          y2={96}
          stroke={COLORS.textSecondary}
          strokeWidth={4}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={trunkDraw}
        />
        {/* split node */}
        <circle
          cx={260}
          cy={100}
          r={interpolate(markIn, [0, 1], [0, 11])}
          fill={COLORS.save}
        />
        <circle cx={260} cy={100} r={22} fill="none" stroke={COLORS.save} strokeOpacity={0.35} strokeWidth={2} />
        {/* three branches */}
        {branchTargets.map((b) => (
          <path
            key={b.x}
            d={`M260 104 C 260 150, ${b.x} 150, ${b.x} 196`}
            fill="none"
            stroke={b.color}
            strokeWidth={4}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={branchDraw}
          />
        ))}
        {branchTargets.map((b) => (
          <circle
            key={`dot-${b.x}`}
            cx={b.x}
            cy={198}
            r={interpolate(frame, [30, 40], [0, 6], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}
            fill={b.color}
          />
        ))}
      </svg>

      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 800,
          fontSize: 112,
          letterSpacing: -3,
          color: COLORS.textPrimary,
          opacity: wordIn,
          transform: `translateY(${wordY}px)`,
          marginTop: 8,
          lineHeight: 1,
        }}
      >
        Shunt
      </div>
      <div
        style={{
          fontFamily: FONT_BODY,
          fontWeight: 500,
          fontSize: 26,
          letterSpacing: 6,
          textTransform: "uppercase",
          color: COLORS.textSecondary,
          opacity: subOpacity,
          marginTop: 18,
        }}
      >
        Automated money routing
      </div>
    </div>
  );
};
