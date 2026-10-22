import React from 'react';

export interface NumberFieldProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  label?: string;
}

export const NumberField: React.FC<NumberFieldProps> = ({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  disabled = false,
  className = '',
  label
}) => {
  const handleDecrement = () => {
    if (disabled) return;
    const next = Math.max(min, Math.round((value - step) * 1e6) / 1e6);
    onChange(next);
  };

  const handleIncrement = () => {
    if (disabled) return;
    const next = Math.min(max, Math.round((value + step) * 1e6) / 1e6);
    onChange(next);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseFloat(e.target.value);
    if (!isNaN(parsed)) {
      onChange(Math.min(max, Math.max(min, parsed)));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      handleIncrement();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleDecrement();
    }
  };

  return (
    <div className={`na-numberfield ${className}`}>
      <button
        type="button"
        className="na-numberfield__btn"
        onClick={handleDecrement}
        disabled={disabled || value <= min}
        tabIndex={-1}
        aria-label="Decrease value"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className="na-numberfield__input"
        aria-label={label}
      />

      <button
        type="button"
        className="na-numberfield__btn"
        onClick={handleIncrement}
        disabled={disabled || value >= max}
        tabIndex={-1}
        aria-label="Increase value"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
};
