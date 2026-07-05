import React from 'react';

interface AnimatedBackgroundProps {
  children?: React.ReactNode;
}

export const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({ children }) => {
  return (
    <div className="animated-background">
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>
      <div className="blob blob-3"></div>
      <div className="animated-background-content">
        {children}
      </div>
    </div>
  );
};
