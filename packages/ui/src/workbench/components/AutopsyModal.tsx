import React from 'react';
import { AutopsyReport } from '../types.js';
import { Button } from '../../components/Button.js';
import { Badge } from '../../components/Badge.js';

export interface AutopsyModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: AutopsyReport | null;
  isLoading?: boolean;
  onDiscardShard?: (shardId: string) => void;
}

export const AutopsyModal: React.FC<AutopsyModalProps> = ({
  isOpen,
  onClose,
  report,
  isLoading = false,
  onDiscardShard
}) => {
  if (!isOpen) return null;

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
          width: '840px',
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
            <span style={{ fontSize: '18px' }}>🔬</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--na-text-base)', color: 'var(--na-text)' }}>
                Training Run Autopsy & The Earned Reveal
              </div>
              <div style={{ fontSize: '11px', color: 'var(--na-muted)', fontFamily: 'var(--na-font-mono)' }}>
                Run ID: {report?.runId || 'Analyzing OPFS checkpoints...'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Badge variant="accent">EARNED REVEAL UNLOCKED</Badge>
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {isLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--na-muted)' }}>
              Calculating per-token cross entropy loss across all kept Vault shards and unlocking ground-truth quality tags...
            </div>
          ) : !report ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--na-muted)' }}>
              No completed run found. Complete a full training run first to unlock the Earned Reveal.
            </div>
          ) : (
            <>
              {/* Summary Banner */}
              <div
                style={{
                  backgroundColor: 'rgba(232, 163, 61, 0.1)',
                  border: '1px solid rgba(232, 163, 61, 0.3)',
                  padding: '14px 16px',
                  borderRadius: '6px',
                  fontSize: 'var(--na-text-sm)',
                  lineHeight: 1.5,
                  color: 'var(--na-text)'
                }}
              >
                {report.summaryVerdict}
              </div>

              {/* Tag Mean Loss Multipliers */}
              <div>
                <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Impact by Ground-Truth Tag (Mean Loss & Multiplier vs Clean Baseline)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                  {report.tagStats.map((ts, idx) => {
                    const mult = ts.multiplier ?? 1;
                    const isHarmful = mult > 1.3;
                    const isLeaked = mult < 0.7;
                    const cardBorder = isHarmful ? '#ef4444' : isLeaked ? '#ec4899' : 'var(--na-line)';
                    const multColor = isHarmful ? '#ef4444' : isLeaked ? '#ec4899' : '#10b981';

                    return (
                      <div
                        key={idx}
                        style={{
                          backgroundColor: 'var(--na-ink)',
                          border: `1px solid ${cardBorder}`,
                          borderRadius: '6px',
                          padding: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600, fontSize: '13px', fontFamily: 'var(--na-font-mono)', color: 'var(--na-text)' }}>
                            {ts.tag}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--na-muted)' }}>
                            {ts.count} shards
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{ fontSize: '11px', color: 'var(--na-muted)' }}>Mean Loss:</span>
                          <span style={{ fontFamily: 'var(--na-font-mono)', fontSize: '14px', fontWeight: 600, color: 'var(--na-text)' }}>
                            {ts.meanLoss.toFixed(3)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px solid var(--na-line)', paddingTop: '6px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--na-muted)' }}>Impact vs Clean:</span>
                          <span style={{ fontFamily: 'var(--na-font-mono)', fontSize: '12px', fontWeight: 600, color: multColor }}>
                            {mult.toFixed(2)}x loss
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Detrimental Kept Shards Table */}
              <div>
                <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Top Detrimental Kept Shards That Hurt Validation Score
                </div>
                <div
                  style={{
                    border: '1px solid var(--na-line)',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    maxHeight: '260px',
                    overflowY: 'auto'
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--na-raised)', borderBottom: '1px solid var(--na-line)', color: 'var(--na-muted)' }}>
                        <th style={{ padding: '8px 12px' }}>Shard ID</th>
                        <th style={{ padding: '8px 12px' }}>Revealed Tag</th>
                        <th style={{ padding: '8px 12px' }}>Model Loss</th>
                        <th style={{ padding: '8px 12px' }}>Text Excerpt</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.detrimentalShards.map((ds, sIdx) => (
                        <tr key={sIdx} style={{ borderBottom: '1px solid var(--na-line)', backgroundColor: sIdx % 2 === 0 ? 'transparent' : 'var(--na-raised)' }}>
                          <td style={{ padding: '8px 12px', fontFamily: 'var(--na-font-mono)', color: 'var(--na-accent)' }}>
                            {ds.shardId}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <Badge variant={ds.tag === 'ocr_noise' ? 'danger' : ds.tag === 'duplicate' ? 'warning' : 'accent-cool'}>
                              {ds.tag}
                            </Badge>
                          </td>
                          <td style={{ padding: '8px 12px', fontFamily: 'var(--na-font-mono)', fontWeight: 600, color: '#ef4444' }}>
                            {ds.meanLoss.toFixed(3)}
                          </td>
                          <td style={{ padding: '8px 12px', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--na-muted)' }} title={ds.snippet}>
                            {ds.snippet}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                            {onDiscardShard && (
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => onDiscardShard(ds.shardId)}
                                style={{ padding: '2px 8px', fontSize: '10px' }}
                              >
                                Discard from Vault
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--na-line)', display: 'flex', justifyContent: 'flex-end', backgroundColor: 'var(--na-raised)' }}>
          <Button variant="secondary" onClick={onClose}>
            Close Autopsy
          </Button>
        </div>
      </div>
    </div>
  );
};
