import React from 'react';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  className = ''
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(!checked);
    }
  };

  return (
    <label
      className={`na-toggle-container ${className}`}
      onClick={(e) => {
        if (disabled) {
          e.preventDefault();
          return;
        }
        onChange(!checked);
      }}
    >
      <div
        role="switch"
        aria-checked={checked}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        className="na-toggle na-focusable"
        aria-disabled={disabled}
      >
        <span className="na-toggle__thumb" />
      </div>
      {label && <span className="na-slider-label">{label}</span>}
    </label>
  );
};
