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
              <span style={{ color: 'var(--na-muted)' }}>Shards:</span>
              <span style={{ fontFamily: 'var(--na-font-mono)' }}>{data.shardCount ?? data.sampleCount ?? 0}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--na-muted)' }}>Tokens:</span>
              <span style={{ fontFamily: 'var(--na-font-mono)' }}>{(data.tokenCount ?? 0).toLocaleString()}</span>
            </div>
            {data.datasetFingerprint && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                <span style={{ color: 'var(--na-muted)' }}>Fingerprint:</span>
                <span style={{ fontFamily: 'var(--na-font-mono)', color: 'var(--na-accent-cool)' }}>{data.datasetFingerprint.slice(0, 8)}</span>
              </div>
            )}
            {/* Signal mini sparkline */}
            {data.signalDistribution?.dictionaryHitRate && (
              <div style={{ height: '4px', display: 'flex', borderRadius: '2px', overflow: 'hidden', marginTop: '2px', backgroundColor: 'var(--na-ink)' }}>
                <div style={{ width: `${Math.min(100, (data.signalDistribution.dictionaryHitRate.mean ?? 0.8) * 100)}%`, backgroundColor: '#4FB3A9' }} title="Dictionary Hit Rate" />
              </div>
            )}
          </div>
        );

      case 'cleaner':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--na-muted)' }}>Kept:</span>
              <span style={{ fontFamily: 'var(--na-font-mono)' }}>
                {data.afterCount ?? 0} / {data.beforeCount ?? 0}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--na-muted)' }}>Filtered:</span>
              <span style={{ color: (data.beforeCount - data.afterCount) > 0 ? 'var(--na-warning)' : 'var(--na-muted)', fontFamily: 'var(--na-font-mono)' }}>
                {Math.max(0, (data.beforeCount ?? 0) - (data.afterCount ?? 0))} ({data.beforeCount ? (((data.beforeCount - data.afterCount) / data.beforeCount) * 100).toFixed(0) : 0}%)
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
              <span style={{ color: 'var(--na-muted)' }}>Compression:</span>
              <span style={{ fontFamily: 'var(--na-font-mono)', color: 'var(--na-accent)' }}>
                {data.compressionRatio ? `${data.compressionRatio.toFixed(2)}x` : '--'}
              </span>
            </div>
          </div>
        );

      case 'model': {
        const tokens = data.totalTokens || 350000;
        const predVal = data.predictedValLoss ?? 3.12;
        const chip = data.starvationChip || (tokens < 100000 ? 'severely-starved' : tokens < 400000 ? 'data-starved' : 'comfortable');
        const chipColor = chip === 'starved' || chip === 'severely-starved' ? '#ef4444' : chip === 'workable' || chip === 'data-starved' ? '#f59e0b' : '#10b981';
        const advice = data.scalingAdvice || (tokens < 400000 ? 'more data helps a lot here' : 'more steps help more than more data');
        const baseline = data.baselineComparison || (predVal < 2.834 ? 'Beats Trigram (2.834)' : predVal < 3.286 ? 'Beats Bigram (3.286)' : 'Above Bigram');

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--na-muted)' }}>Preset:</span>
              <span style={{ fontFamily: 'var(--na-font-mono)' }}>
                {data.preset} ({(data.paramCount / 1000).toFixed(0)}k)
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--na-muted)' }}>Tokens:</span>
              <span style={{ fontFamily: 'var(--na-font-mono)', fontWeight: 600 }}>
                {tokens >= 1000000 ? `${(tokens / 1000000).toFixed(2)}M` : `${Math.round(tokens / 1000)}k`}
                <span style={{ fontSize: '9px', color: 'var(--na-muted)', marginLeft: '4px' }}>
                  ({data.tokensPerParam.toFixed(1)} t/p)
                </span>
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--na-muted)' }}>Pred Val:</span>
              <span style={{ fontFamily: 'var(--na-font-mono)', color: 'var(--na-accent)', fontWeight: 600 }}>
                {predVal.toFixed(3)}
              </span>
            </div>
            <div style={{ fontSize: '9px', color: chipColor, fontWeight: 600, marginTop: '2px' }}>
              ● {baseline}
            </div>
            <div style={{ fontSize: '8.5px', color: 'var(--na-muted)', fontStyle: 'italic', marginTop: '1px' }}>
              "{advice}"
            </div>
          </div>
        );
      }

      case 'trainer':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--na-muted)' }}>Step:</span>
              <span style={{ fontFamily: 'var(--na-font-mono)' }}>
                {data.currentStep ?? 0} / {data.maxSteps ?? 500}
              </span>
            </div>
            <div style={{ height: '4px', background: 'var(--na-line)', borderRadius: '2px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, ((data.currentStep ?? 0) / (data.maxSteps || 1)) * 100)}%`,
                  backgroundColor: 'var(--na-accent)',
                  transition: 'width 0.1s linear'
                }}
              />
            </div>
            {data.etaSeconds !== undefined && data.etaSeconds > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                <span style={{ color: 'var(--na-muted)' }}>ETA:</span>
                <span style={{ fontFamily: 'var(--na-font-mono)' }}>{data.etaSeconds}s</span>
              </div>
            )}
          </div>
        );

      case 'evaluator':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--na-muted)' }}>Val Loss:</span>
              <span style={{ fontFamily: 'var(--na-font-mono)', color: 'var(--na-accent-cool)' }}>
                {data.valLoss ? data.valLoss.toFixed(3) : '--'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--na-muted)' }}>Perplexity:</span>
              <span style={{ fontFamily: 'var(--na-font-mono)', color: 'var(--na-success)' }}>
                {data.perplexity ? data.perplexity.toFixed(2) : '--'}
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
