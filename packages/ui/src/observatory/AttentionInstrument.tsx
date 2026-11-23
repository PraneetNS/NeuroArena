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
  const [directionFilter, setDirectionFilter] = useState<'all' | 'incoming' | 'outgoing'>('all');
  const [minWeightThreshold, setMinWeightThreshold] = useState<number>(0.02);
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

  const avgEntropy = useMemo(() => {
    if (!probs) return 0;
    let totalH = 0;
    for (let t = 0; t < T; t++) {
      let rowH = 0;
      for (let s = 0; s <= t; s++) {
        const p = probs[t * T + s];
        if (p > 1e-6) rowH -= p * Math.log2(p);
      }
      totalH += rowH;
    }
    return totalH / Math.max(1, T);
  }, [probs, T]);

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
        if (weight < minWeightThreshold) continue; // Skip beams below interactive cutoff threshold

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
  }, [probs, tokenCoords, T, minWeightThreshold]);

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

            {/* Weight Cutoff Threshold Slider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--na-space-2)' }}>
              <span style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>Cutoff:</span>
              <input
                type="range"
                min="0.01"
                max="0.25"
                step="0.01"
                value={minWeightThreshold}
                onChange={(e) => setMinWeightThreshold(parseFloat(e.target.value) || 0.01)}
                style={{ width: '64px', cursor: 'pointer' }}
                title={`Filter out attention beams below ${(minWeightThreshold * 100).toFixed(0)}% weight`}
              />
              <span style={{ fontSize: 'var(--na-text-xs)', fontFamily: 'var(--na-font-mono)', color: 'var(--na-accent-cool)' }}>
                {(minWeightThreshold * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Active Head Summary Tag */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--na-space-2)' }}>
            {headMetrics?.entropy != null && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--na-space-1)',
                  backgroundColor: 'var(--na-raised)',
                  padding: '2px 6px',
                  borderRadius: 'var(--na-radius-sm)',
                  border: '1px solid var(--na-line)'
                }}
                title={`Head entropy: ${headMetrics.entropy.toFixed(2)} bits (${Math.min(100, Math.max(0, (headMetrics.entropy / Math.log2(Math.max(2, T))) * 100)).toFixed(0)}% of theoretical uniform maximum ${Math.log2(Math.max(2, T)).toFixed(1)}b)`}
              >
                <span
                  style={{
                    fontSize: 'var(--na-text-xs)',
                    fontFamily: 'var(--na-font-mono)',
                    color: 'var(--na-accent-cool)'
                  }}
                >
                  H: {headMetrics.entropy.toFixed(2)}b
                </span>
                <div
                  style={{
                    width: '32px',
                    height: '4px',
                    backgroundColor: 'var(--na-line)',
                    borderRadius: '2px',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, Math.max(0, (headMetrics.entropy / Math.log2(Math.max(2, T))) * 100))}%`,
                      height: '100%',
                      backgroundColor: 'var(--na-accent-cool)',
                      borderRadius: '2px'
                    }}
                  />
                </div>
              </div>
            )}
            <span
              style={{
                fontSize: 'var(--na-text-xs)',
                fontFamily: 'var(--na-font-mono)',
                color: 'var(--na-muted)',
                backgroundColor: 'var(--na-raised)',
                padding: '3px 8px',
                borderRadius: 'var(--na-radius-sm)',
                border: '1px solid var(--na-line)'
              }}
              title="Number of active attention beams exceeding cutoff threshold"
            >
              {arcs.length} beams
            </span>
            <span
              style={{
                fontSize: 'var(--na-text-xs)',
                color: avgEntropy < 2.0 ? 'var(--na-accent)' : 'var(--na-muted)',
                backgroundColor: 'var(--na-card-bg)',
                padding: '3px 8px',
                borderRadius: 'var(--na-radius-full)',
                border: '1px solid var(--na-line)'
              }}
              title="Mean Shannon entropy across queries (lower indicates sharper, more focused attention)"
            >
              H: {avgEntropy.toFixed(2)} bits
            </span>
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
              <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                <div style={{ display: 'inline-flex', borderRadius: 'var(--na-radius-sm)', border: '1px solid var(--na-line)', overflow: 'hidden' }}>
                  {(['all', 'incoming', 'outgoing'] as const).map(dir => (
                    <button
                      key={dir}
                      onClick={() => setDirectionFilter(dir)}
                      style={{
                        padding: '2px 6px',
                        fontSize: 'var(--na-text-xs)',
                        color: directionFilter === dir ? 'var(--na-accent)' : 'var(--na-muted)',
                        backgroundColor: directionFilter === dir ? 'var(--na-accent-muted)' : 'transparent',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      {dir}
                    </button>
                  ))}
                </div>
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
                  Clear (Pos {selectedTokenIdx})
                </button>
              </div>
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
              let isIsolated = selectedTokenIdx === null;
              if (selectedTokenIdx !== null) {
                if (directionFilter === 'all') isIsolated = isSource || isTarget;
                else if (directionFilter === 'incoming') isIsolated = isTarget;
                else if (directionFilter === 'outgoing') isIsolated = isSource;
              }

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
                    fontSize: 'var(--na-text-xs)',
                    color: isSelected ? 'var(--na-ink)' : 'var(--na-muted)',
                    fontFamily: 'var(--na-font-mono)',
                    opacity: 0.85
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
                          fontSize: 'var(--na-text-xs)',
                          color: 'var(--na-accent)',
                          backgroundColor: 'var(--na-accent-muted)',
                          padding: '1px 6px',
                          borderRadius: 'var(--na-radius-full)'
                        }}
                      >
                        Specialized
                      </span>
                    )}
                  </div>

                  {metrics.label && (
                    <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-text-secondary)', fontStyle: 'italic' }}>
                      "{metrics.label}"
                    </div>
                  )}

                  {/* Quantitative Metric Grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 'var(--na-space-1)',
                      marginTop: 'var(--na-space-1)',
                      fontSize: 'var(--na-text-xs)',
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
