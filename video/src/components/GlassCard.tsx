import React from "react";
import { COLORS } from "../theme";

interface GlassCardProps {
  style?: React.CSSProperties;
  glow?: string;
  children: React.ReactNode;
}

/**
 * Glassmorphism surface used for the payment card, lane pills and vault.
 * Backdrop blur plus a hairline top-light gives the premium fintech feel.
 */
export const GlassCard: React.FC<GlassCardProps> = ({
  style,
  glow,
  children,
}) => {
  return (
    <div
      style={{
        position: "relative",
        borderRadius: 28,
        background: COLORS.glassFill,
        border: `1px solid ${COLORS.glassBorder}`,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        boxShadow: glow
          ? `0 24px 70px rgba(0,0,0,0.5), 0 0 0 1px ${COLORS.hairline}, 0 0 60px ${glow}`
          : "0 24px 70px rgba(0,0,0,0.5)",
        overflow: "hidden",
        ...style,
      }}
    >
      {/* top light sheen */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 30%)",
          pointerEvents: "none",
        }}
      />
      {children}
    </div>
  );
};
