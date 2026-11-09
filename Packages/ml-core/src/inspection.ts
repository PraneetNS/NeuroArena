/**
 * NeuroArena ML-Core: Mechanistic Interpretability & Model Inspection API.
 *
 * Provides on-demand inspection outside the high-throughput training pipeline:
 * - Attention probabilities per layer and head [T, T]
 * - Head metrics: previous-token score, first-token sink mass, local-window mass (<=4 tokens), entropy
 * - Automated thresholded head labeling
 * - Residual stream vector norms and snapshots across embedding and sublayers
 * - Logit Lens: intermediate residual projection through final LayerNorm & tied unembedding head
 * - Per-token surprisal / next-token cross-entropy loss
 * - CPU (TinyGPT) and GPU (GpuModel) support with numerical parity verification
 */

import { TinyGPT } from './model.js';
import { ByteBPE } from './tokenizers/bpe.js';

export interface AttentionHeadMetrics {
  prevTokenScore: number;
  firstTokenScore: number;
  localWindowScore: number;
  entropy: number;
  label: string;
  chancePrev?: number;
  chanceFirst?: number;
  chanceLocal?: number;
  chanceEntropy?: number;
}

export interface AttentionHeadData {
  layer: number;
  head: number;
  probs: Float32Array; // Flattened [T, T] causal attention matrix (row-major)
  metrics: AttentionHeadMetrics;
}

export interface LayerAttentionData {
  layer: number;
  heads: AttentionHeadData[];
}

export type ResidualSublayerType = 'embedding' | 'attn' | 'mlp' | 'final';

export interface ResidualStageData {
  name: string;
  stageIndex: number;
  layerIndex: number; // -1 for embedding, 0..nLayers-1 for transformer blocks
  sublayer: ResidualSublayerType;
  norms: Float32Array; // [T] L2 norm per position
  vectors: Float32Array; // [T * dModel] flat Float32 vectors
}

export interface LogitLensPrediction {
  tokenId: number;
  tokenStr: string;
  prob: number;
  logit: number;
}

export interface LogitLensCell {
  stageName: string;
  position: number;
  tokenStr: string;
  top5: LogitLensPrediction[];
}

export interface LogitLensStageData {
  stageName: string;
  stageIndex: number;
  layerIndex: number;
  sublayer: ResidualSublayerType;
  positions: LogitLensCell[];
}

export interface ModelInspectionResult {
  tokens: number[];
  tokenStrings: string[];
  T: number;
  dModel: number;
  nLayers: number;
  nHeads: number;
  vocabSize: number;
  attention: LayerAttentionData[];
  residuals: ResidualStageData[];
  logitLens: LogitLensStageData[];
  perTokenLoss: Float32Array; // Length T - 1 (loss for predicting token t+1 at position t)
  meanLoss: number;
}

/**
 * Computes mechanistic diagnostic metrics for a single attention head matrix [T, T].
 */
export function computeHeadMetrics(probs: Float32Array | Float64Array, T: number): AttentionHeadMetrics {
  if (T <= 0) {
    return {
      prevTokenScore: 0,
      firstTokenScore: 0,
      localWindowScore: 0,
      entropy: 0,
      label: 'no clear pattern',
      chancePrev: 0,
      chanceFirst: 0,
      chanceLocal: 0,
      chanceEntropy: 0
    };
  }

  let prevTokenSum = 0;
  let firstTokenSum = 0;
  let localWindowSum = 0;
  let totalEntropy = 0;

  for (let i = 0; i < T; i++) {
    const rowOffset = i * T;
    let rowEntropy = 0;

    // First token (attention sink)
    firstTokenSum += probs[rowOffset];

    // Previous token (i - 1)
    if (i > 0) {
      prevTokenSum += probs[rowOffset + (i - 1)];
    }

    // Local window: positions in [max(0, i - 4), i]
    const windowStart = Math.max(0, i - 4);
    for (let j = windowStart; j <= i; j++) {
      localWindowSum += probs[rowOffset + j];
    }

    // Row entropy: -sum(p * ln(p))
    for (let j = 0; j <= i; j++) {
      const p = probs[rowOffset + j];
      if (p > 1e-12) {
        rowEntropy -= p * Math.log(p);
      }
    }
    totalEntropy += rowEntropy;
  }

  const prevTokenScore = T > 1 ? prevTokenSum / (T - 1) : 0;
  const firstTokenScore = firstTokenSum / T;
  const localWindowScore = localWindowSum / T;
  const entropy = totalEntropy / T;

  // Exact uniform causal attention expectations (chance) for context length T
  let harmonicSum = 0;
  for (let k = 1; k <= T; k++) harmonicSum += 1 / k;
  const chanceFirst = harmonicSum / T;
  const chancePrev = T > 1 ? (harmonicSum - 1) / (T - 1) : 0;

  let localChanceSum = 0;
  for (let i = 0; i < T; i++) {
    localChanceSum += Math.min(i + 1, 5) / (i + 1);
  }
  const chanceLocal = localChanceSum / T;

  let chanceEntropySum = 0;
  for (let i = 0; i < T; i++) {
    chanceEntropySum += Math.log(i + 1);
  }
  const chanceEntropy = chanceEntropySum / T;

  // Strict thresholded classification label:
  // Previous-token: score above 0.50
  // Sink: mass on token 0 above 0.50
  // Local-window: score above chance * 2 and at least 0.50
  let label = 'no clear pattern';
  if (prevTokenScore >= 0.50) {
    const ratio = chancePrev > 0 ? prevTokenScore / chancePrev : 0;
    label = `previous-token (${prevTokenScore.toFixed(2)}, ${ratio.toFixed(1)}x chance)`;
  } else if (firstTokenScore >= 0.50) {
    const ratio = chanceFirst > 0 ? firstTokenScore / chanceFirst : 0;
    label = `attention sink (${firstTokenScore.toFixed(2)}, ${ratio.toFixed(1)}x chance)`;
  } else if (localWindowScore >= chanceLocal * 2.0 && localWindowScore >= 0.50) {
    const ratio = chanceLocal > 0 ? localWindowScore / chanceLocal : 0;
    label = `local window (${localWindowScore.toFixed(2)}, ${ratio.toFixed(1)}x chance)`;
  }

  return {
    prevTokenScore,
    firstTokenScore,
    localWindowScore,
    entropy,
    label,
    chancePrev,
    chanceFirst,
    chanceLocal,
    chanceEntropy
  };
}

/**
 * Applies final LayerNorm and tied unembedding head to an intermediate residual stream vector.
 * Returns top 5 token predictions with probabilities.
 */
export function projectLogitLens(
  residualVector: Float32Array | Float64Array,
  tokEmb: Float32Array | Float64Array,
  lnfG: Float32Array | Float64Array,
  lnfB: Float32Array | Float64Array,
  vocabSize: number,
  dModel: number,
  tokenizer?: ByteBPE | null
): LogitLensPrediction[] {
  // 1. LayerNorm on residual vector
  let sum = 0;
  for (let d = 0; d < dModel; d++) sum += residualVector[d];
  const mean = sum / dModel;

  let varSum = 0;
  for (let d = 0; d < dModel; d++) {
    const diff = residualVector[d] - mean;
    varSum += diff * diff;
  }
  const rstd = 1.0 / Math.sqrt(varSum / dModel + 1e-5);

  const normX = new Float64Array(dModel);
  for (let d = 0; d < dModel; d++) {
    normX[d] = ((residualVector[d] - mean) * rstd) * lnfG[d] + lnfB[d];
  }

  // 2. Tied Output Head: logits = normX @ tokEmb^T
  const logits = new Float64Array(vocabSize);
  let maxLogit = -Infinity;
  for (let v = 0; v < vocabSize; v++) {
    const vOffset = v * dModel;
    let dot = 0;
    for (let d = 0; d < dModel; d++) {
      dot += normX[d] * tokEmb[vOffset + d];
    }
    logits[v] = dot;
    if (dot > maxLogit) maxLogit = dot;
  }

  // 3. Softmax
  let sumExp = 0;
  const probs = new Float64Array(vocabSize);
  for (let v = 0; v < vocabSize; v++) {
    const expVal = Math.exp(logits[v] - maxLogit);
    probs[v] = expVal;
    sumExp += expVal;
  }
  const invSumExp = 1.0 / (sumExp + 1e-12);
  for (let v = 0; v < vocabSize; v++) {
    probs[v] *= invSumExp;
  }

  // 4. Extract Top 5
  const topIndices: number[] = [];
  for (let k = 0; k < 5; k++) {
    let bestIdx = -1;
    let bestVal = -Infinity;
    for (let v = 0; v < vocabSize; v++) {
      if (!topIndices.includes(v) && logits[v] > bestVal) {
        bestVal = logits[v];
        bestIdx = v;
      }
    }
    if (bestIdx >= 0) topIndices.push(bestIdx);
  }

  return topIndices.map((idx) => {
    let tokenStr = `[${idx}]`;
    if (tokenizer) {
      try {
        tokenStr = tokenizer.decode([idx]);
      } catch {
        tokenStr = `[${idx}]`;
      }
    }
    return {
      tokenId: idx,
      tokenStr,
      prob: probs[idx],
      logit: logits[idx]
    };
  });
}

/**
 * Inspects a CPU TinyGPT model execution on an input sequence (up to 128 tokens).
 */
export function inspectTinyGPT(
  model: TinyGPT,
  tokens: Uint16Array | Uint32Array | number[],
  tokenizer?: ByteBPE | null
): ModelInspectionResult {
  const tokenArray = Array.from(tokens);
  const T = tokenArray.length;
  if (T === 0) throw new Error('Cannot inspect empty token sequence');
  if (T > model.config.contextLen) {
    throw new Error(`Token sequence length ${T} exceeds model context length ${model.config.contextLen}`);
  }

  const { dModel, nLayers, nHeads, vocabSize } = model.config;

  // Run forward pass
  model.forward(tokenArray, 1, T);
  const cache = model.lastCache;
  if (!cache) throw new Error('Forward cache was not captured');

  // Decode token strings
  const tokenStrings = tokenArray.map((id) => {
    if (tokenizer) {
      try {
        return tokenizer.decode([id]);
      } catch {
        return `[${id}]`;
      }
    }
    return `[${id}]`;
  });

  const tokEmb = model.getParamView('tokEmb');
  const lnfG = model.getParamView('lnf.g');
  const lnfB = model.getParamView('lnf.b');

  // 1. Attention Probabilities & Head Cards
  const attention: LayerAttentionData[] = [];
  for (let l = 0; l < nLayers; l++) {
    const rawAttn = cache.blocks[l].attnWeights; // Shape: [1, nHeads, T, T]
    const heads: AttentionHeadData[] = [];

    for (let h = 0; h < nHeads; h++) {
      const headProbs = new Float32Array(T * T);
      const headOffset = h * (T * T);
      for (let i = 0; i < T * T; i++) {
        headProbs[i] = rawAttn[headOffset + i];
      }

      const metrics = computeHeadMetrics(headProbs, T);
      heads.push({
        layer: l,
        head: h,
        probs: headProbs,
        metrics
      });
    }

    attention.push({ layer: l, heads });
  }

  // 2. Residual Stream Snapshots (embedding, then per-layer attn & mlp residuals)
  const residuals: ResidualStageData[] = [];
  let stageIdx = 0;

  // Stage 0: Embeddings
  const embedVectors = new Float32Array(T * dModel);
  const embedNorms = new Float32Array(T);
  for (let t = 0; t < T; t++) {
    let sumSq = 0;
    const offset = t * dModel;
    for (let d = 0; d < dModel; d++) {
      const val = cache.embeddings[offset + d];
      embedVectors[offset + d] = val;
      sumSq += val * val;
    }
    embedNorms[t] = Math.sqrt(sumSq);
  }
  residuals.push({
    name: 'embedding',
    stageIndex: stageIdx++,
    layerIndex: -1,
    sublayer: 'embedding',
    norms: embedNorms,
    vectors: embedVectors
  });

  // Stages 1..2L: Attention and MLP residual checkpoints
  for (let l = 0; l < nLayers; l++) {
    const block = cache.blocks[l];

    // After Attention Residual: mid
    const attnVectors = new Float32Array(T * dModel);
    const attnNorms = new Float32Array(T);
    for (let t = 0; t < T; t++) {
      let sumSq = 0;
      const offset = t * dModel;
      for (let d = 0; d < dModel; d++) {
        const val = block.mid[offset + d];
        attnVectors[offset + d] = val;
        sumSq += val * val;
      }
      attnNorms[t] = Math.sqrt(sumSq);
    }
    residuals.push({
      name: `layer_${l}_attn`,
      stageIndex: stageIdx++,
      layerIndex: l,
      sublayer: 'attn',
      norms: attnNorms,
      vectors: attnVectors
    });

    // After MLP Residual: blockOut
    const mlpVectors = new Float32Array(T * dModel);
    const mlpNorms = new Float32Array(T);
    for (let t = 0; t < T; t++) {
      let sumSq = 0;
      const offset = t * dModel;
      for (let d = 0; d < dModel; d++) {
        const val = block.blockOut[offset + d];
        mlpVectors[offset + d] = val;
        sumSq += val * val;
      }
      mlpNorms[t] = Math.sqrt(sumSq);
    }
    residuals.push({
      name: `layer_${l}_mlp`,
      stageIndex: stageIdx++,
      layerIndex: l,
      sublayer: 'mlp',
      norms: mlpNorms,
      vectors: mlpVectors
    });
  }

  // 3. Logit Lens: apply final LayerNorm & unembedding to every residual stage
  const logitLens: LogitLensStageData[] = [];
  for (const resStage of residuals) {
    const positions: LogitLensCell[] = [];
    for (let t = 0; t < T; t++) {
      const vec = resStage.vectors.subarray(t * dModel, (t + 1) * dModel);
      const top5 = projectLogitLens(vec, tokEmb, lnfG, lnfB, vocabSize, dModel, tokenizer);
      positions.push({
        stageName: resStage.name,
        position: t,
        tokenStr: tokenStrings[t],
        top5
      });
    }
    logitLens.push({
      stageName: resStage.name,
      stageIndex: resStage.stageIndex,
      layerIndex: resStage.layerIndex,
      sublayer: resStage.sublayer,
      positions
    });
  }

  // 4. Per-Token Loss (Cross Entropy predicting tokens[t+1] at pos t)
  const perTokenLoss = new Float32Array(Math.max(0, T - 1));
  let lossSum = 0;
  for (let t = 0; t < T - 1; t++) {
    const nextTok = tokenArray[t + 1];
    const logitOffset = t * vocabSize;

    // Logits softmax for pos t
    let maxL = -Infinity;
    for (let v = 0; v < vocabSize; v++) {
      if (cache.logits[logitOffset + v] > maxL) maxL = cache.logits[logitOffset + v];
    }
    let sExp = 0;
    for (let v = 0; v < vocabSize; v++) {
      sExp += Math.exp(cache.logits[logitOffset + v] - maxL);
    }
    const targetLogit = cache.logits[logitOffset + nextTok];
    const loss = -(targetLogit - maxL) + Math.log(sExp);
    perTokenLoss[t] = loss;
    lossSum += loss;
  }
  const meanLoss = T > 1 ? lossSum / (T - 1) : 0;

  return {
    tokens: tokenArray,
    tokenStrings,
    T,
    dModel,
    nLayers,
    nHeads,
    vocabSize,
    attention,
    residuals,
    logitLens,
    perTokenLoss,
    meanLoss
  };
}

/**
 * Inspects a WebGPU GpuModel execution on an input sequence (up to 128 tokens).
 * Reads back attention probabilities, intermediate residual buffers, logits, and losses.
 */
export async function inspectGpuModel(
  gpuModel: any,
  tokens: Uint16Array | Uint32Array | number[],
  tokenizer?: ByteBPE | null
): Promise<ModelInspectionResult> {
  const tokenArray = Array.from(tokens);
  const T = tokenArray.length;
  if (T === 0) throw new Error('Cannot inspect empty token sequence');
  if (T > gpuModel.T) {
    throw new Error(`Token sequence length ${T} exceeds GPU model max context length ${gpuModel.T}`);
  }

  const { dModel, nLayers, nHeads, vocabSize } = gpuModel.config;
  const device = gpuModel.context.device;

  // Pad sequence to gpuModel.T if needed
  const paddedInput = new Uint32Array(gpuModel.B * gpuModel.T);
  for (let i = 0; i < T; i++) paddedInput[i] = tokenArray[i];

  // Set targets as shifted sequence
  const paddedTargets = new Uint32Array(gpuModel.B * gpuModel.T);
  for (let i = 0; i < T - 1; i++) paddedTargets[i] = tokenArray[i + 1];

  device.queue.writeBuffer(gpuModel.inputIdsBuffer, 0, paddedInput as unknown as BufferSource);
  device.queue.writeBuffer(gpuModel.targetsBuffer, 0, paddedTargets as unknown as BufferSource);

  // Encode forward pass
  const encoder = device.createCommandEncoder({ label: 'GpuInspectEncoder' });
  const pass = encoder.beginComputePass({ label: 'GpuInspectPass' });
  gpuModel.encodeForward(pass, { hasTargets: true });
  pass.end();
  device.queue.submit([encoder.finish()]);

  // Decode token strings
  const tokenStrings = tokenArray.map((id) => {
    if (tokenizer) {
      try {
        return tokenizer.decode([id]);
      } catch {
        return `[${id}]`;
      }
    }
    return `[${id}]`;
  });

  // Read back tokEmb, lnfG, lnfB for logit lens computation
  const tokEmbMeta = gpuModel.offsets.get('tokEmb');
  const lnfGMeta = gpuModel.offsets.get('lnf.g');
  const lnfBMeta = gpuModel.offsets.get('lnf.b');

  const allParams = await gpuModel.context.readBufferFloat32(gpuModel.paramsBuffer, gpuModel.totalParams);
  const tokEmb = allParams.subarray(tokEmbMeta.offset, tokEmbMeta.offset + tokEmbMeta.size);
  const lnfG = allParams.subarray(lnfGMeta.offset, lnfGMeta.offset + lnfGMeta.size);
  const lnfB = allParams.subarray(lnfBMeta.offset, lnfBMeta.offset + lnfBMeta.size);

  // 1. Attention Maps
  const attention: LayerAttentionData[] = [];
  for (let l = 0; l < nLayers; l++) {
    const rawProbs = await gpuModel.context.readBufferFloat32(
      gpuModel.blockBuffers[l].probs,
      gpuModel.B * nHeads * gpuModel.T * gpuModel.T
    );
    const heads: AttentionHeadData[] = [];

    for (let h = 0; h < nHeads; h++) {
      const headProbs = new Float32Array(T * T);
      const gpuHeadOffset = h * (gpuModel.T * gpuModel.T);

      for (let i = 0; i < T; i++) {
        for (let j = 0; j < T; j++) {
          headProbs[i * T + j] = rawProbs[gpuHeadOffset + i * gpuModel.T + j];
        }
      }

      const metrics = computeHeadMetrics(headProbs, T);
      heads.push({
        layer: l,
        head: h,
        probs: headProbs,
        metrics
      });
    }

    attention.push({ layer: l, heads });
  }

  // 2. Residual Stream Snapshots
  const residuals: ResidualStageData[] = [];
  let stageIdx = 0;

  // Embedding
  const rawEmbed = await gpuModel.context.readBufferFloat32(gpuModel.embeddingsBuffer, gpuModel.B * gpuModel.T * dModel);
  const embedVectors = new Float32Array(T * dModel);
  const embedNorms = new Float32Array(T);
  for (let t = 0; t < T; t++) {
    let sumSq = 0;
    const offset = t * dModel;
    for (let d = 0; d < dModel; d++) {
      const val = rawEmbed[offset + d];
      embedVectors[offset + d] = val;
      sumSq += val * val;
    }
    embedNorms[t] = Math.sqrt(sumSq);
  }
  residuals.push({
    name: 'embedding',
    stageIndex: stageIdx++,
    layerIndex: -1,
    sublayer: 'embedding',
    norms: embedNorms,
    vectors: embedVectors
  });

  // Layer sublayers
  for (let l = 0; l < nLayers; l++) {
    const bBuf = gpuModel.blockBuffers[l];

    // Mid
    const rawMid = await gpuModel.context.readBufferFloat32(bBuf.mid, gpuModel.B * gpuModel.T * dModel);
    const attnVectors = new Float32Array(T * dModel);
    const attnNorms = new Float32Array(T);
    for (let t = 0; t < T; t++) {
      let sumSq = 0;
      const offset = t * dModel;
      for (let d = 0; d < dModel; d++) {
        const val = rawMid[offset + d];
        attnVectors[offset + d] = val;
        sumSq += val * val;
      }
      attnNorms[t] = Math.sqrt(sumSq);
    }
    residuals.push({
      name: `layer_${l}_attn`,
      stageIndex: stageIdx++,
      layerIndex: l,
      sublayer: 'attn',
      norms: attnNorms,
      vectors: attnVectors
    });

    // BlockOut
    const rawOut = await gpuModel.context.readBufferFloat32(bBuf.blockOut, gpuModel.B * gpuModel.T * dModel);
    const mlpVectors = new Float32Array(T * dModel);
    const mlpNorms = new Float32Array(T);
    for (let t = 0; t < T; t++) {
      let sumSq = 0;
      const offset = t * dModel;
      for (let d = 0; d < dModel; d++) {
        const val = rawOut[offset + d];
        mlpVectors[offset + d] = val;
        sumSq += val * val;
      }
      mlpNorms[t] = Math.sqrt(sumSq);
    }
    residuals.push({
      name: `layer_${l}_mlp`,
      stageIndex: stageIdx++,
      layerIndex: l,
      sublayer: 'mlp',
      norms: mlpNorms,
      vectors: mlpVectors
    });
  }

  // 3. Logit Lens
  const logitLens: LogitLensStageData[] = [];
  for (const resStage of residuals) {
    const positions: LogitLensCell[] = [];
    for (let t = 0; t < T; t++) {
      const vec = resStage.vectors.subarray(t * dModel, (t + 1) * dModel);
      const top5 = projectLogitLens(vec, tokEmb, lnfG, lnfB, vocabSize, dModel, tokenizer);
      positions.push({
        stageName: resStage.name,
        position: t,
        tokenStr: tokenStrings[t],
        top5
      });
    }
    logitLens.push({
      stageName: resStage.name,
      stageIndex: resStage.stageIndex,
      layerIndex: resStage.layerIndex,
      sublayer: resStage.sublayer,
      positions
    });
  }

  // 4. Per-token Loss
  const rawRowLoss = await gpuModel.context.readBufferFloat32(gpuModel.rowLossBuffer, gpuModel.B * gpuModel.T);
  const perTokenLoss = new Float32Array(Math.max(0, T - 1));
  let lossSum = 0;
  for (let t = 0; t < T - 1; t++) {
    const loss = rawRowLoss[t];
    perTokenLoss[t] = loss;
    lossSum += loss;
  }
  const meanLoss = T > 1 ? lossSum / (T - 1) : 0;

  return {
    tokens: tokenArray,
    tokenStrings,
    T,
    dModel,
    nLayers,
    nHeads,
    vocabSize,
    attention,
    residuals,
    logitLens,
    perTokenLoss,
    meanLoss
  };
}

/**
 * Unified inspection entry point. Dispatches to inspectTinyGPT or inspectGpuModel.
 */
export async function inspect(
  model: TinyGPT | any,
  tokens: Uint16Array | Uint32Array | number[],
  tokenizer?: ByteBPE | null
): Promise<ModelInspectionResult> {
  if (model instanceof TinyGPT) {
    return inspectTinyGPT(model, tokens, tokenizer);
  }
  return inspectGpuModel(model, tokens, tokenizer);
}

/**
 * Parity check function verifying CPU vs GPU inspection outputs match within numerical tolerances.
 */
export function compareInspectionParity(
  cpu: ModelInspectionResult,
  gpu: ModelInspectionResult,
  tolerance = 1e-3
): {
  matches: boolean;
  maxDiff: number;
  attentionMaxDiff: number;
  residualNormMaxDiff: number;
  lossMaxDiff: number;
  logitLensAgreementPercent: number;
} {
  let attentionMaxDiff = 0;
  for (let l = 0; l < cpu.attention.length; l++) {
    for (let h = 0; h < cpu.attention[l].heads.length; h++) {
      const cProbs = cpu.attention[l].heads[h].probs;
      const gProbs = gpu.attention[l].heads[h].probs;
      for (let i = 0; i < cProbs.length; i++) {
        const diff = Math.abs(cProbs[i] - gProbs[i]);
        if (diff > attentionMaxDiff) attentionMaxDiff = diff;
      }
    }
  }

  let residualNormMaxDiff = 0;
  for (let s = 0; s < cpu.residuals.length; s++) {
    const cNorms = cpu.residuals[s].norms;
    const gNorms = gpu.residuals[s].norms;
    for (let t = 0; t < cNorms.length; t++) {
      const diff = Math.abs(cNorms[t] - gNorms[t]);
      if (diff > residualNormMaxDiff) residualNormMaxDiff = diff;
    }
  }

  let lossMaxDiff = 0;
  for (let t = 0; t < cpu.perTokenLoss.length; t++) {
    const diff = Math.abs(cpu.perTokenLoss[t] - gpu.perTokenLoss[t]);
    if (diff > lossMaxDiff) lossMaxDiff = diff;
  }

  let totalLensCells = 0;
  let matchingTop1 = 0;
  for (let s = 0; s < cpu.logitLens.length; s++) {
    const cPositions = cpu.logitLens[s].positions;
    const gPositions = gpu.logitLens[s].positions;
    for (let t = 0; t < cPositions.length; t++) {
      totalLensCells++;
      if (cPositions[t].top5[0]?.tokenId === gPositions[t].top5[0]?.tokenId) {
        matchingTop1++;
      }
    }
  }
  const logitLensAgreementPercent = totalLensCells > 0 ? (matchingTop1 / totalLensCells) * 100 : 100;

  const maxDiff = Math.max(attentionMaxDiff, residualNormMaxDiff, lossMaxDiff);
  const matches = maxDiff <= tolerance && logitLensAgreementPercent >= 95;

  return {
    matches,
    maxDiff,
    attentionMaxDiff,
    residualNormMaxDiff,
    lossMaxDiff,
    logitLensAgreementPercent
  };
}
