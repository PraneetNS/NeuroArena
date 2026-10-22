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
      <div className="na-inspector-content">
        {/* Status and Type Badges */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Badge variant="neutral">Node ID: {node.id}</Badge>
          <Badge variant={node.state === 'ready' ? 'accent-cool' : node.state === 'running' ? 'accent' : 'neutral'} dot>
            {node.state.toUpperCase()}
          </Badge>
        </div>

        {/* 1. Dataset Inspector */}
        {node.kind === 'dataset' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginBottom: '6px' }}>
                SOURCE CORPUS
              </div>
              <input
                type="text"
                value={data.sourceName || 'NeuroArena Dialogue & World Lore'}
                onChange={(e) => update({ sourceName: e.target.value })}
                className="na-focusable"
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  backgroundColor: 'var(--na-ink)',
                  border: '1px solid var(--na-line)',
                  borderRadius: '4px',
                  color: 'var(--na-text)',
                  fontSize: 'var(--na-text-sm)',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <Slider
              label="Sample Count"
              value={data.sampleCount || 2450}
              min={100}
              max={10000}
              step={50}
              onChange={(val) => update({ sampleCount: val })}
            />

            <div>
              <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginBottom: '8px' }}>
                DATA QUALITY HISTOGRAM
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Badge variant="clean" dot>clean</Badge>
                  <span style={{ fontFamily: 'var(--na-font-mono)', fontSize: 'var(--na-text-xs)' }}>
                    {data.quality?.clean || 1960} ({(((data.quality?.clean || 1960) / (data.sampleCount || 2450)) * 100).toFixed(0)}%)
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Badge variant="noisy" dot>noisy</Badge>
                  <span style={{ fontFamily: 'var(--na-font-mono)', fontSize: 'var(--na-text-xs)' }}>
                    {data.quality?.noisy || 245} (10%)
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Badge variant="duplicate" dot>duplicate</Badge>
                  <span style={{ fontFamily: 'var(--na-font-mono)', fontSize: 'var(--na-text-xs)' }}>
                    {data.quality?.duplicate || 145} (6%)
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Badge variant="contaminated" dot>contaminated</Badge>
                  <span style={{ fontFamily: 'var(--na-font-mono)', fontSize: 'var(--na-text-xs)' }}>
                    {data.quality?.contaminated || 75} (3%)
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Badge variant="unknown" dot>unknown</Badge>
                  <span style={{ fontFamily: 'var(--na-font-mono)', fontSize: 'var(--na-text-xs)' }}>
                    {data.quality?.unknown || 25} (1%)
                  </span>
                </div>
              </div>
            </div>

            <Slider
              label="Duplicate Rate"
              value={Math.round((data.duplicateRate || 0.08) * 100)}
              min={0}
              max={30}
              unit="%"
              onChange={(val) => update({ duplicateRate: val / 100 })}
            />
          </div>
        )}

        {/* 2. Cleaner Inspector */}
        {node.kind === 'cleaner' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Toggle
                label="Deduplication Filter"
                checked={data.dedupeEnabled ?? true}
                onChange={(checked) => {
                  const after = checked ? Math.round(data.beforeCount * 0.88) : data.beforeCount;
                  update({ dedupeEnabled: checked, afterCount: after });
                }}
              />
              <Toggle
                label="Language Guardrails (EN only)"
                checked={true}
                onChange={() => {}}
              />
            </div>

            <Slider
              label="Min Text Length"
              value={data.minTextLength || 16}
              min={4}
              max={128}
              step={4}
              unit=" chars"
              onChange={(val) => update({ minTextLength: val })}
            />

            <Slider
              label="Noise Filter Threshold"
              value={Math.round((data.noiseFilterThreshold || 0.75) * 100)}
              min={10}
              max={100}
              unit="%"
              onChange={(val) => update({ noiseFilterThreshold: val / 100 })}
            />

            <div
              style={{
                backgroundColor: 'var(--na-raised)',
                padding: '10px',
                borderRadius: '4px',
                border: '1px solid var(--na-line)'
              }}
            >
              <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginBottom: '4px' }}>
                CURATION FILTER IMPACT
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--na-text-sm)' }}>
                <span>Before: <strong>{data.beforeCount || 2450}</strong></span>
                <span>After: <strong style={{ color: 'var(--na-accent-cool)' }}>{data.afterCount || 2156}</strong></span>
              </div>
              <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-success)', marginTop: '4px' }}>
                ✓ {((1 - (data.afterCount || 2156) / (data.beforeCount || 2450)) * 100).toFixed(1)}% noise removed
              </div>
            </div>
          </div>
        )}

        {/* 3. Tokenizer Inspector */}
        {node.kind === 'tokenizer' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Slider
              label="Vocabulary Size"
              value={data.vocabSize || 1024}
              min={256}
              max={4096}
              step={256}
              unit=" tokens"
              onChange={(val) => update({ vocabSize: val })}
            />

            <Button
              variant="primary"
              onClick={() => {
                update({ isTrained: true });
              }}
            >
              {data.isTrained ? '✓ Retrain Vocab' : 'Train Vocab (BPE)'}
            </Button>

            <div>
              <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginBottom: '6px' }}>
                LIVE TOKENIZATION PREVIEW
              </div>
              <input
                type="text"
                value={data.sampleInputText || 'Self-attention calculates token affinity across high dimensions.'}
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

            {/* Subword token spans with color coding */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px',
                padding: '8px',
                backgroundColor: 'var(--na-surface)',
                borderRadius: '4px',
                border: '1px solid var(--na-line)'
              }}
            >
              {(data.sampleInputText || 'Self-attention calculates token affinity')
                .split(/(\s+|(?=[A-Z\-\.]))/)
                .filter(Boolean)
                .map((token: string, idx: number) => {
                  const colors = ['#4FB3A9', '#E8A33D', '#B48EE0', '#6BBF7A', '#F5B453'];
                  const c = colors[idx % colors.length];
                  return (
                    <span
                      key={idx}
                      style={{
                        padding: '2px 6px',
                        backgroundColor: 'rgba(255,255,255,0.06)',
                        borderBottom: `2px solid ${c}`,
                        borderRadius: '2px',
                        fontFamily: 'var(--na-font-mono)',
                        fontSize: '11px'
                      }}
                    >
                      {token}
                    </span>
                  );
                })}
            </div>
          </div>
        )}

        {/* 4. Model Inspector */}
        {node.kind === 'model' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginBottom: '6px' }}>
                ARCHITECTURE PRESET
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {(['S', 'M', 'C', 'Custom'] as const).map((p) => (
                  <Button
                    key={p}
                    variant={data.preset === p ? 'primary' : 'secondary'}
                    size="sm"
                    style={{ flex: 1 }}
                    onClick={() => {
                      if (p === 'S') {
                        update({ preset: 'S', dModel: 128, nLayers: 4, nHeads: 4, dFF: 512, contextLen: 128, paramCount: 1250000 });
                      } else if (p === 'M') {
                        update({ preset: 'M', dModel: 192, nLayers: 6, nHeads: 6, dFF: 768, contextLen: 256, paramCount: 3850000 });
                      } else if (p === 'C') {
                        update({ preset: 'C', dModel: 64, nLayers: 2, nHeads: 2, dFF: 256, contextLen: 64, paramCount: 320000 });
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginBottom: '4px' }}>
                  dModel
                </div>
                <NumberField
                  value={data.dModel || 128}
                  min={32}
                  max={512}
                  step={32}
                  onChange={(val) => update({ dModel: val, preset: 'Custom' })}
                />
              </div>

              <div>
                <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginBottom: '4px' }}>
                  nLayers
                </div>
                <NumberField
                  value={data.nLayers || 4}
                  min={1}
                  max={12}
                  step={1}
                  onChange={(val) => update({ nLayers: val, preset: 'Custom' })}
                />
              </div>

              <div>
                <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginBottom: '4px' }}>
                  nHeads
                </div>
                <NumberField
                  value={data.nHeads || 4}
                  min={1}
                  max={8}
                  step={1}
                  onChange={(val) => update({ nHeads: val, preset: 'Custom' })}
                />
              </div>

              <div>
                <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginBottom: '4px' }}>
                  contextLen
                </div>
                <NumberField
                  value={data.contextLen || 128}
                  min={32}
                  max={512}
                  step={32}
                  onChange={(val) => update({ contextLen: val, preset: 'Custom' })}
                />
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--na-raised)',
                padding: '10px',
                borderRadius: '4px',
                border: '1px solid var(--na-line)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>Parameter Count:</span>
                <span style={{ fontFamily: 'var(--na-font-mono)', color: 'var(--na-accent)', fontWeight: 600 }}>
                  {((data.paramCount || 1250000) / 1e6).toFixed(2)}M
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>Estimated Weights VRAM:</span>
                <span style={{ fontFamily: 'var(--na-font-mono)' }}>
                  {Math.round(((data.paramCount || 1250000) * 8) / (1024 * 1024))} MB
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 5. Trainer Inspector */}
        {node.kind === 'trainer' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Slider
              label="Learning Rate (x 10⁻⁴)"
              value={Math.round((data.learningRate || 0.0003) * 10000)}
              min={1}
              max={20}
              unit=" lr"
              onChange={(val) => update({ learningRate: val / 10000 })}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginBottom: '4px' }}>
                  Batch Size
                </div>
                <NumberField
                  value={data.batchSize || 16}
                  min={4}
                  max={64}
                  step={4}
                  onChange={(val) => update({ batchSize: val })}
                />
              </div>

              <div>
                <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginBottom: '4px' }}>
                  Max Steps
                </div>
                <NumberField
                  value={data.maxSteps || 500}
                  min={50}
                  max={2000}
                  step={50}
                  onChange={(val) => update({ maxSteps: val })}
                />
              </div>
            </div>

            <Slider
              label="Warmup Steps"
              value={data.warmupSteps || 50}
              min={0}
              max={150}
              step={10}
              onChange={(val) => update({ warmupSteps: val })}
            />

            <div
              style={{
                backgroundColor: 'var(--na-raised)',
                padding: '10px',
                borderRadius: '4px',
                border: '1px solid var(--na-line)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>Current Step:</span>
                <span style={{ fontFamily: 'var(--na-font-mono)' }}>{data.currentStep || 0} / {data.maxSteps || 500}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>ETA:</span>
                <span style={{ fontFamily: 'var(--na-font-mono)' }}>{data.etaSeconds || 0}s</span>
              </div>
            </div>
          </div>
        )}

        {/* 6. Evaluator Inspector */}
        {node.kind === 'evaluator' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ backgroundColor: 'var(--na-raised)', padding: '10px', borderRadius: '4px' }}>
                <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>Validation Loss</div>
                <div style={{ fontSize: 'var(--na-text-lg)', fontFamily: 'var(--na-font-mono)', color: 'var(--na-accent-cool)', fontWeight: 600 }}>
                  {data.valLoss ? data.valLoss.toFixed(3) : '1.842'}
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--na-raised)', padding: '10px', borderRadius: '4px' }}>
                <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>Perplexity</div>
                <div style={{ fontSize: 'var(--na-text-lg)', fontFamily: 'var(--na-font-mono)', color: 'var(--na-success)', fontWeight: 600 }}>
                  {data.perplexity ? data.perplexity.toFixed(1) : '6.31'}
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginBottom: '6px' }}>
                TEST EVALUATION PROMPT
              </div>
              <textarea
                defaultValue="The transformer calculates self-attention weights by"
                rows={3}
                className="na-focusable"
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: 'var(--na-ink)',
                  border: '1px solid var(--na-line)',
                  borderRadius: '4px',
                  color: 'var(--na-text)',
                  fontSize: 'var(--na-text-xs)',
                  fontFamily: 'var(--na-font-mono)',
                  boxSizing: 'border-box',
                  resize: 'none'
                }}
              />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
