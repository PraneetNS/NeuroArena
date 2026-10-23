/**
 * TinyGPT Model with Flat Float64Array Memory Layout, Tied Output Head Embeddings,
 * Deterministic PRNG Initialization, and Hand-Derived Analytical Backward Pass.
 * No autograd, no external matrix libraries.
 */

import {
  matmul,
  matmulBackward,
  addBias,
  addBiasBackward,
  layerNorm,
  layerNormBackward,
  geluArray,
  geluBackward,
  causalAttention,
  causalAttentionBackward,
  crossEntropy
} from './ops.js';
import { Xoshiro128StarStar } from './rng.js';
import { GPTConfig, ParamMeta, TinyGPTConfig } from './types.js';

interface BlockActivationCache {
  input: Float64Array;
  ln1Out: Float64Array;
  ln1Mean: Float64Array;
  ln1Rstd: Float64Array;
  q: Float64Array;
  k: Float64Array;
  v: Float64Array;
  attnWeights: Float64Array;
  attnOut: Float64Array;
  mid: Float64Array;
  ln2Out: Float64Array;
  ln2Mean: Float64Array;
  ln2Rstd: Float64Array;
  fcOut: Float64Array;
  geluOut: Float64Array;
  blockOut: Float64Array;
}

interface ForwardCache {
  B: number;
  T: number;
  M: number;
  inputs: Uint16Array;
  targets: Uint16Array | null;
  embeddings: Float64Array;
  blocks: BlockActivationCache[];
  finalLnOut: Float64Array;
  finalMean: Float64Array;
  finalRstd: Float64Array;
  logits: Float64Array;
}

export class TinyGPT {
  public config: GPTConfig;
  public totalParams: number;
  public params: Float64Array;
  public grads: Float64Array;
  public offsets: Map<string, ParamMeta> = new Map();
  public paramList: ParamMeta[] = [];

  public lastCache: ForwardCache | null = null;

  constructor(config: GPTConfig | TinyGPTConfig, seed = 42) {
    const dModel = config.dModel ?? config.nEmbd ?? 64;
    const nLayers = config.nLayers ?? config.nLayer ?? 2;
    const nHeads = config.nHeads ?? config.nHead ?? 2;
    const contextLen = config.contextLen ?? config.blockSize ?? 64;
    const dFF = config.dFF ?? (4 * dModel);
    const vocabSize = config.vocabSize;

    this.config = {
      vocabSize,
      dModel,
      nLayers,
      nHeads,
      dFF,
      contextLen,
      blockSize: contextLen,
      nEmbd: dModel,
      nLayer: nLayers,
      nHead: nHeads
    };

    // 1. Build Named Offset Table for ONE Flat Float64Array Buffer
    // Exact requested order:
    // tokEmb [V,D], posEmb [T,D]; per layer: ln1.g, ln1.b, Wq, bq, Wk, bk, Wv, bv, Wo, bo, ln2.g, ln2.b, W1 [D,F], b1, W2 [F,D], b2; then lnf.g, lnf.b
    let currentOffset = 0;
    const registerParam = (
      name: string,
      shape: number[],
      decay: boolean,
      aliases: string[] = []
    ): ParamMeta => {
      const size = shape.reduce((a, b) => a * b, 1);
      const meta: ParamMeta = {
        name,
        offset: currentOffset,
        size,
        shape: [...shape],
        decay
      };
      this.offsets.set(name, meta);
      for (const a of aliases) {
        this.offsets.set(a, meta);
      }
      this.paramList.push(meta);
      currentOffset += size;
      return meta;
    };

    // Embeddings
    registerParam('tokEmb', [vocabSize, dModel], false, ['wte']);
    registerParam('posEmb', [contextLen, dModel], false, ['wpe']);

    // N Transformer Blocks
    for (let l = 0; l < nLayers; l++) {
      registerParam(`blocks.${l}.ln1.g`, [dModel], false, [`blocks.${l}.ln1_gamma`]);
      registerParam(`blocks.${l}.ln1.b`, [dModel], false, [`blocks.${l}.ln1_bias`]);

      registerParam(`blocks.${l}.Wq`, [dModel, dModel], true, [`blocks.${l}.q_proj_weight`]);
      registerParam(`blocks.${l}.bq`, [dModel], false, [`blocks.${l}.q_proj_bias`]);

      registerParam(`blocks.${l}.Wk`, [dModel, dModel], true, [`blocks.${l}.k_proj_weight`]);
      registerParam(`blocks.${l}.bk`, [dModel], false, [`blocks.${l}.k_proj_bias`]);

      registerParam(`blocks.${l}.Wv`, [dModel, dModel], true, [`blocks.${l}.v_proj_weight`]);
      registerParam(`blocks.${l}.bv`, [dModel], false, [`blocks.${l}.v_proj_bias`]);

      registerParam(`blocks.${l}.Wo`, [dModel, dModel], true, [`blocks.${l}.out_proj_weight`]);
      registerParam(`blocks.${l}.bo`, [dModel], false, [`blocks.${l}.out_proj_bias`]);

      registerParam(`blocks.${l}.ln2.g`, [dModel], false, [`blocks.${l}.ln2_gamma`]);
      registerParam(`blocks.${l}.ln2.b`, [dModel], false, [`blocks.${l}.ln2_bias`]);

      registerParam(`blocks.${l}.W1`, [dModel, dFF], true, [`blocks.${l}.fc_weight`]);
      registerParam(`blocks.${l}.b1`, [dFF], false, [`blocks.${l}.fc_bias`]);

      registerParam(`blocks.${l}.W2`, [dFF, dModel], true, [`blocks.${l}.fc_proj_weight`]);
      registerParam(`blocks.${l}.b2`, [dModel], false, [`blocks.${l}.fc_proj_bias`]);
    }

    // Final LayerNorm
    registerParam('lnf.g', [dModel], false, ['ln_f_gamma']);
    registerParam('lnf.b', [dModel], false, ['ln_f_bias']);

    this.totalParams = currentOffset;
    this.params = new Float64Array(this.totalParams);
    this.grads = new Float64Array(this.totalParams);

    // 2. Initialize weights deterministically
    this.initializeWeights(seed);
  }

  /**
   * Returns total parameter count.
   */
  public numParams(): number {
    return this.totalParams;
  }

  public getParameterCount(): number {
    return this.totalParams;
  }

  public getParamView(name: string): Float64Array {
    const meta = this.offsets.get(name);
    if (!meta) throw new Error(`Unknown parameter: ${name}`);
    return this.params.subarray(meta.offset, meta.offset + meta.size);
  }

  public getGradView(name: string): Float64Array {
    const meta = this.offsets.get(name);
    if (!meta) throw new Error(`Unknown parameter: ${name}`);
    return this.grads.subarray(meta.offset, meta.offset + meta.size);
  }

  public zeroGrad(): void {
    this.grads.fill(0);
  }

  /**
   * Deterministic initialization using xoshiro128**:
   * - normal(0, 0.02)
   * - Wo and W2 scaled by 1/sqrt(2 * nLayers)
   * - LayerNorm g = 1, b = 0
   * - Biases = 0
   */
  public initializeWeights(seed: number): void {
    const rng = new Xoshiro128StarStar(seed);
    const nLayers = this.config.nLayers;
    const residualScale = 1.0 / Math.sqrt(2.0 * nLayers);

    for (const meta of this.paramList) {
      const view = this.getParamView(meta.name);

      if (meta.name.endsWith('.g') || meta.name.endsWith('_gamma')) {
        view.fill(1.0);
      } else if (
        meta.name.endsWith('.b') ||
        meta.name.endsWith('_bias') ||
        meta.name.endsWith('.bq') ||
        meta.name.endsWith('.bk') ||
        meta.name.endsWith('.bv') ||
        meta.name.endsWith('.bo') ||
        meta.name.endsWith('.b1') ||
        meta.name.endsWith('.b2')
      ) {
        view.fill(0.0);
      } else if (
        meta.name.endsWith('.Wo') ||
        meta.name.endsWith('.W2') ||
        meta.name.endsWith('out_proj_weight') ||
        meta.name.endsWith('fc_proj_weight')
      ) {
        const std = 0.02 * residualScale;
        for (let i = 0; i < meta.size; i++) {
          view[i] = rng.nextNormal(0, std);
        }
      } else {
        for (let i = 0; i < meta.size; i++) {
          view[i] = rng.nextNormal(0, 0.02);
        }
      }
    }
  }

  /**
   * Forward pass:
   * Supports both:
   *   model.forward(ids, targets, B, T)
   * and:
   *   model.forward(ids, B, T, targets)
   */
  public forward(
    ids: Uint16Array | number[],
    targets?: Uint16Array | number[] | null,
    B?: number,
    T?: number
  ): { loss: number | null; logits: Float64Array };
  public forward(
    ids: Uint16Array | number[],
    B?: number,
    T?: number,
    targets?: Uint16Array | number[] | null
  ): { loss: number | null; logits: Float64Array };
  public forward(
    ids: Uint16Array | number[],
    arg2?: Uint16Array | number[] | number | null,
    arg3?: number,
    arg4?: Uint16Array | number[] | number | null
  ): { loss: number | null; logits: Float64Array } {
    let targets: Uint16Array | null = null;
    let B = 1;
    let T = ids.length;

    if (typeof arg2 === 'number') {
      // Signature: forward(ids, B, T, targets)
      B = arg2;
      T = typeof arg3 === 'number' ? arg3 : Math.floor(ids.length / B);
      if (arg4 instanceof Uint16Array) {
        targets = arg4;
      } else if (Array.isArray(arg4)) {
        targets = new Uint16Array(arg4);
      } else {
        targets = null;
      }
    } else {
      // Signature: forward(ids, targets, B, T)
      if (arg2 instanceof Uint16Array) {
        targets = arg2;
      } else if (Array.isArray(arg2)) {
        targets = new Uint16Array(arg2);
      } else {
        targets = null;
      }
      B = typeof arg3 === 'number' ? arg3 : 1;
      T = typeof arg4 === 'number' ? arg4 : Math.floor(ids.length / B);
    }

    if (T > this.config.contextLen) {
      throw new Error(`Sequence length ${T} exceeds contextLen ${this.config.contextLen}`);
    }

    const { vocabSize, dModel, nLayers, nHeads, dFF } = this.config;
    const headDim = dModel / nHeads;
    const M = B * T;

    const tokEmb = this.getParamView('tokEmb');
    const posEmb = this.getParamView('posEmb');

    // 1. Token + Positional Embeddings: x = tokEmb[ids] + posEmb[pos]
    const embeddings = new Float64Array(M * dModel);
    for (let b = 0; b < B; b++) {
      for (let t = 0; t < T; t++) {
        const m = b * T + t;
        const tok = ids[m];
        const tokOffset = tok * dModel;
        const posOffset = t * dModel;
        const outOffset = m * dModel;
        for (let d = 0; d < dModel; d++) {
          embeddings[outOffset + d] = tokEmb[tokOffset + d] + posEmb[posOffset + d];
        }
      }
    }

    // 2. Transformer Blocks: x = x + Attn(LN1(x)); x = x + MLP(LN2(x))
    const blockCaches: BlockActivationCache[] = [];
    let hidden = embeddings;

    for (let l = 0; l < nLayers; l++) {
      const ln1G = this.getParamView(`blocks.${l}.ln1.g`);
      const ln1B = this.getParamView(`blocks.${l}.ln1.b`);
      const Wq = this.getParamView(`blocks.${l}.Wq`);
      const bq = this.getParamView(`blocks.${l}.bq`);
      const Wk = this.getParamView(`blocks.${l}.Wk`);
      const bk = this.getParamView(`blocks.${l}.bk`);
      const Wv = this.getParamView(`blocks.${l}.Wv`);
      const bv = this.getParamView(`blocks.${l}.bv`);
      const Wo = this.getParamView(`blocks.${l}.Wo`);
      const bo = this.getParamView(`blocks.${l}.bo`);

      const ln2G = this.getParamView(`blocks.${l}.ln2.g`);
      const ln2B = this.getParamView(`blocks.${l}.ln2.b`);
      const W1 = this.getParamView(`blocks.${l}.W1`);
      const b1 = this.getParamView(`blocks.${l}.b1`);
      const W2 = this.getParamView(`blocks.${l}.W2`);
      const b2 = this.getParamView(`blocks.${l}.b2`);

      const blockInput = hidden;

      // Pre-LN 1
      const ln1Out = new Float64Array(M * dModel);
      const ln1Mean = new Float64Array(M);
      const ln1Rstd = new Float64Array(M);
      layerNorm(blockInput, ln1G, ln1B, ln1Out, ln1Mean, ln1Rstd, M, dModel);

      // Q, K, V projections
      const q = new Float64Array(M * dModel);
      matmul(ln1Out, Wq, q, M, dModel, dModel);
      addBias(q, bq, q, M, dModel);

      const k = new Float64Array(M * dModel);
      matmul(ln1Out, Wk, k, M, dModel, dModel);
      addBias(k, bk, k, M, dModel);

      const v = new Float64Array(M * dModel);
      matmul(ln1Out, Wv, v, M, dModel, dModel);
      addBias(v, bv, v, M, dModel);

      // Causal Attention: scaled by 1/sqrt(headDim) with causal mask
      const attnOut = new Float64Array(M * dModel);
      const attnWeights = new Float64Array(B * nHeads * T * T);
      causalAttention(q, k, v, attnOut, attnWeights, B, T, nHeads, headDim);

      // Output projection Wo + residual connection: mid = blockInput + Attn(LN1(blockInput))
      const attnProj = new Float64Array(M * dModel);
      matmul(attnOut, Wo, attnProj, M, dModel, dModel);
      addBias(attnProj, bo, attnProj, M, dModel);

      const mid = new Float64Array(M * dModel);
      for (let i = 0; i < M * dModel; i++) {
        mid[i] = blockInput[i] + attnProj[i];
      }

      // Pre-LN 2
      const ln2Out = new Float64Array(M * dModel);
      const ln2Mean = new Float64Array(M);
      const ln2Rstd = new Float64Array(M);
      layerNorm(mid, ln2G, ln2B, ln2Out, ln2Mean, ln2Rstd, M, dModel);

      // MLP: W1 -> b1 -> GELU -> W2 -> b2 + residual connection
      const fcOut = new Float64Array(M * dFF);
      matmul(ln2Out, W1, fcOut, M, dModel, dFF);
      addBias(fcOut, b1, fcOut, M, dFF);

      const geluOut = new Float64Array(M * dFF);
      geluArray(fcOut, geluOut, M * dFF);

      const fcProj = new Float64Array(M * dModel);
      matmul(geluOut, W2, fcProj, M, dFF, dModel);
      addBias(fcProj, b2, fcProj, M, dModel);

      const blockOut = new Float64Array(M * dModel);
      for (let i = 0; i < M * dModel; i++) {
        blockOut[i] = mid[i] + fcProj[i];
      }

      blockCaches.push({
        input: blockInput,
        ln1Out,
        ln1Mean,
        ln1Rstd,
        q,
        k,
        v,
        attnWeights,
        attnOut,
        mid,
        ln2Out,
        ln2Mean,
        ln2Rstd,
        fcOut,
        geluOut,
        blockOut
      });

      hidden = blockOut;
    }

    // 3. Final LayerNorm: LNf(x)
    const lnfG = this.getParamView('lnf.g');
    const lnfB = this.getParamView('lnf.b');
    const finalLnOut = new Float64Array(M * dModel);
    const finalMean = new Float64Array(M);
    const finalRstd = new Float64Array(M);
    layerNorm(hidden, lnfG, lnfB, finalLnOut, finalMean, finalRstd, M, dModel);

    // 4. Tied Output Head: logits = finalLnOut @ tokEmb^T
    const logits = new Float64Array(M * vocabSize);
    for (let m = 0; m < M; m++) {
      const mD = m * dModel;
      const mV = m * vocabSize;
      for (let v = 0; v < vocabSize; v++) {
        const vD = v * dModel;
        let dot = 0;
        for (let d = 0; d < dModel; d++) {
          dot += finalLnOut[mD + d] * tokEmb[vD + d];
        }
        logits[mV + v] = dot;
      }
    }

    // 5. Softmax Cross-Entropy Mean over B * T tokens
    let loss: number | null = null;
    if (targets) {
      const dummyGrad = new Float64Array(M * vocabSize);
      loss = crossEntropy(logits, targets, dummyGrad, M, vocabSize);
    }

    this.lastCache = {
      B,
      T,
      M,
      inputs: new Uint16Array(ids),
      targets: targets ? new Uint16Array(targets) : null,
      embeddings,
      blocks: blockCaches,
      finalLnOut,
      finalMean,
      finalRstd,
      logits
    };

    return { logits, loss };
  }

  /**
   * Hand-derived analytical backward pass.
   * Zeroes the flat gradient buffer first, then fills it with parameter gradients.
   * Documented with mathematical derivations for every stage.
   */
  public backward(targets?: Uint16Array | number[]): number {
    // 0. Zero gradient buffer first
    this.zeroGrad();

    if (!this.lastCache) {
      throw new Error('Must run forward pass before backward pass');
    }

    const cache = this.lastCache;
    const tgt = targets ? (targets instanceof Uint16Array ? targets : new Uint16Array(targets)) : cache.targets;
    if (!tgt) {
      throw new Error('Targets must be provided to backward pass');
    }

    const { vocabSize, dModel, nLayers, nHeads, dFF } = this.config;
    const headDim = dModel / nHeads;
    const { B, T, M } = cache;

    // =========================================================================
    // DERIVATION 1: Cross-Entropy Loss + Softmax Output Gradient
    // Loss: L = - (1 / M) * sum_{m=1}^M ln p_{m, target[m]}, where M = B * T
    // Softmax: p_{m, v} = exp(z_{m, v} - max) / sum_k exp(z_{m, k} - max)
    // Derivative w.r.t logits z_{m, v}:
    //   dlogits[m, v] = (p_{m, v} - 1(v == target[m])) / (B * T)
    // =========================================================================
    const dLogits = new Float64Array(M * vocabSize);
    const loss = crossEntropy(cache.logits, tgt, dLogits, M, vocabSize);

    // =========================================================================
    // DERIVATION 2: Tied Head Matmul Backward
    // Forward: logits[m, v] = sum_d finalLnOut[m, d] * tokEmb[v, d]
    // Upstream dLogits: dL / dLogits[m, v]
    // Gradient into finalLnOut:
    //   dFinalLnOut[m, d] = sum_v dLogits[m, v] * tokEmb[v, d]
    // Gradient into tokEmb from head:
    //   dTokEmb_head[v, d] = sum_m dLogits[m, v] * finalLnOut[m, d]
    // Note: tokEmb also accumulates gradients from input embeddings later!
    // =========================================================================
    const tokEmb = this.getParamView('tokEmb');
    const dTokEmb = this.getGradView('tokEmb');
    const dFinalLnOut = new Float64Array(M * dModel);

    for (let m = 0; m < M; m++) {
      const mD = m * dModel;
      const mV = m * vocabSize;
      for (let v = 0; v < vocabSize; v++) {
        const dLogit = dLogits[mV + v];
        if (dLogit === 0) continue;
        const vD = v * dModel;
        for (let d = 0; d < dModel; d++) {
          dFinalLnOut[mD + d] += dLogit * tokEmb[vD + d];
          dTokEmb[vD + d] += dLogit * cache.finalLnOut[mD + d];
        }
      }
    }

    // =========================================================================
    // DERIVATION 3: Final Layer Normalization Backward
    // Forward: y_i = (x_i - mu) * rstd * gamma_i + beta_i, where rstd = 1/sqrt(var + eps)
    // x_hat_i = (x_i - mu) * rstd
    // Parameters:
    //   dgamma_i = sum_m dy_i * x_hat_i
    //   dbeta_i  = sum_m dy_i
    // Input gradient (using mean/variance closed-form formula):
    //   dx_i = rstd * [ dy_i * gamma_i - (1/D) * sum_k dy_k * gamma_k - x_hat_i * (1/D) * sum_k dy_k * gamma_k * x_hat_k ]
    // =========================================================================
    const lnfG = this.getParamView('lnf.g');
    const dLnfG = this.getGradView('lnf.g');
    const dLnfB = this.getGradView('lnf.b');

    const lastBlockOut = nLayers > 0 ? cache.blocks[nLayers - 1].blockOut : cache.embeddings;
    const dHidden = new Float64Array(M * dModel);
    layerNormBackward(
      dFinalLnOut,
      lastBlockOut,
      lnfG,
      cache.finalMean,
      cache.finalRstd,
      dHidden,
      dLnfG,
      dLnfB,
      M,
      dModel
    );

    // =========================================================================
    // DERIVATION 4: Reverse Transformer Block Backpropagation
    // In each block, gradients flow through:
    //   MLP branch + residual -> LN2 -> Attn branch + residual -> LN1
    // =========================================================================
    let dCurr = dHidden;

    for (let l = nLayers - 1; l >= 0; l--) {
      const block = cache.blocks[l];

      const ln1G = this.getParamView(`blocks.${l}.ln1.g`);
      const dLn1G = this.getGradView(`blocks.${l}.ln1.g`);
      const dLn1B = this.getGradView(`blocks.${l}.ln1.b`);

      const Wq = this.getParamView(`blocks.${l}.Wq`);
      const dWq = this.getGradView(`blocks.${l}.Wq`);
      const dbq = this.getGradView(`blocks.${l}.bq`);

      const Wk = this.getParamView(`blocks.${l}.Wk`);
      const dWk = this.getGradView(`blocks.${l}.Wk`);
      const dbk = this.getGradView(`blocks.${l}.bk`);

      const Wv = this.getParamView(`blocks.${l}.Wv`);
      const dWv = this.getGradView(`blocks.${l}.Wv`);
      const dbv = this.getGradView(`blocks.${l}.bv`);

      const Wo = this.getParamView(`blocks.${l}.Wo`);
      const dWo = this.getGradView(`blocks.${l}.Wo`);
      const dbo = this.getGradView(`blocks.${l}.bo`);

      const ln2G = this.getParamView(`blocks.${l}.ln2.g`);
      const dLn2G = this.getGradView(`blocks.${l}.ln2.g`);
      const dLn2B = this.getGradView(`blocks.${l}.ln2.b`);

      const W1 = this.getParamView(`blocks.${l}.W1`);
      const dW1 = this.getGradView(`blocks.${l}.W1`);
      const db1 = this.getGradView(`blocks.${l}.b1`);

      const W2 = this.getParamView(`blocks.${l}.W2`);
      const dW2 = this.getGradView(`blocks.${l}.W2`);
      const db2 = this.getGradView(`blocks.${l}.b2`);

      // -----------------------------------------------------------------------
      // 4A. MLP Backward:
      // Forward: blockOut = mid + W2 @ gelu(W1 @ ln2(mid) + b1) + b2
      // DERIVATION 6 (Part 1 - Residual):
      //   dL / d(blockOut) splits directly into W2 projection and residual path 'mid'
      // -----------------------------------------------------------------------
      const dFcProj = dCurr; // gradient into W2 projection
      const dGeluOut = new Float64Array(M * dFF);
      addBiasBackward(dFcProj, new Float64Array(M * dModel), db2, M, dModel);
      matmulBackward(dFcProj, block.geluOut, W2, dGeluOut, dW2, M, dFF, dModel);

      // DERIVATION 5: GELU Backward (Tanh Approximation)
      // GELU(x) = 0.5 * x * (1 + tanh(u)), u = sqrt(2/pi) * (x + 0.044715 * x^3)
      // dGELU / dx = 0.5 * (1 + tanh(u)) + 0.5 * x * (1 - tanh^2(u)) * sqrt(2/pi) * (1 + 3 * 0.044715 * x^2)
      const dFcOut = new Float64Array(M * dFF);
      geluBackward(dGeluOut, block.fcOut, dFcOut, M * dFF);

      // Linear W1 + b1 backward
      const dLn2Out = new Float64Array(M * dModel);
      addBiasBackward(dFcOut, new Float64Array(M * dFF), db1, M, dFF);
      matmulBackward(dFcOut, block.ln2Out, W1, dLn2Out, dW1, M, dModel, dFF);

      // Pre-LN2 Backward into dMid, adding residual gradient from dCurr
      const dMid = new Float64Array(dCurr); // Residual connection: adds gradient from skip branch
      layerNormBackward(
        dLn2Out,
        block.mid,
        ln2G,
        block.ln2Mean,
        block.ln2Rstd,
        dMid,
        dLn2G,
        dLn2B,
        M,
        dModel
      );

      // -----------------------------------------------------------------------
      // 4B. Attention Backward:
      // Forward: mid = input + Wo @ Attn(LN1(input)) + bo
      // DERIVATION 6 (Part 2 - Residual):
      //   dL / d(mid) splits into Wo output projection and residual path 'input'
      // -----------------------------------------------------------------------
      const dOutProj = dMid;
      const dAttnOut = new Float64Array(M * dModel);
      addBiasBackward(dOutProj, new Float64Array(M * dModel), dbo, M, dModel);
      matmulBackward(dOutProj, block.attnOut, Wo, dAttnOut, dWo, M, dModel, dModel);

      // DERIVATION 4: Causal Self-Attention Backward
      // Context output: C_i = sum_{j <= i} P_{ij} * V_j
      // 1. dV_j = sum_{i >= j} P_{ij} * dC_i
      // 2. dP_{ij} = dC_i . V_j (for j <= i)
      // 3. Softmax row backward: dS_{ij} = P_{ij} * (dP_{ij} - sum_{k <= i} dP_{ik} * P_{ik})
      //    Respecting causal mask: dS_{ij} = 0 for j > i
      // 4. Score S_{ij} = (Q_i . K_j) / sqrt(headDim)
      //    dQ_i = (1 / sqrt(headDim)) * sum_{j <= i} dS_{ij} * K_j
      //    dK_j = (1 / sqrt(headDim)) * sum_{i >= j} dS_{ij} * Q_i
      const dQ = new Float64Array(M * dModel);
      const dK = new Float64Array(M * dModel);
      const dV = new Float64Array(M * dModel);
      causalAttentionBackward(
        dAttnOut,
        block.q,
        block.k,
        block.v,
        block.attnWeights,
        dQ,
        dK,
        dV,
        B,
        T,
        nHeads,
        headDim
      );

      // Q, K, V linear projections backward into dLn1Out
      const dLn1Out = new Float64Array(M * dModel);

      addBiasBackward(dQ, new Float64Array(M * dModel), dbq, M, dModel);
      matmulBackward(dQ, block.ln1Out, Wq, dLn1Out, dWq, M, dModel, dModel);

      addBiasBackward(dK, new Float64Array(M * dModel), dbk, M, dModel);
      matmulBackward(dK, block.ln1Out, Wk, dLn1Out, dWk, M, dModel, dModel);

      addBiasBackward(dV, new Float64Array(M * dModel), dbv, M, dModel);
      matmulBackward(dV, block.ln1Out, Wv, dLn1Out, dWv, M, dModel, dModel);

      // Pre-LN1 Backward into dBlockInput, adding residual gradient from dMid
      const dBlockInput = new Float64Array(dMid); // Residual connection: adds gradient from skip branch
      layerNormBackward(
        dLn1Out,
        block.input,
        ln1G,
        block.ln1Mean,
        block.ln1Rstd,
        dBlockInput,
        dLn1G,
        dLn1B,
        M,
        dModel
      );

      dCurr = dBlockInput;
    }

    // =========================================================================
    // DERIVATION 2 (Part 2 - Tied Head & Embedding Lookup):
    // Upstream gradient dCurr reaches the base embedding layer.
    // Forward: embeddings[m, d] = tokEmb[ids[m], d] + posEmb[pos[m], d]
    // Backward (scatter-add accumulation):
    //   dTokEmb[ids[m], d] += dCurr[m, d]
    //   dPosEmb[pos[m], d] += dCurr[m, d]
    // Result: dTokEmb now contains BOTH the output head projection gradient
    // AND the input token embedding lookup gradient!
    // =========================================================================
    const dPosEmb = this.getGradView('posEmb');
    for (let b = 0; b < B; b++) {
      for (let t = 0; t < T; t++) {
        const m = b * T + t;
        const tok = cache.inputs[m];
        const tokOffset = tok * dModel;
        const posOffset = t * dModel;
        const gradOffset = m * dModel;

        for (let d = 0; d < dModel; d++) {
          const g = dCurr[gradOffset + d];
          dTokEmb[tokOffset + d] += g;
          dPosEmb[posOffset + d] += g;
        }
      }
    }

    return loss;
  }

  public getParameters(): Float64Array {
    return this.params;
  }

  public backwardWithLoss(targets?: Uint16Array): number {
    return this.backward(targets);
  }

  public getAttentionMaps(): Float64Array[] {
    if (!this.lastCache) return [];
    return this.lastCache.blocks.map((b) => b.attnWeights);
  }
}
