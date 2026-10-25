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

// Signal histogram distribution
export interface SignalDistribution {
  min: number;
  max: number;
  mean: number;
  std: number;
  bins: number[]; // 5-bin histogram count
}

// Node specific data payloads
export interface DatasetNodeData {
  sourceName: string;
  sampleCount: number;
  tokenCount: number;
  duplicateRate: number; // e.g. 0.08
  fingerprint: string;
  signalsHistogram?: Record<string, SignalDistribution>;
  keptShardIds?: string[];
}

export interface CleanerNodeData {
  dedupeEnabled: boolean;
  nearDedupeThreshold: number; // 0.5 to 1.0, default 0.85
  minDictionaryHitRate: number; // 0.0 to 1.0, default 0.90
  maxNonAlphaRatio: number; // 0.0 to 1.0, default 0.35
  maxUppercaseRatio: number; // 0.0 to 1.0, default 0.20
  minTextLength: number; // default 1200
  maxTextLength: number; // default 3800
  beforeCount: number;
  afterCount: number;
  droppedCount: number;
  beforeHistogram?: Record<string, SignalDistribution>;
  afterHistogram?: Record<string, SignalDistribution>;
}

export interface TokenizerNodeData {
  vocabSize: number;
  isTrained: boolean;
  compressionRatio: number; // bytes per token (e.g. 3.84)
  totalTokens: number;
  mergesCount: number;
  sampleInputText: string;
  tokenizedSpans: Array<{ text: string; id: number; colorIndex: number }>;
}

export interface ModelNodeData {
  preset: 'Scout' | 'S' | 'M' | 'C' | 'Custom';
  dModel: number;
  nLayers: number;
  nHeads: number;
  dFF: number;
  contextLen: number;
  vocabSize: number;
  paramCount: number;
  estimatedMemoryMB: number;
  tokensPerParam: number;
  totalTokens?: number;
  predictedValLoss?: number;
  baselineComparison?: string;
  baselineStatus?: string;
  scalingAdvice?: string;
  starvationChip: 'starved' | 'workable' | 'comfortable' | 'severely-starved' | 'data-starved' | 'adequate';
  tokenHealthStatus?: 'severely-starved' | 'data-starved' | 'adequate' | 'comfortable';
}

export interface TrainerNodeData {
  learningRate: number;
  batchSize: number;
  maxSteps: number;
  warmupSteps: number;
  weightDecay: number;
  seed: number;
  throttle: number; // 0 to 1
  currentStep: number;
  currentLoss: number;
  currentValLoss?: number;
  currentGradNorm?: number;
  etaSeconds: number;
  elapsedSeconds?: number;
  selectedCheckpointId?: string;
  activeRunId?: string;
}

export interface EvaluatorNodeData {
  valLoss: number;
  perplexity: number;
  prompts: string[];
  temperature: number;
  topK: number;
  topP: number;
  generations: Array<{ prompt: string; output: string }>;
  heatmapText?: string;
  heatmapItems?: Array<{ token: string; tokenId: number; loss: number }>;
  memorizationRate?: number;
}

export interface GraphValidationError {
  nodeId?: string;
  type: 'vocab_mismatch' | 'empty_dataset' | 'context_length' | 'zero_lr' | 'stale_upstream' | 'disconnected_port';
  title: string;
  message: string;
  suggestedFix?: string;
}

export interface AutopsyTagStat {
  tag: string;
  count: number;
  meanLoss: number;
  multiplier: number; // relative to clean
  totalLoss: number;
}

export interface DetrimentalShard {
  shardId: string;
  tag: string;
  meanLoss: number;
  snippet: string;
  regionId: string;
}

export interface AutopsyReport {
  runId: string;
  datasetFingerprint: string;
  totalShards: number;
  tagStats: AutopsyTagStat[];
  detrimentalShards: DetrimentalShard[];
  summaryVerdict: string;
}

export interface RunSummary {
  runId: string;
  preset: string;
  datasetFingerprint?: string;
  step: number;
  finalTrainLoss?: number;
  finalValLoss?: number;
  finalPerplexity?: number;
  timestamp: number;
  hyperparameters?: any;
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
  gradNorm?: number;
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
  onFinding?: (finding: any) => void;
  onDiagnostics?: (findings: any[]) => void;
  onToken?: (token: string, sampleId: string) => void;
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
