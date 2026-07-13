import React from "react";
import { Threads } from "./Threads";

interface AnimatedBackgroundProps {
  children?: React.ReactNode;
  /** Landing/entry screens get a single soft glow behind the hero. */
  aurora?: boolean;
  /** Interactive reactbits "Threads" field behind the hero (WebGL). */
  threads?: boolean;
}

/**
 * Clean, restrained backdrop: a near-black surface with a barely-there dot
 * grid, an optional soft glow, and an optional interactive Threads field
 * (reactbits.dev) masked to the top so it reads as a hero background and
 * dissolves before the content below. Deliberately calm — the old WebGL
 * aurora + particle field + rainbow blobs read as busy/AI-generated and were
 * removed (feedback 2026-07-13).
 */
export const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({
  children,
  aurora = false,
  threads = false,
}) => {
  return (
    <div className="animated-background">
      <div className="ab-decor" aria-hidden>
        <div className="ab-grid" />
        {threads && (
          <div className="ab-threads">
            <Threads color={[0.83, 0.98, 0.29]} amplitude={1.6} distance={0.42} enableMouseInteraction />
          </div>
        )}
        {aurora && <div className="ab-glow" />}
      </div>
      <div className="animated-background-content">{children}</div>
    </div>
  );
};
