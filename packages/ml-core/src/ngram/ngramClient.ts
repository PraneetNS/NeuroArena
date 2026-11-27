/**
 * NeuroArena ML-Core: N-Gram Worker Client.
 *
 * Provides a clean Promise-based async API for the Loom UI to communicate with the
 * background NGramWorker, with fallback to synchronous local execution when Workers
 * are unavailable.
 */

import {
  NGramEngine,
  PredictionResult,
  MemoryStats
} from './ngramEngine.js';
import { ByteBPE } from '../tokenizers/bpe.js';

export class NGramClient {
  private worker: Worker | null = null;
  private localEngine: NGramEngine;
  private messageId = 0;
  private pending = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>();

  constructor(tokenizer?: ByteBPE) {
    this.localEngine = new NGramEngine(tokenizer);

    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(new URL('./ngramWorker.js', import.meta.url), {
          type: 'module'
        });
        this.worker.onmessage = (e: MessageEvent) => {
          const { id, error, ...rest } = e.data;
          const handler = this.pending.get(id);
          if (handler) {
            this.pending.delete(id);
            if (error) {
              handler.reject(new Error(error));
            } else {
              handler.resolve(rest);
            }
          }
        };
      } catch (err) {
        console.warn('Could not initialize NGram Web Worker, falling back to local engine:', err);
        this.worker = null;
      }
    }
  }

  public setTokenizer(tok: ByteBPE): void {
    this.localEngine.setTokenizer(tok);
  }

  public async build(tokens: Uint16Array, maxOrder = 5): Promise<number> {
    if (this.worker) {
      const id = ++this.messageId;
      return new Promise((resolve, reject) => {
        this.pending.set(id, {
          resolve: (res) => resolve(res.buildTimeMs),
          reject
        });
        this.worker!.postMessage({ id, type: 'build', tokens, maxOrder });
      });
    }
    return this.localEngine.build(tokens, maxOrder);
  }

  public async predict(context: number[], topK = 5, order = 5): Promise<PredictionResult> {
    if (this.worker) {
      const id = ++this.messageId;
      return new Promise((resolve, reject) => {
        this.pending.set(id, {
          resolve: (res) => resolve(res.prediction),
          reject
        });
        this.worker!.postMessage({ id, type: 'predict', context, topK, order });
      });
    }
    return this.localEngine.predict(context, topK, order);
  }

  public async valLoss(
    n: number,
    valTokens: Uint16Array,
    charsPerToken = 2.311
  ): Promise<{ valLossPerToken: number; valLossPerChar: number }> {
    if (this.worker) {
      const id = ++this.messageId;
      return new Promise((resolve, reject) => {
        this.pending.set(id, {
          resolve: (res) => resolve(res.valLossResult),
          reject
        });
        this.worker!.postMessage({ id, type: 'valLoss', n, valTokens, charsPerToken });
      });
    }
    return this.localEngine.valLoss(n, valTokens, charsPerToken);
  }

  public async generate(
    promptText: string,
    n = 3,
    maxTokens = 30,
    temperature = 0.8
  ): Promise<{ text: string; tokens: number[]; backoffEvents: any[] }> {
    if (this.worker) {
      const id = ++this.messageId;
      return new Promise((resolve, reject) => {
        this.pending.set(id, {
          resolve: (res) => resolve(res.generation),
          reject
        });
        this.worker!.postMessage({ id, type: 'generate', promptText, n, maxTokens, temperature });
      });
    }
    return this.localEngine.generate(promptText, n, maxTokens, temperature);
  }

  public async getMemoryStats(n: number): Promise<MemoryStats> {
    if (this.worker) {
      const id = ++this.messageId;
      return new Promise((resolve, reject) => {
        this.pending.set(id, {
          resolve: (res) => resolve(res.memoryStats),
          reject
        });
        this.worker!.postMessage({ id, type: 'memoryStats', n });
      });
    }
    return this.localEngine.getMemoryStats(n);
  }

  public async calculateValSeenFraction(n: number, valTokens: Uint16Array): Promise<number> {
    if (this.worker) {
      const id = ++this.messageId;
      return new Promise((resolve, reject) => {
        this.pending.set(id, {
          resolve: (res) => resolve(res.seenFraction),
          reject
        });
        this.worker!.postMessage({ id, type: 'seenFraction', n, valTokens });
      });
    }
    return this.localEngine.calculateValSeenFraction(n, valTokens);
  }

  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
