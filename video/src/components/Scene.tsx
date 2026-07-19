import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

interface SceneProps {
  /** Length of the enclosing <Sequence>, used to time the fade-out. */
  durationInFrames: number;
  fadeIn?: number;
  fadeOut?: number;
  children: React.ReactNode;
}

/**
 * Crossfade wrapper. Scene contents fade in at the start and out at the end of
 * their sequence window, so overlapping <Sequence>es dissolve into one another
 * on the shared background — smooth, never a hard cut.
 */
export const Scene: React.FC<SceneProps> = ({
  durationInFrames,
  fadeIn = 10,
  fadeOut = 10,
  children,
}) => {
  const frame = useCurrentFrame();
  // Compose the two fades independently so fadeIn/fadeOut of 0 stay valid
  // (a single 4-point interpolate would produce a non-monotonic range).
  const inOpacity =
    fadeIn > 0
      ? interpolate(frame, [0, fadeIn], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;
  const outOpacity =
    fadeOut > 0
      ? interpolate(
          frame,
          [durationInFrames - fadeOut, durationInFrames],
          [1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        )
      : 1;
  const opacity = inOpacity * outOpacity;

  return (
    <AbsoluteFill style={{ opacity, justifyContent: "center", alignItems: "center" }}>
      {children}
    </AbsoluteFill>
  );
};
