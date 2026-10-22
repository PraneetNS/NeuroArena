import React, { useRef } from 'react';
import { GraphNode as GraphNodeType, PortDefinition } from '../types.js';
import { Badge } from '../../components/Badge.js';
import {
  DatasetIcon,
  TokenIcon,
  ModelIcon,
  TrainIcon,
  EvaluateIcon,
  CleanIcon
} from '../../icons/index.js';

export interface GraphNodeProps {
  node: GraphNodeType;
  isSelected: boolean;
  zoom: number;
  onSelect: (e: React.MouseEvent, id: string) => void;
  onMove: (id: string, dx: number, dy: number) => void;
  onPortMouseDown: (e: React.MouseEvent, nodeId: string, port: PortDefinition) => void;
  onPortMouseUp: (nodeId: string, port: PortDefinition) => void;
  onOpenCodex: (node: GraphNodeType) => void;
}

export const GraphNode: React.FC<GraphNodeProps> = ({
  node,
  isSelected,
  zoom,
  onSelect,
  onMove,
  onPortMouseDown,
  onPortMouseUp,
  onOpenCodex
}) => {
  const isDragging = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });

  const getNodeIcon = () => {
    switch (node.kind) {
      case 'dataset':
        return <DatasetIcon size={16} />;
      case 'cleaner':
        return <CleanIcon size={16} />;
      case 'tokenizer':
        return <TokenIcon size={16} />;
      case 'model':
        return <ModelIcon size={16} />;
      case 'trainer':
        return <TrainIcon size={16} />;
      case 'evaluator':
        return <EvaluateIcon size={16} />;
    }
  };

  const getStateBadgeVariant = () => {
    switch (node.state) {
      case 'ready':
        return 'accent-cool';
      case 'running':
        return 'accent';
      case 'error':
        return 'danger';
      case 'stale':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(e, node.id);
    isDragging.current = true;
    dragStartPos.current = { x: e.clientX, y: e.clientY };

    const handleMouseMove = (moveEvt: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = (moveEvt.clientX - dragStartPos.current.x) / zoom;
      const dy = (moveEvt.clientY - dragStartPos.current.y) / zoom;
      dragStartPos.current = { x: moveEvt.clientX, y: moveEvt.clientY };
      onMove(node.id, dx, dy);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 20 : 5;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      onMove(node.id, step, 0);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onMove(node.id, -step, 0);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onMove(node.id, 0, step);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onMove(node.id, 0, -step);
    }
  };

  // Render Compact Face Summary based on kind
  const renderCompactSummary = () => {
    const data = node.data as any;
    switch (node.kind) {
      case 'dataset':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--na-muted)' }}>Samples:</span>
              <span style={{ fontFamily: 'var(--na-font-mono)' }}>{data.sampleCount?.toLocaleString()}</span>
            </div>
            {/* Mini quality histogram bar */}
            <div style={{ height: '4px', display: 'flex', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ flex: data.quality?.clean || 80, backgroundColor: 'var(--na-quality-clean)' }} />
              <div style={{ flex: data.quality?.noisy || 10, backgroundColor: 'var(--na-quality-noisy)' }} />
              <div style={{ flex: data.quality?.duplicate || 5, backgroundColor: 'var(--na-quality-duplicate)' }} />
              <div style={{ flex: data.quality?.contaminated || 5, backgroundColor: 'var(--na-quality-contaminated)' }} />
            </div>
          </div>
        );

      case 'cleaner':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--na-muted)' }}>Deduplication:</span>
              <span style={{ color: data.dedupeEnabled ? 'var(--na-success)' : 'var(--na-muted)' }}>
                {data.dedupeEnabled ? 'ACTIVE' : 'OFF'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--na-muted)' }}>Kept:</span>
              <span style={{ fontFamily: 'var(--na-font-mono)' }}>
                {data.afterCount} / {data.beforeCount}
              </span>
            </div>
          </div>
        );

      case 'tokenizer':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--na-muted)' }}>Vocab Size:</span>
              <span style={{ fontFamily: 'var(--na-font-mono)' }}>{data.vocabSize} tokens</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--na-muted)' }}>Status:</span>
              <span style={{ color: data.isTrained ? 'var(--na-success)' : 'var(--na-warning)' }}>
                {data.isTrained ? 'Trained' : 'Untrained'}
              </span>
            </div>
          </div>
        );

      case 'model':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--na-muted)' }}>Architecture:</span>
              <span style={{ fontFamily: 'var(--na-font-mono)' }}>
                {data.preset} ({data.dModel}d / {data.nLayers}L / {data.nHeads}H)
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--na-muted)' }}>Parameters:</span>
              <span style={{ fontFamily: 'var(--na-font-mono)', color: 'var(--na-accent)' }}>
                {(data.paramCount / 1000).toFixed(1)}k params
              </span>
            </div>
          </div>
        );

      case 'trainer':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--na-muted)' }}>Progress:</span>
              <span style={{ fontFamily: 'var(--na-font-mono)' }}>
                {data.currentStep} / {data.maxSteps}
              </span>
            </div>
            <div style={{ height: '4px', background: 'var(--na-line)', borderRadius: '2px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, (data.currentStep / (data.maxSteps || 1)) * 100)}%`,
                  backgroundColor: 'var(--na-accent)',
                  transition: 'width 0.1s linear'
                }}
              />
            </div>
          </div>
        );

      case 'evaluator':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--na-muted)' }}>Validation Loss:</span>
              <span style={{ fontFamily: 'var(--na-font-mono)', color: 'var(--na-accent-cool)' }}>
                {data.valLoss?.toFixed(3) || '--'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--na-muted)' }}>Perplexity:</span>
              <span style={{ fontFamily: 'var(--na-font-mono)' }}>
                {data.perplexity?.toFixed(1) || '--'}
              </span>
            </div>
          </div>
        );
    }
  };

  return (
    <div
      tabIndex={0}
      role="group"
      aria-label={`${node.title} Node`}
      onKeyDown={handleKeyDown}
      onClick={(e) => onSelect(e, node.id)}
      className={`na-graph-node na-focusable ${isSelected ? 'is-selected' : ''}`}
      style={{
        left: `${node.x}px`,
        top: `${node.y}px`,
        width: `${node.width}px`
      }}
    >
      {/* Node Header */}
      <div className="na-graph-node-header" onMouseDown={handleHeaderMouseDown}>
        <div className="na-graph-node-title">
          <span style={{ color: 'var(--na-accent)' }}>{getNodeIcon()}</span>
          <span>{node.title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Badge variant={getStateBadgeVariant()} dot>
            {node.state}
          </Badge>
          <button
            type="button"
            className="na-button na-button--ghost na-button--sm na-button--icon-only"
            title="Read Codex entry for this component"
            style={{ width: '18px', height: '18px', padding: 0, fontSize: '11px', color: 'var(--na-muted)' }}
            onClick={(e) => {
              e.stopPropagation();
              onOpenCodex(node);
            }}
          >
            ?
          </button>
        </div>
      </div>

      {/* Node Compact Body */}
      <div className="na-graph-node-body">{renderCompactSummary()}</div>

      {/* Ports Area */}
      <div className="na-graph-node-ports">
        {/* Left Inputs */}
        <div className="na-port-column">
          {node.inputs.map((port) => (
            <div key={port.id} className="na-port-row">
              <div
                id={`port-${node.id}-${port.id}`}
                className={`na-port-dot na-port-type-${port.type}`}
                title={`Input: ${port.name} (${port.type})`}
                onMouseUp={(e) => {
                  e.stopPropagation();
                  onPortMouseUp(node.id, port);
                }}
              />
              <span>{port.name}</span>
            </div>
          ))}
        </div>

        {/* Right Outputs */}
        <div className="na-port-column" style={{ alignItems: 'flex-end' }}>
          {node.outputs.map((port) => (
            <div key={port.id} className="na-port-row" style={{ flexDirection: 'row-reverse' }}>
              <div
                id={`port-${node.id}-${port.id}`}
                className={`na-port-dot na-port-type-${port.type}`}
                title={`Output: ${port.name} (${port.type}) - Drag to connect`}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onPortMouseDown(e, node.id, port);
                }}
              />
              <span>{port.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actionable Error Banner if in Error State */}
      {node.state === 'error' && node.errorMessage && (
        <div className="na-node-error-banner">
          ⚠️ {node.errorMessage}
        </div>
      )}
    </div>
  );
};
