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
  AnyNodeData,
  WorkbenchRuntime,
  AutopsyReport,
  RunSummary,
  GraphValidationError
} from './types.js';
import { RealRuntime } from './runtime.js';
import { CanvasGrid } from './components/CanvasGrid.js';
import { InspectorPanel } from './components/InspectorPanel.js';
import { BottomDock } from './components/BottomDock.js';
import { CommandPalette } from './components/CommandPalette.js';
import { CodexStubModal } from './components/CodexStubModal.js';
import { AutopsyModal } from './components/AutopsyModal.js';
import { RunManagerModal } from './components/RunManagerModal.js';
import { Button } from '../components/Button.js';
import { Badge } from '../components/Badge.js';
import { PlayIcon, PauseIcon, StopIcon } from '../icons/index.js';
import { Finding, SuggestedFix } from '@na/ml-core';
import { VaultManager } from '@na/game-core';

export interface WorkbenchProps {
  vaultManager?: VaultManager;
  runtime?: WorkbenchRuntime;
  onClose?: () => void;
}

// Educational Graph Validator
export function validateGraphForTeaching(graph: GraphState): GraphValidationError[] {
  const errors: GraphValidationError[] = [];

  const datasetNode = graph.nodes.find((n) => n.kind === 'dataset');
  const tokenizerNode = graph.nodes.find((n) => n.kind === 'tokenizer');
  const modelNode = graph.nodes.find((n) => n.kind === 'model');
  const trainerNode = graph.nodes.find((n) => n.kind === 'trainer');

  // 1. Empty dataset check
  if (datasetNode) {
    const dsData = datasetNode.data as DatasetNodeData;
    const shards = dsData.sampleCount ?? 0;
    if (shards === 0) {
      errors.push({
        type: 'empty_dataset',
        nodeId: datasetNode.id,
        title: 'Empty Dataset: No Kept Shards in Vault',
        message: 'The training corpus contains 0 shards. Training requires data to compute loss.',
        suggestedFix: 'Collect shards in the world and keep them in your Vault'
      });
    }
  }

  // 2. Vocab size mismatch check
  if (tokenizerNode && modelNode) {
    const tokData = tokenizerNode.data as TokenizerNodeData;
    const modelData = modelNode.data as ModelNodeData;
    if (tokData.vocabSize && modelData.vocabSize && tokData.vocabSize !== modelData.vocabSize) {
      errors.push({
        type: 'vocab_mismatch',
        nodeId: modelNode.id,
        title: 'Vocabulary Dimension Mismatch',
        message: `Tokenizer outputs vocab size ${tokData.vocabSize}, but Model expects ${modelData.vocabSize}.`,
        suggestedFix: `Set model vocabSize to ${tokData.vocabSize}`
      });
    }
  }

  // 3. Context overflow beyond positional table
  if (modelNode) {
    const modelData = modelNode.data as ModelNodeData;
    if (modelData.contextLen && modelData.contextLen > 512) {
      errors.push({
        type: 'context_length',
        nodeId: modelNode.id,
        title: 'Context Length Exceeds Position Table',
        message: `Context length (${modelData.contextLen}) exceeds positional table limit (512).`,
        suggestedFix: 'Reduce contextLen to 128'
      });
    }
  }

  // 4. Learning rate of 0
  if (trainerNode) {
    const trainerData = trainerNode.data as TrainerNodeData;
    if (trainerData.learningRate !== undefined && trainerData.learningRate <= 0) {
      errors.push({
        type: 'zero_lr',
        nodeId: trainerNode.id,
        title: 'Learning Rate is Zero',
        message: 'The learning rate is 0. Optimizer updates are disabled.',
        suggestedFix: 'Set learningRate to 0.0003'
      });
    }
  }

  // 5. Stale upstream node warning
  for (const n of graph.nodes) {
    if (n.state === 'stale') {
      errors.push({
        type: 'stale_upstream',
        nodeId: n.id,
        title: `Stale Node: ${n.title}`,
        message: 'Upstream parameters changed. Downstream cached outputs are outdated.',
        suggestedFix: 'Re-execute or retrain this node'
      });
    }
  }

  return errors;
}

// Factory to create initial node payloads with defaults
export function createDefaultNode(kind: NodeKind, x: number, y: number, idSuffix?: string): GraphNodeType {
  const id = `node-${kind}-${idSuffix || Math.random().toString(36).substring(2, 7)}`;

  switch (kind) {
    case 'dataset':
      return {
        id,
        kind: 'dataset',
        title: 'Vault Corpus',
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
            description: 'Kept Vault shards stream'
          }
        ],
        data: {
          sourceName: 'The Vault (Harvested Pages)',
          sampleCount: 0,
          shardCount: 0,
          tokenCount: 0,
          duplicateRate: 0.05,
          duplicateEstimate: 0.05,
          fingerprint: '0000000000000000',
          datasetFingerprint: '0000000000000000',
          quality: { clean: 0, noisy: 0, duplicate: 0, contaminated: 0, unknown: 0 }
        } as DatasetNodeData
      };

    case 'cleaner':
      return {
        id,
        kind: 'cleaner',
        title: 'Signal Guardrail',
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
          nearDedupeThreshold: 0.20,
          minDictionaryHitRate: 0.60,
          maxNonAlphaRatio: 0.25,
          maxUppercaseRatio: 0.20,
          minTextLength: 400,
          maxTextLength: 4500,
          beforeCount: 0,
          afterCount: 0,
          droppedCount: 0
        } as CleanerNodeData
      };

    case 'tokenizer':
      return {
        id,
        kind: 'tokenizer',
        title: 'ByteBPE Tokenizer',
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
          isTrained: false,
          compressionRatio: 0,
          totalTokens: 0,
          mergesCount: 0,
          sampleInputText: 'Shall I compare thee to a summer day?',
          tokenizedSpans: []
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
          paramCount: 1250000,
          estimatedMemoryMB: 24,
          tokensPerParam: 0,
          starvationChip: 'data-starved'
        } as ModelNodeData
      };

    case 'trainer':
      return {
        id,
        kind: 'trainer',
        title: 'WebGPU Trainer',
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
          learningRate: 0.0003,
          batchSize: 16,
          maxSteps: 250,
          warmupSteps: 50,
          weightDecay: 0.01,
          seed: 42,
          throttle: 0,
          currentStep: 0,
          currentLoss: 4.82,
          etaSeconds: 30
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
          valLoss: 0,
          perplexity: 0,
          prompts: [
            'To be, or not to be',
            'Shall I compare thee to a summer day?',
            'What light through yonder window breaks?'
          ],
          temperature: 0.8,
          topK: 40,
          topP: 0.9,
          generations: []
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

export const Workbench: React.FC<WorkbenchProps> = ({ vaultManager, runtime, onClose }) => {
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

  // Autopsy & Run Manager Modals
  const [isAutopsyOpen, setIsAutopsyOpen] = useState(false);
  const [isAutopsyLoading, setIsAutopsyLoading] = useState(false);
  const [autopsyReport, setAutopsyReport] = useState<AutopsyReport | null>(null);

  const [isRunManagerOpen, setIsRunManagerOpen] = useState(false);
  const [storedRuns, setStoredRuns] = useState<RunSummary[]>([]);

  // Findings & Validation
  const [findings, setFindings] = useState<Finding[]>([]);
  const [validationErrors, setValidationErrors] = useState<GraphValidationError[]>([]);

  // RealRuntime Seam
  const realVault = useRef<VaultManager>(vaultManager || new VaultManager());
  const runtimeRef = useRef<WorkbenchRuntime>(runtime || new RealRuntime({ vaultManager: realVault.current }));
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

  // Initial Sync from Real Vault on Mount
  useEffect(() => {
    const r = runtimeRef.current as any;
    if (r && typeof r.syncDataset === 'function') {
      setGraph((prev) => {
        const nextNodes = prev.nodes.map((n) => {
          if (n.kind === 'dataset') {
            const syncData = r.syncDataset(n);
            return { ...n, data: syncData };
          }
          return n;
        });
        return { ...prev, nodes: nextNodes };
      });
    }
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

  // Port Validation Logic
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

  // Update node data and propagate stale state to downstream nodes
  const handleUpdateNodeData = (nodeId: string, newData: AnyNodeData) => {
    updateGraphWithHistory((prev) => {
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

      return {
        ...prev,
        nodes: prev.nodes.map((n) => {
          if (n.id === nodeId) {
            return { ...n, data: newData, state: 'ready' as const };
          }
          if (downstreamIds.has(n.id)) {
            return {
              ...n,
              state: 'stale' as const
            };
          }
          return n;
        })
      };
    });
  };

  // Apply suggested fix from a finding card
  const handleApplyFix = (fix: SuggestedFix, finding: Finding) => {
    const param = fix.parameterChange?.parameter;
    const value = fix.parameterChange?.suggestedValue;
    if (!param || value === undefined) {
      showToast(`Fix: ${fix.label}`, 'info');
      return;
    }

    updateGraphWithHistory((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => {
        if (n.kind === 'trainer') {
          const tData = n.data as TrainerNodeData;
          if (param === 'learningRate') {
            return { ...n, data: { ...tData, learningRate: Number(value) } };
          }
          if (param === 'batchSize') {
            return { ...n, data: { ...tData, batchSize: Number(value) } };
          }
          if (param === 'warmupSteps') {
            return { ...n, data: { ...tData, warmupSteps: Number(value) } };
          }
        }
        if (n.kind === 'model') {
          const mData = n.data as ModelNodeData;
          if (param === 'preset') {
            return { ...n, data: { ...mData, preset: value as any } };
          }
          if (param === 'contextLen') {
            return { ...n, data: { ...mData, contextLen: Number(value) } };
          }
        }
        if (n.kind === 'cleaner') {
          const cData = n.data as CleanerNodeData;
          if (param === 'nearDedupeThreshold') {
            return { ...n, data: { ...cData, nearDedupeThreshold: Number(value) } };
          }
          if (param === 'minDictionaryHitRate') {
            return { ...n, data: { ...cData, minDictionaryHitRate: Number(value) } };
          }
        }
        return n;
      })
    }));

    showToast(`Applied fix for [${finding.title}]: Set ${param} to ${value}`, 'success');
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

  // Duplicate selected nodes
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

  // Auto-Layout Algorithm
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
      const colCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      const colWidth = 240;
      const rowHeight = 160;
      const startX = 80;
      const startY = 160;

      return {
        ...prev,
        nodes: prev.nodes.map((n) => {
          const col = kindColumns[n.kind] ?? 0;
          const row = colCounts[col] || 0;
          colCounts[col] = row + 1;
          return {
            ...n,
            x: startX + col * colWidth,
            y: startY + row * rowHeight
          };
        })
      };
    });

    showToast('Auto-layout applied across pipeline columns', 'info');
  };

  // Save graph specification to JSON file
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
    e.target.value = '';
  };

  // Reset to default template
  const handleResetDefaultPipeline = () => {
    const defaultGraph = createDefaultGraph();
    updateGraphWithHistory(defaultGraph);
    setSelectedNodeIds([]);
    setActiveInspectorNodeId(null);
    showToast('Loaded canonical End-to-End training pipeline', 'success');
  };

  // Keyboard navigation & accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === ' ' || e.key === '/') {
        e.preventDefault();
        setIsCommandPaletteOpen((open) => !open);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicateSelected();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteSelected();
        return;
      }

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
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [graph.nodes, selectedNodeIds, handleUndo, handleRedo, handleDuplicateSelected, handleDeleteSelected]);

  // Subscribe to Runtime Events
  useEffect(() => {
    const runtime = runtimeRef.current;

    const unsubscribe = runtime.subscribe({
      onStep: (stats) => {
        setTelemetryHistory((prev) => [...prev.slice(-400), stats]);

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
      onFinding: (finding: Finding) => {
        setFindings((prev) => {
          const exists = prev.some((f) => f.id === finding.id || (f.conceptId && f.conceptId === finding.conceptId));
          if (exists) {
            return prev.map((f) => (f.id === finding.id || f.conceptId === finding.conceptId ? finding : f));
          }
          return [finding, ...prev];
        });
        showToast(`Finding: ${finding.title}`, finding.severity === 'critical' ? 'error' : 'info');
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
          showToast('Training completed! Earned Reveal unlocked in Autopsy.', 'success');
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
    // 1. Run teaching validation rules
    const errors = validateGraphForTeaching(graph);
    setValidationErrors(errors);

    const fatalErrors = errors.filter((e) => e.type !== 'stale_upstream');
    if (fatalErrors.length > 0) {
      showToast(`Cannot start: ${fatalErrors[0].title}`, 'error');
      return;
    }

    try {
      await runtimeRef.current.start(graph);
      showToast('Training started on RealRuntime pipeline', 'success');
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

  // Autopsy trigger
  const handleOpenAutopsy = async (runId?: string) => {
    setIsAutopsyOpen(true);
    setIsAutopsyLoading(true);
    try {
      const r = runtimeRef.current as any;
      if (r && typeof r.runAutopsy === 'function') {
        const report = await r.runAutopsy(runId);
        setAutopsyReport(report);
      } else {
        setAutopsyReport(null);
      }
    } catch (err: any) {
      showToast(`Autopsy failed: ${err.message}`, 'error');
    } finally {
      setIsAutopsyLoading(false);
    }
  };

  // Run Manager trigger
  const handleOpenRunManager = async () => {
    setIsRunManagerOpen(true);
    try {
      const r = runtimeRef.current as any;
      if (r && typeof r.listRuns === 'function') {
        const runs = await r.listRuns();
        setStoredRuns(runs);
      }
    } catch (err: any) {
      showToast(`Failed to list OPFS runs: ${err.message}`, 'error');
    }
  };

  const handleDeleteRun = async (runId: string) => {
    try {
      const r = runtimeRef.current as any;
      if (r && typeof r.deleteRun === 'function') {
        await r.deleteRun(runId);
        setStoredRuns((prev) => prev.filter((x) => x.runId !== runId));
        showToast(`Deleted run ${runId} from OPFS`, 'info');
      }
    } catch (err: any) {
      showToast(`Delete failed: ${err.message}`, 'error');
    }
  };

  const handleDiscardShardFromVault = (shardId: string) => {
    realVault.current.setEntryStatus(shardId, 'discard');
    showToast(`Discarded shard ${shardId} from Vault`, 'success');
    // Refresh autopsy
    handleOpenAutopsy();
  };

  // Active inspector node lookup
  const inspectorNode = graph.nodes.find((n) => n.id === activeInspectorNodeId) || null;

  return (
    <div className="na-workbench" role="region" aria-label="NeuroArena Machine Learning Workbench">
      {/* Top Header & Toolbar */}
      <header className="na-workbench-header">
        <div className="na-workbench-brand">
          <span className="na-workbench-title">NeuroArena // RealRuntime Workbench</span>
          <Badge variant={isRunning ? 'accent' : 'neutral'}>
            {isRunning ? (isPaused ? 'PAUSED' : 'REAL GPU RUNNING') : 'STANDBY'}
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
              title="Start training run on RealRuntime"
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
            onClick={() => handleOpenAutopsy()}
            title="Inspect trained weights against ground-truth tags"
          >
            🔬 Autopsy
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenRunManager}
            title="Inspect and compare runs saved in OPFS"
          >
            📁 Run Manager
          </Button>

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

          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} style={{ marginLeft: '6px' }}>
              ✕ Close
            </Button>
          )}
        </div>

        {/* Right Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontFamily: 'var(--na-font-mono)', color: 'var(--na-muted)' }}>
            [Space] Palette · [Tab] Focus · [Del] Remove
          </span>
        </div>
      </header>

      {/* Validation Errors Teaching Banner */}
      {validationErrors.length > 0 && (
        <div
          style={{
            backgroundColor: '#2A1818',
            borderBottom: '1px solid #7F1D1D',
            padding: '8px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '16px' }}>⚠️</span>
            <div>
              <span style={{ fontWeight: 600, fontSize: '12px', color: '#FCA5A5' }}>
                {validationErrors[0].title}: {validationErrors[0].message}
              </span>
              {validationErrors[0].suggestedFix && (
                <span style={{ fontSize: '11px', color: '#E5E7EB', marginLeft: '8px' }}>
                  (Hint: {validationErrors[0].suggestedFix})
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setValidationErrors([])}
              style={{ padding: '2px 6px', fontSize: '11px', color: '#9CA3AF' }}
            >
              ✕ Dismiss
            </Button>
          </div>
        </div>
      )}

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

      {/* Bottom Dock: Live Loss Chart, Checkpoint Sample Viewer & Findings Cards */}
      <BottomDock
        history={telemetryHistory}
        samples={sampleHistory}
        findings={findings}
        isRunning={isRunning && !isPaused}
        onApplyFix={handleApplyFix}
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

      {/* Autopsy Modal (The Earned Reveal) */}
      <AutopsyModal
        isOpen={isAutopsyOpen}
        onClose={() => setIsAutopsyOpen(false)}
        report={autopsyReport}
        isLoading={isAutopsyLoading}
        onDiscardShard={handleDiscardShardFromVault}
      />

      {/* Run Manager Modal */}
      <RunManagerModal
        isOpen={isRunManagerOpen}
        onClose={() => setIsRunManagerOpen(false)}
        runs={storedRuns}
        onDeleteRun={handleDeleteRun}
        onRunAutopsy={(rId) => handleOpenAutopsy(rId)}
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
