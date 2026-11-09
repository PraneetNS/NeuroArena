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

export type EmbeddingViewMode = '3d' | '2d_pc2_pc3' | 'top10_variance';

export const EmbeddingExplorer: React.FC<EmbeddingExplorerProps> = ({
  tokEmb,
  vocabSize,
  dModel,
  tokenStrings = [],
  checkpointSnapshots = []
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // View Mode: 3D point cloud, 2D PC2 vs PC3, or Top 10 Variance bars
  const [viewMode, setViewMode] = useState<EmbeddingViewMode>('3d');
  const [isAutoFlyThrough, setIsAutoFlyThrough] = useState<boolean>(false);

  // PCA state (calculates top 10 components)
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

  // 1. Compute Base PCA on primary embedding matrix (top 10 components)
  useEffect(() => {
    const res = computeEmbeddingPca(tokEmb, vocabSize, dModel, 10, 45);
    setPcaResult(res);
  }, [tokEmb, vocabSize, dModel]);

  // 2. Compute 3D Coordinates based on scrubber / snapshot selection
  const currentCoords = useMemo(() => {
    if (!pcaResult) return null;

    if (checkpointSnapshots.length > 0) {
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

  // 5. Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentCoords || !pcaResult) return;
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

      // Automatic camera fly-through rotation when enabled in 3D mode
      if (viewMode === '3d' && isAutoFlyThrough && !cameraRef.current.isDragging) {
        cameraRef.current.rotY += 0.005;
      }

      const categoryColors: Record<TokenCategory, string> = {
        character_name: '#E8A33D',
        capitalized: '#4FB3A9',
        lowercase: '#E8E4DA',
        subword: '#E0B04A',
        punctuation: '#9AA3AE',
        whitespace: '#656E7B'
      };

      if (viewMode === 'top10_variance') {
        // --- VIEW 1: TOP 10 VARIANCES BAR CHART ---
        const padX = 60;
        const padY = 50;
        const chartW = width - padX * 2;
        const chartH = height - padY * 2;
        const ratios = pcaResult.explainedVarianceRatio.slice(0, 10);
        const maxRatio = Math.max(0.35, ratios[0] || 0.3);
        const barH = Math.min(32, (chartH / ratios.length) - 8);

        ctx.font = 'bold 13px "IBM Plex Mono", monospace';
        ctx.fillStyle = '#E2E8F0';
        ctx.textAlign = 'left';
        ctx.fillText('TOP 10 PRINCIPAL COMPONENT VARIANCES (EIGENVALUES)', padX, padY - 20);

        let cumSum = 0;
        ratios.forEach((ratio, idx) => {
          cumSum += ratio;
          const y = padY + idx * (barH + 8);
          const barW = (ratio / maxRatio) * (chartW - 140);

          ctx.font = '11px "IBM Plex Mono", monospace';
          ctx.fillStyle = idx < 3 ? '#4FB3A9' : '#94A3B8';
          ctx.textAlign = 'right';
          ctx.fillText(`PC${idx + 1}`, padX + 30, y + barH * 0.7);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
          ctx.fillRect(padX + 40, y, chartW - 140, barH);

          ctx.fillStyle = idx < 3 ? '#4FB3A9' : '#334155';
          ctx.fillRect(padX + 40, y, barW, barH);

          ctx.fillStyle = '#E2E8F0';
          ctx.textAlign = 'left';
          ctx.fillText(
            `${(ratio * 100).toFixed(1)}% (cum: ${(cumSum * 100).toFixed(1)}%)`,
            padX + 50 + barW,
            y + barH * 0.7
          );
        });

      } else if (viewMode === '2d_pc2_pc3') {
        // --- VIEW 2: 2D PLOT OF PC2 VS PC3 ---
        const cx = width / 2;
        const cy = height / 2;
        const scale2D = 180;

        ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(40, cy);
        ctx.lineTo(width - 40, cy);
        ctx.moveTo(cx, 40);
        ctx.lineTo(cx, height - 40);
        ctx.stroke();

        ctx.font = '10px "IBM Plex Mono", monospace';
        ctx.fillStyle = '#64748B';
        ctx.textAlign = 'right';
        ctx.fillText('PC2 →', width - 45, cy - 8);
        ctx.textAlign = 'center';
        ctx.fillText('↑ PC3', cx + 24, 52);

        for (let v = 0; v < vocabSize; v++) {
          const cat = tokenCategories[v];
          if (selectedCategory !== 'all' && cat !== selectedCategory) continue;

          const pc2 = currentCoords[v * 3 + 1];
          const pc3 = currentCoords[v * 3 + 2];

          const sx = cx + pc2 * scale2D;
          const sy = cy - pc3 * scale2D;

          const isHovered = hoveredTokenIdx === v;
          const isNeighbor = nearestNeighbors.some((n) => n.tokenId === v);

          const radius = isHovered ? 6 : isNeighbor ? 4.5 : 2.5;
          const color = isHovered
            ? '#F5B453'
            : isNeighbor
            ? '#62C5BB'
            : categoryColors[cat];

          ctx.beginPath();
          ctx.arc(sx, sy, radius, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();

          if (isHovered || isNeighbor) {
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            ctx.font = '11px "IBM Plex Mono", monospace';
            ctx.fillStyle = '#FFFFFF';
            const tokStr = tokenStrings[v] || `[${v}]`;
            ctx.fillText(tokStr, sx + 8, sy + 4);
          }
        }

      } else {
        // --- VIEW 3: 3D POINT CLOUD (PERSPECTIVE PROJECTION) ---
        const { rotX, rotY, zoom } = cameraRef.current;
        const cosX = Math.cos(rotX);
        const sinX = Math.sin(rotX);
        const cosY = Math.cos(rotY);
        const sinY = Math.sin(rotY);

        const cx = width / 2;
        const cy = height / 2;

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

          const x1 = cosY * x + sinY * z;
          const z1 = -sinY * x + cosY * z;
          const y2 = cosX * y - sinX * z1;
          const z2 = sinX * y + cosX * z1;

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

        projected.sort((a, b) => b.depth - a.depth);

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

            ctx.font = '11px "IBM Plex Mono", monospace';
            ctx.fillStyle = '#FFFFFF';
            const tokStr = tokenStrings[pt.idx] || `[${pt.idx}]`;
            ctx.fillText(tokStr, pt.sx + 8, pt.sy + 4);
          }
        }

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
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    currentCoords,
    vocabSize,
    tokenCategories,
    selectedCategory,
    hoveredTokenIdx,
    nearestNeighbors,
    tokenStrings,
    viewMode,
    isAutoFlyThrough,
    pcaResult
  ]);

  // Mouse drag handlers for 3D Orbiting
  const handleMouseDown = (e: React.MouseEvent) => {
    if (viewMode !== '3d') return;
    cameraRef.current.isDragging = true;
    cameraRef.current.lastMouseX = e.clientX;
    cameraRef.current.lastMouseY = e.clientY;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !currentCoords) return;

    if (viewMode === '3d') {
      if (cameraRef.current.isDragging) {
        const dx = e.clientX - cameraRef.current.lastMouseX;
        const dy = e.clientY - cameraRef.current.lastMouseY;
        cameraRef.current.rotY += dx * 0.008;
        cameraRef.current.rotX += dy * 0.008;
        cameraRef.current.lastMouseX = e.clientX;
        cameraRef.current.lastMouseY = e.clientY;
      } else {
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
        let minDistance = 14;

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
    } else if (viewMode === '2d_pc2_pc3') {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const scale2D = 180;

      let closestIdx: number | null = null;
      let minDistance = 12;

      for (let v = 0; v < vocabSize; v++) {
        const pc2 = currentCoords[v * 3 + 1];
        const pc3 = currentCoords[v * 3 + 2];
        const sx = cx + pc2 * scale2D;
        const sy = cy - pc3 * scale2D;

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
    if (viewMode !== '3d') return;
    e.preventDefault();
    cameraRef.current.zoom = Math.max(8, Math.min(60, cameraRef.current.zoom - e.deltaY * 0.02));
  };

  const top3VariancePct = pcaResult
    ? Math.round(
        (pcaResult.explainedVarianceRatio[0] +
          pcaResult.explainedVarianceRatio[1] +
          pcaResult.explainedVarianceRatio[2]) *
          100
      )
    : 38;

  return (
    <div style={{ display: 'flex', gap: 'var(--na-space-4)', height: '100%', overflow: 'hidden' }}>
      {/* Canvas Viewport */}
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
            backgroundColor: 'var(--na-raised)',
            flexWrap: 'wrap',
            gap: 'var(--na-space-2)'
          }}
        >
          {/* View Mode & Variance Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--na-space-3)' }}>
            <div
              style={{
                display: 'flex',
                backgroundColor: 'var(--na-surface)',
                borderRadius: 'var(--na-radius-sm)',
                padding: '2px',
                border: '1px solid var(--na-line)'
              }}
            >
              <button
                onClick={() => setViewMode('3d')}
                style={{
                  padding: '3px 8px',
                  fontSize: '11px',
                  fontFamily: 'var(--na-font-mono)',
                  borderRadius: 'var(--na-radius-sm)',
                  backgroundColor: viewMode === '3d' ? 'var(--na-accent)' : 'transparent',
                  color: viewMode === '3d' ? 'var(--na-ink)' : 'var(--na-text)',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                3D Cloud
              </button>
              <button
                onClick={() => setViewMode('2d_pc2_pc3')}
                style={{
                  padding: '3px 8px',
                  fontSize: '11px',
                  fontFamily: 'var(--na-font-mono)',
                  borderRadius: 'var(--na-radius-sm)',
                  backgroundColor: viewMode === '2d_pc2_pc3' ? 'var(--na-accent-cool)' : 'transparent',
                  color: viewMode === '2d_pc2_pc3' ? 'var(--na-ink)' : 'var(--na-text)',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                2D (PC2 vs PC3)
              </button>
              <button
                onClick={() => setViewMode('top10_variance')}
                style={{
                  padding: '3px 8px',
                  fontSize: '11px',
                  fontFamily: 'var(--na-font-mono)',
                  borderRadius: 'var(--na-radius-sm)',
                  backgroundColor: viewMode === 'top10_variance' ? 'var(--na-warning)' : 'transparent',
                  color: viewMode === 'top10_variance' ? 'var(--na-ink)' : 'var(--na-text)',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Top 10 Variances
              </button>
            </div>

            {viewMode === '3d' && (
              <button
                onClick={() => setIsAutoFlyThrough(!isAutoFlyThrough)}
                style={{
                  padding: '3px 8px',
                  fontSize: '11px',
                  fontFamily: 'var(--na-font-mono)',
                  borderRadius: 'var(--na-radius-sm)',
                  backgroundColor: isAutoFlyThrough ? 'var(--na-accent-cool)' : 'var(--na-surface)',
                  color: isAutoFlyThrough ? 'var(--na-ink)' : 'var(--na-text)',
                  border: '1px solid var(--na-line)',
                  cursor: 'pointer'
                }}
              >
                {isAutoFlyThrough ? '⏸ Pause Fly-Through' : '▶ Camera Fly-Through'}
              </button>
            )}

            {/* Exact requirement statement */}
            <span
              style={{
                fontFamily: 'var(--na-font-mono)',
                fontSize: 'var(--na-text-xs)',
                color: 'var(--na-accent-cool)',
                fontWeight: 600
              }}
            >
              top 3 components explain {top3VariancePct} percent of variance
            </span>
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

        {/* Interactive Canvas */}
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
            cursor: viewMode === '3d' ? (cameraRef.current.isDragging ? 'grabbing' : 'grab') : 'default'
          }}
        />

        {/* Checkpoint Scrubber Bar */}
        {checkpointSnapshots.length > 0 && viewMode === '3d' && (
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
          backgroundColor: 'var(--na-surface)',
          border: '1px solid var(--na-line)',
          borderRadius: 'var(--na-radius-base)',
          padding: 'var(--na-space-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--na-space-3)',
          overflowY: 'auto'
        }}
      >
        <div
          style={{
            fontFamily: 'var(--na-font-display)',
            fontSize: 'var(--na-text-sm)',
            fontWeight: 600,
            color: 'var(--na-text)'
          }}
        >
          Nearest Neighbors (Cosine)
        </div>

        {hoveredTokenIdx !== null ? (
          <>
            <div
              style={{
                padding: 'var(--na-space-3)',
                backgroundColor: 'var(--na-raised)',
                borderRadius: 'var(--na-radius-sm)',
                border: '1px solid var(--na-line)'
              }}
            >
              <div style={{ fontSize: '11px', color: 'var(--na-muted)' }}>Selected Token:</div>
              <div
                style={{
                  fontFamily: 'var(--na-font-mono)',
                  fontSize: 'var(--na-text-base)',
                  color: 'var(--na-accent)',
                  fontWeight: 600
                }}
              >
                "{tokenStrings[hoveredTokenIdx] || `[${hoveredTokenIdx}]`}"
                <span style={{ fontSize: '11px', color: 'var(--na-muted)', marginLeft: '8px' }}>
                  (id: {hoveredTokenIdx})
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--na-muted)', marginTop: '4px' }}>
                Category: <strong>{CATEGORY_METAS[tokenCategories[hoveredTokenIdx]].label}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--na-space-2)' }}>
              <div style={{ fontSize: '11px', color: 'var(--na-muted)' }}>
                8 Closest Vectors in 128D Embedding Space:
              </div>

              {nearestNeighbors.map((n, idx) => (
                <div
                  key={n.tokenId}
                  style={{
                    padding: 'var(--na-space-2) var(--na-space-3)',
                    backgroundColor: 'var(--na-raised)',
                    borderRadius: 'var(--na-radius-sm)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: '1px solid var(--na-line)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--na-muted)' }}>#{idx + 1}</span>
                    <span
                      style={{
                        fontFamily: 'var(--na-font-mono)',
                        fontSize: 'var(--na-text-xs)',
                        color: 'var(--na-text)',
                        fontWeight: 600
                      }}
                    >
                      "{tokenStrings[n.tokenId] || `[${n.tokenId}]`}"
                    </span>
                  </div>
                  <span
                    style={{
                      fontFamily: 'var(--na-font-mono)',
                      fontSize: '11px',
                      color: 'var(--na-accent-cool)'
                    }}
                  >
                    {n.similarity.toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ color: 'var(--na-muted)', fontSize: 'var(--na-text-xs)' }}>
            Hover over any token in the 3D or 2D scatter cloud to inspect its 8 nearest semantic/syntactic neighbors by cosine similarity.
          </div>
        )}
      </div>
    </div>
  );
};
