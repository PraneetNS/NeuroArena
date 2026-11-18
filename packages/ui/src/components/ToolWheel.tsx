import React, { useState, useEffect, useCallback, useRef } from 'react';

export interface ToolWheelItem {
  id: string;
  label: string;
  description: string;
  icon?: React.ReactNode;
}

export interface ToolWheelProps {
  items: ToolWheelItem[];
  selectedId?: string;
  onSelect: (item: ToolWheelItem) => void;
  className?: string;
}

export const ToolWheel: React.FC<ToolWheelProps> = ({
  items,
  selectedId,
  onSelect,
  className = ''
}) => {
  const initialIndex = Math.max(
    0,
    items.findIndex((item) => item.id === selectedId)
  );
  const [highlightedIndex, setHighlightedIndex] = useState(initialIndex);
  const wheelRef = useRef<HTMLDivElement>(null);
  const lastGamepadAction = useRef<number>(0);

  const n = items.length;
  const anglePerItem = (2 * Math.PI) / n;
  const outerR = 145;
  const innerR = 68;
  const cx = 160;
  const cy = 160;

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'd' || e.key === 's') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % n);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'a' || e.key === 'w') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 + n) % n);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const item = items[highlightedIndex];
        if (item) {
          onSelect(item);
        }
      }
    },
    [highlightedIndex, items, n, onSelect]
  );

  // Gamepad navigation polling
  useEffect(() => {
    let animFrameId: number;

    const pollGamepad = () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = gamepads[0];

      if (gp) {
        const now = Date.now();
        // Cooldown between stick inputs (200ms)
        if (now - lastGamepadAction.current > 200) {
          const axisX = gp.axes[0] ?? 0;
          const axisY = gp.axes[1] ?? 0;
          const dpadLeft = gp.buttons[14]?.pressed;
          const dpadRight = gp.buttons[15]?.pressed;
          const buttonA = gp.buttons[0]?.pressed;

          if (axisX > 0.4 || dpadRight) {
            setHighlightedIndex((prev) => (prev + 1) % n);
            lastGamepadAction.current = now;
          } else if (axisX < -0.4 || dpadLeft) {
            setHighlightedIndex((prev) => (prev - 1 + n) % n);
            lastGamepadAction.current = now;
          } else if (axisY > 0.4) {
            setHighlightedIndex((prev) => (prev + 1) % n);
            lastGamepadAction.current = now;
          } else if (axisY < -0.4) {
            setHighlightedIndex((prev) => (prev - 1 + n) % n);
            lastGamepadAction.current = now;
          } else if (buttonA) {
            const item = items[highlightedIndex];
            if (item) {
              onSelect(item);
              lastGamepadAction.current = now + 150;
            }
          }
        }
      }

      animFrameId = requestAnimationFrame(pollGamepad);
    };

    animFrameId = requestAnimationFrame(pollGamepad);
    return () => cancelAnimationFrame(animFrameId);
  }, [highlightedIndex, items, n, onSelect]);

  const currentItem = items[highlightedIndex];

  // Helper to construct donut arc paths
  const getArcPath = (index: number) => {
    const gap = 0.03; // Angular gap between segments
    const startAngle = index * anglePerItem - Math.PI / 2 + gap;
    const endAngle = (index + 1) * anglePerItem - Math.PI / 2 - gap;

    const x1 = cx + outerR * Math.cos(startAngle);
    const y1 = cy + outerR * Math.sin(startAngle);
    const x2 = cx + outerR * Math.cos(endAngle);
    const y2 = cy + outerR * Math.sin(endAngle);

    const x3 = cx + innerR * Math.cos(endAngle);
    const y3 = cy + innerR * Math.sin(endAngle);
    const x4 = cx + innerR * Math.cos(startAngle);
    const y4 = cy + innerR * Math.sin(startAngle);

    const largeArcFlag = anglePerItem > Math.PI ? 1 : 0;

    return `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${x4} ${y4} Z`;
  };

  // Icon placement at the midpoint of each segment
  const getIconPosition = (index: number) => {
    const midAngle = (index + 0.5) * anglePerItem - Math.PI / 2;
    const midR = (innerR + outerR) / 2;
    return {
      x: cx + midR * Math.cos(midAngle),
      y: cy + midR * Math.sin(midAngle)
    };
  };

  return (
    <div
      ref={wheelRef}
      role="menu"
      tabIndex={0}
      aria-label="Tool Wheel Instrument"
      onKeyDown={handleKeyDown}
      className={`na-toolwheel-wrapper na-focusable ${className}`}
      style={{ outline: 'none' }}
    >
      <svg width={320} height={320} style={{ position: 'absolute', inset: 0 }}>
        {items.map((item, idx) => {
          const isHighlighted = idx === highlightedIndex;
          const isSelected = item.id === selectedId;

          return (
            <path
              key={item.id}
              d={getArcPath(idx)}
              className={`na-toolwheel-segment ${isHighlighted ? 'is-active' : ''} ${
                isSelected ? 'is-selected' : ''
              }`}
              fill={
                isHighlighted
                  ? 'var(--na-accent-muted)'
                  : isSelected
                  ? 'rgba(232, 163, 61, 0.25)'
                  : 'var(--na-surface)'
              }
              stroke={
                isHighlighted
                  ? 'var(--na-accent)'
                  : isSelected
                  ? 'var(--na-accent-hover)'
                  : 'var(--na-line)'
              }
              strokeWidth={isHighlighted ? 2 : 1}
              onClick={() => {
                setHighlightedIndex(idx);
                onSelect(item);
              }}
              onMouseEnter={() => setHighlightedIndex(idx)}
            />
          );
        })}

        {/* Segment icons & glyphs */}
        {items.map((item, idx) => {
          const pos = getIconPosition(idx);
          const isHighlighted = idx === highlightedIndex;
          return (
            <g
              key={`icon-${item.id}`}
              transform={`translate(${pos.x - 10}, ${pos.y - 10})`}
              pointerEvents="none"
              style={{
                color: isHighlighted ? 'var(--na-accent)' : 'var(--na-text)',
                transition: 'color var(--na-duration-fast) var(--na-ease-standard)'
              }}
            >
              {item.icon}
            </g>
          );
        })}
      </svg>

      {/* Central Readout Instrument */}
      <div
        className="na-toolwheel-center"
        style={{
          borderColor: currentItem?.id === selectedId ? 'var(--na-accent)' : 'var(--na-line-strong)'
        }}
      >
        <div style={{ color: 'var(--na-accent)', marginBottom: '2px' }}>
          {currentItem?.icon}
        </div>
        <div
          style={{
            fontFamily: 'var(--na-font-display)',
            fontSize: 'var(--na-text-xs)',
            fontWeight: 600,
            color: 'var(--na-text)',
            lineHeight: 1.2
          }}
        >
          {currentItem?.label}
        </div>
        <div
          style={{
            fontFamily: 'var(--na-font-mono)',
            fontSize: '0.6875rem',
            color: 'var(--na-muted)',
            marginTop: '2px',
            lineHeight: 1.2
          }}
        >
          {currentItem?.description}
        </div>
      </div>
    </div>
  );
};
