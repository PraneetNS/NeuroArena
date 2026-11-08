import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ModelInspectionResult } from '@na/ml-core';

export interface AttentionInstrumentProps {
  inspection: ModelInspectionResult;
  selectedLayer: number;
  selectedHead: number;
  onSelectLayerHead: (layer: number, head: number) => void;
}

export const AttentionInstrument: React.FC<AttentionInstrumentProps> = ({
  inspection,
  selectedLayer,
  selectedHead,
  onSelectLayerHead
}) => {
  const [selectedTokenIdx, setSelectedTokenIdx] = useState<number | null>(null);
  const [hoveredBeam, setHoveredBeam] = useState<{
    source: number;
    target: number;
    weight: number;
    x: number;
    y: number;
  } | null>(null);
  const [hoveredTokenIdx, setHoveredTokenIdx] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const tokenRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const { T, attention, nLayers, nHeads } = inspection;
  const currentLayerData = attention[selectedLayer] || attention[0];
  const currentHeadData = currentLayerData?.heads[selectedHead] || currentLayerData?.heads[0];

  const probs = currentHeadData?.probs;
  const headMetrics = currentHeadData?.metrics;

  // Track token element X coordinates for exact SVG curve anchor points
  const [tokenCoords, setTokenCoords] = useState<{ x: number; y: number }[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateCoords = () => {
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return;

      const coords: { x: number; y: number }[] = [];
      for (let i = 0; i < T; i++) {
        const el = tokenRefs.current[i];
        if (el) {
          const rect = el.getBoundingClientRect();
          coords.push({
            x: rect.left + rect.width / 2 - containerRect.left,
            y: rect.top - containerRect.top
          });
        } else {
          coords.push({ x: i * 40 + 20, y: 150 });
        }
      }
      setTokenCoords(coords);
    };

    updateCoords();
    window.addEventListener('resize', updateCoords);
    return () => window.removeEventListener('resize', updateCoords);
  }, [T, inspection.tokens]);

  // Compute all arc beams for current head
  const arcs = useMemo(() => {
    if (!probs || tokenCoords.length < T) return [];
    const list: Array<{
      source: number;
      target: number;
      weight: number;
      path: string;
      sourceX: number;
      targetX: number;
    }> = [];

    for (let target = 0; target < T; target++) {
      for (let source = 0; source <= target; source++) {
        const weight = probs[target * T + source];
        if (weight < 0.01) continue; // Skip negligible noise for render performance

        const pSource = tokenCoords[source];
        const pTarget = tokenCoords[target];
        if (!pSource || !pTarget) continue;

        const distance = Math.abs(pTarget.x - pSource.x);
        const arcHeight = Math.min(180, Math.max(20, distance * 0.45));
        const midX = (pSource.x + pTarget.x) / 2;
        const midY = Math.min(pSource.y, pTarget.y) - arcHeight;

        const path = `M ${pSource.x} ${pSource.y} Q ${midX} ${midY} ${pTarget.x} ${pTarget.y}`;

        list.push({
          source,
          target,
          weight,
          path,
          sourceX: pSource.x,
          targetX: pTarget.x
        });
      }
    }
    return list;
  }, [probs, tokenCoords, T]);

  return (
    <div style={{ display: 'flex', gap: 'var(--na-space-4)', height: '100%', overflow: 'hidden' }}>
      {/* Main Interactive Arc View */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--na-surface)',
          border: '1px solid var(--na-line)',
          borderRadius: 'var(--na-radius-base)',
          position: 'relative',
          overflow: 'hidden',
          padding: 'var(--na-space-4)'
        }}
      >
        {/* Top Controls Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--na-space-4)',
            borderBottom: '1px solid var(--na-line)',
            paddingBottom: 'var(--na-space-3)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--na-space-4)' }}>
            {/* Layer Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--na-space-2)' }}>
              <span style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>Layer:</span>
              <div style={{ display: 'flex', gap: 'var(--na-space-1)' }}>
                {Array.from({ length: nLayers }).map((_, l) => (
                  <button
                    key={l}
                    onClick={() => onSelectLayerHead(l, selectedHead)}
                    style={{
                      padding: '2px 8px',
                      fontSize: 'var(--na-text-xs)',
                      fontFamily: 'var(--na-font-mono)',
                      borderRadius: 'var(--na-radius-sm)',
                      backgroundColor: selectedLayer === l ? 'var(--na-accent)' : 'var(--na-raised)',
                      color: selectedLayer === l ? 'var(--na-ink)' : 'var(--na-text)',
                      border: '1px solid var(--na-line)',
                      cursor: 'pointer',
                      fontWeight: selectedLayer === l ? 600 : 400
                    }}
                  >
                    L{l}
                  </button>
                ))}
              </div>
            </div>

            {/* Head Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--na-space-2)' }}>
              <span style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>Head:</span>
              <div style={{ display: 'flex', gap: 'var(--na-space-1)' }}>
                {Array.from({ length: nHeads }).map((_, h) => (
                  <button
                    key={h}
                    onClick={() => onSelectLayerHead(selectedLayer, h)}
                    style={{
                      padding: '2px 8px',
                      fontSize: 'var(--na-text-xs)',
                      fontFamily: 'var(--na-font-mono)',
                      borderRadius: 'var(--na-radius-sm)',
                      backgroundColor: selectedHead === h ? 'var(--na-accent-cool)' : 'var(--na-raised)',
                      color: selectedHead === h ? 'var(--na-ink)' : 'var(--na-text)',
                      border: '1px solid var(--na-line)',
                      cursor: 'pointer',
                      fontWeight: selectedHead === h ? 600 : 400
                    }}
                  >
                    H{h}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Active Head Summary Tag */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--na-space-2)' }}>
            {headMetrics?.label && (
              <span
                style={{
                  fontSize: 'var(--na-text-xs)',
                  color: 'var(--na-accent)',
                  backgroundColor: 'var(--na-accent-muted)',
                  padding: '3px 8px',
                  borderRadius: 'var(--na-radius-full)',
                  border: '1px solid var(--na-accent-glow)'
                }}
              >
                {headMetrics.label}
              </span>
            )}
            {selectedTokenIdx !== null && (
              <button
                onClick={() => setSelectedTokenIdx(null)}
                style={{
                  padding: '2px 6px',
                  fontSize: 'var(--na-text-xs)',
                  color: 'var(--na-muted)',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--na-line)',
                  borderRadius: 'var(--na-radius-sm)',
                  cursor: 'pointer'
                }}
              >
                Clear Filter (Pos {selectedTokenIdx})
              </button>
            )}
          </div>
        </div>

        {/* SVG Arcs Canvas */}
        <div style={{ flex: 1, position: 'relative', minHeight: '260px' }}>
          <svg
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'stroke'
            }}
          >
            {arcs.map((arc, idx) => {
              const isSource = selectedTokenIdx !== null && arc.source === selectedTokenIdx;
              const isTarget = selectedTokenIdx !== null && arc.target === selectedTokenIdx;
              const isIsolated = selectedTokenIdx === null || isSource || isTarget;

              if (!isIsolated) return null;

              const strokeOpacity = Math.max(0.12, Math.min(0.95, arc.weight * (isIsolated && selectedTokenIdx !== null ? 1.5 : 1.0)));
              const strokeWidth = Math.max(1, arc.weight * 5);
              const color = isTarget ? 'var(--na-accent)' : isSource ? 'var(--na-accent-cool)' : 'var(--na-accent-cool)';

              return (
                <path
                  key={idx}
                  d={arc.path}
                  fill="none"
                  stroke={color}
                  strokeWidth={strokeWidth}
                  strokeOpacity={strokeOpacity}
                  strokeLinecap="round"
                  style={{
                    cursor: 'pointer',
                    transition: 'stroke-width var(--na-duration-fast) var(--na-ease-standard)'
                  }}
                  onMouseEnter={(e) => {
                    const rect = containerRef.current?.getBoundingClientRect();
                    setHoveredBeam({
                      source: arc.source,
                      target: arc.target,
                      weight: arc.weight,
                      x: e.clientX - (rect?.left || 0),
                      y: e.clientY - (rect?.top || 0) - 20
                    });
                  }}
                  onMouseLeave={() => setHoveredBeam(null)}
                  onClick={() => setSelectedTokenIdx(arc.target)}
                />
              );
            })}
          </svg>

          {/* Hovered Beam Tooltip */}
          {hoveredBeam && (
            <div
              style={{
                position: 'absolute',
                left: `${hoveredBeam.x}px`,
                top: `${hoveredBeam.y}px`,
                transform: 'translate(-50%, -100%)',
                backgroundColor: 'var(--na-ink)',
                border: '1px solid var(--na-accent-cool)',
                borderRadius: 'var(--na-radius-sm)',
                padding: '4px 8px',
                fontSize: 'var(--na-text-xs)',
                fontFamily: 'var(--na-font-mono)',
                color: 'var(--na-text)',
                boxShadow: '0 4px 12px var(--na-overlay)',
                pointerEvents: 'none',
                zIndex: 'var(--na-z-tooltip)',
                whiteSpace: 'nowrap'
              }}
            >
              <span>{inspection.tokenStrings[hoveredBeam.target]}</span>
              <span style={{ color: 'var(--na-muted)', margin: '0 4px' }}>attends to</span>
              <span>{inspection.tokenStrings[hoveredBeam.source]}</span>
              <span style={{ color: 'var(--na-accent-cool)', marginLeft: '6px', fontWeight: 600 }}>
                ({hoveredBeam.weight.toFixed(4)})
              </span>
            </div>
          )}
        </div>

        {/* Horizontal Tokens Row */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--na-space-1)',
            overflowX: 'auto',
            paddingTop: 'var(--na-space-3)',
            borderTop: '1px solid var(--na-line)',
            alignItems: 'flex-start'
          }}
        >
          {inspection.tokens.map((_tokId, idx) => {
            const isSelected = selectedTokenIdx === idx;
            const isHovered = hoveredTokenIdx === idx;

            // Compute attention received by this token when another token is selected
            let receivedWeight = 0;
            if (selectedTokenIdx !== null && probs) {
              receivedWeight = probs[selectedTokenIdx * T + idx];
            }

            return (
              <button
                key={idx}
                ref={(el) => {
                  tokenRefs.current[idx] = el;
                }}
                onClick={() => setSelectedTokenIdx(isSelected ? null : idx)}
                onMouseEnter={() => setHoveredTokenIdx(idx)}
                onMouseLeave={() => setHoveredTokenIdx(null)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '4px 6px',
                  backgroundColor: isSelected
                    ? 'var(--na-accent)'
                    : isHovered
                    ? 'var(--na-raised)'
                    : 'var(--na-surface)',
                  color: isSelected ? 'var(--na-ink)' : 'var(--na-text)',
                  border: `1px solid ${
                    isSelected
                      ? 'var(--na-accent)'
                      : receivedWeight > 0.1
                      ? 'var(--na-accent-cool)'
                      : 'var(--na-line)'
                  }`,
                  borderRadius: 'var(--na-radius-sm)',
                  cursor: 'pointer',
                  minWidth: '28px',
                  flexShrink: 0,
                  transition: 'background-color var(--na-duration-fast)'
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--na-font-mono)',
                    fontSize: 'var(--na-text-xs)',
                    fontWeight: isSelected ? 600 : 400
                  }}
                >
                  {inspection.tokenStrings[idx]}
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    color: isSelected ? 'var(--na-ink)' : 'var(--na-muted)',
                    fontFamily: 'var(--na-font-mono)'
                  }}
                >
                  {idx}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Head Cards Sidebar */}
      <div
        style={{
          width: '320px',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--na-surface)',
          border: '1px solid var(--na-line)',
          borderRadius: 'var(--na-radius-base)',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            padding: 'var(--na-space-3) var(--na-space-4)',
            borderBottom: '1px solid var(--na-line)',
            fontSize: 'var(--na-text-sm)',
            fontWeight: 600,
            color: 'var(--na-text)'
          }}
        >
          Attention Head Cards ({nLayers * nHeads} Total)
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--na-space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--na-space-2)' }}>
          {attention.flatMap((layerData) =>
            layerData.heads.map((headData) => {
              const isSelected = selectedLayer === headData.layer && selectedHead === headData.head;
              const { metrics } = headData;

              return (
                <div
                  key={`${headData.layer}-${headData.head}`}
                  onClick={() => onSelectLayerHead(headData.layer, headData.head)}
                  style={{
                    padding: 'var(--na-space-3)',
                    backgroundColor: isSelected ? 'var(--na-raised)' : 'var(--na-surface)',
                    border: `1px solid ${isSelected ? 'var(--na-accent-cool)' : 'var(--na-line)'}`,
                    borderRadius: 'var(--na-radius-sm)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--na-space-1)',
                    transition: 'border-color var(--na-duration-fast)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span
                      style={{
                        fontFamily: 'var(--na-font-mono)',
                        fontSize: 'var(--na-text-xs)',
                        fontWeight: 600,
                        color: isSelected ? 'var(--na-accent-cool)' : 'var(--na-text)'
                      }}
                    >
                      Layer {headData.layer} · Head {headData.head}
                    </span>
                    {metrics.label && (
                      <span
                        style={{
                          fontSize: '10px',
                          color: 'var(--na-accent)',
                          backgroundColor: 'var(--na-accent-muted)',
                          padding: '1px 5px',
                          borderRadius: 'var(--na-radius-full)'
                        }}
                      >
                        Specialized
                      </span>
                    )}
                  </div>

                  {metrics.label && (
                    <div style={{ fontSize: '11px', color: 'var(--na-text-secondary)', fontStyle: 'italic' }}>
                      "{metrics.label}"
                    </div>
                  )}

                  {/* Quantitative Metric Grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '4px',
                      marginTop: '4px',
                      fontSize: '10px',
                      fontFamily: 'var(--na-font-mono)'
                    }}
                  >
                    <div style={{ color: 'var(--na-muted)' }}>
                      Prev-Token:{' '}
                      <span style={{ color: 'var(--na-text)', fontWeight: 600 }}>
                        {metrics.prevTokenScore.toFixed(3)}
                      </span>
                    </div>
                    <div style={{ color: 'var(--na-muted)' }}>
                      Sink Mass:{' '}
                      <span style={{ color: 'var(--na-text)', fontWeight: 600 }}>
                        {metrics.firstTokenScore.toFixed(3)}
                      </span>
                    </div>
                    <div style={{ color: 'var(--na-muted)' }}>
                      Local Window:{' '}
                      <span style={{ color: 'var(--na-text)', fontWeight: 600 }}>
                        {metrics.localWindowScore.toFixed(3)}
                      </span>
                    </div>
                    <div style={{ color: 'var(--na-muted)' }}>
                      Entropy:{' '}
                      <span style={{ color: 'var(--na-text)', fontWeight: 600 }}>
                        {metrics.entropy.toFixed(2)}
                      </span>
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
