/**
 * Typed message protocol, configurations, checkpoint manifests,
 * and event signatures for the WebGPU Training Worker & Client runtime.
 */

import { GPTConfig } from '../types.js';
import type { DiagnosticsSnapshot } from '../diagnostics.js';

export type { DiagnosticsSnapshot, LayerDiagnostics } from '../diagnostics.js';

export interface TokenizerRef {
  type: 'bpe' | 'char';
  vocabSize: number;
  merges?: Array<[number, number, number]>;
  chars?: string[];
}

export interface TrainingHyperparameters {
  preset?: 'S' | 'M' | 'C' | 'custom';
  lr: number;
  batchSize: number;
  contextLen: number;
  totalSteps: number;
  warmupSteps: number;
  weightDecay: number;
  seed: number;
  throttle: number;
  logInterval: number;
  valInterval: number;
  valBatches: number;
  checkpointInterval: number;
  keepCheckpoints: number;
}

export interface TrainingRunConfig {
  runId?: string;
  preset?: 'S' | 'M' | 'C';
  gptConfig?: GPTConfig;
  hyperparameters?: Partial<TrainingHyperparameters>;
  // Shorthand overrides for ease of use
  lr?: number;
  batchSize?: number;
  contextLen?: number;
  steps?: number;
  warmupSteps?: number;
  weightDecay?: number;
  seed?: number;
  throttle?: number;
  logInterval?: number;
  valInterval?: number;
  valBatches?: number;
  checkpointInterval?: number;
  keepCheckpoints?: number;

  // Dataset tokens
  tokens?: Uint16Array | number[] | Uint32Array;
  valTokens?: Uint16Array | number[] | Uint32Array;
  valSplit?: number; // default 0.1
  tokenizer?: TokenizerRef;
  initialWeights?: Float32Array;
}

export interface TrainingStats {
  step: number;
  trainLoss: number;
  smoothedLoss: number;
  gradNorm: number;
  lr: number;
  tokensPerSec: number;
  elapsedSec: number;
  etaSec: number;
}

export interface ValidationStats {
  step: number;
  valLoss: number;
  perplexity: number;
}

export interface SampleRequest {
  sampleId?: string;
  prompt: string | number[];
  maxNewTokens?: number;
  temperature?: number;
  topK?: number;
  topP?: number;
  seed?: number;
}

export interface SampleTokenData {
  sampleId: string;
  token: string;
  tokenId: number;
  step: number;
  isLast: boolean;
  fullText?: string;
}

export interface CheckpointMetadata {
  step: number;
  valLoss?: number;
  trainLoss?: number;
  timestamp: number;
  weightsFile: string;
  optimizerFile?: string;
}

export interface RunManifest {
  runId: string;
  config: GPTConfig;
  tokenizer: TokenizerRef;
  hyperparameters: TrainingHyperparameters;
  step: number;
  seed: number;
  rngCallCount: number;
  bestValLoss: number;
  bestStep: number;
  metricHistory: Array<{
    step: number;
    trainLoss: number;
    smoothedLoss: number;
    gradNorm: number;
    lr: number;
    valLoss?: number;
    perplexity?: number;
    timestamp: number;
  }>;
  diagnosticsHistory?: DiagnosticsSnapshot[];
  checkpoints: CheckpointMetadata[];
}

export interface CheckpointEventData {
  runId: string;
  step: number;
  path: string;
  valLoss?: number;
  trainLoss?: number;
  manifest: RunManifest;
}

export interface DeviceLostEventData {
  reason?: string;
  message?: string;
  recovered: boolean;
  step: number;
}

export interface FinishedEventData {
  runId: string;
  totalSteps: number;
  finalLoss: number;
  finalValLoss?: number;
  elapsedSec: number;
}

// Typed Messages from Main -> Worker
export type TrainerWorkerInMessage =
  | { type: 'START'; config: TrainingRunConfig }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'STOP' }
  | { type: 'SET_LR'; lr: number }
  | { type: 'SET_THROTTLE'; throttle: number }
  | { type: 'SAMPLE'; request: SampleRequest }
  | { type: 'SAVE_CHECKPOINT' }
  | { type: 'LOAD_CHECKPOINT'; checkpointId?: string | number };

// Typed Events from Worker -> Main
export type TrainerWorkerOutEvent =
  | { type: 'STATS'; data: TrainingStats }
  | { type: 'VAL_STATS'; data: ValidationStats }
  | { type: 'SAMPLE_TOKEN'; data: SampleTokenData }
  | { type: 'CHECKPOINT'; data: CheckpointEventData }
  | { type: 'DIAGNOSTICS'; data: DiagnosticsSnapshot }
  | { type: 'DEVICE_LOST'; data: DeviceLostEventData }
  | { type: 'ERROR'; data: { message: string; stack?: string } }
  | { type: 'FINISHED'; data: FinishedEventData };
