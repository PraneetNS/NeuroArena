import React, { useState } from 'react';
import { ModelInspectionResult, LogitLensCell } from '@na/ml-core';

export interface LogitLensPanelProps {
  inspection: ModelInspectionResult;
}

export const LogitLensPanel: React.FC<LogitLensPanelProps> = ({ inspection }) => {
  const [hoveredCell, setHoveredCell] = useState<{
    cell: LogitLensCell;
    x: number;
    y: number;
  } | null>(null);

  const { logitLens, tokenStrings, T } = inspection;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--na-surface)',
        border: '1px solid var(--na-line)',
        borderRadius: 'var(--na-radius-base)',
        overflow: 'hidden'
      }}
    >
      {/* Header explanation banner */}
      <div
        style={{
          padding: 'var(--na-space-3) var(--na-space-4)',
          borderBottom: '1px solid var(--na-line)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--na-raised)'
        }}
      >
        <div>
          <span style={{ fontSize: 'var(--na-text-sm)', fontWeight: 600, color: 'var(--na-text)' }}>
            The Logit Lens: Progressive Representation Decoding
          </span>
          <span style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginLeft: 'var(--na-space-3)' }}>
            Applies final LayerNorm and tied unembedding head to intermediate residual streams
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--na-space-2)' }}>
          <span style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>Confidence:</span>
          <div
            style={{
              width: '80px',
              height: '8px',
              borderRadius: 'var(--na-radius-sm)',
              background: 'linear-gradient(to right, var(--na-surface), var(--na-accent-cool))',
              border: '1px solid var(--na-line)'
            }}
          />
          <span style={{ fontSize: '10px', color: 'var(--na-text-secondary)', fontFamily: 'var(--na-font-mono)' }}>
            0% → 100%
          </span>
        </div>
      </div>

      {/* Main Grid View */}
      <div style={{ flex: 1, overflow: 'auto', padding: 'var(--na-space-4)', position: 'relative' }}>
        <table
          style={{
            borderCollapse: 'collapse',
            fontSize: 'var(--na-text-xs)',
            fontFamily: 'var(--na-font-mono)',
            minWidth: '100%'
          }}
        >
          {/* Header Row: Token Positions and Text */}
          <thead>
            <tr>
              <th
                style={{
                  padding: '6px 12px',
                  textAlign: 'left',
                  color: 'var(--na-muted)',
                  borderBottom: '1px solid var(--na-line-strong)',
                  backgroundColor: 'var(--na-raised)',
                  position: 'sticky',
                  left: 0,
                  zIndex: 2
                }}
              >
                Depth / Stage
              </th>
              {tokenStrings.map((tok, pos) => (
                <th
                  key={pos}
                  style={{
                    padding: '6px 8px',
                    textAlign: 'center',
                    borderBottom: '1px solid var(--na-line-strong)',
                    color: 'var(--na-text)',
                    backgroundColor: 'var(--na-raised)',
                    minWidth: '54px'
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{tok}</div>
                  <div style={{ fontSize: '10px', color: 'var(--na-muted)' }}>t={pos}</div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {logitLens.map((stage) => {
              const formattedName = stage.stageName
                .replace('embedding', '0. Embedding')
                .replace(/layer_(\d+)_attn/, 'L$1 Attn')
                .replace(/layer_(\d+)_mlp/, 'L$1 MLP');

              const isMlp = stage.sublayer === 'mlp';
              const isEmbed = stage.sublayer === 'embedding';

              return (
                <tr
                  key={stage.stageName}
                  style={{
                    borderBottom: `1px solid ${isMlp ? 'var(--na-line-strong)' : 'var(--na-line)'}`
                  }}
                >
                  {/* Stage Label */}
                  <td
                    style={{
                      padding: '6px 12px',
                      color: isEmbed
                        ? 'var(--na-accent)'
                        : isMlp
                        ? 'var(--na-text)'
                        : 'var(--na-muted)',
                      fontWeight: isMlp || isEmbed ? 600 : 400,
                      backgroundColor: 'var(--na-surface)',
                      position: 'sticky',
                      left: 0,
                      zIndex: 1,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {formattedName}
                  </td>

                  {/* Prediction Cells */}
                  {Array.from({ length: T }).map((_, pos) => {
                    const cell = stage.positions[pos];
                    const top1 = cell?.top5[0];
                    if (!top1) return <td key={pos} style={{ padding: '4px' }}>—</td>;

                    // Probability determines opacity and background fill
                    const prob = top1.prob;
                    const alpha = Math.min(0.85, Math.max(0.08, prob * 0.9));

                    return (
                      <td
                        key={pos}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredCell({
                            cell,
                            x: rect.left + rect.width / 2,
                            y: rect.top
                          });
                        }}
                        onMouseLeave={() => setHoveredCell(null)}
                        style={{
                          padding: '6px 4px',
                          textAlign: 'center',
                          cursor: 'pointer',
                          backgroundColor: `color-mix(in srgb, var(--na-accent-cool) ${Math.round(alpha * 100)}%, var(--na-surface))`,
                          borderRight: '1px solid var(--na-line)',
                          color: alpha > 0.4 ? 'var(--na-ink)' : 'var(--na-text)',
                          fontWeight: alpha > 0.4 ? 600 : 400,
                          transition: 'background-color var(--na-duration-fast)'
                        }}
                      >
                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {top1.tokenStr}
                        </div>
                        <div
                          style={{
                            fontSize: '9px',
                            opacity: 0.85,
                            marginTop: '1px'
                          }}
                        >
                          {(prob * 100).toFixed(0)}%
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Hover Popover showing Top 5 Predictions */}
        {hoveredCell && (
          <div
            style={{
              position: 'fixed',
              left: `${hoveredCell.x}px`,
              top: `${hoveredCell.y - 10}px`,
              transform: 'translate(-50%, -100%)',
              backgroundColor: 'var(--na-ink)',
              border: '1px solid var(--na-accent-cool)',
              borderRadius: 'var(--na-radius-sm)',
              padding: '8px 12px',
              boxShadow: '0 8px 24px var(--na-overlay)',
              zIndex: 'var(--na-z-popover)',
              pointerEvents: 'none',
              minWidth: '180px'
            }}
          >
            <div
              style={{
                fontSize: '11px',
                color: 'var(--na-muted)',
                marginBottom: '4px',
                borderBottom: '1px solid var(--na-line)',
                paddingBottom: '2px',
                display: 'flex',
                justifyContent: 'space-between'
              }}
            >
              <span>{hoveredCell.cell.stageName}</span>
              <span>pos {hoveredCell.cell.position}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {hoveredCell.cell.top5.map((pred, i) => (
                <div
                  key={pred.tokenId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 'var(--na-text-xs)',
                    fontFamily: 'var(--na-font-mono)',
                    color: i === 0 ? 'var(--na-accent-cool)' : 'var(--na-text)'
                  }}
                >
                  <span style={{ fontWeight: i === 0 ? 600 : 400 }}>
                    {i + 1}. "{pred.tokenStr}"
                  </span>
                  <span style={{ color: 'var(--na-muted)', marginLeft: '8px' }}>
                    {(pred.prob * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

