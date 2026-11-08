import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  computeEmbeddingPca,
  projectEmbeddingsToBasis,
  findNearestNeighbors,
  categorizeToken,
  CATEGORY_METAS,
  TokenCategory,
  PcaResult
} from '@na/ml-core';

export interface EmbeddingExplorerProps {
  tokEmb: Float32Array | Float64Array;
  vocabSize: number;
  dModel: number;
  tokenStrings?: string[];
  checkpointSnapshots?: Array<{
    step: number;
    label: string;
    tokEmb: Float32Array;
  }>;
}

export const EmbeddingExplorer: React.FC<EmbeddingExplorerProps> = ({
  tokEmb,
  vocabSize,
  dModel,
  tokenStrings = [],
  checkpointSnapshots = []
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // PCA state
  const [pcaResult, setPcaResult] = useState<PcaResult | null>(null);
  const [scrubberValue, setScrubberValue] = useState<number>(100); // 0 to 100%

  // Interaction State
  const [hoveredTokenIdx, setHoveredTokenIdx] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<TokenCategory | 'all'>('all');

  // Camera Orbit State
  const cameraRef = useRef({
    rotX: 0.35,
    rotY: 0.55,
    zoom: 24,
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0
  });

  // 1. Compute Base PCA on primary embedding matrix
  useEffect(() => {
    const res = computeEmbeddingPca(tokEmb, vocabSize, dModel, 3, 40);
    setPcaResult(res);
  }, [tokEmb, vocabSize, dModel]);

  // 2. Compute 3D Coordinates based on scrubber / snapshot selection
  const currentCoords = useMemo(() => {
    if (!pcaResult) return null;

    if (checkpointSnapshots.length > 0) {
      // Interpolate between snapshots based on scrubber (0% to 100%)
      const totalStages = checkpointSnapshots.length - 1;
      const progress = (scrubberValue / 100) * totalStages;
      const stageA = Math.floor(progress);
      const stageB = Math.min(totalStages, stageA + 1);
      const alpha = progress - stageA;

      const embA = checkpointSnapshots[stageA].tokEmb;
      const embB = checkpointSnapshots[stageB].tokEmb;

      const coordsA = projectEmbeddingsToBasis(embA, pcaResult, vocabSize, dModel);
      const coordsB = projectEmbeddingsToBasis(embB, pcaResult, vocabSize, dModel);

      const blended = new Float32Array(vocabSize * 3);
      for (let i = 0; i < vocabSize * 3; i++) {
        blended[i] = coordsA[i] * (1 - alpha) + coordsB[i] * alpha;
      }
      return blended;
    }

    return pcaResult.coordinates;
  }, [pcaResult, scrubberValue, checkpointSnapshots, vocabSize, dModel]);

  // 3. Precompute categories for all tokens
  const tokenCategories = useMemo(() => {
    const cats: TokenCategory[] = [];
    for (let i = 0; i < vocabSize; i++) {
      const str = tokenStrings[i] || `[${i}]`;
      cats.push(categorizeToken(i, str));
    }
    return cats;
  }, [vocabSize, tokenStrings]);

  // 4. Nearest neighbors for hovered token
  const nearestNeighbors = useMemo(() => {
    if (hoveredTokenIdx === null) return [];
    return findNearestNeighbors(hoveredTokenIdx, tokEmb, vocabSize, dModel, 8);
  }, [hoveredTokenIdx, tokEmb, vocabSize, dModel]);

  // 5. 3D Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentCoords) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.clearRect(0, 0, width, height);

      const { rotX, rotY, zoom } = cameraRef.current;
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);

      const cx = width / 2;
      const cy = height / 2;

      // Project points to 2D screen with depth sorting
      const projected: Array<{
        idx: number;
        sx: number;
        sy: number;
        depth: number;
        category: TokenCategory;
      }> = [];

      for (let v = 0; v < vocabSize; v++) {
        const cat = tokenCategories[v];
        if (selectedCategory !== 'all' && cat !== selectedCategory) continue;

        const x = currentCoords[v * 3];
        const y = currentCoords[v * 3 + 1];
        const z = currentCoords[v * 3 + 2];

        // 3D rotation: Yaw around Y, Pitch around X
        const x1 = cosY * x + sinY * z;
        const z1 = -sinY * x + cosY * z;
        const y2 = cosX * y - sinX * z1;
        const z2 = sinX * y + cosX * z1;

        // Perspective division
        const distance = 40;
        const pz = z2 + distance;
        if (pz <= 0.1) continue;

        const scale = (zoom * 28) / pz;
        const sx = cx + x1 * scale;
        const sy = cy - y2 * scale;

        projected.push({
          idx: v,
          sx,
          sy,
          depth: pz,
          category: cat
        });
      }

      // Depth sort: back to front
      projected.sort((a, b) => b.depth - a.depth);

      // Category color mapping
      const categoryColors: Record<TokenCategory, string> = {
        character_name: '#E8A33D', // Lantern amber
        capitalized: '#4FB3A9',    // Signal teal
        lowercase: '#E8E4DA',      // Parchment text
        subword: '#E0B04A',        // Gold warning
        punctuation: '#9AA3AE',    // Slate muted
        whitespace: '#656E7B'      // Faint slate
      };

      // Draw points
      for (const pt of projected) {
        const isHovered = hoveredTokenIdx === pt.idx;
        const isNeighbor = nearestNeighbors.some((n) => n.tokenId === pt.idx);

        const radius = isHovered ? 6 : isNeighbor ? 4.5 : Math.max(1.5, 3.2 - pt.depth * 0.04);
        const color = isHovered
          ? '#F5B453'
          : isNeighbor
          ? '#62C5BB'
          : categoryColors[pt.category];

        ctx.beginPath();
        ctx.arc(pt.sx, pt.sy, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        if (isHovered || isNeighbor) {
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.2;
          ctx.stroke();

          // Draw token text label
          ctx.font = '11px "IBM Plex Mono", monospace';
          ctx.fillStyle = '#FFFFFF';
          const tokStr = tokenStrings[pt.idx] || `[${pt.idx}]`;
          ctx.fillText(tokStr, pt.sx + 8, pt.sy + 4);
        }
      }

      // Draw connection lines from hovered token to its nearest neighbors
      if (hoveredTokenIdx !== null) {
        const targetPt = projected.find((p) => p.idx === hoveredTokenIdx);
        if (targetPt) {
          ctx.strokeStyle = 'rgba(79, 179, 169, 0.4)';
          ctx.lineWidth = 1;
          for (const neighbor of nearestNeighbors) {
            const nPt = projected.find((p) => p.idx === neighbor.tokenId);
            if (nPt) {
              ctx.beginPath();
              ctx.moveTo(targetPt.sx, targetPt.sy);
              ctx.lineTo(nPt.sx, nPt.sy);
              ctx.stroke();
            }
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [currentCoords, vocabSize, tokenCategories, selectedCategory, hoveredTokenIdx, nearestNeighbors, tokenStrings]);

  // Mouse drag handlers for 3D Orbiting
  const handleMouseDown = (e: React.MouseEvent) => {
    cameraRef.current.isDragging = true;
    cameraRef.current.lastMouseX = e.clientX;
    cameraRef.current.lastMouseY = e.clientY;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (cameraRef.current.isDragging) {
      const dx = e.clientX - cameraRef.current.lastMouseX;
      const dy = e.clientY - cameraRef.current.lastMouseY;
      cameraRef.current.rotY += dx * 0.008;
      cameraRef.current.rotX += dy * 0.008;
      cameraRef.current.lastMouseX = e.clientX;
      cameraRef.current.lastMouseY = e.clientY;
    } else {
      // Hit testing for nearest point on hover
      const canvas = canvasRef.current;
      if (!canvas || !currentCoords) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const { rotX, rotY, zoom } = cameraRef.current;
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      let closestIdx: number | null = null;
      let minDistance = 14; // Hit radius in pixels

      for (let v = 0; v < vocabSize; v++) {
        const x = currentCoords[v * 3];
        const y = currentCoords[v * 3 + 1];
        const z = currentCoords[v * 3 + 2];

        const x1 = cosY * x + sinY * z;
        const z1 = -sinY * x + cosY * z;
        const y2 = cosX * y - sinX * z1;
        const z2 = sinX * y + cosX * z1;

        const pz = z2 + 40;
        if (pz <= 0.1) continue;

        const scale = (zoom * 28) / pz;
        const sx = cx + x1 * scale;
        const sy = cy - y2 * scale;

        const dist = Math.hypot(mouseX - sx, mouseY - sy);
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = v;
        }
      }

      setHoveredTokenIdx(closestIdx);
    }
  };

  const handleMouseUp = () => {
    cameraRef.current.isDragging = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    cameraRef.current.zoom = Math.max(8, Math.min(60, cameraRef.current.zoom - e.deltaY * 0.02));
  };

  return (
    <div style={{ display: 'flex', gap: 'var(--na-space-4)', height: '100%', overflow: 'hidden' }}>
      {/* 3D Canvas Viewport */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--na-surface)',
          border: '1px solid var(--na-line)',
          borderRadius: 'var(--na-radius-base)',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        {/* Top Controls Toolbar */}
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
          {/* PCA Explained Variance Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--na-space-3)' }}>
            <span style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>PCA Explained Variance:</span>
            {pcaResult && (
              <span
                style={{
                  fontFamily: 'var(--na-font-mono)',
                  fontSize: 'var(--na-text-xs)',
                  color: 'var(--na-accent-cool)',
                  fontWeight: 600
                }}
              >
                PC1: {(pcaResult.explainedVarianceRatio[0] * 100).toFixed(1)}% · PC2:{' '}
                {(pcaResult.explainedVarianceRatio[1] * 100).toFixed(1)}% · PC3:{' '}
                {(pcaResult.explainedVarianceRatio[2] * 100).toFixed(1)}% (Total:{' '}
                {(
                  (pcaResult.explainedVarianceRatio[0] +
                    pcaResult.explainedVarianceRatio[1] +
                    pcaResult.explainedVarianceRatio[2]) *
                  100
                ).toFixed(1)}
                %)
              </span>
            )}
          </div>

          {/* Category Filter Pills */}
          <div style={{ display: 'flex', gap: 'var(--na-space-1)', alignItems: 'center' }}>
            <button
              onClick={() => setSelectedCategory('all')}
              style={{
                padding: '2px 8px',
                fontSize: '11px',
                borderRadius: 'var(--na-radius-sm)',
                backgroundColor: selectedCategory === 'all' ? 'var(--na-accent)' : 'var(--na-surface)',
                color: selectedCategory === 'all' ? 'var(--na-ink)' : 'var(--na-text)',
                border: '1px solid var(--na-line)',
                cursor: 'pointer'
              }}
            >
              All ({vocabSize})
            </button>
            {(Object.keys(CATEGORY_METAS) as TokenCategory[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '2px 8px',
                  fontSize: '11px',
                  borderRadius: 'var(--na-radius-sm)',
                  backgroundColor: selectedCategory === cat ? 'var(--na-raised)' : 'var(--na-surface)',
                  color: CATEGORY_METAS[cat].colorVar,
                  border: `1px solid ${selectedCategory === cat ? 'var(--na-accent-cool)' : 'var(--na-line)'}`,
                  cursor: 'pointer'
                }}
              >
                {CATEGORY_METAS[cat].label}
              </button>
            ))}
          </div>
        </div>

        {/* 3D Interactive Canvas */}
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          style={{
            flex: 1,
            width: '100%',
            height: '100%',
            cursor: cameraRef.current.isDragging ? 'grabbing' : 'grab'
          }}
        />

        {/* Checkpoint Scrubber Bar */}
        {checkpointSnapshots.length > 0 && (
          <div
            style={{
              padding: 'var(--na-space-3) var(--na-space-4)',
              borderTop: '1px solid var(--na-line)',
              backgroundColor: 'var(--na-raised)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--na-space-4)'
            }}
          >
            <span style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>
              Checkpoint Scrubber:
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={scrubberValue}
              onChange={(e) => setScrubberValue(Number(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--na-accent)' }}
            />
            <span
              style={{
                fontFamily: 'var(--na-font-mono)',
                fontSize: 'var(--na-text-xs)',
                color: 'var(--na-text)',
                minWidth: '120px'
              }}
            >
              {scrubberValue}% ({checkpointSnapshots[Math.min(checkpointSnapshots.length - 1, Math.floor((scrubberValue / 100) * (checkpointSnapshots.length - 1)))]?.label})
            </span>
          </div>
        )}
      </div>

      {/* Sidebar: Nearest Neighbors Inspector */}
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
          Semantic Neighborhood (128D Cosine)
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--na-space-3)' }}>
          {hoveredTokenIdx !== null ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--na-space-3)' }}>
              {/* Selected Token Card */}
              <div
                style={{
                  padding: 'var(--na-space-3)',
                  backgroundColor: 'var(--na-raised)',
                  border: '1px solid var(--na-accent)',
                  borderRadius: 'var(--na-radius-sm)'
                }}
              >
                <div style={{ fontSize: '10px', color: 'var(--na-muted)' }}>Selected Token:</div>
                <div
                  style={{
                    fontFamily: 'var(--na-font-mono)',
                    fontSize: 'var(--na-text-md)',
                    fontWeight: 600,
                    color: 'var(--na-accent)',
                    marginTop: '2px'
                  }}
                >
                  "{tokenStrings[hoveredTokenIdx]}"
                </div>
                <div style={{ fontSize: '10px', color: 'var(--na-text-secondary)', marginTop: '2px' }}>
                  Index: {hoveredTokenIdx} · Category: {CATEGORY_METAS[tokenCategories[hoveredTokenIdx]].label}
                </div>
              </div>

              {/* 8 Nearest Neighbors List */}
              <div style={{ fontSize: 'var(--na-text-xs)', fontWeight: 600, color: 'var(--na-text)' }}>
                8 Nearest Semantic Neighbors:
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--na-space-1)' }}>
                {nearestNeighbors.map((item, rank) => {
                  const tokStr = tokenStrings[item.tokenId] || `[${item.tokenId}]`;
                  const cat = tokenCategories[item.tokenId];

                  return (
                    <div
                      key={item.tokenId}
                      style={{
                        padding: '6px 8px',
                        backgroundColor: 'var(--na-raised)',
                        border: '1px solid var(--na-line)',
                        borderRadius: 'var(--na-radius-sm)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 'var(--na-text-xs)',
                        fontFamily: 'var(--na-font-mono)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: 'var(--na-muted)', fontSize: '10px' }}>{rank + 1}.</span>
                        <span style={{ color: CATEGORY_METAS[cat].colorVar, fontWeight: 500 }}>
                          "{tokStr}"
                        </span>
                      </div>
                      <span style={{ color: 'var(--na-accent-cool)', fontWeight: 600 }}>
                        {item.similarity.toFixed(4)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                color: 'var(--na-muted)',
                fontSize: 'var(--na-text-xs)',
                padding: 'var(--na-space-4)'
              }}
            >
              Hover over any point in the 3D embedding cloud to inspect its 8 nearest semantic neighbors by cosine similarity.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
