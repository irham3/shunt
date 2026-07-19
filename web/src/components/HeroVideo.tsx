/**
 * HeroVideo — plays the pre-rendered Shunt hero produced by the standalone
 * Remotion project in `../../../video`. The MP4 is copied to
 * `web/public/videos/shunt-hero.mp4` (run `npm run build:web` inside `video/`).
 *
 * This is a plain <video> tag on purpose: @remotion/player is intentionally NOT
 * pulled into the Vite bundle, keeping Remotion fully isolated from the app.
 */
export interface HeroVideoProps {
  className?: string;
  /** Optional poster still (e.g. /videos/shunt-hero.png). */
  poster?: string;
  style?: React.CSSProperties;
}

const SRC = "/videos/shunt-hero.mp4";

export function HeroVideo({ className, poster, style }: HeroVideoProps) {
  return (
    <video
      className={className}
      src={SRC}
      poster={poster}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-label="Shunt — automated money routing on Stellar"
      style={{
        display: "block",
        width: "100%",
        height: "auto",
        aspectRatio: "1 / 1",
        borderRadius: "var(--radius-card-lg, 20px)",
        objectFit: "cover",
        ...style,
      }}
    />
  );
}

export default HeroVideo;
