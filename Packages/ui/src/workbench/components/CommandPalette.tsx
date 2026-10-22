import React, { useState, useEffect, useRef } from 'react';
import { NodeKind } from '../types.js';
import {
  DatasetIcon,
  CleanIcon,
  TokenIcon,
  ModelIcon,
  TrainIcon,
  EvaluateIcon
} from '../../icons/index.js';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onAddNode: (kind: NodeKind) => void;
}

interface PaletteItem {
  kind: NodeKind;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const PALETTE_ITEMS: PaletteItem[] = [
  {
    kind: 'dataset',
    title: 'Dataset Source',
    description: 'Ingest raw corpora shards and inspect quality distribution',
    icon: <DatasetIcon size={20} />
  },
  {
    kind: 'cleaner',
    title: 'Data Cleaner',
    description: 'Filter noise, deduplicate samples, and enforce text guardrails',
    icon: <CleanIcon size={20} />
  },
  {
    kind: 'tokenizer',
    title: 'BPE Tokenizer',
    description: 'Train subword vocabulary and partition text into discrete tokens',
    icon: <TokenIcon size={20} />
  },
  {
    kind: 'model',
    title: 'Tiny GPT Model',
    description: 'Configure transformer blocks, multi-head attention, and parameters',
    icon: <ModelIcon size={20} />
  },
  {
    kind: 'trainer',
    title: 'AdamW Trainer',
    description: 'Execute backpropagation, learning rate schedules, and step updates',
    icon: <TrainIcon size={20} />
  },
  {
    kind: 'evaluator',
    title: 'Loss Evaluator',
    description: 'Calculate validation loss, perplexity, and autoregressive completions',
    icon: <EvaluateIcon size={20} />
  }
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onAddNode
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = PALETTE_ITEMS.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.description.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filtered[selectedIndex];
      if (item) {
        onAddNode(item.kind);
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="na-command-palette-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="na-command-palette" role="dialog" aria-label="Command Palette">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search and insert node... (e.g. Dataset, Tokenizer, Model)"
          className="na-command-palette-input"
        />

        <div style={{ maxHeight: '280px', overflowY: 'auto', padding: '6px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--na-muted)', fontSize: 'var(--na-text-sm)' }}>
              No matching node found.
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.kind}
                  onClick={() => {
                    onAddNode(item.kind);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'var(--na-surface)' : 'transparent',
                    borderLeft: isSelected ? '3px solid var(--na-accent)' : '3px solid transparent'
                  }}
                >
                  <div style={{ color: 'var(--na-accent)' }}>{item.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 'var(--na-text-sm)', fontWeight: 600, color: 'var(--na-text)' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>
                      {item.description}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
