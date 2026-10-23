import React from 'react';
import { GraphNode as GraphNodeType, NodeKind } from '../types.js';
import { Button } from '../../components/Button.js';
import { Slider } from '../../components/Slider.js';
import { Toggle } from '../../components/Toggle.js';
import { NumberField } from '../../components/NumberField.js';
import { Badge } from '../../components/Badge.js';
import {
  DatasetIcon,
  CleanIcon,
  TokenIcon,
  ModelIcon,
  TrainIcon,
  EvaluateIcon
} from '../../icons/index.js';

export interface InspectorPanelProps {
  node: GraphNodeType | null;
  onUpdateNodeData: (id: string, newData: any) => void;
  onClose: () => void;
  onOpenCodex: (node: GraphNodeType) => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  node,
  onUpdateNodeData,
  onClose,
  onOpenCodex
}) => {
  if (!node) {
    return (
      <aside className="na-workbench-inspector is-collapsed" aria-label="Inspector Panel" />
    );
  }

  const data = node.data as any;

  const update = (patch: Record<string, any>) => {
    onUpdateNodeData(node.id, { ...data, ...patch });
  };

  const getNodeIcon = (kind: NodeKind) => {
    switch (kind) {
      case 'dataset': return <DatasetIcon size={18} />;
      case 'cleaner': return <CleanIcon size={18} />;
      case 'tokenizer': return <TokenIcon size={18} />;
      case 'model': return <ModelIcon size={18} />;
      case 'trainer': return <TrainIcon size={18} />;
      case 'evaluator': return <EvaluateIcon size={18} />;
    }
  };

  const renderSignalRow = (label: string, stat?: { min: number; mean: number; max: number; histogram: number[] }, unit = '') => {
    if (!stat) return null;
    const maxVal = Math.max(...stat.histogram, 1);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px', fontFamily: 'var(--na-font-mono)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--na-text)' }}>
          <span>{label}</span>
          <span style={{ color: 'var(--na-muted)' }}>
            μ={stat.mean.toFixed(2)}{unit} [{stat.min.toFixed(2)} - {stat.max.toFixed(2)}]
          </span>
        </div>
        {/* 5-bar sparkline histogram */}
        <div style={{ display: 'flex', height: '14px', gap: '2px', alignItems: 'flex-end', backgroundColor: 'var(--na-ink)', padding: '2px', borderRadius: '2px' }}>
          {stat.histogram.map((count, idx) => {
            const h = Math.max(15, Math.round((count / maxVal) * 100));
            return (
              <div
                key={idx}
                style={{
                  flex: 1,
                  height: `${h}%`,
                  backgroundColor: '#4FB3A9',
                  borderRadius: '1px',
                  opacity: 0.7 + (idx * 0.06)
                }}
                title={`Bin ${idx + 1}: ${count}`}
              />
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <aside className="na-workbench-inspector" aria-label="Inspector Panel">
      {/* Inspector Header */}
      <div className="na-panel__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: 'var(--na-accent)' }}>{getNodeIcon(node.kind)}</span>
          <span className="na-panel__title">{node.title} Inspector</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenCodex(node)}
            title="Read documentation"
          >
            ?
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close inspector">
            ✕
          </Button>
        </div>
      </div>

      {/* Inspector Body Content */}
      <div className="na-inspector-content" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 120px)', padding: '12px' }}>
        {/* Status and Type Badges */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '14px' }}>
          <Badge variant="neutral">ID: {node.id}</Badge>
          <Badge variant={node.state === 'ready' ? 'accent-cool' : node.state === 'running' ? 'accent' : node.state === 'error' ? 'danger' : 'warning'} dot>
            {node.state.toUpperCase()}
          </Badge>
          {node.state === 'stale' && <Badge variant="warning">STALE</Badge>}
        </div>

        {/* 1. DATASET INSPECTOR */}
        {node.kind === 'dataset' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ backgroundColor: 'var(--na-raised)', padding: '10px', borderRadius: '4px', border: '1px solid var(--na-line)' }}>
              <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginBottom: '6px' }}>
                VAULT KEPT SHARDS
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontFamily: 'var(--na-font-mono)' }}>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--na-muted)' }}>Kept Shards</div>
                  <div style={{ fontSize: 'var(--na-text-base)', color: 'var(--na-accent)', fontWeight: 600 }}>
                    {data.shardCount ?? data.sampleCount ?? 0}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--na-muted)' }}>Token Count</div>
                  <div style={{ fontSize: 'var(--na-text-base)', color: '#4FB3A9', fontWeight: 600 }}>
                    {(data.tokenCount ?? 0).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '10px', color: 'var(--na-muted)', marginBottom: '4px' }}>DATASET FINGERPRINT</div>
              <div
                style={{
                  backgroundColor: 'var(--na-ink)',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: '1px solid var(--na-line)',
                  fontFamily: 'var(--na-font-mono)',
                  fontSize: '11px',
                  color: 'var(--na-accent-cool)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
                title={data.datasetFingerprint}
              >
                {data.datasetFingerprint || 'sha256:calculating...'}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--na-raised)', padding: '10px', borderRadius: '4px', border: '1px solid var(--na-line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', color: 'var(--na-muted)' }}>Duplicate Estimate (3-gram hash):</span>
                <span style={{ fontFamily: 'var(--na-font-mono)', fontSize: '12px', fontWeight: 600, color: (data.duplicateEstimate ?? 0) > 0.15 ? 'var(--na-warning)' : 'var(--na-text)' }}>
                  {(((data.duplicateEstimate ?? data.duplicateRate ?? 0)) * 100).toFixed(1)}%
                </span>
              </div>
              <div style={{ height: '4px', backgroundColor: 'var(--na-line)', borderRadius: '2px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, (data.duplicateEstimate ?? 0) * 100)}%`,
                    backgroundColor: (data.duplicateEstimate ?? 0) > 0.15 ? '#f59e0b' : '#4FB3A9'
                  }}
                />
              </div>
            </div>

            {/* Lens Signal Histograms */}
            <div>
              <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginBottom: '8px' }}>
                LENS SIGNAL HISTOGRAMS (MEASURED SIGNALS)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {data.signalDistribution?.dictionaryHitRate && renderSignalRow('Dictionary Hit Rate', data.signalDistribution.dictionaryHitRate)}
                {data.signalDistribution?.nonAlphaRatio && renderSignalRow('Non-Alpha Ratio', data.signalDistribution.nonAlphaRatio)}
                {data.signalDistribution?.uppercaseRatio && renderSignalRow('Uppercase Ratio', data.signalDistribution.uppercaseRatio)}
                {data.signalDistribution?.meanWordLength && renderSignalRow('Mean Word Length', data.signalDistribution.meanWordLength, ' chars')}
                {data.signalDistribution?.repetitionRatio && renderSignalRow('Repetition Ratio', data.signalDistribution.repetitionRatio)}
                {data.signalDistribution?.whitespaceRatio && renderSignalRow('Whitespace Ratio', data.signalDistribution.whitespaceRatio)}
              </div>
            </div>
          </div>
        )}

        {/* 2. CLEANER INSPECTOR */}
        {node.kind === 'cleaner' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ backgroundColor: 'var(--na-raised)', padding: '10px', borderRadius: '4px', border: '1px solid var(--na-line)' }}>
              <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginBottom: '4px' }}>
                CLEANER RETENTION IMPACT
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--na-font-mono)', fontSize: '13px' }}>
                <span>Before: <strong>{data.beforeCount ?? 0}</strong></span>
                <span>After: <strong style={{ color: 'var(--na-accent-cool)' }}>{data.afterCount ?? 0}</strong></span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--na-muted)', marginTop: '4px' }}>
                Removed: {Math.max(0, (data.beforeCount ?? 0) - (data.afterCount ?? 0))} shards ({data.beforeCount ? (((data.beforeCount - data.afterCount) / data.beforeCount) * 100).toFixed(1) : 0}%)
              </div>
              <div style={{ fontSize: '10px', color: '#f59e0b', marginTop: '6px', fontStyle: 'italic', lineHeight: 1.3 }}>
                Note: Filters act on measured signals; some bad shards survive and some clean shards are removed as intended.
              </div>
            </div>

            {/* Threshold Sliders */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Slider
                label="Near-Dedupe Shingle Threshold"
                value={Math.round((data.nearDedupeThreshold ?? 0.20) * 100)}
                min={5}
                max={60}
                unit="%"
                onChange={(val) => update({ nearDedupeThreshold: val / 100 })}
              />

              <Slider
                label="Min Dictionary Hit Rate"
                value={Math.round((data.minDictionaryHitRate ?? 0.60) * 100)}
                min={0}
                max={95}
                unit="%"
                onChange={(val) => update({ minDictionaryHitRate: val / 100 })}
              />

              <Slider
                label="Max Non-Alpha Ratio"
                value={Math.round((data.maxNonAlphaRatio ?? 0.25) * 100)}
                min={5}
                max={60}
                unit="%"
                onChange={(val) => update({ maxNonAlphaRatio: val / 100 })}
              />

              <Slider
                label="Max Uppercase Ratio"
                value={Math.round((data.maxUppercaseRatio ?? 0.20) * 100)}
                min={5}
                max={60}
                unit="%"
                onChange={(val) => update({ maxUppercaseRatio: val / 100 })}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--na-muted)', marginBottom: '3px' }}>Min Chars</div>
                  <NumberField
                    value={data.minTextLength ?? 400}
                    min={100}
                    max={2000}
                    step={100}
                    onChange={(val) => update({ minTextLength: val })}
                  />
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--na-muted)', marginBottom: '3px' }}>Max Chars</div>
                  <NumberField
                    value={data.maxTextLength ?? 4500}
                    min={1000}
                    max={10000}
                    step={500}
                    onChange={(val) => update({ maxTextLength: val })}
                  />
                </div>
              </div>
            </div>

            {/* Before / After Signal Comparison */}
            {data.afterSignals && (
              <div>
                <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginBottom: '6px' }}>
                  POST-CLEANING SIGNAL HISTOGRAMS
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {data.afterSignals.dictionaryHitRate && renderSignalRow('Cleaned Dict Hit Rate', data.afterSignals.dictionaryHitRate)}
                  {data.afterSignals.nonAlphaRatio && renderSignalRow('Cleaned Non-Alpha Ratio', data.afterSignals.nonAlphaRatio)}
                  {data.afterSignals.uppercaseRatio && renderSignalRow('Cleaned Uppercase Ratio', data.afterSignals.uppercaseRatio)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. TOKENIZER INSPECTOR */}
        {node.kind === 'tokenizer' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Slider
              label="BPE Vocabulary Size"
              value={data.vocabSize || 1024}
              min={256}
              max={2048}
              step={128}
              unit=" tokens"
              onChange={(val) => update({ vocabSize: val, isTrained: false })}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ backgroundColor: 'var(--na-raised)', padding: '8px', borderRadius: '4px', border: '1px solid var(--na-line)' }}>
                <div style={{ fontSize: '10px', color: 'var(--na-muted)' }}>Compression</div>
                <div style={{ fontSize: 'var(--na-text-sm)', fontFamily: 'var(--na-font-mono)', color: 'var(--na-accent)', fontWeight: 600 }}>
                  {data.compressionRatio ? `${data.compressionRatio.toFixed(2)} bytes/tok` : '--'}
                </div>
              </div>
              <div style={{ backgroundColor: 'var(--na-raised)', padding: '8px', borderRadius: '4px', border: '1px solid var(--na-line)' }}>
                <div style={{ fontSize: '10px', color: 'var(--na-muted)' }}>Status</div>
                <div style={{ fontSize: 'var(--na-text-sm)', fontFamily: 'var(--na-font-mono)', color: data.isTrained ? 'var(--na-success)' : 'var(--na-warning)', fontWeight: 600 }}>
                  {data.isTrained ? 'Trained' : 'Untrained'}
                </div>
              </div>
            </div>

            <Button
              variant="primary"
              onClick={() => update({ isTrained: true })}
              style={{ width: '100%', padding: '8px' }}
            >
              {data.isTrained ? '✓ Retrain ByteBPE Worker' : 'Train ByteBPE in Worker'}
            </Button>

            <div>
              <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginBottom: '6px' }}>
                LIVE TOKENIZATION PREVIEW
              </div>
              <input
                type="text"
                value={data.sampleInputText || 'Shall I compare thee to a summer day?'}
                onChange={(e) => update({ sampleInputText: e.target.value })}
                className="na-focusable"
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  backgroundColor: 'var(--na-ink)',
                  border: '1px solid var(--na-line)',
                  borderRadius: '4px',
                  color: 'var(--na-text)',
                  fontSize: 'var(--na-text-xs)',
                  fontFamily: 'var(--na-font-mono)',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Colored Token Spans */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px',
                padding: '8px',
                backgroundColor: 'var(--na-surface)',
                borderRadius: '4px',
                border: '1px solid var(--na-line)',
                minHeight: '48px'
              }}
            >
              {data.tokenSpans && data.tokenSpans.length > 0 ? (
                data.tokenSpans.map((span: { text: string; id: number; color: string }, idx: number) => (
                  <span
                    key={idx}
                    title={`Token ID: ${span.id}`}
                    style={{
                      padding: '2px 6px',
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      borderBottom: `2px solid ${span.color}`,
                      borderRadius: '2px',
                      fontFamily: 'var(--na-font-mono)',
                      fontSize: '11px',
                      color: 'var(--na-text)'
                    }}
                  >
                    {span.text}
                  </span>
                ))
              ) : (
                (data.sampleInputText || 'Shall I compare thee to a summer day')
                  .split(/(\s+|(?=[A-Z\-\.]))/)
                  .filter(Boolean)
                  .map((token: string, idx: number) => {
                    const colors = ['#4FB3A9', '#E8A33D', '#B48EE0', '#6BBF7A', '#F5B453'];
                    return (
                      <span
                        key={idx}
                        style={{
                          padding: '2px 6px',
                          backgroundColor: 'rgba(255,255,255,0.06)',
                          borderBottom: `2px solid ${colors[idx % colors.length]}`,
                          borderRadius: '2px',
                          fontFamily: 'var(--na-font-mono)',
                          fontSize: '11px'
                        }}
                      >
                        {token}
                      </span>
                    );
                  })
              )}
            </div>
          </div>
        )}

        {/* 4. MODEL INSPECTOR */}
        {node.kind === 'model' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginBottom: '6px' }}>
                ARCHITECTURE PRESET
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {(['C', 'S', 'M', 'Custom'] as const).map((p) => (
                  <Button
                    key={p}
                    variant={data.preset === p ? 'primary' : 'secondary'}
                    size="sm"
                    style={{ flex: 1 }}
                    onClick={() => {
                      if (p === 'C') {
                        update({ preset: 'C', dModel: 64, nLayers: 2, nHeads: 2, dFF: 256, contextLen: 64, paramCount: 320000, vramMb: 8 });
                      } else if (p === 'S') {
                        update({ preset: 'S', dModel: 128, nLayers: 4, nHeads: 4, dFF: 512, contextLen: 128, paramCount: 1250000, vramMb: 24 });
                      } else if (p === 'M') {
                        update({ preset: 'M', dModel: 192, nLayers: 6, nHeads: 6, dFF: 768, contextLen: 256, paramCount: 3850000, vramMb: 68 });
                      } else {
                        update({ preset: 'Custom' });
                      }
                    }}
                  >
                    {p}
                  </Button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--na-muted)', marginBottom: '3px' }}>dModel</div>
                <NumberField
                  value={data.dModel || 64}
                  min={32}
                  max={512}
                  step={32}
                  onChange={(val) => update({ dModel: val, preset: 'Custom' })}
                />
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--na-muted)', marginBottom: '3px' }}>nLayers</div>
                <NumberField
                  value={data.nLayers || 2}
                  min={1}
                  max={12}
                  step={1}
                  onChange={(val) => update({ nLayers: val, preset: 'Custom' })}
                />
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--na-muted)', marginBottom: '3px' }}>nHeads</div>
                <NumberField
                  value={data.nHeads || 2}
                  min={1}
                  max={8}
                  step={1}
                  onChange={(val) => update({ nHeads: val, preset: 'Custom' })}
                />
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--na-muted)', marginBottom: '3px' }}>contextLen</div>
                <NumberField
                  value={data.contextLen || 64}
                  min={32}
                  max={512}
                  step={32}
                  onChange={(val) => update({ contextLen: val, preset: 'Custom' })}
                />
              </div>
            </div>

            {/* Parameters & VRAM */}
            <div style={{ backgroundColor: 'var(--na-raised)', padding: '10px', borderRadius: '4px', border: '1px solid var(--na-line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>Parameter Count:</span>
                <span style={{ fontFamily: 'var(--na-font-mono)', color: 'var(--na-accent)', fontWeight: 600 }}>
                  {((data.paramCount || 320000) / 1000).toFixed(1)}k ({((data.paramCount || 320000) / 1e6).toFixed(2)}M)
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>Estimated VRAM:</span>
                <span style={{ fontFamily: 'var(--na-font-mono)' }}>
                  {data.vramMb ?? Math.round(((data.paramCount || 320000) * 8) / (1024 * 1024))} MB
                </span>
              </div>
            </div>

            {/* Tokens-per-parameter Meter */}
            <div style={{ backgroundColor: 'var(--na-raised)', padding: '10px', borderRadius: '4px', border: '1px solid var(--na-line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>Tokens per Parameter:</span>
                <span
                  style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--na-ink)',
                    color:
                      data.tokenHealthStatus === 'severely-starved' ? '#ef4444' :
                      data.tokenHealthStatus === 'data-starved' ? '#f59e0b' :
                      data.tokenHealthStatus === 'adequate' ? '#38bdf8' : '#10b981',
                    fontWeight: 600,
                    border: '1px solid currentColor'
                  }}
                >
                  {(data.tokenHealthStatus || 'comfortable').toUpperCase()}
                </span>
              </div>
              <div style={{ fontFamily: 'var(--na-font-mono)', fontSize: '13px', fontWeight: 600, color: 'var(--na-text)' }}>
                {(data.tokensPerParam ?? 12.5).toFixed(2)} tok/param
              </div>
              <div style={{ height: '4px', backgroundColor: 'var(--na-line)', borderRadius: '2px', overflow: 'hidden', marginTop: '6px' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, ((data.tokensPerParam ?? 12.5) / 20) * 100)}%`,
                    backgroundColor: (data.tokensPerParam ?? 12.5) < 2 ? '#f59e0b' : '#10b981'
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* 5. TRAINER INSPECTOR */}
        {node.kind === 'trainer' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Slider
              label="Learning Rate (x 10⁻⁴)"
              value={Math.round((data.learningRate || 0.0003) * 10000)}
              min={1}
              max={30}
              unit=" lr"
              onChange={(val) => update({ learningRate: val / 10000 })}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--na-muted)', marginBottom: '3px' }}>Batch Size</div>
                <NumberField
                  value={data.batchSize || 16}
                  min={4}
                  max={64}
                  step={4}
                  onChange={(val) => update({ batchSize: val })}
                />
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--na-muted)', marginBottom: '3px' }}>Max Steps</div>
                <NumberField
                  value={data.maxSteps || 500}
                  min={50}
                  max={2000}
                  step={50}
                  onChange={(val) => update({ maxSteps: val })}
                />
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--na-muted)', marginBottom: '3px' }}>Warmup Steps</div>
                <NumberField
                  value={data.warmupSteps || 50}
                  min={0}
                  max={200}
                  step={10}
                  onChange={(val) => update({ warmupSteps: val })}
                />
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--na-muted)', marginBottom: '3px' }}>Weight Decay</div>
                <NumberField
                  value={data.weightDecay || 0.01}
                  min={0}
                  max={0.2}
                  step={0.01}
                  onChange={(val) => update({ weightDecay: val })}
                />
              </div>
            </div>

            {/* Throttle Slider */}
            <Slider
              label="GPU Throttle Delay"
              value={data.throttleMs ?? 0}
              min={0}
              max={200}
              step={10}
              unit=" ms"
              onChange={(val) => update({ throttleMs: val })}
            />

            {/* Resumption */}
            <Toggle
              label="Resume From Checkpoint"
              checked={data.resumeFromCheckpoint ?? false}
              onChange={(val) => update({ resumeFromCheckpoint: val })}
            />

            {/* Live Progress Card */}
            <div style={{ backgroundColor: 'var(--na-raised)', padding: '10px', borderRadius: '4px', border: '1px solid var(--na-line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>Progress:</span>
                <span style={{ fontFamily: 'var(--na-font-mono)' }}>{data.currentStep || 0} / {data.maxSteps || 500}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>ETA Remaining:</span>
                <span style={{ fontFamily: 'var(--na-font-mono)', color: 'var(--na-accent)' }}>{data.etaSeconds || 0}s</span>
              </div>
            </div>
          </div>
        )}

        {/* 6. EVALUATOR INSPECTOR */}
        {node.kind === 'evaluator' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ backgroundColor: 'var(--na-raised)', padding: '10px', borderRadius: '4px', border: '1px solid var(--na-line)' }}>
                <div style={{ fontSize: '10px', color: 'var(--na-muted)' }}>Fixed Val Loss</div>
                <div style={{ fontSize: 'var(--na-text-base)', fontFamily: 'var(--na-font-mono)', color: 'var(--na-accent-cool)', fontWeight: 600 }}>
                  {data.valLoss ? data.valLoss.toFixed(3) : '--'}
                </div>
              </div>
              <div style={{ backgroundColor: 'var(--na-raised)', padding: '10px', borderRadius: '4px', border: '1px solid var(--na-line)' }}>
                <div style={{ fontSize: '10px', color: 'var(--na-muted)' }}>Fixed Perplexity</div>
                <div style={{ fontSize: 'var(--na-text-base)', fontFamily: 'var(--na-font-mono)', color: 'var(--na-success)', fontWeight: 600 }}>
                  {data.perplexity ? data.perplexity.toFixed(2) : '--'}
                </div>
              </div>
            </div>

            {/* Memorization Probe Rate */}
            <div style={{ backgroundColor: 'var(--na-raised)', padding: '10px', borderRadius: '4px', border: '1px solid var(--na-line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--na-muted)' }}>Memorization Probe Rate:</span>
                <span style={{ fontFamily: 'var(--na-font-mono)', fontSize: '12px', fontWeight: 600, color: (data.memorizationProbeRate ?? 0) > 0.4 ? 'var(--na-warning)' : 'var(--na-text)' }}>
                  {(((data.memorizationProbeRate ?? 0.05)) * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Streaming Prompt Generation */}
            <div>
              <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginBottom: '6px' }}>
                STREAMING TEXT GENERATION
              </div>
              <input
                type="text"
                value={data.testPrompt || 'To be, or not to be'}
                onChange={(e) => update({ testPrompt: e.target.value })}
                className="na-focusable"
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  backgroundColor: 'var(--na-ink)',
                  border: '1px solid var(--na-line)',
                  borderRadius: '4px',
                  color: 'var(--na-text)',
                  fontSize: 'var(--na-text-xs)',
                  fontFamily: 'var(--na-font-mono)',
                  boxSizing: 'border-box',
                  marginBottom: '8px'
                }}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontSize: '9px', color: 'var(--na-muted)' }}>Temp</div>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="2.0"
                    value={data.generationParams?.temperature ?? 0.8}
                    onChange={(e) => update({ generationParams: { ...data.generationParams, temperature: parseFloat(e.target.value) } })}
                    style={{ width: '100%', padding: '3px', backgroundColor: 'var(--na-ink)', border: '1px solid var(--na-line)', color: 'var(--na-text)', fontSize: '11px' }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: '9px', color: 'var(--na-muted)' }}>Top-K</div>
                  <input
                    type="number"
                    step="5"
                    min="1"
                    max="100"
                    value={data.generationParams?.topK ?? 40}
                    onChange={(e) => update({ generationParams: { ...data.generationParams, topK: parseInt(e.target.value, 10) } })}
                    style={{ width: '100%', padding: '3px', backgroundColor: 'var(--na-ink)', border: '1px solid var(--na-line)', color: 'var(--na-text)', fontSize: '11px' }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: '9px', color: 'var(--na-muted)' }}>Top-P</div>
                  <input
                    type="number"
                    step="0.05"
                    min="0.1"
                    max="1.0"
                    value={data.generationParams?.topP ?? 0.9}
                    onChange={(e) => update({ generationParams: { ...data.generationParams, topP: parseFloat(e.target.value) } })}
                    style={{ width: '100%', padding: '3px', backgroundColor: 'var(--na-ink)', border: '1px solid var(--na-line)', color: 'var(--na-text)', fontSize: '11px' }}
                  />
                </div>
              </div>

              {data.generatedOutput && (
                <div
                  style={{
                    backgroundColor: 'var(--na-ink)',
                    padding: '8px 10px',
                    borderRadius: '4px',
                    border: '1px solid var(--na-line)',
                    fontFamily: 'var(--na-font-mono)',
                    fontSize: '11px',
                    color: 'var(--na-text)',
                    lineHeight: 1.4,
                    minHeight: '40px'
                  }}
                >
                  {data.generatedOutput}
                </div>
              )}
            </div>

            {/* Per-token Loss Heatmap */}
            <div>
              <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginBottom: '6px' }}>
                PER-TOKEN LOSS HEATMAP
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '3px',
                  padding: '8px',
                  backgroundColor: 'var(--na-ink)',
                  borderRadius: '4px',
                  border: '1px solid var(--na-line)'
                }}
              >
                {data.perTokenLoss && data.perTokenLoss.length > 0 ? (
                  data.perTokenLoss.map((pt: { token: string; loss: number }, idx: number) => {
                    const normLoss = Math.min(1, Math.max(0, (pt.loss - 1.0) / 4.0));
                    const r = Math.round(normLoss * 220);
                    const g = Math.round((1 - normLoss) * 180);
                    return (
                      <span
                        key={idx}
                        title={`Loss: ${pt.loss.toFixed(3)}`}
                        style={{
                          padding: '2px 5px',
                          borderRadius: '3px',
                          backgroundColor: `rgba(${r}, ${g}, 70, 0.35)`,
                          border: `1px solid rgba(${r}, ${g}, 70, 0.7)`,
                          fontFamily: 'var(--na-font-mono)',
                          fontSize: '11px',
                          color: '#fff'
                        }}
                      >
                        {pt.token}
                      </span>
                    );
                  })
                ) : (
                  <div style={{ color: 'var(--na-muted)', fontSize: '11px' }}>
                    Train the model to inspect per-token cross-entropy loss heatmaps.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
