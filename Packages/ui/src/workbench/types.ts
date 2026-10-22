/**
 * NeuroArena Workbench Types
 * Node-graph data structures, port typing, runtime seam, and stats models.
 */

export type PortType = 'Dataset' | 'TokenStream' | 'Model' | 'Metrics';

export type NodeKind =
  | 'dataset'
  | 'cleaner'
  | 'tokenizer'
  | 'model'
  | 'trainer'
  | 'evaluator';

export type NodeState = 'idle' | 'ready' | 'running' | 'error' | 'stale';

export interface PortDefinition {
  id: string;
  name: string;
  type: PortType;
  direction: 'input' | 'output';
  description?: string;
}

// Node specific data payloads
export interface DatasetNodeData {
  sourceName: string;
  sampleCount: number;
  quality: {
    clean: number;
    noisy: number;
    duplicate: number;
    contaminated: number;
    unknown: number;
  };
  duplicateRate: number; // e.g. 0.08
}

export interface CleanerNodeData {
  dedupeEnabled: boolean;
  minTextLength: number;
  maxTextLength: number;
  languageFilter: string;
  noiseFilterThreshold: number; // 0 to 1
  beforeCount: number;
  afterCount: number;
}

export interface TokenizerNodeData {
  vocabSize: number;
  isTrained: boolean;
  sampleInputText: string;
  tokenizedSpans: Array<{ text: string; id: number; colorIndex: number }>;
}

export interface ModelNodeData {
  preset: 'S' | 'M' | 'C' | 'Custom';
  dModel: number;
  nLayers: number;
  nHeads: number;
  dFF: number;
  contextLen: number;
  vocabSize: number;
  paramCount: number;
  estimatedMemoryMB: number;
}

export interface TrainerNodeData {
  learningRate: number;
  batchSize: number;
  maxSteps: number;
  warmupSteps: number;
  weightDecay: number;
  seed: number;
  currentStep: number;
  currentLoss: number;
  etaSeconds: number;
}

export interface EvaluatorNodeData {
  valLoss: number;
  perplexity: number;
  prompts: string[];
  generations: Array<{ prompt: string; output: string }>;
}

export type AnyNodeData =
  | DatasetNodeData
  | CleanerNodeData
  | TokenizerNodeData
  | ModelNodeData
  | TrainerNodeData
  | EvaluatorNodeData;

export interface GraphNode {
  id: string;
  kind: NodeKind;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  state: NodeState;
  errorMessage?: string;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  data: AnyNodeData;
}

export interface GraphEdge {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
  type: PortType;
  isActive?: boolean;
}

export interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Runtime Seam: Stats and Events
export interface TrainingStepStats {
  step: number;
  maxSteps: number;
  trainLoss: number;
  valLoss: number;
  learningRate: number;
  tokensPerSec: number;
  elapsedSeconds: number;
  etaSeconds: number;
  annotations?: string[]; // e.g. ["Warmup ended", "Loss spiked"]
}

export interface GeneratedSample {
  checkpointStep: number;
  prompt: string;
  output: string;
  perplexity: number;
  timestamp: number;
}

export interface RuntimeListener {
  onStep?: (stats: TrainingStepStats) => void;
  onSample?: (sample: GeneratedSample) => void;
  onStateChange?: (state: 'idle' | 'running' | 'paused' | 'completed' | 'error', error?: string) => void;
}

export interface WorkbenchRuntime {
  start(graph: GraphState): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;
  reset(): void;
  subscribe(listener: RuntimeListener): () => void;
  getHistory(): TrainingStepStats[];
  getSamples(): GeneratedSample[];
  isRunning(): boolean;
}
