import React, { useId } from 'react';

export interface SliderProps {
  label?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
  className?: string;
}

export const Slider: React.FC<SliderProps> = ({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  disabled = false,
  onChange,
  className = ''
}) => {
  const id = useId();

  return (
    <div className={`na-slider-group ${className}`}>
      {(label || unit !== undefined) && (
        <div className="na-slider-header">
          {label && (
            <label htmlFor={id} className="na-slider-label">
              {label}
            </label>
          )}
          <span className="na-slider-value">
            {value}
            {unit}
          </span>
        </div>
      )}
      <div className="na-slider-track-wrap">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="na-slider-input na-focusable"
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
        />
      </div>
    </div>
  );
};
