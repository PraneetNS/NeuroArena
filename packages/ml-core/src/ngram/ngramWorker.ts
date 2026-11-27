/**
 * NeuroArena ML-Core: N-Gram Web Worker.
 *
 * Runs discrete n-gram count table construction, prediction queries, validation evaluations,
 * and text generation off the main thread to ensure 60 fps rendering in the Loom UI.
 */

import { NGramEngine } from './ngramEngine.js';

const engine = new NGramEngine();

export interface NGramWorkerRequest {
  id: number;
  type: 'build' | 'predict' | 'valLoss' | 'generate' | 'memoryStats' | 'seenFraction';
  tokens?: Uint16Array;
  maxOrder?: number;
  context?: number[];
  topK?: number;
  order?: number;
  n?: number;
  valTokens?: Uint16Array;
  charsPerToken?: number;
  promptText?: string;
  maxTokens?: number;
  temperature?: number;
  mode?: 'kn' | 'naive';
}

export interface NGramWorkerResponse {
  id: number;
  type: string;
  buildTimeMs?: number;
  prediction?: any;
  valLossResult?: any;
  generation?: any;
  memoryStats?: any;
  seenFraction?: number;
  error?: string;
}

self.onmessage = (e: MessageEvent<NGramWorkerRequest>) => {
  const req = e.data;
  try {
    if (req.type === 'build' && req.tokens) {
      const ms = engine.build(req.tokens, req.maxOrder ?? 5);
      self.postMessage({
        id: req.id,
        type: 'build',
        buildTimeMs: Math.round(ms)
      });
    } else if (req.type === 'predict' && req.context) {
      const pred = engine.predict(req.context, req.topK ?? 5, req.order ?? 5, req.mode ?? 'kn');
      self.postMessage({
        id: req.id,
        type: 'predict',
        prediction: pred
      });
    } else if (req.type === 'valLoss' && req.n !== undefined && req.valTokens) {
      const res = engine.valLoss(req.n, req.valTokens, req.charsPerToken ?? 2.3107, req.mode ?? 'kn');
      self.postMessage({
        id: req.id,
        type: 'valLoss',
        valLossResult: res
      });
    } else if (req.type === 'generate' && req.promptText) {
      const gen = engine.generate(req.promptText, req.n ?? 3, req.maxTokens ?? 30, req.temperature ?? 0.8, req.mode ?? 'kn');
      self.postMessage({
        id: req.id,
        type: 'generate',
        generation: gen
      });
    } else if (req.type === 'memoryStats' && req.n !== undefined) {
      const stats = engine.getMemoryStats(req.n);
      self.postMessage({
        id: req.id,
        type: 'memoryStats',
        memoryStats: stats
      });
    } else if (req.type === 'seenFraction' && req.n !== undefined && req.valTokens) {
      const frac = engine.calculateValSeenFraction(req.n, req.valTokens);
      self.postMessage({
        id: req.id,
        type: 'seenFraction',
        seenFraction: frac
      });
    } else {
      throw new Error(`Unknown n-gram worker request type: ${req.type}`);
    }
  } catch (err: any) {
    self.postMessage({
      id: req.id,
      type: req.type,
      error: err?.message || String(err)
    });
  }
};
