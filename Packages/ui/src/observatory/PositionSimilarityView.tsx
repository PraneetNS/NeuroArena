import React, { useRef, useEffect, useState, useMemo } from 'react';

export interface PositionSimilarityViewProps {
  posEmb: Float32Array | Float64Array;
  contextLen: number;
  dModel: number;
}

export const PositionSimilarityView: React.FC<PositionSimilarityViewProps> = ({
  posEmb,
  contextLen,
  dModel
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredCell, setHoveredCell] = useState<{
    posA: number;
    posB: number;
    distance: number;
    similarity: number;
    x: number;
    y: number;
  } | null>(null);

  // Compute 128 x 128 Cosine Similarity Matrix
  const similarityMatrix = useMemo(() => {
    const T = contextLen;
    const D = dModel;
    const mat = new Float32Array(T * T);

    // Compute norms for each position
    const norms = new Float32Array(T);
    for (let t = 0; t < T; t++) {
      let sumSq = 0;
      const off = t * D;
      for (let d = 0; d < D; d++) {
        sumSq += posEmb[off + d] * posEmb[off + d];
      }
      norms[t] = Math.sqrt(sumSq) + 1e-12;
    }

    // Compute pairwise cosine similarities
    for (let i = 0; i < T; i++) {
      const iOff = i * D;
      const iNorm = norms[i];
      for (let j = 0; j < T; j++) {
        const jOff = j * D;
        let dot = 0;
        for (let d = 0; d < D; d++) {
          dot += posEmb[iOff + d] * posEmb[jOff + d];
        }
        mat[i * T + j] = dot / (iNorm * norms[j]);
      }
    }
    return mat;
  }, [posEmb, contextLen, dModel]);

  // Render Heatmap to Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const T = contextLen;
    const size = 512;
    canvas.width = size;
    canvas.height = size;

    const cellSize = size / T;

    for (let i = 0; i < T; i++) {
      for (let j = 0; j < T; j++) {
        const sim = similarityMatrix[i * T + j]; // typically in [-1, 1]
        // Normalize: 0 = minimum/blue, 1 = maximum/amber/teal
        const normSim = Math.max(0, Math.min(1, (sim + 0.2) / 1.2));

        // Color ramp from deep navy to bright signal teal
        const r = Math.round(14 + normSim * (79 - 14));
        const g = Math.round(17 + normSim * (179 - 17));
        const b = Math.round(22 + normSim * (169 - 22));

        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(j * cellSize, i * cellSize, cellSize, cellSize);
      }
    }
  }, [similarityMatrix, contextLen]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const col = Math.floor((x / rect.width) * contextLen);
    const row = Math.floor((y / rect.height) * contextLen);

    if (row >= 0 && row < contextLen && col >= 0 && col < contextLen) {
      const sim = similarityMatrix[row * contextLen + col];
      setHoveredCell({
        posA: row,
        posB: col,
        distance: Math.abs(row - col),
        similarity: sim,
        x: e.clientX,
        y: e.clientY
      });
    }
  };

  const handleMouseLeave = () => {
    setHoveredCell(null);
  };

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
      {/* Header Description */}
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
            Positional Embedding Geometry ({contextLen} × {contextLen})
          </span>
          <span style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginLeft: 'var(--na-space-3)' }}>
            Pairwise cosine similarity matrix showing learned temporal distance decay
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--na-space-2)' }}>
          <span style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>Similarity:</span>
          <div
            style={{
              width: '80px',
              height: '8px',
              borderRadius: 'var(--na-radius-sm)',
              background: 'linear-gradient(to right, rgb(14, 17, 22), rgb(79, 179, 169))',
              border: '1px solid var(--na-line)'
            }}
          />
          <span style={{ fontSize: '10px', color: 'var(--na-text-secondary)', fontFamily: 'var(--na-font-mono)' }}>
            -0.2 → 1.0
          </span>
        </div>
      </div>

      {/* Main Heatmap Container */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--na-space-6)',
          position: 'relative'
        }}
      >
        <div
          style={{
            position: 'relative',
            border: '1px solid var(--na-line-strong)',
            borderRadius: 'var(--na-radius-sm)',
            overflow: 'hidden',
            boxShadow: '0 8px 32px var(--na-overlay)'
          }}
        >
          <canvas
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
              width: '512px',
              height: '512px',
              display: 'block',
              cursor: 'crosshair'
            }}
          />
        </div>

        {/* Hovered Cell Floating Tooltip */}
        {hoveredCell && (
          <div
            style={{
              position: 'fixed',
              left: `${hoveredCell.x}px`,
              top: `${hoveredCell.y - 12}px`,
              transform: 'translate(-50%, -100%)',
              backgroundColor: 'var(--na-ink)',
              border: '1px solid var(--na-accent-cool)',
              borderRadius: 'var(--na-radius-sm)',
              padding: '6px 10px',
              fontSize: 'var(--na-text-xs)',
              fontFamily: 'var(--na-font-mono)',
              color: 'var(--na-text)',
              boxShadow: '0 8px 24px var(--na-overlay)',
              pointerEvents: 'none',
              zIndex: 'var(--na-z-popover)'
            }}
          >
            <div>
              Position <span style={{ color: 'var(--na-accent-cool)', fontWeight: 600 }}>{hoveredCell.posA}</span> vs{' '}
              <span style={{ color: 'var(--na-accent)', fontWeight: 600 }}>{hoveredCell.posB}</span>
            </div>
            <div style={{ color: 'var(--na-muted)', fontSize: '10px', marginTop: '2px' }}>
              Separation Δt: {hoveredCell.distance} tokens · Cosine: {hoveredCell.similarity.toFixed(4)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
