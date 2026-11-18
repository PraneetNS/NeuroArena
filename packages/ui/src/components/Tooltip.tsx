import React, { useState } from 'react';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className={`na-tooltip-wrapper ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      <div
        role="tooltip"
        className="na-tooltip-content"
        style={{
          opacity: isVisible ? 1 : 0,
          visibility: isVisible ? 'visible' : 'hidden'
        }}
      >
        {content}
      </div>
    </div>
  );
};
