import React, { useState } from 'react';
import { RunSummary } from '../types.js';
import { Button } from '../../components/Button.js';
import { Badge } from '../../components/Badge.js';

export interface RunManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  runs: RunSummary[];
  onDeleteRun?: (runId: string) => Promise<void>;
  onResumeRun?: (runId: string) => void;
  onRunAutopsy?: (runId: string) => void;
}

export const RunManagerModal: React.FC<RunManagerModalProps> = ({
  isOpen,
  onClose,
  runs,
  onDeleteRun,
  onResumeRun,
  onRunAutopsy
}) => {
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);

  if (!isOpen) return null;

  const toggleSelectRun = (runId: string) => {
    setSelectedRunIds((prev) => {
      if (prev.includes(runId)) {
        return prev.filter((id) => id !== runId);
      }
      if (prev.length >= 2) {
        return [prev[1], runId]; // Keep max 2 for comparison
      }
      return [...prev, runId];
    });
  };

  const runA = runs.find((r) => r.runId === selectedRunIds[0]);
  const runB = runs.find((r) => r.runId === selectedRunIds[1]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '940px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          backgroundColor: 'var(--na-surface)',
          border: '1px solid var(--na-line-strong)',
          borderRadius: '8px',
          boxShadow: 'var(--na-elevation-4)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--na-line)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--na-raised)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>📁</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--na-text-base)', color: 'var(--na-text)' }}>
                OPFS Run Manager & Side-by-Side Comparison
              </div>
              <div style={{ fontSize: '11px', color: 'var(--na-muted)' }}>
                {runs.length} runs saved in Origin Private File System (`neuroarena_runs`)
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ✕
          </Button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* List of Runs */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', textTransform: 'uppercase' }}>
                Stored Checkpoints ({selectedRunIds.length}/2 selected for comparison)
              </span>
            </div>

            {runs.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--na-muted)', backgroundColor: 'var(--na-ink)', borderRadius: '6px' }}>
                No training runs found in OPFS. Complete a training run on the canvas to save checkpoints and metrics.
              </div>
            ) : (
              <div style={{ border: '1px solid var(--na-line)', borderRadius: '6px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--na-raised)', borderBottom: '1px solid var(--na-line)', color: 'var(--na-muted)' }}>
                      <th style={{ padding: '8px 10px', width: '32px' }}>Compare</th>
                      <th style={{ padding: '8px 10px' }}>Run ID</th>
                      <th style={{ padding: '8px 10px' }}>Preset</th>
                      <th style={{ padding: '8px 10px' }}>Fingerprint</th>
                      <th style={{ padding: '8px 10px' }}>Steps</th>
                      <th style={{ padding: '8px 10px' }}>Train / Val Loss</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((r, idx) => {
                      const isSelected = selectedRunIds.includes(r.runId);
                      return (
                        <tr
                          key={r.runId || idx}
                          style={{
                            borderBottom: '1px solid var(--na-line)',
                            backgroundColor: isSelected ? 'rgba(79, 179, 169, 0.12)' : idx % 2 === 0 ? 'transparent' : 'var(--na-raised)'
                          }}
                        >
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectRun(r.runId)}
                              style={{ cursor: 'pointer' }}
                            />
                          </td>
                          <td style={{ padding: '8px 10px', fontFamily: 'var(--na-font-mono)', fontWeight: 600, color: 'var(--na-accent)' }}>
                            {r.runId.length > 24 ? `${r.runId.slice(0, 24)}...` : r.runId}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <Badge variant="neutral">{r.preset || 'S'}</Badge>
                          </td>
                          <td style={{ padding: '8px 10px', fontFamily: 'var(--na-font-mono)', fontSize: '11px', color: 'var(--na-accent-cool)' }}>
                            {r.datasetFingerprint ? r.datasetFingerprint.slice(0, 10) : 'none'}
                          </td>
                          <td style={{ padding: '8px 10px', fontFamily: 'var(--na-font-mono)' }}>
                            {r.step} steps
                          </td>
                          <td style={{ padding: '8px 10px', fontFamily: 'var(--na-font-mono)' }}>
                            <span style={{ color: '#E8A33D' }}>{r.finalTrainLoss?.toFixed(2) ?? '--'}</span>
                            {' / '}
                            <span style={{ color: '#4FB3A9' }}>{r.finalValLoss?.toFixed(2) ?? '--'}</span>
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            {onRunAutopsy && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onRunAutopsy(r.runId)}
                                style={{ padding: '2px 8px', fontSize: '11px' }}
                              >
                                🔬 Autopsy
                              </Button>
                            )}
                            {onResumeRun && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => onResumeRun(r.runId)}
                                style={{ padding: '2px 8px', fontSize: '11px' }}
                              >
                                Resume
                              </Button>
                            )}
                            {onDeleteRun && (
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => onDeleteRun(r.runId)}
                                style={{ padding: '2px 8px', fontSize: '11px' }}
                              >
                                🗑️
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Side-by-Side Comparison Area */}
          {selectedRunIds.length === 2 && runA && runB && (
            <div style={{ backgroundColor: 'var(--na-raised)', border: '1px solid var(--na-line)', borderRadius: '6px', padding: '16px' }}>
              <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Side-by-Side Run Comparison
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* Run A Card */}
                <div style={{ backgroundColor: 'var(--na-ink)', border: '1px solid #4FB3A9', borderRadius: '6px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Badge variant="accent-cool">Run A</Badge>
                    <span style={{ fontFamily: 'var(--na-font-mono)', fontSize: '11px', color: 'var(--na-accent)' }}>{runA.runId.slice(0, 16)}</span>
                  </div>
                  <div style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--na-muted)' }}>Architecture:</span>
                    <span>Preset {runA.preset}</span>
                  </div>
                  <div style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--na-muted)' }}>Final Val Loss:</span>
                    <span style={{ fontFamily: 'var(--na-font-mono)', color: '#4FB3A9', fontWeight: 600 }}>{runA.finalValLoss?.toFixed(3) ?? '--'}</span>
                  </div>
                  <div style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--na-muted)' }}>Perplexity:</span>
                    <span style={{ fontFamily: 'var(--na-font-mono)', color: 'var(--na-success)', fontWeight: 600 }}>{runA.finalPerplexity?.toFixed(2) ?? '--'}</span>
                  </div>
                  <div style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--na-muted)' }}>Dataset Fingerprint:</span>
                    <span style={{ fontFamily: 'var(--na-font-mono)', fontSize: '10px' }}>{runA.datasetFingerprint?.slice(0, 12)}</span>
                  </div>
                </div>

                {/* Run B Card */}
                <div style={{ backgroundColor: 'var(--na-ink)', border: '1px solid #E8A33D', borderRadius: '6px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Badge variant="accent">Run B</Badge>
                    <span style={{ fontFamily: 'var(--na-font-mono)', fontSize: '11px', color: 'var(--na-accent)' }}>{runB.runId.slice(0, 16)}</span>
                  </div>
                  <div style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--na-muted)' }}>Architecture:</span>
                    <span>Preset {runB.preset}</span>
                  </div>
                  <div style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--na-muted)' }}>Final Val Loss:</span>
                    <span style={{ fontFamily: 'var(--na-font-mono)', color: '#4FB3A9', fontWeight: 600 }}>{runB.finalValLoss?.toFixed(3) ?? '--'}</span>
                  </div>
                  <div style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--na-muted)' }}>Perplexity:</span>
                    <span style={{ fontFamily: 'var(--na-font-mono)', color: 'var(--na-success)', fontWeight: 600 }}>{runB.finalPerplexity?.toFixed(2) ?? '--'}</span>
                  </div>
                  <div style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--na-muted)' }}>Dataset Fingerprint:</span>
                    <span style={{ fontFamily: 'var(--na-font-mono)', fontSize: '10px' }}>{runB.datasetFingerprint?.slice(0, 12)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--na-line)', display: 'flex', justifyContent: 'flex-end', backgroundColor: 'var(--na-raised)' }}>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
