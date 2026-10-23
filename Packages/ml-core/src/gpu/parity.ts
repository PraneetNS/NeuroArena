/**
 * CPU (Float64) vs WebGPU (Float32) Parity & Training Benchmark Suite.
 * 
 * 1. Forward Parity: Loss, Logits, and per-layer activation comparison across Presets C, S, M.
 * 2. Gradient Parity: Parameter group gradient relative errors vs CPU analytical backward.
 * 3. 300-step Shakespeare Training Curve Comparison (CPU vs GPU).
 * 4. Benchmarking: ms/step, tokens/s, TFLOPS for Presets C, S (B16, B32), M (B16).
 */

import { DataLoader } from '../dataset.js';
import { TinyGPT } from '../model.js';
import { AdamW, CosineLRScheduler } from '../optimizer.js';
import { Xoshiro128StarStar } from '../rng.js';
import { CharTokenizer, normalizeText } from '../tokenizers/char.js';
import { GPTConfig, PRESETS } from '../types.js';
import { GpuContext } from './context.js';
import { GpuModel } from './model.js';
import { GpuTrainer } from './trainer.js';

export interface LayerParityResult {
  layer: number;
  maxAbsDiff: number;
  relError: number;
  passed: boolean;
}

export interface PresetParityResult {
  preset: 'C' | 'S' | 'M';
  config: GPTConfig;
  batchSize: number;
  seqLen: number;
  cpuLoss: number;
  gpuLoss: number;
  lossAbsDiff: number;
  lossRelError: number;
  logitsMaxAbsDiff: number;
  logitsRelError: number;
  layerResults: LayerParityResult[];
  lossPassed: boolean;
  logitsPassed: boolean;
  overallPassed: boolean;
  forwardTimeMs?: number;
}

export interface FullParityReport {
  presets: Record<'C' | 'S' | 'M', PresetParityResult>;
  timingReport?: {
    presetS_B16_ms: number;
    presetM_B16_ms: number;
  };
  allPassed: boolean;
}

export interface ParamGroupGradResult {
  name: string;
  size: number;
  maxAbsDiff: number;
  maxCpuGrad: number;
  relError: number;
  passed: boolean;
}

export interface GradParityReport {
  preset: 'C' | 'S' | 'M';
  groups: ParamGroupGradResult[];
  worstGroup: ParamGroupGradResult;
  overallPassed: boolean;
}

export interface TrainingCurvePoint {
  step: number;
  cpuLoss: number;
  gpuLoss: number;
}

export interface TrainingParityReport {
  preset: string;
  totalSteps: number;
  points: TrainingCurvePoint[];
  finalCpuLoss: number;
  finalGpuLoss: number;
}

export interface BenchmarkItemResult {
  preset: string;
  batchSize: number;
  seqLen: number;
  params: number;
  msPerStep: number;
  tokensPerSec: number;
  tflops: number;
  adapterName: string;
}

export interface TrainingBenchmarkSuiteResult {
  adapterName: string;
  items: BenchmarkItemResult[];
}

/**
 * 1. Forward Parity Pass
 */
export async function runPresetParity(
  context: GpuContext,
  presetKey: 'C' | 'S' | 'M',
  options: {
    B?: number;
    T?: number;
    vocabSize?: number;
    seed?: number;
  } = {}
): Promise<PresetParityResult> {
  const seed = options.seed ?? 42;
  const rng = new Xoshiro128StarStar(seed);

  const baseConfig = PRESETS[presetKey];
  const vocabSize = options.vocabSize ?? (presetKey === 'C' ? 81 : baseConfig.vocabSize);
  const B = options.B ?? 4;
  const T = options.T ?? Math.min(64, baseConfig.contextLen);

  const config: GPTConfig = {
    ...baseConfig,
    vocabSize,
    contextLen: Math.max(T, baseConfig.contextLen)
  };

  const cpuModel = new TinyGPT(config, seed);
  const gpuModel = new GpuModel(context, config, cpuModel.params, B, T);

  const M = B * T;
  const inputs = new Uint16Array(M);
  const targets = new Uint16Array(M);
  for (let i = 0; i < M; i++) {
    inputs[i] = rng.next() % vocabSize;
    targets[i] = rng.next() % vocabSize;
  }

  const cpuRes = cpuModel.forward(inputs, targets, B, T);
  const cpuLoss = cpuRes.loss!;
  const cpuLogits = cpuRes.logits;
  const cpuCache = cpuModel.lastCache!;

  const gpuRes = await gpuModel.forward(inputs, targets, {
    readbackLoss: true,
    readbackLogits: true,
    readbackBlockOutputs: true
  });
  const gpuLoss = gpuRes.loss!;
  const gpuLogits = gpuRes.logits!;
  const gpuBlockOutputs = gpuRes.blockOutputs!;

  const lossAbsDiff = Math.abs(cpuLoss - gpuLoss);
  const lossRelError = lossAbsDiff / (Math.abs(cpuLoss) + 1e-12);
  const lossPassed = lossRelError < 1e-4;

  let maxLogitDiff = 0;
  let maxCpuLogit = 0;
  const totalLogits = M * vocabSize;
  for (let i = 0; i < totalLogits; i++) {
    const diff = Math.abs(cpuLogits[i] - gpuLogits[i]);
    if (diff > maxLogitDiff) maxLogitDiff = diff;
    if (Math.abs(cpuLogits[i]) > maxCpuLogit) maxCpuLogit = Math.abs(cpuLogits[i]);
  }
  const logitsRelError = maxLogitDiff / Math.max(maxCpuLogit, 1e-8);
  const logitsPassed = maxLogitDiff < 1e-3 || logitsRelError < 1e-3;

  const layerResults: LayerParityResult[] = [];
  for (let l = 0; l < config.nLayers; l++) {
    const cpuBlockOut = cpuCache.blocks[l].blockOut;
    const gpuBlockOut = gpuBlockOutputs[l];
    let maxDiff = 0;
    let maxVal = 0;
    const len = M * config.dModel;
    for (let i = 0; i < len; i++) {
      const diff = Math.abs(cpuBlockOut[i] - gpuBlockOut[i]);
      if (diff > maxDiff) maxDiff = diff;
      if (Math.abs(cpuBlockOut[i]) > maxVal) maxVal = Math.abs(cpuBlockOut[i]);
    }
    const rel = maxDiff / Math.max(maxVal, 1e-8);
    layerResults.push({
      layer: l,
      maxAbsDiff: maxDiff,
      relError: rel,
      passed: rel < 1e-3
    });
  }

  const overallPassed = lossPassed && logitsPassed && layerResults.every((r) => r.passed);

  return {
    preset: presetKey,
    config,
    batchSize: B,
    seqLen: T,
    cpuLoss,
    gpuLoss,
    lossAbsDiff,
    lossRelError,
    logitsMaxAbsDiff: maxLogitDiff,
    logitsRelError,
    layerResults,
    lossPassed,
    logitsPassed,
    overallPassed
  };
}

/**
 * 2. Gradient Parity Pass
 */
export async function runGradParity(
  context: GpuContext,
  presetKey: 'C' | 'S' | 'M' = 'C',
  options: { B?: number; T?: number; vocabSize?: number; seed?: number } = {}
): Promise<GradParityReport> {
  const seed = options.seed ?? 42;
  const rng = new Xoshiro128StarStar(seed);

  const baseConfig = PRESETS[presetKey];
  const vocabSize = options.vocabSize ?? (presetKey === 'C' ? 81 : baseConfig.vocabSize);
  const B = options.B ?? 4;
  const T = options.T ?? Math.min(64, baseConfig.contextLen);

  const config: GPTConfig = {
    ...baseConfig,
    vocabSize,
    contextLen: Math.max(T, baseConfig.contextLen)
  };

  const cpuModel = new TinyGPT(config, seed);
  const gpuModel = new GpuModel(context, config, cpuModel.params, B, T);

  const M = B * T;
  const inputs = new Uint16Array(M);
  const targets = new Uint16Array(M);
  for (let i = 0; i < M; i++) {
    inputs[i] = rng.next() % vocabSize;
    targets[i] = rng.next() % vocabSize;
  }

  // CPU Forward & Backward
  cpuModel.forward(inputs, targets, B, T);
  cpuModel.backward(targets);
  const cpuGrads = cpuModel.grads;

  // GPU Forward & Backward
  await gpuModel.forward(inputs, targets, { readbackLoss: false });
  await gpuModel.backward();
  const gpuGrads = await gpuModel.getGrads();

  // Compare gradients per parameter group
  const groups: ParamGroupGradResult[] = [];
  let worstGroup: ParamGroupGradResult = {
    name: '',
    size: 0,
    maxAbsDiff: -1,
    maxCpuGrad: 0,
    relError: -1,
    passed: true
  };

  for (const meta of cpuModel.paramList) {
    let maxDiff = 0;
    let maxCpu = 0;
    for (let i = 0; i < meta.size; i++) {
      const idx = meta.offset + i;
      const cg = cpuGrads[idx];
      const gg = gpuGrads[idx];
      const diff = Math.abs(cg - gg);
      if (diff > maxDiff) maxDiff = diff;
      if (Math.abs(cg) > maxCpu) maxCpu = Math.abs(cg);
    }
    const relError = maxDiff / Math.max(maxCpu, 1e-5);
    const passed = maxDiff < 1e-4 || relError < 1e-3;

    const groupRes: ParamGroupGradResult = {
      name: meta.name,
      size: meta.size,
      maxAbsDiff: maxDiff,
      maxCpuGrad: maxCpu,
      relError,
      passed
    };
    groups.push(groupRes);

    if (relError > worstGroup.relError) {
      worstGroup = groupRes;
    }
  }

  const overallPassed = groups.every((g) => g.passed);

  return {
    preset: presetKey,
    groups,
    worstGroup,
    overallPassed
  };
}

/**
 * 3. 300-step Shakespeare Training Curve Comparison (CPU vs GPU)
 */
export async function runTrainingParity(
  context: GpuContext,
  rawCorpus: string,
  totalSteps = 300
): Promise<TrainingParityReport> {
  const normText = normalizeText(rawCorpus);
  const tokenizer = new CharTokenizer();
  tokenizer.buildVocab(normText);
  const tokens = tokenizer.encode(normText);

  const B = 16;
  const T = 64;
  const seed = 1337;
  const warmupSteps = 20;
  const maxLR = 0.003;
  const minLR = 0.0003;

  const config: GPTConfig = {
    ...PRESETS.C,
    vocabSize: tokenizer.vocabSize,
    contextLen: 64
  };

  // CPU Training
  const cpuModel = new TinyGPT(config, 42);
  const cpuScheduler = new CosineLRScheduler({ maxLR, minLR, warmupSteps, totalSteps });
  const cpuOpt = new AdamW(cpuModel, {
    lr: maxLR,
    weightDecay: 0.1,
    maxGradNorm: 1.0,
    scheduler: cpuScheduler
  });
  const cpuLoader = new DataLoader(tokens, 0.9, seed);

  // GPU Training
  const gpuModel = new GpuModel(context, config, cpuModel.params, B, T);
  const gpuScheduler = new CosineLRScheduler({ maxLR, minLR, warmupSteps, totalSteps });
  const gpuTrainer = new GpuTrainer(gpuModel, {
    lr: maxLR,
    weightDecay: 0.1,
    maxGradNorm: 1.0,
    scheduler: gpuScheduler,
    logInterval: 10
  });
  const gpuLoader = new DataLoader(tokens, 0.9, seed);

  const points: TrainingCurvePoint[] = [];

  for (let s = 1; s <= totalSteps; s++) {
    const batchCpu = cpuLoader.getBatch('train', B, T);
    const batchGpu = gpuLoader.getBatch('train', B, T);

    // CPU Step
    const cpuRes = cpuModel.forward(batchCpu.inputs, batchCpu.targets, B, T);
    cpuModel.backward(batchCpu.targets);
    cpuOpt.step();

    // GPU Step
    await gpuTrainer.step(batchGpu.inputs, batchGpu.targets);

    if (s % 10 === 0 || s === 1 || s === totalSteps) {
      // Direct loss read for comparison points
      const gpuLossArr = await context.readBufferFloat32(gpuModel.meanLossBuffer, 1);
      points.push({
        step: s,
        cpuLoss: cpuRes.loss!,
        gpuLoss: gpuLossArr[0]
      });
    }
  }

  return {
    preset: 'C',
    totalSteps,
    points,
    finalCpuLoss: points[points.length - 1].cpuLoss,
    finalGpuLoss: points[points.length - 1].gpuLoss
  };
}

/**
 * 4. Benchmarking Suite: C (B16), S (B16), S (B32), M (B16)
 * 10 warmup steps, 100 benchmark steps
 */
export async function runTrainingBenchmark(
  context: GpuContext,
  _defaultVocabSize = 81
): Promise<TrainingBenchmarkSuiteResult> {
  const adapterInfo = (context.adapter as any).info || {};
  const adapterName =
    adapterInfo.description || adapterInfo.device || adapterInfo.vendor || 'WebGPU Device';

  const testConfigs = [
    { preset: 'C' as const, B: 16, T: 64, vocabSize: 81 },
    { preset: 'S' as const, B: 16, T: 128, vocabSize: 1024 },
    { preset: 'S' as const, B: 32, T: 128, vocabSize: 1024 },
    { preset: 'M' as const, B: 16, T: 256, vocabSize: 2048 }
  ];

  const items: BenchmarkItemResult[] = [];

  for (const tc of testConfigs) {
    const baseConfig = PRESETS[tc.preset];
    const config: GPTConfig = {
      ...baseConfig,
      vocabSize: tc.vocabSize ?? baseConfig.vocabSize,
      contextLen: tc.T ?? baseConfig.contextLen
    };

    const cpuModel = new TinyGPT(config, 42);
    const gpuModel = new GpuModel(context, config, cpuModel.params, tc.B, tc.T);
    const trainer = new GpuTrainer(gpuModel, { logInterval: 999 });

    const M = tc.B * tc.T;
    const inputs = new Uint16Array(M).fill(1);
    const targets = new Uint16Array(M).fill(2);

    // Warmup 10 steps
    for (let w = 0; w < 10; w++) {
      await trainer.step(inputs, targets);
    }

    // Benchmark 100 steps
    const numBenchSteps = 100;
    const start = performance.now();
    for (let s = 0; s < numBenchSteps; s++) {
      await trainer.step(inputs, targets);
    }
    // Final sync
    await context.readBufferFloat32(gpuModel.meanLossBuffer, 1);
    const totalMs = performance.now() - start;

    const msPerStep = totalMs / numBenchSteps;
    const totalTokens = tc.B * tc.T * numBenchSteps;
    const tokensPerSec = (totalTokens * 1000) / totalMs;
    // TFLOPS = 6 * params * tokens / time (s) / 1e12
    const tflops = (6 * gpuModel.totalParams * tc.B * tc.T * numBenchSteps) / (totalMs * 1e9);

    items.push({
      preset: tc.preset,
      batchSize: tc.B,
      seqLen: tc.T,
      params: gpuModel.totalParams,
      msPerStep,
      tokensPerSec,
      tflops,
      adapterName
    });
  }

  return {
    adapterName,
    items
  };
}

export async function runFullParitySuite(
  context: GpuContext,
  vocabSize = 81
): Promise<FullParityReport> {
  const resultC = await runPresetParity(context, 'C', { vocabSize });
  const resultS = await runPresetParity(context, 'S');
  const resultM = await runPresetParity(context, 'M');

  return {
    presets: {
      C: resultC,
      S: resultS,
      M: resultM
    },
    allPassed: resultC.overallPassed && resultS.overallPassed && resultM.overallPassed
  };
}
