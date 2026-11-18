import React, { useRef } from 'react';

export interface TabItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
  children?: React.ReactNode;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeId,
  onChange,
  className = '',
  children
}) => {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let targetIndex = -1;
    if (e.key === 'ArrowRight') {
      targetIndex = (index + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      targetIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      targetIndex = 0;
    } else if (e.key === 'End') {
      targetIndex = tabs.length - 1;
    }

    if (targetIndex >= 0) {
      e.preventDefault();
      const targetTab = tabs[targetIndex];
      if (targetTab) {
        onChange(targetTab.id);
        tabRefs.current[targetIndex]?.focus();
      }
    }
  };

  return (
    <div className={className}>
      <div role="tablist" className="na-tabs-list">
        {tabs.map((tab, idx) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              ref={(el) => { tabRefs.current[idx] = el; }}
              role="tab"
              type="button"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className="na-tab na-focusable"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
      {children && <div className="na-tab-panel">{children}</div>}
    </div>
  );
};
