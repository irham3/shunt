import React from "react";
import { Particles } from "./Particles";
import { Aurora } from "./Aurora";

interface AnimatedBackgroundProps {
  children?: React.ReactNode;
  /** Landing pages get the full Aurora light source at the top; app screens
      keep only the restrained particle field. */
  aurora?: boolean;
}

export const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({ children, aurora = false }) => {
  return (
    <div className="animated-background">
      {/* Decorative layer only — clipped here, not on the parent, so sticky
          descendants (e.g. the landing nav) keep working. */}
      <div className="ab-decor" aria-hidden>
        {aurora && (
          <div className="ab-aurora">
            <Aurora />
          </div>
        )}
        <Particles />
        <div className="blob blob-1"></div>
        <div className="blob blob-3"></div>
      </div>
      <div className="animated-background-content">{children}</div>
    </div>
  );
};
