import type { ReactNode } from "react";

interface AnimatedBackgroundProps {
  children?: ReactNode;
  aurora?: boolean;
  threads?: boolean;
}

export function AnimatedBackground({ children, aurora = false }: AnimatedBackgroundProps) {
  return (
    <div className="animated-background">
      <div className="ab-decor" aria-hidden>
        <div className="ab-grid" />
        {aurora && <div className="ab-glow" />}
      </div>
      <div className="animated-background-content">{children}</div>
    </div>
  );
}
