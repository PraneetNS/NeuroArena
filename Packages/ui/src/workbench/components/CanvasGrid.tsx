import React, { useRef, useState } from 'react';
import { GraphNode as GraphNodeType, GraphEdge, PortDefinition } from '../types.js';
import { GraphNode } from './GraphNode.js';

export interface CanvasGridProps {
  nodes: GraphNodeType[];
  edges: GraphEdge[];
  selectedNodeIds: string[];
  isRunning: boolean;
  onSelectNode: (e: React.MouseEvent, id: string) => void;
  onMoveNode: (id: string, dx: number, dy: number) => void;
  onConnectPorts: (sourceNodeId: string, sourcePortId: string, targetNodeId: string, targetPortId: string) => void;
  onOpenCodex: (node: GraphNodeType) => void;
  onClearSelection: () => void;
}

export const CanvasGrid: React.FC<CanvasGridProps> = ({
  nodes,
  edges,
  selectedNodeIds,
  isRunning,
  onSelectNode,
  onMoveNode,
  onConnectPorts,
  onOpenCodex,
  onClearSelection
}) => {
  // Pan and Zoom transform state
  const [pan, setPan] = useState({ x: 80, y: 80 });
  const [zoom, setZoom] = useState(1.0);

  const containerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const startPanPos = useRef({ x: 0, y: 0 });

  // Edge drag state
  const [draggingEdge, setDraggingEdge] = useState<{
    sourceNodeId: string;
    sourcePort: PortDefinition;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // Box selection marquee state
  const [marquee, setMarquee] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);

  // Wheel cursor-anchored zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(2.5, Math.max(0.25, zoom * zoomFactor));

    // Anchor zoom around cursor position:
    // (mouseX - pan.x) / zoom = (mouseX - newPan.x) / newZoom
    const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  // Canvas pan / marquee drag handlers
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target !== containerRef.current && !(e.target as HTMLElement).classList.contains('na-workbench-grid-bg')) {
      return;
    }

    if (e.shiftKey) {
      // Start marquee selection
      setMarquee({
        startX: (e.clientX - pan.x) / zoom,
        startY: (e.clientY - pan.y) / zoom,
        currentX: (e.clientX - pan.x) / zoom,
        currentY: (e.clientY - pan.y) / zoom
      });
    } else {
      // Pan canvas
      isPanning.current = true;
      startPanPos.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      onClearSelection();
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isPanning.current) {
      setPan({
        x: e.clientX - startPanPos.current.x,
        y: e.clientY - startPanPos.current.y
      });
    } else if (marquee) {
      setMarquee((prev) =>
        prev
          ? {
              ...prev,
              currentX: (e.clientX - pan.x) / zoom,
              currentY: (e.clientY - pan.y) / zoom
            }
          : null
      );
    } else if (draggingEdge) {
      setDraggingEdge((prev) =>
        prev
          ? {
              ...prev,
              currentX: (e.clientX - pan.x) / zoom,
              currentY: (e.clientY - pan.y) / zoom
            }
          : null
      );
    }
  };

  const handleCanvasMouseUp = () => {
    isPanning.current = false;
    setMarquee(null);
    setDraggingEdge(null);
  };

  // Port connection initiation
  const handlePortMouseDown = (e: React.MouseEvent, nodeId: string, port: PortDefinition) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    // Output port is on right side
    const startX = node.x + node.width;
    const portIndex = node.outputs.findIndex((p) => p.id === port.id);
    const startY = node.y + 70 + portIndex * 24;

    setDraggingEdge({
      sourceNodeId: nodeId,
      sourcePort: port,
      startX,
      startY,
      currentX: (e.clientX - pan.x) / zoom,
      currentY: (e.clientY - pan.y) / zoom
    });
  };

  // Port connection drop
  const handlePortMouseUp = (targetNodeId: string, targetPort: PortDefinition) => {
    if (!draggingEdge) return;

    if (draggingEdge.sourceNodeId !== targetNodeId) {
      onConnectPorts(
        draggingEdge.sourceNodeId,
        draggingEdge.sourcePort.id,
        targetNodeId,
        targetPort.id
      );
    }
    setDraggingEdge(null);
  };

  // Helper to compute node port coordinates
  const getPortCoordinates = (nodeId: string, portId: string, isInput: boolean) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };

    if (isInput) {
      const idx = node.inputs.findIndex((p) => p.id === portId);
      return {
        x: node.x,
        y: node.y + 70 + (idx >= 0 ? idx * 24 : 0)
      };
    } else {
      const idx = node.outputs.findIndex((p) => p.id === portId);
      return {
        x: node.x + node.width,
        y: node.y + 70 + (idx >= 0 ? idx * 24 : 0)
      };
    }
  };

  // Bezier curve path helper
  const getBezierPath = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = Math.abs(x2 - x1) * 0.55;
    const cx1 = x1 + Math.max(30, dx);
    const cy1 = y1;
    const cx2 = x2 - Math.max(30, dx);
    const cy2 = y2;
    return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
  };

  // Type color mapping for connection lines
  const getEdgeColor = (type: string) => {
    switch (type) {
      case 'Dataset':
        return '#4FB3A9';
      case 'TokenStream':
        return '#E8A33D';
      case 'Model':
        return '#B48EE0';
      case 'Metrics':
        return '#6BBF7A';
      default:
        return '#9AA3AE';
    }
  };

  // Minimap bounds calculation
  const getGraphBounds = () => {
    if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 1000, maxY: 600 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const n of nodes) {
      minX = Math.min(minX, n.x - 50);
      minY = Math.min(minY, n.y - 50);
      maxX = Math.max(maxX, n.x + n.width + 50);
      maxY = Math.max(maxY, n.y + n.height + 50);
    }

    return { minX, minY, maxX: Math.max(minX + 500, maxX), maxY: Math.max(minY + 300, maxY) };
  };

  const bounds = getGraphBounds();
  const boundsW = bounds.maxX - bounds.minX;
  const boundsH = bounds.maxY - bounds.minY;
  const mmScale = Math.min(170 / boundsW, 120 / boundsH);

  return (
    <div
      ref={containerRef}
      className="na-workbench-canvas-container"
      onWheel={handleWheel}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
    >
      {/* Blueprint Grid Background */}
      <div
        className="na-workbench-grid-bg"
        style={{
          backgroundPosition: `${pan.x}px ${pan.y}px`,
          backgroundSize: `${24 * zoom}px ${24 * zoom}px, ${120 * zoom}px ${120 * zoom}px, ${120 * zoom}px ${120 * zoom}px`
        }}
      />

      {/* World Plane transformed by pan and zoom */}
      <div
        className="na-workbench-world"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
        }}
      >
        {/* SVG Connections & Particle Flows */}
        <svg
          className="na-workbench-edges-svg"
          style={{ width: '4000px', height: '4000px', transform: 'translate(0, 0)' }}
        >
          {edges.map((edge) => {
            const p1 = getPortCoordinates(edge.sourceNodeId, edge.sourcePortId, false);
            const p2 = getPortCoordinates(edge.targetNodeId, edge.targetPortId, true);
            const pathData = getBezierPath(p1.x, p1.y, p2.x, p2.y);
            const edgeCol = getEdgeColor(edge.type);

            return (
              <g key={edge.id}>
                {/* Glow/Underline for edge */}
                <path d={pathData} stroke="rgba(0,0,0,0.5)" strokeWidth="4.5" fill="none" />
                {/* Main colored bezier edge */}
                <path
                  d={pathData}
                  stroke={edgeCol}
                  className="na-edge-path"
                />
                {/* Active Data Flow Particles (animated dasharray when runtime active) */}
                {isRunning && (
                  <path
                    d={pathData}
                    stroke="#FFFFFF"
                    strokeWidth="2.5"
                    className="na-edge-flow-particle"
                    fill="none"
                  />
                )}
              </g>
            );
          })}

          {/* Interactive Dragging Edge */}
          {draggingEdge && (
            <path
              d={getBezierPath(
                draggingEdge.startX,
                draggingEdge.startY,
                draggingEdge.currentX,
                draggingEdge.currentY
              )}
              stroke={getEdgeColor(draggingEdge.sourcePort.type)}
              strokeWidth="2.5"
              strokeDasharray="4 4"
              fill="none"
            />
          )}
        </svg>

        {/* HTML Nodes on Canvas */}
        {nodes.map((node) => (
          <GraphNode
            key={node.id}
            node={node}
            isSelected={selectedNodeIds.includes(node.id)}
            zoom={zoom}
            onSelect={onSelectNode}
            onMove={onMoveNode}
            onPortMouseDown={handlePortMouseDown}
            onPortMouseUp={handlePortMouseUp}
            onOpenCodex={onOpenCodex}
          />
        ))}

        {/* Box Selection Marquee */}
        {marquee && (
          <div
            style={{
              position: 'absolute',
              left: `${Math.min(marquee.startX, marquee.currentX)}px`,
              top: `${Math.min(marquee.startY, marquee.currentY)}px`,
              width: `${Math.abs(marquee.currentX - marquee.startX)}px`,
              height: `${Math.abs(marquee.currentY - marquee.startY)}px`,
              backgroundColor: 'rgba(232, 163, 61, 0.12)',
              border: '1px solid var(--na-accent)',
              borderRadius: '2px',
              pointerEvents: 'none'
            }}
          />
        )}
      </div>

      {/* Minimap in Bottom-Right */}
      <div
        className="na-workbench-minimap"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const clickY = e.clientY - rect.top;
          const worldTargetX = bounds.minX + clickX / mmScale;
          const worldTargetY = bounds.minY + clickY / mmScale;
          setPan({
            x: (containerRef.current?.clientWidth || 800) * 0.5 - worldTargetX * zoom,
            y: (containerRef.current?.clientHeight || 600) * 0.5 - worldTargetY * zoom
          });
        }}
      >
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
          {nodes.map((n) => (
            <rect
              key={`mm-${n.id}`}
              x={(n.x - bounds.minX) * mmScale}
              y={(n.y - bounds.minY) * mmScale}
              width={n.width * mmScale}
              height={n.height * mmScale}
              fill={selectedNodeIds.includes(n.id) ? 'var(--na-accent)' : 'var(--na-line-strong)'}
              rx="1"
            />
          ))}
        </svg>

        {/* Current Viewport Box on Minimap */}
        <div
          className="na-minimap-viewport"
          style={{
            left: `${(-pan.x / zoom - bounds.minX) * mmScale}px`,
            top: `${(-pan.y / zoom - bounds.minY) * mmScale}px`,
            width: `${((containerRef.current?.clientWidth || 800) / zoom) * mmScale}px`,
            height: `${((containerRef.current?.clientHeight || 600) / zoom) * mmScale}px`
          }}
        />
      </div>
    </div>
  );
};
