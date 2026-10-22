import React, { useRef, useEffect, useState } from 'react';
import { TrainingStepStats, GeneratedSample } from '../types.js';
import { Button } from '../../components/Button.js';
import { Slider } from '../../components/Slider.js';
import { Toggle } from '../../components/Toggle.js';
import { Badge } from '../../components/Badge.js';

export interface BottomDockProps {
  history: TrainingStepStats[];
  samples: GeneratedSample[];
  isRunning: boolean;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  history,
  samples,
  isRunning
}) => {
  const [activeTab, setActiveTab] = useState<'chart' | 'samples'>('chart');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [smoothing, setSmoothing] = useState(0.65);
  const [isLogScale, setIsLogScale] = useState(false);
  const [selectedSampleIndex, setSelectedSampleIndex] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // High-performance Canvas rendering of Live Loss Chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || activeTab !== 'chart' || isCollapsed) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high-DPI displays
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.fillStyle = '#151A21'; // --na-surface
    ctx.fillRect(0, 0, width, height);

    const padLeft = 45;
    const padRight = 20;
    const padTop = 15;
    const padBottom = 25;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    // Grid lines
    ctx.strokeStyle = '#2A333F'; // --na-line
    ctx.lineWidth = 1;
    ctx.beginPath();

    // 4 Horizontal grid lines
    for (let i = 0; i <= 4; i++) {
      const y = padTop + (plotH / 4) * i;
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
    }
    ctx.stroke();

    if (history.length < 2) {
      // Empty state
      ctx.fillStyle = '#9AA3AE';
      ctx.font = '12px "IBM Plex Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        isRunning ? 'Collecting loss metrics...' : 'Press "Run Graph" to stream live training metrics',
        width / 2,
        height / 2
      );
      return;
    }

    // Min and Max values
    let minLoss = Infinity;
    let maxLoss = -Infinity;
    for (const h of history) {
      minLoss = Math.min(minLoss, h.trainLoss, h.valLoss);
      maxLoss = Math.max(maxLoss, h.trainLoss, h.valLoss);
    }

    minLoss = Math.max(0.1, minLoss * 0.9);
    maxLoss = Math.max(minLoss + 0.5, maxLoss * 1.1);

    const getY = (loss: number) => {
      let norm: number;
      if (isLogScale) {
        norm = (Math.log(loss) - Math.log(minLoss)) / (Math.log(maxLoss) - Math.log(minLoss));
      } else {
        norm = (loss - minLoss) / (maxLoss - minLoss);
      }
      return padTop + plotH * (1 - Math.max(0, Math.min(1, norm)));
    };

    const getX = (stepIndex: number) => {
      return padLeft + (stepIndex / (history.length - 1)) * plotW;
    };

    // Y-Axis Labels
    ctx.fillStyle = '#9AA3AE';
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const lossVal = isLogScale
        ? Math.exp(Math.log(minLoss) + ((Math.log(maxLoss) - Math.log(minLoss)) / 4) * (4 - i))
        : minLoss + ((maxLoss - minLoss) / 4) * (4 - i);
      const y = padTop + (plotH / 4) * i;
      ctx.fillText(lossVal.toFixed(2), padLeft - 6, y + 3);
    }

    // EMA Smoothing computation
    const smoothedTrain: number[] = [];
    const smoothedVal: number[] = [];
    let prevT = history[0].trainLoss;
    let prevV = history[0].valLoss;

    for (const h of history) {
      prevT = smoothing * prevT + (1 - smoothing) * h.trainLoss;
      prevV = smoothing * prevV + (1 - smoothing) * h.valLoss;
      smoothedTrain.push(prevT);
      smoothedVal.push(prevV);
    }

    // Draw Raw Train Loss Line (faint)
    ctx.strokeStyle = 'rgba(232, 163, 61, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    history.forEach((h, idx) => {
      const x = getX(idx);
      const y = getY(h.trainLoss);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw Smoothed Train Loss Line (Amber)
    ctx.strokeStyle = '#E8A33D';
    ctx.lineWidth = 2;
    ctx.beginPath();
    smoothedTrain.forEach((val, idx) => {
      const x = getX(idx);
      const y = getY(val);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw Smoothed Validation Loss Line (Signal Teal)
    ctx.strokeStyle = '#4FB3A9';
    ctx.lineWidth = 2;
    ctx.beginPath();
    smoothedVal.forEach((val, idx) => {
      const x = getX(idx);
      const y = getY(val);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw Event Annotation Markers (loss spike, warmup, checkpoint)
    history.forEach((h, idx) => {
      if (h.annotations && h.annotations.length > 0) {
        const x = getX(idx);
        ctx.strokeStyle = '#D9564A';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x, padTop);
        ctx.lineTo(x, padTop + plotH);
        ctx.stroke();
        ctx.setLineDash([]);

        // Event pin dot
        ctx.fillStyle = '#D9564A';
        ctx.beginPath();
        ctx.arc(x, padTop + 4, 3, 0, Math.PI * 2);
        ctx.fill();

        // Event text
        ctx.fillStyle = '#E8E4DA';
        ctx.font = '9px "IBM Plex Sans", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(h.annotations[0], x + 4, padTop + 14);
      }
    });

    // Step Axis Labels
    ctx.fillStyle = '#9AA3AE';
    ctx.textAlign = 'left';
    ctx.fillText(`Step ${history[0].step}`, padLeft, height - 8);
    ctx.textAlign = 'right';
    ctx.fillText(`Step ${history[history.length - 1].step}`, width - padRight, height - 8);

  }, [history, activeTab, isCollapsed, smoothing, isLogScale, isRunning]);

  return (
    <div className={`na-workbench-bottom-dock ${isCollapsed ? 'is-collapsed' : ''}`}>
      {/* Dock Header Tabs & Controls */}
      <div className="na-dock-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className={`na-tab ${activeTab === 'chart' ? 'is-selected' : ''}`}
            onClick={() => setActiveTab('chart')}
            style={{
              padding: '4px 10px',
              fontFamily: 'var(--na-font-mono)',
              fontSize: 'var(--na-text-xs)',
              borderBottom: activeTab === 'chart' ? '2px solid var(--na-accent)' : 'none',
              color: activeTab === 'chart' ? 'var(--na-accent)' : 'var(--na-muted)'
            }}
          >
            📉 Live Loss Chart ({history.length} steps)
          </button>
          <button
            type="button"
            className={`na-tab ${activeTab === 'samples' ? 'is-selected' : ''}`}
            onClick={() => setActiveTab('samples')}
            style={{
              padding: '4px 10px',
              fontFamily: 'var(--na-font-mono)',
              fontSize: 'var(--na-text-xs)',
              borderBottom: activeTab === 'samples' ? '2px solid var(--na-accent)' : 'none',
              color: activeTab === 'samples' ? 'var(--na-accent)' : 'var(--na-muted)'
            }}
          >
            📝 Checkpoint Samples ({samples.length})
          </button>
        </div>

        {/* Live Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {activeTab === 'chart' && (
            <>
              <div style={{ width: '130px' }}>
                <Slider
                  label="Smoothing"
                  value={Math.round(smoothing * 100)}
                  min={0}
                  max={95}
                  unit="%"
                  onChange={(val) => setSmoothing(val / 100)}
                />
              </div>

              <Toggle
                label="Log Scale"
                checked={isLogScale}
                onChange={setIsLogScale}
              />

              <div style={{ display: 'flex', gap: '8px', fontSize: '11px', fontFamily: 'var(--na-font-mono)' }}>
                <span style={{ color: '#E8A33D' }}>● Train Loss</span>
                <span style={{ color: '#4FB3A9' }}>● Val Loss</span>
              </div>
            </>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{ padding: '2px 8px', fontSize: '11px' }}
          >
            {isCollapsed ? '▲ Expand' : '▼ Collapse'}
          </Button>
        </div>
      </div>

      {/* Dock Content Body */}
      {!isCollapsed && (
        <div className="na-dock-body">
          {activeTab === 'chart' ? (
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
          ) : (
            /* Checkpoint Sample Viewer */
            <div style={{ display: 'flex', width: '100%', height: '100%' }}>
              {/* Checkpoint Tabs on Left */}
              <div
                style={{
                  width: '160px',
                  borderRight: '1px solid var(--na-line)',
                  backgroundColor: 'var(--na-raised)',
                  overflowY: 'auto'
                }}
              >
                {samples.length === 0 ? (
                  <div style={{ padding: '12px', fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>
                    No checkpoints recorded yet.
                  </div>
                ) : (
                  samples.map((s, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedSampleIndex(idx)}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        fontSize: 'var(--na-text-xs)',
                        fontFamily: 'var(--na-font-mono)',
                        borderBottom: '1px solid var(--na-line)',
                        backgroundColor: selectedSampleIndex === idx ? 'var(--na-surface)' : 'transparent',
                        color: selectedSampleIndex === idx ? 'var(--na-accent)' : 'var(--na-text)'
                      }}
                    >
                      Step {s.checkpointStep} (PPL: {s.perplexity.toFixed(1)})
                    </div>
                  ))
                )}
              </div>

              {/* Sample Detail Card on Right */}
              <div style={{ flex: 1, padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {samples[selectedSampleIndex] ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Badge variant="accent">
                        Checkpoint @ Step {samples[selectedSampleIndex].checkpointStep}
                      </Badge>
                      <span style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>
                        Perplexity: <strong style={{ color: 'var(--na-success)' }}>{samples[selectedSampleIndex].perplexity.toFixed(2)}</strong>
                      </span>
                    </div>

                    <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>PROMPT</div>
                    <div
                      style={{
                        backgroundColor: 'var(--na-ink)',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        border: '1px solid var(--na-line)',
                        fontFamily: 'var(--na-font-mono)',
                        fontSize: 'var(--na-text-xs)'
                      }}
                    >
                      "{samples[selectedSampleIndex].prompt}"
                    </div>

                    <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginTop: '4px' }}>
                      MODEL GENERATION (AUTOREGRESSIVE SAMPLING)
                    </div>
                    <div
                      style={{
                        backgroundColor: 'var(--na-surface)',
                        padding: '10px 12px',
                        borderRadius: '4px',
                        border: '1px solid var(--na-line-strong)',
                        fontFamily: 'var(--na-font-mono)',
                        fontSize: 'var(--na-text-sm)',
                        color: 'var(--na-text)',
                        lineHeight: 1.4
                      }}
                    >
                      {samples[selectedSampleIndex].output}
                    </div>
                  </>
                ) : (
                  <div style={{ color: 'var(--na-muted)', fontSize: 'var(--na-text-xs)' }}>
                    Start training to generate autoregressive text completions at intervals.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
