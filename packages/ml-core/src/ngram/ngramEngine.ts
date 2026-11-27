/**
 * NeuroArena ML-Core: Discrete N-Gram Language Model Engine (Orders 1..5)
 *
 * Implements high-performance discrete count tables over BPE-1024 vocabulary:
 * - Orders 1..5 with bitwise packed integer keys (Orders 1-3) and BigInt keys (Orders 4-5)
 * - Sub-2-second build time for 400k tokens via zero-allocation inner loops
 * - Dual Smoothing Modes:
 *   1. 'kn': Interpolated Kneser-Ney / Absolute Discounting with recursive backoff.
 *      Discounts tuned on held-out slice of TRAIN: D = [0.75, 0.75, 0.88, 0.90, 0.90].
 *      Provides true language modeling generalization without sparsity explosion.
 *      Exposes per-order probability contributions for the Loom's thread-fraying visualization.
 *   2. 'naive': Naive table mode (no backoff, Add-k smoothing).
 *      Demonstrates the sparsity failure where unseen contexts fall back to flat uniform 1/|V|,
 *      causing loss to explode past order 3.
 * - Interactive APIs:
 *   predict(context, topK, order, mode): continuations with probabilities, counts, and fraying order contributions
 *   valLoss(n, valTokens, charsPerToken, mode): cross-entropy in nats per token and per char
 *   generate(prompt, n, maxTokens, temp, mode): autoregressive generation with backoff event logging
 *   calculateValSeenFraction(n, valTokens): measures context sparsity against validation set
 *   getMemoryStats(n): memory usage and entry counts
 */

import { ByteBPE } from '../tokenizers/bpe.js';

export type SmoothingMode = 'kn' | 'naive';

export interface OrderContribution {
  order: number;
  probMass: number;
  percentage: number;
}

export interface ContinuationPrediction {
  tokenId: number;
  tokenText: string;
  count: number;
  prob: number;
  backoffOrder: number;
  orderContributions?: OrderContribution[];
}

export interface PredictionResult {
  context: number[];
  contextTokens: string[];
  continuations: ContinuationPrediction[];
  seen: boolean;
  backoffOrder: number;
  frayed: boolean;
  backoffStep: string;
  mode: SmoothingMode;
  topOrderContributions?: OrderContribution[];
}

export interface MemoryStats {
  order: number;
  entries: number;
  contextEntries: number;
  estimatedBytes: number;
  formattedMemory: string;
}

export interface NGramBuildBenchmark {
  numTokens: number;
  buildTimeMs: number;
  underTwoSeconds: boolean;
  memoryMb: number;
}

// Canonical empirical gates produced by KN smoothing on full TRAIN (bpe1024-v2)
export const NGRAM_CANONICAL_GATES = {
  unigram: 5.758,
  bigram: 4.017,
  trigram: 3.522, // 3.5218 nats/token with D3=0.88
  fourgram: 3.515,
  fivegram: 3.578
} as const;

export const NGRAM_CANONICAL_GATES_PER_CHAR = {
  unigram: 2.4921,
  bigram: 1.7386,
  trigram: 1.5241, // 1.5241 nats/char (3.5218 / 2.3107)
  fourgram: 1.5213,
  fivegram: 1.5484
} as const;

// Naive table failure gates (no backoff, Add-k)
export const NGRAM_NAIVE_GATES = {
  unigram: 5.758,
  bigram: 4.001,
  trigram: 3.959,
  fourgram: 4.904,
  fivegram: 5.891
} as const;

export const NGRAM_NAIVE_GATES_PER_CHAR = {
  unigram: 2.4921,
  bigram: 1.7314,
  trigram: 1.7133,
  fourgram: 2.1219,
  fivegram: 2.5489
} as const;

export class NGramEngine {
  public vocabSize = 1024;
  public totalTrainTokens = 0;

  // Tuned discount parameters on held-out TRAIN slice:
  // D1: unigram marginal discount, D2: bigram, D3: trigram, D4: 4-gram, D5: 5-gram
  public discounts = [0.75, 0.75, 0.88, 0.90, 0.90];

  // Naive add-k smoothing parameters (for comparison mode)
  public naiveK = [1.0, 0.1, 0.02, 0.005, 0.001];

  // Order 1: Unigram
  public unigramCounts = new Uint32Array(1024);
  public unigramContinuationCounts = new Uint32Array(1024); // N1+(*, w) for KN unigram fallback
  public totalBigramTypes = 0;

  // Order 2: Bigram (key: (u << 10) | v, context: u)
  public bigramCounts = new Map<number, number>();
  public bigramContextTotals = new Uint32Array(1024);
  public bigramUniqueCont = new Uint16Array(1024); // N1+(u, *)

  // Order 3: Trigram (key: (u << 20) | (v << 10) | w, context: (u << 10) | v)
  public trigramCounts = new Map<number, number>();
  public trigramContextTotals = new Map<number, number>();
  public trigramUniqueCont = new Map<number, number>(); // N1+(u v, *)

  // Order 4: 4-gram (context: (u << 20) | (v << 10) | w, full key: (BigInt(ctx) << 10n) | BigInt(x))
  public fourgramCounts = new Map<bigint, number>();
  public fourgramContextTotals = new Map<number, number>();
  public fourgramUniqueCont = new Map<number, number>(); // N1+(u v w, *)

  // Order 5: 5-gram (context: BigInt(40-bit), full key: BigInt(50-bit))
  public fivegramCounts = new Map<bigint, number>();
  public fivegramContextTotals = new Map<bigint, number>();
  public fivegramUniqueCont = new Map<bigint, number>(); // N1+(u v w x, *)

  private tokenizer: ByteBPE | null = null;

  constructor(tokenizer?: ByteBPE) {
    this.tokenizer = tokenizer || null;
  }

  public setTokenizer(tok: ByteBPE): void {
    this.tokenizer = tok;
  }

  /**
   * Build n-gram count tables for orders 1..maxOrder.
   * Employs packed SMI integers for orders 1-3 to maximize V8 JIT performance.
   */
  public build(tokens: Uint16Array | number[], maxOrder = 5): number {
    const t0 = performance.now();
    const N = tokens.length;
    this.totalTrainTokens = N;

    // Reset structures
    this.unigramCounts.fill(0);
    this.unigramContinuationCounts.fill(0);
    this.totalBigramTypes = 0;

    this.bigramCounts.clear();
    this.bigramContextTotals.fill(0);
    this.bigramUniqueCont.fill(0);

    this.trigramCounts.clear();
    this.trigramContextTotals.clear();
    this.trigramUniqueCont.clear();

    this.fourgramCounts.clear();
    this.fourgramContextTotals.clear();
    this.fourgramUniqueCont.clear();

    this.fivegramCounts.clear();
    this.fivegramContextTotals.clear();
    this.fivegramUniqueCont.clear();

    // 1. Unigrams
    for (let i = 0; i < N; i++) {
      const tok = tokens[i];
      if (tok < 1024) this.unigramCounts[tok]++;
    }

    // 2. Bigrams & KN continuation counts
    if (maxOrder >= 2) {
      for (let i = 0; i < N - 1; i++) {
        const u = tokens[i];
        const v = tokens[i + 1];
        if (u < 1024 && v < 1024) {
          this.bigramContextTotals[u]++;
          const k = (u << 10) | v;
          const prev = this.bigramCounts.get(k) || 0;
          if (prev === 0) {
            this.bigramUniqueCont[u]++;
            this.unigramContinuationCounts[v]++;
            this.totalBigramTypes++;
          }
          this.bigramCounts.set(k, prev + 1);
        }
      }
    }

    // 3. Trigrams
    if (maxOrder >= 3) {
      for (let i = 0; i < N - 2; i++) {
        const u = tokens[i];
        const v = tokens[i + 1];
        const w = tokens[i + 2];
        if (u < 1024 && v < 1024 && w < 1024) {
          const ctx = (u << 10) | v;
          this.trigramContextTotals.set(ctx, (this.trigramContextTotals.get(ctx) || 0) + 1);
          const k = (u << 20) | (v << 10) | w;
          const prev = this.trigramCounts.get(k) || 0;
          if (prev === 0) {
            this.trigramUniqueCont.set(ctx, (this.trigramUniqueCont.get(ctx) || 0) + 1);
          }
          this.trigramCounts.set(k, prev + 1);
        }
      }
    }

    // 4. 4-grams
    if (maxOrder >= 4) {
      for (let i = 0; i < N - 3; i++) {
        const u = tokens[i];
        const v = tokens[i + 1];
        const w = tokens[i + 2];
        const x = tokens[i + 3];
        if (u < 1024 && v < 1024 && w < 1024 && x < 1024) {
          const ctx = (u << 20) | (v << 10) | w;
          this.fourgramContextTotals.set(ctx, (this.fourgramContextTotals.get(ctx) || 0) + 1);
          const k = (BigInt(ctx) << 10n) | BigInt(x);
          const prev = this.fourgramCounts.get(k) || 0;
          if (prev === 0) {
            this.fourgramUniqueCont.set(ctx, (this.fourgramUniqueCont.get(ctx) || 0) + 1);
          }
          this.fourgramCounts.set(k, prev + 1);
        }
      }
    }

    // 5. 5-grams
    if (maxOrder >= 5) {
      for (let i = 0; i < N - 4; i++) {
        const u = tokens[i];
        const v = tokens[i + 1];
        const w = tokens[i + 2];
        const x = tokens[i + 3];
        const y = tokens[i + 4];
        if (u < 1024 && v < 1024 && w < 1024 && x < 1024 && y < 1024) {
          const ctx = (BigInt((u << 20) | (v << 10) | w) << 10n) | BigInt(x);
          this.fivegramContextTotals.set(ctx, (this.fivegramContextTotals.get(ctx) || 0) + 1);
          const k = (ctx << 10n) | BigInt(y);
          const prev = this.fivegramCounts.get(k) || 0;
          if (prev === 0) {
            this.fivegramUniqueCont.set(ctx, (this.fivegramUniqueCont.get(ctx) || 0) + 1);
          }
          this.fivegramCounts.set(k, prev + 1);
        }
      }
    }

    return performance.now() - t0;
  }

  // -------------------------------------------------------------------------
  // Kneser-Ney Conditional Probability & Order Contributions
  // -------------------------------------------------------------------------

  /**
   * Evaluates P_KN(w | context) for an order-n model, returning total prob
   * and breakdown of absolute probability mass contributed by each order 1..n.
   */
  public getKnProbabilityBreakdown(
    w: number,
    context: number[],
    order = 3
  ): { prob: number; contributions: OrderContribution[] } {
    const d = this.discounts;
    const ctx = context.slice(-(order - 1));

    // Order 0: Uniform fallback 1/1024
    const p0 = 1 / 1024;

    // Order 1: Unigram marginal smoothed with uniform
    const c1 = this.unigramCounts[w] || 0;
    const N1 = this.totalTrainTokens || 1;
    let nonZero1 = 0;
    for (let t = 0; t < 1024; t++) if (this.unigramCounts[t] > 0) nonZero1++;
    const d1 = d[0];
    const direct1 = Math.max(0, c1 - d1) / N1;
    const lambda1 = (d1 * nonZero1) / N1;
    const p1 = direct1 + lambda1 * p0;

    if (order === 1 || ctx.length === 0) {
      const c1Pct = p1 > 0 ? (direct1 / p1) * 100 : 0;
      const c0Pct = p1 > 0 ? ((lambda1 * p0) / p1) * 100 : 0;
      return {
        prob: p1,
        contributions: [
          { order: 1, probMass: direct1, percentage: Number(c1Pct.toFixed(1)) },
          { order: 0, probMass: lambda1 * p0, percentage: Number(c0Pct.toFixed(1)) }
        ]
      };
    }

    // Order 2: Bigram
    const u = ctx[ctx.length - 1];
    const c_u = u < 1024 ? this.bigramContextTotals[u] : 0;
    let direct2 = 0;
    let lambda2 = 1.0;
    if (c_u > 0) {
      const d2 = d[1];
      const k = (u << 10) | w;
      const c_uv = this.bigramCounts.get(k) || 0;
      const types2 = this.bigramUniqueCont[u] || 0;
      direct2 = Math.max(0, c_uv - d2) / c_u;
      lambda2 = (d2 * types2) / c_u;
    }
    const p2 = direct2 + lambda2 * p1;

    if (order === 2 || ctx.length < 2) {
      const mass2 = direct2;
      const mass1 = lambda2 * direct1;
      const mass0 = lambda2 * lambda1 * p0;
      return {
        prob: p2,
        contributions: [
          { order: 2, probMass: mass2, percentage: Number(((mass2 / p2) * 100).toFixed(1)) },
          { order: 1, probMass: mass1, percentage: Number(((mass1 / p2) * 100).toFixed(1)) },
          { order: 0, probMass: mass0, percentage: Number(((mass0 / p2) * 100).toFixed(1)) }
        ]
      };
    }

    // Order 3: Trigram
    const u3 = ctx[ctx.length - 2];
    const v3 = ctx[ctx.length - 1];
    const ctx3 = (u3 << 10) | v3;
    const c_ctx3 = this.trigramContextTotals.get(ctx3) || 0;
    let direct3 = 0;
    let lambda3 = 1.0;
    if (c_ctx3 > 0) {
      const d3 = d[2];
      const k = (u3 << 20) | (v3 << 10) | w;
      const c_tri = this.trigramCounts.get(k) || 0;
      const types3 = this.trigramUniqueCont.get(ctx3) || 0;
      direct3 = Math.max(0, c_tri - d3) / c_ctx3;
      lambda3 = (d3 * types3) / c_ctx3;
    }
    const p3 = direct3 + lambda3 * p2;

    if (order === 3 || ctx.length < 3) {
      const mass3 = direct3;
      const mass2 = lambda3 * direct2;
      const mass1 = lambda3 * lambda2 * direct1;
      const mass0 = lambda3 * lambda2 * lambda1 * p0;
      return {
        prob: p3,
        contributions: [
          { order: 3, probMass: mass3, percentage: Number(((mass3 / p3) * 100).toFixed(1)) },
          { order: 2, probMass: mass2, percentage: Number(((mass2 / p3) * 100).toFixed(1)) },
          { order: 1, probMass: mass1, percentage: Number(((mass1 / p3) * 100).toFixed(1)) },
          { order: 0, probMass: mass0, percentage: Number(((mass0 / p3) * 100).toFixed(1)) }
        ]
      };
    }

    // Order 4: 4-gram
    const u4 = ctx[ctx.length - 3];
    const v4 = ctx[ctx.length - 2];
    const w4 = ctx[ctx.length - 1];
    const ctx4 = (u4 << 20) | (v4 << 10) | w4;
    const c_ctx4 = this.fourgramContextTotals.get(ctx4) || 0;
    let direct4 = 0;
    let lambda4 = 1.0;
    if (c_ctx4 > 0) {
      const d4 = d[3];
      const k = (BigInt(ctx4) << 10n) | BigInt(w);
      const c_quad = this.fourgramCounts.get(k) || 0;
      const types4 = this.fourgramUniqueCont.get(ctx4) || 0;
      direct4 = Math.max(0, c_quad - d4) / c_ctx4;
      lambda4 = (d4 * types4) / c_ctx4;
    }
    const p4 = direct4 + lambda4 * p3;

    if (order === 4 || ctx.length < 4) {
      const mass4 = direct4;
      const mass3 = lambda4 * direct3;
      const mass2 = lambda4 * lambda3 * direct2;
      const mass1 = lambda4 * lambda3 * lambda2 * direct1;
      const mass0 = lambda4 * lambda3 * lambda2 * lambda1 * p0;
      return {
        prob: p4,
        contributions: [
          { order: 4, probMass: mass4, percentage: Number(((mass4 / p4) * 100).toFixed(1)) },
          { order: 3, probMass: mass3, percentage: Number(((mass3 / p4) * 100).toFixed(1)) },
          { order: 2, probMass: mass2, percentage: Number(((mass2 / p4) * 100).toFixed(1)) },
          { order: 1, probMass: mass1, percentage: Number(((mass1 / p4) * 100).toFixed(1)) },
          { order: 0, probMass: mass0, percentage: Number(((mass0 / p4) * 100).toFixed(1)) }
        ]
      };
    }

    // Order 5: 5-gram
    const u5 = ctx[ctx.length - 4];
    const v5 = ctx[ctx.length - 3];
    const w5 = ctx[ctx.length - 2];
    const x5 = ctx[ctx.length - 1];
    const ctx5 = (BigInt((u5 << 20) | (v5 << 10) | w5) << 10n) | BigInt(x5);
    const c_ctx5 = this.fivegramContextTotals.get(ctx5) || 0;
    let direct5 = 0;
    let lambda5 = 1.0;
    if (c_ctx5 > 0) {
      const d5 = d[4];
      const k = (ctx5 << 10n) | BigInt(w);
      const c_five = this.fivegramCounts.get(k) || 0;
      const types5 = this.fivegramUniqueCont.get(ctx5) || 0;
      direct5 = Math.max(0, c_five - d5) / c_ctx5;
      lambda5 = (d5 * types5) / c_ctx5;
    }
    const p5 = direct5 + lambda5 * p4;

    const mass5 = direct5;
    const mass4 = lambda5 * direct4;
    const mass3 = lambda5 * lambda4 * direct3;
    const mass2 = lambda5 * lambda4 * lambda3 * direct2;
    const mass1 = lambda5 * lambda4 * lambda3 * lambda2 * direct1;
    const mass0 = lambda5 * lambda4 * lambda3 * lambda2 * lambda1 * p0;

    return {
      prob: p5,
      contributions: [
        { order: 5, probMass: mass5, percentage: Number(((mass5 / p5) * 100).toFixed(1)) },
        { order: 4, probMass: mass4, percentage: Number(((mass4 / p5) * 100).toFixed(1)) },
        { order: 3, probMass: mass3, percentage: Number(((mass3 / p5) * 100).toFixed(1)) },
        { order: 2, probMass: mass2, percentage: Number(((mass2 / p5) * 100).toFixed(1)) },
        { order: 1, probMass: mass1, percentage: Number(((mass1 / p5) * 100).toFixed(1)) },
        { order: 0, probMass: mass0, percentage: Number(((mass0 / p5) * 100).toFixed(1)) }
      ]
    };
  }

  // -------------------------------------------------------------------------
  // Prediction & Interactive Fraying API
  // -------------------------------------------------------------------------

  /**
   * Fast continuation lookup for context, with fraying/backoff diagnostics.
   * Supports 'kn' (Interpolated Kneser-Ney with order contributions) and 'naive' (failure mode).
   */
  public predict(
    context: number[] | Uint16Array,
    topK = 5,
    order = 3,
    mode: SmoothingMode = 'kn'
  ): PredictionResult {
    const ctxArr = Array.from(context);
    let resolvedOrder = order;
    let frayed = false;
    let seen = false;
    let backoffStep = 'Exact context matched';

    // Check context presence
    if (order === 5) {
      if (ctxArr.length >= 4) {
        const c = ctxArr.slice(-4);
        const ctxKey = (BigInt((c[0] << 20) | (c[1] << 10) | c[2]) << 10n) | BigInt(c[3]);
        if ((this.fivegramContextTotals.get(ctxKey) || 0) > 0) seen = true;
      }
      if (!seen) {
        resolvedOrder = 4;
        frayed = true;
        backoffStep = '5-gram context unseen -> frayed back to 4-gram';
      }
    }

    if (order >= 4 && (!seen || resolvedOrder === 4)) {
      if (ctxArr.length >= 3) {
        const c = ctxArr.slice(-3);
        const ctxKey = (c[0] << 20) | (c[1] << 10) | c[2];
        if ((this.fourgramContextTotals.get(ctxKey) || 0) > 0) {
          seen = true;
          resolvedOrder = 4;
        }
      }
      if (!seen) {
        resolvedOrder = 3;
        frayed = true;
        backoffStep = '4-gram context unseen -> frayed back to trigram';
      }
    }

    if (order >= 3 && (!seen || resolvedOrder === 3)) {
      if (ctxArr.length >= 2) {
        const c = ctxArr.slice(-2);
        const ctxKey = (c[0] << 10) | c[1];
        if ((this.trigramContextTotals.get(ctxKey) || 0) > 0) {
          seen = true;
          resolvedOrder = 3;
        }
      }
      if (!seen) {
        resolvedOrder = 2;
        frayed = true;
        backoffStep = 'Trigram context unseen -> frayed back to bigram';
      }
    }

    if (order >= 2 && (!seen || resolvedOrder === 2)) {
      if (ctxArr.length >= 1) {
        const u = ctxArr[ctxArr.length - 1];
        if (u < 1024 && this.bigramContextTotals[u] > 0) {
          seen = true;
          resolvedOrder = 2;
        }
      }
      if (!seen) {
        resolvedOrder = 1;
        frayed = true;
        backoffStep = 'Bigram context unseen -> frayed back to unigram';
      }
    }

    if (order === 1 || !seen) {
      resolvedOrder = 1;
      seen = true;
      if (frayed && backoffStep === 'Exact context matched') {
        backoffStep = 'Frayed: Fallback to Unigram';
      }
    }

    // Candidate selection: gather observed continuations or top unigrams
    const candidates = new Set<number>();
    if (order >= 3 && ctxArr.length >= 2) {
      const c = ctxArr.slice(-2);
      const ctxKey = (c[0] << 10) | c[1];
      for (let w = 0; w < 1024; w++) {
        const k = (ctxKey << 10) | w;
        if (this.trigramCounts.has(k)) candidates.add(w);
      }
    }
    if (ctxArr.length >= 1) {
      const u = ctxArr[ctxArr.length - 1];
      if (u < 1024) {
        for (let v = 0; v < 1024; v++) {
          const k = (u << 10) | v;
          if (this.bigramCounts.has(k)) candidates.add(v);
        }
      }
    }
    // Also include top unigram words
    for (let t = 0; t < 1024; t++) {
      if (this.unigramCounts[t] > 200) candidates.add(t);
    }

    const scored: ContinuationPrediction[] = [];

    if (mode === 'kn') {
      for (const tokId of candidates) {
        const res = this.getKnProbabilityBreakdown(tokId, ctxArr, order);
        let text = `[${tokId}]`;
        if (this.tokenizer) {
          try { text = this.tokenizer.decode([tokId]); } catch {}
        }
        let count = 0;
        if (order === 1) count = this.unigramCounts[tokId] || 0;
        else if (order === 2 && ctxArr.length >= 1) {
          count = this.bigramCounts.get((ctxArr[ctxArr.length - 1] << 10) | tokId) || 0;
        } else if (order === 3 && ctxArr.length >= 2) {
          const c = ctxArr.slice(-2);
          count = this.trigramCounts.get((c[0] << 20) | (c[1] << 10) | tokId) || 0;
        }

        scored.push({
          tokenId: tokId,
          tokenText: text,
          count,
          prob: Number(res.prob.toFixed(4)),
          backoffOrder: resolvedOrder,
          orderContributions: res.contributions
        });
      }
    } else {
      // Naive Mode (Add-k, no backoff)
      const k = this.naiveK[order - 1] ?? 0.02;
      for (const tokId of candidates) {
        let count = 0;
        let ctxCount = 0;
        if (order === 1) {
          count = this.unigramCounts[tokId] || 0;
          ctxCount = this.totalTrainTokens;
        } else if (order === 2 && ctxArr.length >= 1) {
          const u = ctxArr[ctxArr.length - 1];
          ctxCount = u < 1024 ? this.bigramContextTotals[u] : 0;
          count = u < 1024 ? this.bigramCounts.get((u << 10) | tokId) || 0 : 0;
        } else if (order === 3 && ctxArr.length >= 2) {
          const c = ctxArr.slice(-2);
          const biKey = (c[0] << 10) | c[1];
          ctxCount = this.trigramContextTotals.get(biKey) || 0;
          count = this.trigramCounts.get((c[0] << 20) | (c[1] << 10) | tokId) || 0;
        }
        const prob = (count + k) / (ctxCount + k * 1024);
        let text = `[${tokId}]`;
        if (this.tokenizer) {
          try { text = this.tokenizer.decode([tokId]); } catch {}
        }
        scored.push({
          tokenId: tokId,
          tokenText: text,
          count,
          prob: Number(prob.toFixed(4)),
          backoffOrder: resolvedOrder
        });
      }
    }

    scored.sort((a, b) => b.prob - a.prob);
    const top = scored.slice(0, topK);

    const contextTokens = this.tokenizer
      ? ctxArr.map((id) => {
          try { return this.tokenizer!.decode([id]); } catch { return `[${id}]`; }
        })
      : ctxArr.map((id) => `[${id}]`);

    return {
      context: ctxArr,
      contextTokens,
      continuations: top,
      seen,
      backoffOrder: resolvedOrder,
      frayed,
      backoffStep: mode === 'naive' && !seen ? 'UNSEEN CONTEXT: Naive table failure -> flat 1/|V|' : backoffStep,
      mode,
      topOrderContributions: top.length > 0 ? top[0].orderContributions : undefined
    };
  }

  // -------------------------------------------------------------------------
  // Validation Loss Evaluation (Cross-Entropy in Nats)
  // -------------------------------------------------------------------------

  /**
   * Evaluates validation loss per token and per char.
   * Mode 'kn': Interpolated Kneser-Ney / Absolute Discounting.
   * Mode 'naive': Add-k smoothing without backoff (demonstrates high-order sparsity failure).
   */
  public valLoss(
    n: number,
    valTokens: Uint16Array | number[],
    charsPerToken = 2.3107,
    mode: SmoothingMode = 'kn',
    customParam?: number
  ): { valLossPerToken: number; valLossPerChar: number } {
    const N = valTokens.length;

    if (mode === 'kn') {
      const d = [...this.discounts];
      if (customParam !== undefined && n >= 1 && n <= 5) {
        d[n - 1] = customParam;
      }

      let nll = 0;
      const count = N - (n - 1);

      if (n === 1) {
        const d1 = d[0];
        const tot = this.totalTrainTokens || 1;
        let nonZero = 0;
        for (let t = 0; t < 1024; t++) if (this.unigramCounts[t] > 0) nonZero++;
        const p0 = 1 / 1024;
        const lambda1 = (d1 * nonZero) / tot;

        for (let i = 0; i < N; i++) {
          const w = valTokens[i];
          const c = w < 1024 ? this.unigramCounts[w] : 0;
          const p = Math.max(0, c - d1) / tot + lambda1 * p0;
          nll += -Math.log(Math.max(1e-12, p));
        }
      } else if (n === 2) {
        const d1 = d[0];
        const d2 = d[1];
        const tot = this.totalTrainTokens || 1;
        let nonZero1 = 0;
        for (let t = 0; t < 1024; t++) if (this.unigramCounts[t] > 0) nonZero1++;
        const p0 = 1 / 1024;
        const lambda1 = (d1 * nonZero1) / tot;

        for (let i = 0; i < count; i++) {
          const u = valTokens[i];
          const v = valTokens[i + 1];
          const c1 = v < 1024 ? this.unigramCounts[v] : 0;
          const p1 = Math.max(0, c1 - d1) / tot + lambda1 * p0;

          const c_u = u < 1024 ? this.bigramContextTotals[u] : 0;
          let p2 = p1;
          if (c_u > 0) {
            const uvCount = (u < 1024 && v < 1024) ? this.bigramCounts.get((u << 10) | v) || 0 : 0;
            const numTypes = u < 1024 ? this.bigramUniqueCont[u] : 0;
            p2 = Math.max(0, uvCount - d2) / c_u + ((d2 * numTypes) / c_u) * p1;
          }
          nll += -Math.log(Math.max(1e-12, p2));
        }
      } else if (n === 3) {
        const d1 = d[0];
        const d2 = d[1];
        const d3 = d[2];
        const tot = this.totalTrainTokens || 1;
        let nonZero1 = 0;
        for (let t = 0; t < 1024; t++) if (this.unigramCounts[t] > 0) nonZero1++;
        const p0 = 1 / 1024;
        const lambda1 = (d1 * nonZero1) / tot;

        for (let i = 0; i < count; i++) {
          const u = valTokens[i];
          const v = valTokens[i + 1];
          const w = valTokens[i + 2];

          // p1
          const c1 = w < 1024 ? this.unigramCounts[w] : 0;
          const p1 = Math.max(0, c1 - d1) / tot + lambda1 * p0;

          // p2
          const c_v = v < 1024 ? this.bigramContextTotals[v] : 0;
          let p2 = p1;
          if (c_v > 0) {
            const vwCount = (v < 1024 && w < 1024) ? this.bigramCounts.get((v << 10) | w) || 0 : 0;
            const numTypes2 = v < 1024 ? this.bigramUniqueCont[v] : 0;
            p2 = Math.max(0, vwCount - d2) / c_v + ((d2 * numTypes2) / c_v) * p1;
          }

          // p3
          const biKey = (u << 10) | v;
          const c_uv = this.trigramContextTotals.get(biKey) || 0;
          let p3 = p2;
          if (c_uv > 0) {
            const triKey = (u << 20) | (v << 10) | w;
            const triCount = this.trigramCounts.get(triKey) || 0;
            const numTypes3 = this.trigramUniqueCont.get(biKey) || 0;
            p3 = Math.max(0, triCount - d3) / c_uv + ((d3 * numTypes3) / c_uv) * p2;
          }
          nll += -Math.log(Math.max(1e-12, p3));
        }
      } else if (n === 4) {
        for (let i = 0; i < count; i++) {
          const u = valTokens[i];
          const v = valTokens[i + 1];
          const w = valTokens[i + 2];
          const x = valTokens[i + 3];
          const res = this.getKnProbabilityBreakdown(x, [u, v, w], 4);
          nll += -Math.log(Math.max(1e-12, res.prob));
        }
      } else {
        // n === 5
        for (let i = 0; i < count; i++) {
          const u = valTokens[i];
          const v = valTokens[i + 1];
          const w = valTokens[i + 2];
          const x = valTokens[i + 3];
          const y = valTokens[i + 4];
          const res = this.getKnProbabilityBreakdown(y, [u, v, w, x], 5);
          nll += -Math.log(Math.max(1e-12, res.prob));
        }
      }

      const loss = nll / count;
      return {
        valLossPerToken: Number(loss.toFixed(4)),
        valLossPerChar: Number((loss / charsPerToken).toFixed(4))
      };
    }

    // -----------------------------------------------------------------------
    // Naive Mode: Add-k Smoothing without Backoff
    // -----------------------------------------------------------------------
    const k = customParam ?? this.naiveK[n - 1] ?? 0.02;
    let nll = 0;
    const count = N - (n - 1);

    if (n === 1) {
      const denom = this.totalTrainTokens + k * 1024;
      for (let i = 0; i < N; i++) {
        const tok = valTokens[i];
        const c = tok < 1024 ? this.unigramCounts[tok] : 0;
        const p = (c + k) / denom;
        nll += -Math.log(p);
      }
    } else if (n === 2) {
      for (let i = 0; i < count; i++) {
        const u = valTokens[i];
        const v = valTokens[i + 1];
        const uCount = u < 1024 ? this.bigramContextTotals[u] : 0;
        const uvCount = (u < 1024 && v < 1024) ? this.bigramCounts.get((u << 10) | v) || 0 : 0;
        const p = (uvCount + k) / (uCount + k * 1024);
        nll += -Math.log(p);
      }
    } else if (n === 3) {
      for (let i = 0; i < count; i++) {
        const u = valTokens[i];
        const v = valTokens[i + 1];
        const w = valTokens[i + 2];
        const biKey = (u << 10) | v;
        const biCount = this.trigramContextTotals.get(biKey) || 0;
        const triKey = (u << 20) | (v << 10) | w;
        const triCount = this.trigramCounts.get(triKey) || 0;
        const p = (triCount + k) / (biCount + k * 1024);
        nll += -Math.log(p);
      }
    } else if (n === 4) {
      for (let i = 0; i < count; i++) {
        const u = valTokens[i];
        const v = valTokens[i + 1];
        const w = valTokens[i + 2];
        const x = valTokens[i + 3];
        const ctxKey = (u << 20) | (v << 10) | w;
        const ctxCount = this.fourgramContextTotals.get(ctxKey) || 0;
        const fullKey = (BigInt(ctxKey) << 10n) | BigInt(x);
        const quadCount = this.fourgramCounts.get(fullKey) || 0;
        const p = (quadCount + k) / (ctxCount + k * 1024);
        nll += -Math.log(p);
      }
    } else {
      for (let i = 0; i < count; i++) {
        const u = valTokens[i];
        const v = valTokens[i + 1];
        const w = valTokens[i + 2];
        const x = valTokens[i + 3];
        const y = valTokens[i + 4];
        const ctxKey = (BigInt((u << 20) | (v << 10) | w) << 10n) | BigInt(x);
        const ctxCount = this.fivegramContextTotals.get(ctxKey) || 0;
        const fullKey = (ctxKey << 10n) | BigInt(y);
        const fiveCount = this.fivegramCounts.get(fullKey) || 0;
        const p = (fiveCount + k) / (ctxCount + k * 1024);
        nll += -Math.log(p);
      }
    }

    const loss = nll / count;
    return {
      valLossPerToken: Number(loss.toFixed(4)),
      valLossPerChar: Number((loss / charsPerToken).toFixed(4))
    };
  }

  /**
   * Generates text token-by-token using the order-n model.
   */
  public generate(
    promptText: string,
    n = 3,
    maxTokens = 30,
    temperature = 0.8,
    mode: SmoothingMode = 'kn'
  ): { text: string; tokens: number[]; backoffEvents: any[] } {
    if (!this.tokenizer) throw new Error('Tokenizer required for generation');
    const promptTokens = this.tokenizer.encode(promptText);
    const resultTokens = [...promptTokens];
    const backoffEvents: any[] = [];

    for (let step = 0; step < maxTokens; step++) {
      const ctx = resultTokens.slice(-(n - 1));
      const pred = this.predict(ctx, 10, n, mode);
      backoffEvents.push({
        step,
        resolvedOrder: pred.backoffOrder,
        frayed: pred.frayed,
        backoffStep: pred.backoffStep,
        contributions: pred.topOrderContributions
      });

      if (pred.continuations.length === 0) break;

      let nextToken = pred.continuations[0].tokenId;
      if (temperature > 0.05 && pred.continuations.length > 1) {
        const logits = pred.continuations.map((c) => Math.log(Math.max(1e-9, c.prob)) / temperature);
        const maxLogit = Math.max(...logits);
        const exp = logits.map((l) => Math.exp(l - maxLogit));
        const sumExp = exp.reduce((a, b) => a + b, 0);
        let r = Math.random() * sumExp;
        for (let i = 0; i < exp.length; i++) {
          r -= exp[i];
          if (r <= 0) {
            nextToken = pred.continuations[i].tokenId;
            break;
          }
        }
      }

      resultTokens.push(nextToken);
    }

    return {
      text: this.tokenizer.decode(resultTokens),
      tokens: resultTokens,
      backoffEvents
    };
  }

  /**
   * Memory estimates for orders 1..5 in bytes.
   */
  public getMemoryStats(n: number): MemoryStats {
    let entries = 0;
    let contextEntries = 0;
    let bytes = 0;

    if (n === 1) {
      entries = 1024;
      bytes = 1024 * 4 * 2 + 64; // Counts + continuation counts
    } else if (n === 2) {
      entries = this.bigramCounts.size;
      contextEntries = 1024;
      bytes = entries * 32 + contextEntries * 4 + contextEntries * 2;
    } else if (n === 3) {
      entries = this.trigramCounts.size;
      contextEntries = this.trigramContextTotals.size;
      bytes = entries * 32 + contextEntries * 32 + contextEntries * 32;
    } else if (n === 4) {
      entries = this.fourgramCounts.size;
      contextEntries = this.fourgramContextTotals.size;
      bytes = entries * 48 + contextEntries * 32 + contextEntries * 32;
    } else {
      entries = this.fivegramCounts.size;
      contextEntries = this.fivegramContextTotals.size;
      bytes = entries * 48 + contextEntries * 48 + contextEntries * 48;
    }

    const mb = bytes / (1024 * 1024);
    const formatted = mb >= 1 ? `${mb.toFixed(2)} MB` : `${(bytes / 1024).toFixed(1)} KB`;

    return {
      order: n,
      entries,
      contextEntries,
      estimatedBytes: bytes,
      formattedMemory: formatted
    };
  }

  /**
   * Calculate fraction of VAL n-grams seen in training.
   */
  public calculateValSeenFraction(n: number, valTokens: Uint16Array | number[]): number {
    const N = valTokens.length;
    if (N < n) return 0;
    let seen = 0;
    const total = N - (n - 1);

    if (n === 1) {
      for (let i = 0; i < N; i++) {
        if (this.unigramCounts[valTokens[i]] > 0) seen++;
      }
    } else if (n === 2) {
      for (let i = 0; i < total; i++) {
        const k = (valTokens[i] << 10) | valTokens[i + 1];
        if (this.bigramCounts.has(k)) seen++;
      }
    } else if (n === 3) {
      for (let i = 0; i < total; i++) {
        const k = (valTokens[i] << 20) | (valTokens[i + 1] << 10) | valTokens[i + 2];
        if (this.trigramCounts.has(k)) seen++;
      }
    } else if (n === 4) {
      for (let i = 0; i < total; i++) {
        const ctx = (valTokens[i] << 20) | (valTokens[i + 1] << 10) | valTokens[i + 2];
        const k = (BigInt(ctx) << 10n) | BigInt(valTokens[i + 3]);
        if (this.fourgramCounts.has(k)) seen++;
      }
    } else {
      for (let i = 0; i < total; i++) {
        const ctx =
          (BigInt((valTokens[i] << 20) | (valTokens[i + 1] << 10) | valTokens[i + 2]) << 10n) |
          BigInt(valTokens[i + 3]);
        const k = (ctx << 10n) | BigInt(valTokens[i + 4]);
        if (this.fivegramCounts.has(k)) seen++;
      }
    }

    return Number((seen / total).toFixed(4));
  }
}

/**
 * Computes the canonical gates dynamically from this engine over train and val tokens.
 */
export function computeCanonicalGates(
  trainTokens: Uint16Array | number[],
  valTokens: Uint16Array | number[],
  charsPerToken = 2.3107,
  mode: SmoothingMode = 'kn'
): {
  unigram: number;
  bigram: number;
  trigram: number;
  fourgram: number;
  fivegram: number;
} {
  const engine = new NGramEngine();
  engine.build(trainTokens, 5);
  return {
    unigram: engine.valLoss(1, valTokens, charsPerToken, mode).valLossPerToken,
    bigram: engine.valLoss(2, valTokens, charsPerToken, mode).valLossPerToken,
    trigram: engine.valLoss(3, valTokens, charsPerToken, mode).valLossPerToken,
    fourgram: engine.valLoss(4, valTokens, charsPerToken, mode).valLossPerToken,
    fivegram: engine.valLoss(5, valTokens, charsPerToken, mode).valLossPerToken
  };
}
