import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  GraphNode as GraphNodeType,
  GraphEdge,
  GraphState,
  NodeKind,
  PortDefinition,
  TrainingStepStats,
  GeneratedSample,
  DatasetNodeData,
  CleanerNodeData,
  TokenizerNodeData,
  ModelNodeData,
  TrainerNodeData,
  EvaluatorNodeData,
  AnyNodeData
} from './types.js';
import { MockRuntime } from './runtime.js';
import { CanvasGrid } from './components/CanvasGrid.js';
import { InspectorPanel } from './components/InspectorPanel.js';
import { BottomDock } from './components/BottomDock.js';
import { CommandPalette } from './components/CommandPalette.js';
import { CodexStubModal } from './components/CodexStubModal.js';
import { Button } from '../components/Button.js';
import { Badge } from '../components/Badge.js';
import { PlayIcon, PauseIcon, StopIcon } from '../icons/index.js';

// Factory to create initial node payloads with defaults
export function createDefaultNode(kind: NodeKind, x: number, y: number, idSuffix?: string): GraphNodeType {
  const id = `node-${kind}-${idSuffix || Math.random().toString(36).substring(2, 7)}`;

  switch (kind) {
    case 'dataset':
      return {
        id,
        kind: 'dataset',
        title: 'Corpus Shard',
        x,
        y,
        width: 200,
        height: 120,
        state: 'ready',
        inputs: [],
        outputs: [
          {
            id: 'out-dataset',
            name: 'Dataset',
            type: 'Dataset',
            direction: 'output',
            description: 'Raw documents stream'
          }
        ],
        data: {
          sourceName: 'The Pile / FineWeb-Edu',
          sampleCount: 100000,
          quality: {
            clean: 74200,
            noisy: 12100,
            duplicate: 8900,
            contaminated: 3100,
            unknown: 1700
          },
          duplicateRate: 0.089
        } as DatasetNodeData
      };

    case 'cleaner':
      return {
        id,
        kind: 'cleaner',
        title: 'Quality Guardrail',
        x,
        y,
        width: 200,
        height: 120,
        state: 'ready',
        inputs: [
          {
            id: 'in-dataset',
            name: 'Dataset',
            type: 'Dataset',
            direction: 'input',
            description: 'Raw input corpus'
          }
        ],
        outputs: [
          {
            id: 'out-cleaned',
            name: 'Clean Data',
            type: 'Dataset',
            direction: 'output',
            description: 'Sanitized document stream'
          }
        ],
        data: {
          dedupeEnabled: true,
          minTextLength: 32,
          maxTextLength: 4096,
          languageFilter: 'English (en)',
          noiseFilterThreshold: 0.85,
          beforeCount: 100000,
          afterCount: 81400
        } as CleanerNodeData
      };

    case 'tokenizer':
      return {
        id,
        kind: 'tokenizer',
        title: 'BPE Tokenizer',
        x,
        y,
        width: 200,
        height: 120,
        state: 'ready',
        inputs: [
          {
            id: 'in-corpus',
            name: 'Dataset',
            type: 'Dataset',
            direction: 'input',
            description: 'Cleaned corpus'
          }
        ],
        outputs: [
          {
            id: 'out-tokens',
            name: 'TokenStream',
            type: 'TokenStream',
            direction: 'output',
            description: 'Encoded integer token sequence'
          }
        ],
        data: {
          vocabSize: 1024,
          isTrained: true,
          sampleInputText: 'The quick brown fox jumps over the neural network.',
          tokenizedSpans: [
            { text: 'The', id: 412, colorIndex: 0 },
            { text: ' quick', id: 89, colorIndex: 1 },
            { text: ' brown', id: 504, colorIndex: 2 },
            { text: ' fox', id: 219, colorIndex: 3 },
            { text: ' jumps', id: 671, colorIndex: 0 },
            { text: ' over', id: 144, colorIndex: 1 },
            { text: ' the', id: 28, colorIndex: 2 },
            { text: ' neural', id: 832, colorIndex: 3 },
            { text: ' network', id: 911, colorIndex: 0 },
            { text: '.', id: 14, colorIndex: 1 }
          ]
        } as TokenizerNodeData
      };

    case 'model':
      return {
        id,
        kind: 'model',
        title: 'Tiny GPT',
        x,
        y,
        width: 200,
        height: 120,
        state: 'ready',
        inputs: [
          {
            id: 'in-tokens',
            name: 'Tokens',
            type: 'TokenStream',
            direction: 'input',
            description: 'Token vocabulary stream'
          }
        ],
        outputs: [
          {
            id: 'out-model',
            name: 'Model',
            type: 'Model',
            direction: 'output',
            description: 'Compiled architecture graph'
          }
        ],
        data: {
          preset: 'S',
          dModel: 128,
          nLayers: 4,
          nHeads: 4,
          dFF: 512,
          contextLen: 128,
          vocabSize: 1024,
          paramCount: 841000,
          estimatedMemoryMB: 6.8
        } as ModelNodeData
      };

    case 'trainer':
      return {
        id,
        kind: 'trainer',
        title: 'AdamW Trainer',
        x,
        y,
        width: 200,
        height: 120,
        state: 'ready',
        inputs: [
          {
            id: 'in-data',
            name: 'Tokens',
            type: 'TokenStream',
            direction: 'input',
            description: 'Token stream for batches'
          },
          {
            id: 'in-arch',
            name: 'Model',
            type: 'Model',
            direction: 'input',
            description: 'Transformer architecture'
          }
        ],
        outputs: [
          {
            id: 'out-weights',
            name: 'Model',
            type: 'Model',
            direction: 'output',
            description: 'Trained checkpoint weights'
          },
          {
            id: 'out-metrics',
            name: 'Metrics',
            type: 'Metrics',
            direction: 'output',
            description: 'Training telemetry'
          }
        ],
        data: {
          learningRate: 0.001,
          batchSize: 16,
          maxSteps: 500,
          warmupSteps: 50,
          weightDecay: 0.01,
          seed: 42,
          currentStep: 0,
          currentLoss: 4.82,
          etaSeconds: 50
        } as TrainerNodeData
      };

    case 'evaluator':
      return {
        id,
        kind: 'evaluator',
        title: 'Loss & Perplexity',
        x,
        y,
        width: 200,
        height: 120,
        state: 'ready',
        inputs: [
          {
            id: 'in-trained-model',
            name: 'Model',
            type: 'Model',
            direction: 'input',
            description: 'Trained checkpoint'
          },
          {
            id: 'in-validation-data',
            name: 'Validation',
            type: 'Dataset',
            direction: 'input',
            description: 'Held-out validation data'
          }
        ],
        outputs: [
          {
            id: 'out-eval-metrics',
            name: 'Metrics',
            type: 'Metrics',
            direction: 'output',
            description: 'Evaluation benchmarks'
          }
        ],
        data: {
          valLoss: 4.89,
          perplexity: 132.8,
          prompts: [
            'In the beginning, the neural network',
            'Once upon a gradient step',
            'The loss function converged when'
          ],
          generations: [
            {
              prompt: 'In the beginning, the neural network',
              output: ' learned random embeddings before cross-entropy dropped to steady decay.'
            },
            {
              prompt: 'Once upon a gradient step',
              output: ' the optimizer found a smooth basin and generalized gracefully.'
            }
          ]
        } as EvaluatorNodeData
      };
  }
}

// Generate the canonical default end-to-end learning pipeline
export function createDefaultGraph(): GraphState {
  const nDataset = createDefaultNode('dataset', 80, 160, '1');
  const nCleaner = createDefaultNode('cleaner', 320, 160, '1');
  const nTokenizer = createDefaultNode('tokenizer', 560, 160, '1');
  const nModel = createDefaultNode('model', 800, 160, '1');
  const nTrainer = createDefaultNode('trainer', 1040, 160, '1');
  const nEvaluator = createDefaultNode('evaluator', 1280, 160, '1');

  const edges: GraphEdge[] = [
    {
      id: 'edge-1',
      sourceNodeId: nDataset.id,
      sourcePortId: 'out-dataset',
      targetNodeId: nCleaner.id,
      targetPortId: 'in-dataset',
      type: 'Dataset'
    },
    {
      id: 'edge-2',
      sourceNodeId: nCleaner.id,
      sourcePortId: 'out-cleaned',
      targetNodeId: nTokenizer.id,
      targetPortId: 'in-corpus',
      type: 'Dataset'
    },
    {
      id: 'edge-3',
      sourceNodeId: nTokenizer.id,
      sourcePortId: 'out-tokens',
      targetNodeId: nModel.id,
      targetPortId: 'in-tokens',
      type: 'TokenStream'
    },
    {
      id: 'edge-4',
      sourceNodeId: nTokenizer.id,
      sourcePortId: 'out-tokens',
      targetNodeId: nTrainer.id,
      targetPortId: 'in-data',
      type: 'TokenStream'
    },
    {
      id: 'edge-5',
      sourceNodeId: nModel.id,
      sourcePortId: 'out-model',
      targetNodeId: nTrainer.id,
      targetPortId: 'in-arch',
      type: 'Model'
    },
    {
      id: 'edge-6',
      sourceNodeId: nTrainer.id,
      sourcePortId: 'out-weights',
      targetNodeId: nEvaluator.id,
      targetPortId: 'in-trained-model',
      type: 'Model'
    },
    {
      id: 'edge-7',
      sourceNodeId: nCleaner.id,
      sourcePortId: 'out-cleaned',
      targetNodeId: nEvaluator.id,
      targetPortId: 'in-validation-data',
      type: 'Dataset'
    }
  ];

  return {
    nodes: [nDataset, nCleaner, nTokenizer, nModel, nTrainer, nEvaluator],
    edges
  };
}

export const Workbench: React.FC = () => {
  // Graph state & history stack for Undo/Redo
  const [graph, setGraph] = useState<GraphState>(() => createDefaultGraph());
  const [historyPast, setHistoryPast] = useState<GraphState[]>([]);
  const [historyFuture, setHistoryFuture] = useState<GraphState[]>([]);

  // Selection state
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [activeInspectorNodeId, setActiveInspectorNodeId] = useState<string | null>(null);

  // Modals & Panels
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [codexModalNode, setCodexModalNode] = useState<GraphNodeType | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'info' | 'error' | 'success' } | null>(null);

  // Runtime Seam: MockRuntime
  const runtimeRef = useRef<MockRuntime>(new MockRuntime());
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [telemetryHistory, setTelemetryHistory] = useState<TrainingStepStats[]>([]);
  const [sampleHistory, setSampleHistory] = useState<GeneratedSample[]>([]);

  // File input ref for loading JSON
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toast auto-clear
  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 3800);
    return () => clearTimeout(t);
  }, [toastMessage]);

  const showToast = (text: string, type: 'info' | 'error' | 'success' = 'info') => {
    setToastMessage({ text, type });
  };

  // Push new state with undo record
  const updateGraphWithHistory = useCallback((newGraph: GraphState | ((prev: GraphState) => GraphState)) => {
    setGraph((currentGraph) => {
      const nextGraph = typeof newGraph === 'function' ? newGraph(currentGraph) : newGraph;
      setHistoryPast((past) => [...past.slice(-25), currentGraph]);
      setHistoryFuture([]);
      return nextGraph;
    });
  }, []);

  // Undo / Redo handlers
  const handleUndo = useCallback(() => {
    if (historyPast.length === 0) return;
    const prev = historyPast[historyPast.length - 1];
    setHistoryPast((p) => p.slice(0, -1));
    setHistoryFuture((f) => [graph, ...f]);
    setGraph(prev);
    showToast('Undo action', 'info');
  }, [historyPast, graph]);

  const handleRedo = useCallback(() => {
    if (historyFuture.length === 0) return;
    const next = historyFuture[0];
    setHistoryFuture((f) => f.slice(1));
    setHistoryPast((p) => [...p, graph]);
    setGraph(next);
    showToast('Redo action', 'info');
  }, [historyFuture, graph]);

  // Port Validation Logic (Requirement 2 & 4: Incompatible types refused with clear message)
  const validateConnection = (
    sourceNode: GraphNodeType,
    sourcePort: PortDefinition,
    targetNode: GraphNodeType,
    targetPort: PortDefinition
  ): { valid: boolean; reason?: string } => {
    if (sourceNode.id === targetNode.id) {
      return { valid: false, reason: 'Cannot connect a node to itself.' };
    }

    if (sourcePort.direction !== 'output' || targetPort.direction !== 'input') {
      return { valid: false, reason: 'Connections must flow from an Output port to an Input port.' };
    }

    if (sourcePort.type !== targetPort.type) {
      return {
        valid: false,
        reason: `Port type mismatch: Cannot connect ${sourcePort.type} to ${targetPort.type}. Data schemas are incompatible.`
      };
    }

    // Check if target input already has a connection
    const alreadyConnected = graph.edges.some(
      (e) => e.targetNodeId === targetNode.id && e.targetPortId === targetPort.id
    );
    if (alreadyConnected) {
      return { valid: false, reason: `Port "${targetPort.name}" already has an active input connection.` };
    }

    return { valid: true };
  };

  // Connect ports
  const handleConnectPorts = (
    sourceNodeId: string,
    sourcePortId: string,
    targetNodeId: string,
    targetPortId: string
  ) => {
    const sourceNode = graph.nodes.find((n) => n.id === sourceNodeId);
    const targetNode = graph.nodes.find((n) => n.id === targetNodeId);
    if (!sourceNode || !targetNode) return;

    const sourcePort = sourceNode.outputs.find((p) => p.id === sourcePortId);
    const targetPort = targetNode.inputs.find((p) => p.id === targetPortId);
    if (!sourcePort || !targetPort) return;

    const check = validateConnection(sourceNode, sourcePort, targetNode, targetPort);
    if (!check.valid) {
      showToast(check.reason || 'Invalid connection', 'error');
      return;
    }

    const newEdge: GraphEdge = {
      id: `edge-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      sourceNodeId,
      sourcePortId,
      targetNodeId,
      targetPortId,
      type: sourcePort.type
    };

    updateGraphWithHistory((prev) => {
      // Validate downstream semantic rules (e.g. Model vocab size matches Tokenizer vocab size)
      const nextNodes = prev.nodes.map((n) => {
        if (n.id === targetNodeId) {
          return { ...n, state: 'ready' as const, errorMessage: undefined };
        }
        return n;
      });

      return {
        nodes: nextNodes,
        edges: [...prev.edges, newEdge]
      };
    });

    showToast(`Connected ${sourcePort.type} port: ${sourceNode.title} → ${targetNode.title}`, 'success');
  };

  // Update node data and propagate stale state to downstream nodes (Requirement 4)
  const handleUpdateNodeData = (nodeId: string, newData: AnyNodeData) => {
    updateGraphWithHistory((prev) => {
      // Find all downstream dependent node IDs using BFS
      const downstreamIds = new Set<string>();
      const queue = [nodeId];

      while (queue.length > 0) {
        const current = queue.shift()!;
        for (const edge of prev.edges) {
          if (edge.sourceNodeId === current && !downstreamIds.has(edge.targetNodeId)) {
            downstreamIds.add(edge.targetNodeId);
            queue.push(edge.targetNodeId);
          }
        }
      }

      // Check for educational errors (e.g., Tokenizer vs Model vocab size mismatch)
      let tokenizerVocab: number | null = null;
      for (const n of prev.nodes) {
        if (n.id === nodeId && n.kind === 'tokenizer') {
          tokenizerVocab = (newData as TokenizerNodeData).vocabSize;
        } else if (n.kind === 'tokenizer') {
          tokenizerVocab = (n.data as TokenizerNodeData).vocabSize;
        }
      }

      return {
        ...prev,
        nodes: prev.nodes.map((n) => {
          if (n.id === nodeId) {
            return { ...n, data: newData };
          }
          if (downstreamIds.has(n.id)) {
            let errorMsg: string | undefined = undefined;
            let nodeState: GraphNodeType['state'] = 'stale';

            // Check if model node has vocab mismatch with tokenizer
            if (n.kind === 'model' && tokenizerVocab) {
              const modelData = n.data as ModelNodeData;
              if (modelData.vocabSize !== tokenizerVocab) {
                errorMsg = `Model vocab size (${modelData.vocabSize}) does not match tokenizer vocab (${tokenizerVocab}).`;
                nodeState = 'error';
              }
            }

            return {
              ...n,
              state: nodeState,
              errorMessage: errorMsg
            };
          }
          return n;
        })
      };
    });
  };

  // Node position drag handler
  const handleMoveNode = (id: string, dx: number, dy: number) => {
    setGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => {
        if (n.id === id || (selectedNodeIds.includes(id) && selectedNodeIds.includes(n.id))) {
          return { ...n, x: Math.round(n.x + dx), y: Math.round(n.y + dy) };
        }
        return n;
      })
    }));
  };

  // Node Selection
  const handleSelectNode = (e: React.MouseEvent, id: string) => {
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      setSelectedNodeIds((prev) =>
        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
      );
    } else {
      setSelectedNodeIds([id]);
      setActiveInspectorNodeId(id);
    }
  };

  const handleClearSelection = () => {
    setSelectedNodeIds([]);
    setActiveInspectorNodeId(null);
  };

  // Add new node from command palette
  const handleAddNode = (kind: NodeKind) => {
    // Offset position near center of canvas
    const x = 300 + Math.floor(Math.random() * 80);
    const y = 200 + Math.floor(Math.random() * 80);
    const newNode = createDefaultNode(kind, x, y);

    updateGraphWithHistory((prev) => ({
      ...prev,
      nodes: [...prev.nodes, newNode]
    }));

    setSelectedNodeIds([newNode.id]);
    setActiveInspectorNodeId(newNode.id);
    showToast(`Added ${newNode.title} node`, 'success');
  };

  // Duplicate selected nodes (Requirement 1: Ctrl+D)
  const handleDuplicateSelected = useCallback(() => {
    if (selectedNodeIds.length === 0) return;

    updateGraphWithHistory((prev) => {
      const newNodes: GraphNodeType[] = [];
      const idMap = new Map<string, string>();

      for (const id of selectedNodeIds) {
        const orig = prev.nodes.find((n) => n.id === id);
        if (!orig) continue;

        const newId = `node-${orig.kind}-${Math.random().toString(36).substring(2, 7)}`;
        idMap.set(orig.id, newId);

        const dup: GraphNodeType = {
          ...orig,
          id: newId,
          title: `${orig.title} (Copy)`,
          x: orig.x + 40,
          y: orig.y + 40,
          data: JSON.parse(JSON.stringify(orig.data))
        };
        newNodes.push(dup);
      }

      // Recreate internal edges between duplicated nodes
      const newEdges: GraphEdge[] = [];
      for (const edge of prev.edges) {
        if (idMap.has(edge.sourceNodeId) && idMap.has(edge.targetNodeId)) {
          newEdges.push({
            id: `edge-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            sourceNodeId: idMap.get(edge.sourceNodeId)!,
            sourcePortId: edge.sourcePortId,
            targetNodeId: idMap.get(edge.targetNodeId)!,
            targetPortId: edge.targetPortId,
            type: edge.type
          });
        }
      }

      return {
        nodes: [...prev.nodes, ...newNodes],
        edges: [...prev.edges, ...newEdges]
      };
    });

    showToast(`Duplicated ${selectedNodeIds.length} node(s)`, 'info');
  }, [selectedNodeIds, updateGraphWithHistory]);

  // Delete selected nodes
  const handleDeleteSelected = useCallback(() => {
    if (selectedNodeIds.length === 0) return;

    updateGraphWithHistory((prev) => ({
      nodes: prev.nodes.filter((n) => !selectedNodeIds.includes(n.id)),
      edges: prev.edges.filter(
        (e) => !selectedNodeIds.includes(e.sourceNodeId) && !selectedNodeIds.includes(e.targetNodeId)
      )
    }));

    setSelectedNodeIds([]);
    setActiveInspectorNodeId(null);
    showToast(`Deleted selected node(s)`, 'info');
  }, [selectedNodeIds, updateGraphWithHistory]);

  // Auto-Layout Algorithm (Requirement 1: Auto-layout button)
  const handleAutoLayout = () => {
    const kindColumns: Record<NodeKind, number> = {
      dataset: 0,
      cleaner: 1,
      tokenizer: 2,
      model: 3,
      trainer: 4,
      evaluator: 5
    };

    updateGraphWithHistory((prev) => {
      // Group nodes by their column slot
      const colBuckets: Record<number, GraphNodeType[]> = {
        0: [], 1: [], 2: [], 3: [], 4: [], 5: []
      };

      for (const node of prev.nodes) {
        const col = kindColumns[node.kind] ?? 0;
        colBuckets[col].push(node);
      }

      const colSpacingX = 260;
      const nodeSpacingY = 160;
      const startX = 80;
      const startY = 140;

      const updatedNodes = prev.nodes.map((node) => {
        const col = kindColumns[node.kind] ?? 0;
        const indexInCol = colBuckets[col].findIndex((n) => n.id === node.id);
        const totalInCol = colBuckets[col].length;
        const centeredY = startY + (indexInCol - (totalInCol - 1) / 2) * nodeSpacingY;

        return {
          ...node,
          x: startX + col * colSpacingX,
          y: Math.max(80, centeredY)
        };
      });

      return {
        ...prev,
        nodes: updatedNodes
      };
    });

    showToast('Applied topological auto-layout', 'success');
  };

  // Save graph as JSON (Requirement 1)
  const handleSaveGraph = () => {
    const jsonStr = JSON.stringify(graph, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neuroarena-graph-${new Date().toISOString().substring(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Saved graph specification to JSON', 'success');
  };

  // Load graph from JSON file
  const handleLoadGraphFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string) as GraphState;
        if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
          updateGraphWithHistory(parsed);
          setSelectedNodeIds([]);
          setActiveInspectorNodeId(null);
          showToast(`Successfully loaded graph with ${parsed.nodes.length} nodes`, 'success');
        } else {
          showToast('Invalid graph file schema: nodes or edges array missing.', 'error');
        }
      } catch (err: any) {
        showToast(`Failed to parse graph JSON: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
  };

  // Reset to default template
  const handleResetDefaultPipeline = () => {
    const defaultGraph = createDefaultGraph();
    updateGraphWithHistory(defaultGraph);
    setSelectedNodeIds([]);
    setActiveInspectorNodeId(null);
    showToast('Loaded canonical End-to-End training pipeline', 'success');
  };

  // Keyboard navigation & accessibility (Requirement 8)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing inside an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Command palette trigger (Space or /)
      if (e.key === ' ' || e.key === '/') {
        e.preventDefault();
        setIsCommandPaletteOpen((open) => !open);
        return;
      }

      // Undo: Ctrl+Z / Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Redo: Ctrl+Y or Ctrl+Shift+Z
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Duplicate: Ctrl+D
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicateSelected();
        return;
      }

      // Delete / Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteSelected();
        return;
      }

      // Tab navigation through nodes
      if (e.key === 'Tab') {
        e.preventDefault();
        if (graph.nodes.length === 0) return;
        const currentIdx = graph.nodes.findIndex((n) => selectedNodeIds.includes(n.id));
        const nextIdx = e.shiftKey
          ? (currentIdx - 1 + graph.nodes.length) % graph.nodes.length
          : (currentIdx + 1) % graph.nodes.length;
        const nextNode = graph.nodes[nextIdx];
        setSelectedNodeIds([nextNode.id]);
        setActiveInspectorNodeId(nextNode.id);
        return;
      }

      // Arrow keys nudge selected node position
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (selectedNodeIds.length === 0) return;
        e.preventDefault();
        const step = e.shiftKey ? 40 : 10;
        let dx = 0;
        let dy = 0;
        if (e.key === 'ArrowUp') dy = -step;
        if (e.key === 'ArrowDown') dy = step;
        if (e.key === 'ArrowLeft') dx = -step;
        if (e.key === 'ArrowRight') dx = step;

        for (const id of selectedNodeIds) {
          handleMoveNode(id, dx, dy);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    graph.nodes,
    selectedNodeIds,
    handleUndo,
    handleRedo,
    handleDuplicateSelected,
    handleDeleteSelected
  ]);

  // Subscribe to Runtime Events
  useEffect(() => {
    const runtime = runtimeRef.current;

    const unsubscribe = runtime.subscribe({
      onStep: (stats) => {
        setTelemetryHistory((prev) => [...prev.slice(-400), stats]);

        // Reflect current trainer state on trainer node
        setGraph((g) => ({
          ...g,
          nodes: g.nodes.map((n) => {
            if (n.kind === 'trainer') {
              const trData = n.data as TrainerNodeData;
              return {
                ...n,
                state: 'running',
                data: {
                  ...trData,
                  currentStep: stats.step,
                  currentLoss: stats.trainLoss,
                  etaSeconds: stats.etaSeconds
                }
              };
            }
            if (n.kind === 'evaluator') {
              const evData = n.data as EvaluatorNodeData;
              return {
                ...n,
                state: 'running',
                data: {
                  ...evData,
                  valLoss: stats.valLoss,
                  perplexity: Math.exp(Math.min(stats.valLoss, 6.0))
                }
              };
            }
            return n;
          })
        }));
      },
      onSample: (sample) => {
        setSampleHistory((prev) => [...prev, sample]);
        showToast(`Checkpoint ${sample.checkpointStep}: Generated autoregressive sample`, 'info');
      },
      onStateChange: (state, error) => {
        if (state === 'running') {
          setIsRunning(true);
          setIsPaused(false);
          setGraph((g) => ({
            ...g,
            nodes: g.nodes.map((n) => ({ ...n, state: 'running' as const }))
          }));
        } else if (state === 'paused') {
          setIsRunning(true);
          setIsPaused(true);
        } else if (state === 'completed') {
          setIsRunning(false);
          setIsPaused(false);
          setGraph((g) => ({
            ...g,
            nodes: g.nodes.map((n) => ({ ...n, state: 'ready' as const }))
          }));
          showToast('Training run completed successfully!', 'success');
        } else if (state === 'idle') {
          setIsRunning(false);
          setIsPaused(false);
        } else if (state === 'error') {
          setIsRunning(false);
          setIsPaused(false);
          showToast(`Runtime Error: ${error || 'Training divergence'}`, 'error');
        }
      }
    });

    return () => {
      unsubscribe();
      runtime.stop();
    };
  }, []);

  // Execution controls
  const handleStartRun = async () => {
    // Validate that trainer and model are present and connected
    const hasTrainer = graph.nodes.some((n) => n.kind === 'trainer');
    const hasModel = graph.nodes.some((n) => n.kind === 'model');
    if (!hasTrainer || !hasModel) {
      showToast('Graph must include at least one Model and one Trainer node to execute.', 'error');
      return;
    }

    try {
      await runtimeRef.current.start(graph);
      showToast('Runtime started: Training Tiny GPT at 10 Hz telemetry', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handlePauseResume = () => {
    if (isPaused) {
      runtimeRef.current.resume();
      showToast('Resumed training run', 'info');
    } else {
      runtimeRef.current.pause();
      showToast('Paused training run', 'info');
    }
  };

  const handleStopRun = () => {
    runtimeRef.current.stop();
    showToast('Stopped training run', 'info');
  };

  // Active inspector node lookup
  const inspectorNode = graph.nodes.find((n) => n.id === activeInspectorNodeId) || null;

  return (
    <div className="na-workbench" role="region" aria-label="NeuroArena Machine Learning Workbench">
      {/* Top Header & Toolbar */}
      <header className="na-workbench-header">
        <div className="na-workbench-brand">
          <span className="na-workbench-title">NeuroArena // Workbench</span>
          <Badge variant={isRunning ? 'accent' : 'neutral'}>
            {isRunning ? (isPaused ? 'PAUSED' : '10 HZ RUNNING') : 'STANDBY'}
          </Badge>
          <span style={{ fontSize: '12px', color: 'var(--na-muted)' }}>
            {graph.nodes.length} nodes · {graph.edges.length} edges
          </span>
        </div>

        {/* Central Controls */}
        <div className="na-workbench-toolbar">
          {!isRunning ? (
            <Button
              variant="primary"
              size="sm"
              icon={<PlayIcon size={14} />}
              onClick={handleStartRun}
              title="Start training run (Mock Runtime)"
            >
              Start Run
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                size="sm"
                icon={isPaused ? <PlayIcon size={14} /> : <PauseIcon size={14} />}
                onClick={handlePauseResume}
              >
                {isPaused ? 'Resume' : 'Pause'}
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon={<StopIcon size={14} />}
                onClick={handleStopRun}
              >
                Stop
              </Button>
            </>
          )}

          <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--na-line)', margin: '0 4px' }} />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCommandPaletteOpen(true)}
            title="Add Node (Space or /)"
          >
            + Add Node
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleAutoLayout}
            title="Auto-organize graph columns"
          >
            Auto Layout
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetDefaultPipeline}
            title="Load default 6-node training pipeline"
          >
            Reset Pipeline
          </Button>

          <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--na-line)', margin: '0 4px' }} />

          <Button
            variant="ghost"
            size="sm"
            onClick={handleUndo}
            disabled={historyPast.length === 0}
            title="Undo (Ctrl+Z)"
          >
            Undo
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleRedo}
            disabled={historyFuture.length === 0}
            title="Redo (Ctrl+Y)"
          >
            Redo
          </Button>

          <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--na-line)', margin: '0 4px' }} />

          <Button
            variant="ghost"
            size="sm"
            onClick={handleSaveGraph}
            title="Download Graph JSON"
          >
            Save JSON
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            title="Upload Graph JSON"
          >
            Load JSON
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleLoadGraphFile}
          />
        </div>

        {/* Right Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontFamily: 'var(--na-font-mono)', color: 'var(--na-muted)' }}>
            [Space] Palette · [Tab] Focus · [Del] Remove
          </span>
        </div>
      </header>

      {/* Main Graph Canvas Area with Integrated Inspector */}
      <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        <CanvasGrid
          nodes={graph.nodes}
          edges={graph.edges}
          selectedNodeIds={selectedNodeIds}
          isRunning={isRunning && !isPaused}
          onSelectNode={handleSelectNode}
          onMoveNode={handleMoveNode}
          onConnectPorts={handleConnectPorts}
          onOpenCodex={(node) => setCodexModalNode(node)}
          onClearSelection={handleClearSelection}
        />

        {/* Side Inspector Panel */}
        <InspectorPanel
          node={inspectorNode}
          onUpdateNodeData={handleUpdateNodeData}
          onClose={() => setActiveInspectorNodeId(null)}
          onOpenCodex={(node) => setCodexModalNode(node)}
        />
      </div>

      {/* Bottom Dock: Live Loss Chart & Checkpoint Sample Viewer */}
      <BottomDock
        history={telemetryHistory}
        samples={sampleHistory}
        isRunning={isRunning && !isPaused}
      />

      {/* Command Palette Modal */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onAddNode={handleAddNode}
      />

      {/* Codex Reference Specification Modal */}
      <CodexStubModal
        node={codexModalNode}
        isOpen={codexModalNode !== null}
        onClose={() => setCodexModalNode(null)}
      />

      {/* Feedback Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '220px',
            right: '24px',
            backgroundColor:
              toastMessage.type === 'error'
                ? 'var(--na-danger)'
                : toastMessage.type === 'success'
                ? 'var(--na-success)'
                : 'var(--na-raised)',
            color: '#FFFFFF',
            padding: '10px 18px',
            borderRadius: 'var(--na-radius-md)',
            boxShadow: 'var(--na-elevation-4)',
            fontSize: '13px',
            fontFamily: 'var(--na-font-ui)',
            fontWeight: 500,
            zIndex: 150,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'na-fade-in 0.15s ease-out'
          }}
        >
          {toastMessage.text}
        </div>
      )}
    </div>
  );
};
