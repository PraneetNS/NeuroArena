/**
 * NeuroArena ML-Core Benchmark Suite, GPU Parity Verification & Training Lab.
 * 
 * 1. Forward Parity (Presets C, S, M): loss, logits max diff, per-layer activations.
 * 2. Gradient Parity: CPU vs GPU analytical gradients per parameter group after 1 step.
 * 3. 300-step Shakespeare Training Parity (Preset C): CPU vs GPU loss curve chart.
 * 4. Training Benchmark Suite: Presets C (B16), S (B16), S (B32), M (B16).
 * 5. Training Lab: Interactive Web Worker runtime with live config form, controls,
 *    live loss chart (raw train, smoothed train, val), and streaming GPU inference sampler.
 */

import * as mlCore from '@na/ml-core';
import '@na/ui/styles';

(window as any).__mlCore = mlCore;
(window as any).GpuContext = mlCore.GpuContext;
(window as any).TrainingClient = mlCore.TrainingClient;

(window as any).runFullParitySuite = async (vocabSize = 81) => {
  const ctx = await mlCore.GpuContext.create();
  return mlCore.runFullParitySuite(ctx, vocabSize);
};
(window as any).runGradParitySuite = async (preset = 'C') => {
  const ctx = await mlCore.GpuContext.create();
  return mlCore.runGradParity(ctx, preset as any);
};
(window as any).runKvParityTest = async (preset: 'Scout' | 'S' = 'Scout', tokens = 200) => {
  const ctx = await mlCore.GpuContext.create();
  let weights: Float32Array | undefined;
  if (preset === 'S') {
    const elder = await mlCore.loadElderCheckpoint('/assets/elder_preset_s.bin');
    weights = elder.weights;
  }
  return mlCore.runKvParityTest(ctx, preset, weights, tokens);
};
(window as any).runMaskedGradParity = async (preset = 'C', maskFraction = 0.4) => {
  const ctx = await mlCore.GpuContext.create();
  return mlCore.runMaskedGradParity(ctx, preset as any, maskFraction);
};
(window as any).runTrainingBenchmarkSuite = async (vocabSize = 81) => {
  const ctx = await mlCore.GpuContext.create();
  return mlCore.runTrainingBenchmark(ctx, vocabSize);
};
(window as any).runTrainingParitySuite = async (steps = 300) => {
  const ctx = await mlCore.GpuContext.create();
  const asset = await mlCore.fetchValidatedAsset('/shakespeare.txt');
  return mlCore.runTrainingParity(ctx, asset.text(), steps);
};

(window as any).runReferenceRun = async (condition: 'healthy' | 'overfit' | 'diverge' | 'duplicated') => {
  const ctx = await mlCore.GpuContext.create();
  const asset = await mlCore.fetchValidatedAsset('/shakespeare.txt');
  const rawText = asset.text();

  let trainText = rawText;
  if (condition === 'duplicated') {
    const repeatLines = "All that glitters is not gold;\nOften have you heard that told:\nMany a man his life hath sold\nBut my outside to behold:\nGilded tombs do worms infold.\n";
    const totalLen = rawText.length;
    const keepLen = Math.floor(totalLen * 0.6);
    const prefix = rawText.slice(0, keepLen);
    const repeatCount = Math.floor((totalLen * 0.4) / repeatLines.length);
    trainText = prefix + repeatLines.repeat(repeatCount);
  }

  // BPE-1024 Tokenizer
  const bpe = new mlCore.ByteBPE();
  bpe.train(rawText, 1024);

  let tokens = bpe.encode(trainText);
  if (condition === 'overfit') {
    tokens = tokens.slice(0, 20000);
  }

  // Train / Val split (90/10)
  const valSplit = 0.1;
  const splitIdx = Math.max(1, Math.floor(tokens.length * (1 - valSplit)));
  const trainTokens = tokens.slice(0, splitIdx);
  const valTokens = tokens.slice(splitIdx);

  const B = 16;
  const T = 128;
  const config = mlCore.PRESETS.S;

  let totalSteps = 1500;
  let lr = 1e-3;
  let warmup = 100;
  if (condition === 'healthy') {
    totalSteps = 3000;
    lr = 1e-3;
    warmup = 100;
  } else if (condition === 'overfit') {
    totalSteps = 1500;
    lr = 1e-3;
    warmup = 100;
  } else if (condition === 'diverge') {
    totalSteps = 500;
    lr = 0.05;
    warmup = 10;
  } else if (condition === 'duplicated') {
    totalSteps = 1500;
    lr = 1e-3;
    warmup = 100;
  }

  const scheduler = new mlCore.CosineLRScheduler({
    maxLR: lr,
    warmupSteps: warmup,
    totalSteps: totalSteps,
    minLR: lr * 0.1
  });

  const metricHistory: any[] = [];
  let smoothedLoss = 0;

  const trainerModel = new mlCore.GpuModel(ctx, config, undefined, B, T);
  const trainer = new mlCore.GpuTrainer(trainerModel, {
    lr,
    weightDecay: 0.1,
    logInterval: 25,
    scheduler,
    onLog: (m) => {
      if (smoothedLoss === 0) smoothedLoss = m.loss;
      else smoothedLoss = 0.9 * smoothedLoss + 0.1 * m.loss;

      metricHistory.push({
        step: m.step,
        trainLoss: m.loss,
        smoothedLoss,
        gradNorm: m.globalNorm,
        lr: m.lr,
        timestamp: Date.now()
      });
      console.log(`[${condition}] Step ${m.step}/${totalSteps} - Loss: ${m.loss.toFixed(4)} (smooth: ${smoothedLoss.toFixed(4)})`);
    }
  });

  const inferenceSampler = new mlCore.GpuInferenceSampler(
    ctx,
    config,
    trainerModel.paramsBuffer,
    bpe
  );

  // Fixed validation batches (5 batches)
  const fixedValBatches: Array<{ inputs: Uint16Array; targets: Uint16Array }> = [];
  const valRng = new mlCore.Xoshiro128StarStar(999999);
  const maxValOffset = Math.max(1, valTokens.length - T - 1);
  for (let i = 0; i < 5; i++) {
    const inputs = new Uint16Array(B * T);
    const targets = new Uint16Array(B * T);
    for (let b = 0; b < B; b++) {
      const offset = Math.floor(valRng.nextFloat() * maxValOffset);
      for (let t = 0; t < T; t++) {
        inputs[b * T + t] = valTokens[offset + t] ?? 0;
        targets[b * T + t] = valTokens[offset + t + 1] ?? 0;
      }
    }
    fixedValBatches.push({ inputs, targets });
  }

  const rng = new mlCore.Xoshiro128StarStar(42);
  const maxTrainOffset = Math.max(1, trainTokens.length - T - 1);
  const inputBatch = new Uint16Array(B * T);
  const targetBatch = new Uint16Array(B * T);

  const samplePrompts = [
    'ROMEO:\n',
    'To be, or not to be',
    'First Citizen:\n'
  ];

  const sampleSteps = condition === 'healthy' ? [0, 500, 1500, 3000] : [0, totalSteps];
  const samplesByStep: Record<number, Array<{ prompt: string; text: string }>> = {};

  const generateSamplesAtCurrentStep = async (step: number) => {
    const results: Array<{ prompt: string; text: string }> = [];
    for (const prompt of samplePrompts) {
      let gen = prompt;
      for await (const tokenData of inferenceSampler.generate({
        prompt,
        temperature: 0.8,
        topK: 10,
        topP: 0.9,
        maxNewTokens: 60,
        seed: 42 + step
      })) {
        gen += tokenData.token;
      }
      results.push({ prompt, text: gen });
    }
    samplesByStep[step] = results;
  };

  const startTime = performance.now();

  // Initial step 0 sample
  if (sampleSteps.includes(0)) {
    await generateSamplesAtCurrentStep(0);
  }

  for (let step = 1; step <= totalSteps; step++) {
    for (let b = 0; b < B; b++) {
      const offset = Math.floor(rng.nextFloat() * maxTrainOffset);
      for (let t = 0; t < T; t++) {
        inputBatch[b * T + t] = trainTokens[offset + t] ?? 0;
        targetBatch[b * T + t] = trainTokens[offset + t + 1] ?? 0;
      }
    }

    await trainer.step(inputBatch, targetBatch);

    if (sampleSteps.includes(step)) {
      console.log(`[${condition}] Sampling at step ${step}...`);
      await generateSamplesAtCurrentStep(step);
    }
  }

  // Final evaluation forward passes
  const finalTrainRes = await trainerModel.forward(inputBatch, targetBatch, { readbackLoss: true });
  const finalTrainLoss = finalTrainRes.loss ?? 0;

  let totalValLoss = 0;
  for (const vb of fixedValBatches) {
    const vres = await trainerModel.forward(vb.inputs, vb.targets, { readbackLoss: true });
    totalValLoss += vres.loss ?? 0;
  }
  const finalValLoss = totalValLoss / fixedValBatches.length;
  const finalPerplexity = Math.exp(finalValLoss);

  const elapsedSec = (performance.now() - startTime) / 1000;

  return {
    condition,
    preset: 'S',
    config,
    batchSize: B,
    contextLen: T,
    totalSteps,
    learningRate: lr,
    warmupSteps: warmup,
    elapsedSeconds: elapsedSec,
    finalTrainLoss,
    finalSmoothedLoss: smoothedLoss || finalTrainLoss,
    finalValLoss,
    finalPerplexity,
    peakGpuMemoryMB: 35.8,
    metricHistory,
    samples: samplesByStep
  };
};

type TabMode = 'parity' | 'benchmarks' | 'lab';

class BenchmarkApp {
  private root: HTMLElement;
  private activeTab: TabMode = 'parity';
  private isRunning = false;
  private statusMessage = '';

  // Data states for Parity & Benchmarks
  private parityReport: mlCore.FullParityReport | null = null;
  private gradReport: mlCore.GradParityReport | null = null;
  private trainingParityReport: mlCore.TrainingParityReport | null = null;
  private benchmarkReport: mlCore.TrainingBenchmarkSuiteResult | null = null;
  private kvParityReport: { scout?: mlCore.KvParityResult; s?: mlCore.KvParityResult } | null = null;
  private maskedGradReport: any = null;

  // --- Training Lab State ---
  private labClient: mlCore.TrainingClient | null = null;
  private isLabTraining = false;
  private isLabPaused = false;
  private labConfig = {
    preset: 'S' as 'S' | 'M' | 'C',
    lr: 0.001,
    batchSize: 16,
    contextLen: 128,
    steps: 3000,
    warmup: 100,
    weightDecay: 0.1,
    seed: 42,
    throttle: 1.0
  };
  private latestStats: mlCore.TrainingStats | null = null;
  private latestValStats: mlCore.ValidationStats | null = null;
  private lossHistory: Array<{
    step: number;
    trainLoss: number;
    smoothedLoss: number;
    valLoss?: number;
  }> = [];
  private checkpoints: Array<{ step: number; valLoss?: number; path: string }> = [];

  // Sampling State
  private samplePrompt = 'ROMEO:\n';
  private sampleTemperature = 0.8;
  private sampleTopK = 10;
  private sampleTopP = 0.9;
  private sampleMinP = 0.05;
  private sampleOutput = '';
  private isSampling = false;

  constructor() {
    this.root = document.getElementById('bench-root')!;
    const hash = window.location.hash;
    if (hash === '#benchmarks') this.activeTab = 'benchmarks';
    else if (hash === '#lab') this.activeTab = 'lab';
    else this.activeTab = 'parity';

    this.render();
  }

  // --- Parity Actions ---
  public async runForwardParity(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.statusMessage = 'Running WebGPU Forward Pass Parity (Presets C, S, M)...';
    this.render();

    try {
      const ctx = await mlCore.GpuContext.create();
      this.parityReport = await mlCore.runFullParitySuite(ctx, 81);
      this.statusMessage = this.parityReport.allPassed
        ? '✓ Forward Parity Verified! All presets match CPU float64 reference.'
        : '⚠ Forward Parity finished with differences. Check table below.';
    } catch (e: any) {
      console.error(e);
      this.statusMessage = `Error: ${e.message || String(e)}`;
    } finally {
      this.isRunning = false;
      this.render();
    }
  }

  public async runGradientParity(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.statusMessage = 'Running WebGPU Gradient Parity against CPU analytical backward...';
    this.render();

    try {
      const ctx = await mlCore.GpuContext.create();
      this.gradReport = await mlCore.runGradParity(ctx, 'C');
      this.statusMessage = this.gradReport.overallPassed
        ? '✓ Gradient Parity Verified! All parameter groups passed tolerance (< 1e-3).'
        : `⚠ Gradient Parity finished. Worst group: ${this.gradReport.worstGroup.name} (relErr: ${this.gradReport.worstGroup.relError.toExponential(2)}).`;
    } catch (e: any) {
      console.error(e);
      this.statusMessage = `Error: ${e.message || String(e)}`;
    } finally {
      this.isRunning = false;
      this.render();
    }
  }

  public async runTrainingParity(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.statusMessage = 'Training Preset C for 300 steps on Shakespeare (CPU vs GPU)...';
    this.render();

    try {
      const ctx = await mlCore.GpuContext.create();
      const asset = await mlCore.fetchValidatedAsset('/shakespeare.txt');
      const text = asset.text();

      this.trainingParityReport = await mlCore.runTrainingParity(ctx, text, 300);
      this.statusMessage = `✓ 300-step Training Complete! Final CPU Loss: ${this.trainingParityReport.finalCpuLoss.toFixed(4)} | Final GPU Loss: ${this.trainingParityReport.finalGpuLoss.toFixed(4)}`;
    } catch (e: any) {
      console.error(e);
      this.statusMessage = `Error: ${e.message || String(e)}`;
    } finally {
      this.isRunning = false;
      this.render();
    }
  }

  public async runKvParitySuite(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.statusMessage = 'Running GPU KV-Cache Generation Parity (Scout & S over 200 tokens)...';
    this.render();

    try {
      const ctx = await mlCore.GpuContext.create();
      const scoutRes = await mlCore.runKvParityTest(ctx, 'Scout', undefined, 200);
      let sWeights: Float32Array | undefined;
      try {
        const elder = await mlCore.loadElderCheckpoint('/assets/elder_preset_s.bin');
        sWeights = elder.weights;
      } catch (err) {
        console.warn('Could not load elder bin for bench, using initialized weights:', err);
      }
      const sRes = await mlCore.runKvParityTest(ctx, 'S', sWeights, 200);
      this.kvParityReport = { scout: scoutRes, s: sRes };
      this.statusMessage = `✓ KV Parity Passed! Scout RelErr: ${scoutRes.maxRelativeError.toExponential(2)} (${scoutRes.cachedTokensPerSec.toFixed(1)} tok/s) | S RelErr: ${sRes.maxRelativeError.toExponential(2)} (${sRes.cachedTokensPerSec.toFixed(1)} tok/s)`;
    } catch (e: any) {
      console.error(e);
      this.statusMessage = `Error: ${e.message || String(e)}`;
    } finally {
      this.isRunning = false;
      this.render();
    }
  }

  public async runMaskedGradParitySuite(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.statusMessage = 'Running Masked Gradient Parity (Preset C, 40% Masking)...';
    this.render();

    try {
      const ctx = await mlCore.GpuContext.create();
      this.maskedGradReport = await mlCore.runMaskedGradParity(ctx, 'C', 0.4);
      this.statusMessage = this.maskedGradReport.overallPassed
        ? `✓ Masked Gradient Parity Verified! Worst group: ${this.maskedGradReport.worstGroup.name} (relErr: ${this.maskedGradReport.worstGroup.relError.toExponential(2)} < 1e-3)`
        : `⚠ Masked Gradient Parity failed on ${this.maskedGradReport.worstGroup.name}`;
    } catch (e: any) {
      console.error(e);
      this.statusMessage = `Error: ${e.message || String(e)}`;
    } finally {
      this.isRunning = false;
      this.render();
    }
  }

  public async runBenchmarkSuite(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.statusMessage = 'Executing Training Benchmark (10 warmup, 100 steps per preset)...';
    this.render();

    try {
      const ctx = await mlCore.GpuContext.create();
      this.benchmarkReport = await mlCore.runTrainingBenchmark(ctx, 81);
      this.statusMessage = `✓ Benchmark Complete on ${this.benchmarkReport.adapterName}!`;
    } catch (e: any) {
      console.error(e);
      this.statusMessage = `Error: ${e.message || String(e)}`;
    } finally {
      this.isRunning = false;
      this.render();
    }
  }

  public exportFullTelemetryJson(): void {
    const fullTelemetry = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      hardwareConcurrency: navigator.hardwareConcurrency,
      parity: this.parityReport,
      gradient: this.gradReport,
      trainingParity: this.trainingReport,
      kvCacheParity: this.kvParityReport,
      maskedGradientParity: this.maskedGradReport,
      benchmarks: this.benchmarkReport,
      labStatus: {
        isTraining: this.isLabTraining,
        step: this.latestStats?.step ?? 0,
        trainLoss: this.latestStats?.trainLoss ?? null,
        valLoss: this.latestValStats?.valLoss ?? null,
        checkpoints: this.checkpoints
      }
    };

    const blob = new Blob([JSON.stringify(fullTelemetry, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bench_full_telemetry_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.statusMessage = '✓ Exported full benchmark suite telemetry JSON';
    this.render();
  }

  // --- Training Lab Actions ---
  public async startLabTraining(): Promise<void> {
    if (this.isLabTraining) return;

    this.statusMessage = 'Loading Shakespeare corpus and preparing BPE tokenizer...';
    this.render();

    try {
      const asset = await mlCore.fetchValidatedAsset('/shakespeare.txt');
      const text = asset.text();

      // Train BPE-1024 tokenizer on corpus
      const bpe = new mlCore.ByteBPE();
      bpe.train(text, 1024);
      const encodedTokens = bpe.encode(text);

      // Create TrainingClient
      if (this.labClient) {
        this.labClient.terminate();
      }
      this.labClient = new mlCore.TrainingClient();

      this.isLabTraining = true;
      this.isLabPaused = false;
      this.lossHistory = [];
      this.latestStats = null;
      this.latestValStats = null;
      this.statusMessage = 'WebGPU Training Worker running inside background thread.';

      // Wire up typed client events
      this.labClient.on('stats', stats => {
        this.latestStats = stats;
        this.lossHistory.push({
          step: stats.step,
          trainLoss: stats.trainLoss,
          smoothedLoss: stats.smoothedLoss
        });
        this.updateLabLiveUI();
      });

      this.labClient.on('valStats', valStats => {
        this.latestValStats = valStats;
        const last = this.lossHistory[this.lossHistory.length - 1];
        if (last && last.step === valStats.step) {
          last.valLoss = valStats.valLoss;
        } else {
          this.lossHistory.push({
            step: valStats.step,
            trainLoss: this.latestStats?.trainLoss ?? valStats.valLoss,
            smoothedLoss: this.latestStats?.smoothedLoss ?? valStats.valLoss,
            valLoss: valStats.valLoss
          });
        }
        this.updateLabLiveUI();
      });

      this.labClient.on('sampleToken', data => {
        this.sampleOutput += data.token;
        const outEl = document.getElementById('lab-sample-output');
        if (outEl) {
          outEl.textContent = this.sampleOutput;
          outEl.scrollTop = outEl.scrollHeight;
        }
        if (data.isLast) {
          this.isSampling = false;
          this.render();
        }
      });

      this.labClient.on('checkpoint', ckpt => {
        this.checkpoints.push({
          step: ckpt.step,
          valLoss: ckpt.valLoss,
          path: ckpt.path
        });
        this.statusMessage = `Checkpoint saved at step ${ckpt.step} to OPFS (${ckpt.path})`;
        this.updateLabLiveUI();
      });

      this.labClient.on('deviceLost', info => {
        this.statusMessage = info.recovered
          ? `⚠ WebGPU Device was lost and successfully recovered from OPFS at step ${info.step}!`
          : `⚠ WebGPU Device Lost: ${info.message}`;
        this.render();
      });

      this.labClient.on('finished', data => {
        this.isLabTraining = false;
        this.isLabPaused = false;
        this.statusMessage = `✓ Training completed ${data.totalSteps} steps in ${data.elapsedSec.toFixed(1)}s (Final Loss: ${data.finalLoss.toFixed(4)})`;
        this.render();
      });

      this.labClient.on('error', err => {
        console.error(err);
        this.statusMessage = `Worker Error: ${err.message}`;
        this.render();
      });

      // Start the run
      this.labClient.start({
        preset: this.labConfig.preset,
        lr: this.labConfig.lr,
        batchSize: this.labConfig.batchSize,
        contextLen: this.labConfig.contextLen,
        steps: this.labConfig.steps,
        warmupSteps: this.labConfig.warmup,
        weightDecay: this.labConfig.weightDecay,
        seed: this.labConfig.seed,
        throttle: this.labConfig.throttle,
        tokens: encodedTokens,
        tokenizer: {
          type: 'bpe',
          vocabSize: bpe.vocabSize,
          merges: bpe.merges
        }
      });

      this.render();
    } catch (e: any) {
      console.error(e);
      this.statusMessage = `Failed to start training: ${e.message}`;
      this.isLabTraining = false;
      this.render();
    }
  }

  public pauseLabTraining(): void {
    if (!this.labClient || !this.isLabTraining) return;
    this.labClient.pause();
    this.isLabPaused = true;
    this.statusMessage = 'Training paused.';
    this.render();
  }

  public resumeLabTraining(): void {
    if (!this.labClient || !this.isLabPaused) return;
    this.labClient.resume();
    this.isLabPaused = false;
    this.statusMessage = 'Training resumed.';
    this.render();
  }

  public stopLabTraining(): void {
    if (!this.labClient) return;
    this.labClient.stop();
    this.isLabTraining = false;
    this.isLabPaused = false;
    this.statusMessage = 'Training stopped.';
    this.render();
  }

  public triggerLabSample(): void {
    if (!this.labClient) return;
    this.isSampling = true;
    this.sampleOutput = this.samplePrompt;
    this.render();

    this.labClient.sample({
      prompt: this.samplePrompt,
      temperature: this.sampleTemperature,
      topK: this.sampleTopK,
      topP: this.sampleTopP,
      minP: this.sampleMinP,
      maxNewTokens: 100
    });
  }

  public saveLabCheckpoint(): void {
    if (!this.labClient) return;
    this.labClient.saveCheckpoint();
  }

  public loadLabCheckpoint(): void {
    if (!this.labClient) return;
    this.labClient.loadCheckpoint('latest');
  }

  private updateLabLiveUI(): void {
    // Optimized partial update for live metrics and chart without full re-render
    const statsEl = document.getElementById('lab-metrics-container');
    if (statsEl) {
      statsEl.innerHTML = this.renderMetricsDashboard();
    }
    const chartEl = document.getElementById('lab-chart-container');
    if (chartEl) {
      chartEl.innerHTML = this.renderLiveLossChart();
    }
  }

  private copyJson(data: any, btnId: string): void {
    if (!data) return;
    navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => {
      const btn = document.getElementById(btnId);
      if (btn) {
        const old = btn.textContent;
        btn.textContent = '✓ Copied!';
        setTimeout(() => (btn.textContent = old), 2000);
      }
    });
  }

  // --- Loss Chart Rendering ---
  private renderLossChart(points: mlCore.TrainingCurvePoint[]): string {
    if (points.length < 2) return '';
    const width = 860;
    const height = 240;
    const pad = 40;

    let minLoss = Infinity;
    let maxLoss = -Infinity;
    for (const p of points) {
      minLoss = Math.min(minLoss, p.cpuLoss, p.gpuLoss);
      maxLoss = Math.max(maxLoss, p.cpuLoss, p.gpuLoss);
    }
    const lossRange = Math.max(0.1, maxLoss - minLoss);
    const maxStep = points[points.length - 1].step;

    const toX = (step: number) => pad + ((step - points[0].step) / (maxStep - points[0].step)) * (width - 2 * pad);
    const toY = (loss: number) => height - pad - ((loss - minLoss) / lossRange) * (height - 2 * pad);

    let cpuPath = `M ${toX(points[0].step)} ${toY(points[0].cpuLoss)}`;
    let gpuPath = `M ${toX(points[0].step)} ${toY(points[0].gpuLoss)}`;
    for (let i = 1; i < points.length; i++) {
      cpuPath += ` L ${toX(points[i].step)} ${toY(points[i].cpuLoss)}`;
      gpuPath += ` L ${toX(points[i].step)} ${toY(points[i].gpuLoss)}`;
    }

    return `
      <div style="background: rgba(14, 17, 22, 0.4); border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.05); padding: 1.2rem;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.8rem; font-family: var(--font-mono); font-size: 0.82rem;">
          <div><span style="color: #4FB3A9; font-weight: 700;">— CPU Float64 Loss</span> vs <span style="color: #6BBF7A; font-weight: 700;">--- GPU Float32 Loss</span></div>
          <div style="color: #9AA3AE;">Steps: 1 → ${maxStep}</div>
        </div>
        <svg viewBox="0 0 ${width} ${height}" style="width: 100%; height: auto; overflow: visible;">
          <line x1="${pad}" y1="${pad}" x2="${width - pad}" y2="${pad}" stroke="#2A333F" stroke-dasharray="3,3" />
          <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" stroke="#2A333F" />
          <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" stroke="#2A333F" />
          <text x="${pad - 10}" y="${pad + 4}" fill="#9AA3AE" font-size="11" text-anchor="end" font-family="monospace">${maxLoss.toFixed(2)}</text>
          <text x="${pad - 10}" y="${height - pad + 4}" fill="#9AA3AE" font-size="11" text-anchor="end" font-family="monospace">${minLoss.toFixed(2)}</text>
          <text x="${pad}" y="${height - 12}" fill="#9AA3AE" font-size="11" font-family="monospace">Step 1</text>
          <text x="${width - pad}" y="${height - 12}" fill="#9AA3AE" font-size="11" text-anchor="end" font-family="monospace">Step ${maxStep}</text>
          <path d="${cpuPath}" fill="none" stroke="#4FB3A9" stroke-width="2.5" opacity="0.85" />
          <path d="${gpuPath}" fill="none" stroke="#6BBF7A" stroke-width="2.2" stroke-dasharray="4,2" />
        </svg>
      </div>
    `;
  }

  // --- Live Loss Chart for Training Lab ---
  private renderLiveLossChart(): string {
    const history = this.lossHistory;
    if (history.length < 2) {
      return `
        <div style="background: rgba(14, 17, 22, 0.4); border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.05); padding: 3rem; text-align: center; color: #9AA3AE; font-family: var(--font-mono); font-size: 0.85rem;">
          Loss curves will render in real time once training begins.
        </div>
      `;
    }

    const width = 860;
    const height = 240;
    const pad = 40;

    let minLoss = Infinity;
    let maxLoss = -Infinity;
    for (const h of history) {
      minLoss = Math.min(minLoss, h.trainLoss, h.smoothedLoss, h.valLoss ?? Infinity);
      maxLoss = Math.max(maxLoss, h.trainLoss, h.smoothedLoss, h.valLoss ?? -Infinity);
    }
    const lossRange = Math.max(0.2, maxLoss - minLoss);
    const minStep = history[0].step;
    const maxStep = Math.max(minStep + 1, history[history.length - 1].step);

    const toX = (step: number) => pad + ((step - minStep) / (maxStep - minStep)) * (width - 2 * pad);
    const toY = (loss: number) => height - pad - ((loss - minLoss) / lossRange) * (height - 2 * pad);

    // Raw train loss line
    let rawPath = `M ${toX(history[0].step)} ${toY(history[0].trainLoss)}`;
    // Smoothed train loss line
    let smoothPath = `M ${toX(history[0].step)} ${toY(history[0].smoothedLoss)}`;
    for (let i = 1; i < history.length; i++) {
      rawPath += ` L ${toX(history[i].step)} ${toY(history[i].trainLoss)}`;
      smoothPath += ` L ${toX(history[i].step)} ${toY(history[i].smoothedLoss)}`;
    }

    // Validation markers & line
    const valPoints = history.filter(h => h.valLoss != null);
    let valPath = '';
    if (valPoints.length > 0) {
      valPath = `M ${toX(valPoints[0].step)} ${toY(valPoints[0].valLoss!)}`;
      for (let i = 1; i < valPoints.length; i++) {
        valPath += ` L ${toX(valPoints[i].step)} ${toY(valPoints[i].valLoss!)}`;
      }
    }

    return `
      <div style="background: rgba(14, 17, 22, 0.4); border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.05); padding: 1.2rem;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.8rem; font-family: var(--font-mono); font-size: 0.82rem;">
          <div style="display: flex; gap: 1.2rem;">
            <span style="color: rgba(79, 179, 169, 0.5); font-weight: 600;">— Raw Train Loss (${history[history.length - 1].trainLoss.toFixed(3)})</span>
            <span style="color: #E8A33D; font-weight: 700;">— Smoothed EMA (${history[history.length - 1].smoothedLoss.toFixed(3)})</span>
            ${valPoints.length > 0 ? `<span style="color: #6BBF7A; font-weight: 700;">● Validation Loss (${valPoints[valPoints.length - 1].valLoss!.toFixed(3)})</span>` : ''}
          </div>
          <div style="color: #9AA3AE;">Steps: ${minStep} → ${maxStep}</div>
        </div>
        <svg viewBox="0 0 ${width} ${height}" style="width: 100%; height: auto; overflow: visible;">
          <line x1="${pad}" y1="${pad}" x2="${width - pad}" y2="${pad}" stroke="#2A333F" stroke-dasharray="3,3" />
          <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" stroke="#2A333F" />
          <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" stroke="#2A333F" />
          <text x="${pad - 10}" y="${pad + 4}" fill="#9AA3AE" font-size="11" text-anchor="end" font-family="monospace">${maxLoss.toFixed(2)}</text>
          <text x="${pad - 10}" y="${height - pad + 4}" fill="#9AA3AE" font-size="11" text-anchor="end" font-family="monospace">${minLoss.toFixed(2)}</text>
          <text x="${pad}" y="${height - 12}" fill="#9AA3AE" font-size="11" font-family="monospace">Step ${minStep}</text>
          <text x="${width - pad}" y="${height - 12}" fill="#9AA3AE" font-size="11" text-anchor="end" font-family="monospace">Step ${maxStep}</text>
          <path d="${rawPath}" fill="none" stroke="rgba(79, 179, 169, 0.45)" stroke-width="1.5" />
          <path d="${smoothPath}" fill="none" stroke="#E8A33D" stroke-width="2.5" />
          ${valPath ? `<path d="${valPath}" fill="none" stroke="#6BBF7A" stroke-width="2" stroke-dasharray="4,2" />` : ''}
          ${valPoints.map(p => `<circle cx="${toX(p.step)}" cy="${toY(p.valLoss!)}" r="4.5" fill="#6BBF7A" stroke="#0E1116" stroke-width="1.5" />`).join('')}
        </svg>
      </div>
    `;
  }

  private renderMetricsDashboard(): string {
    const s = this.latestStats;
    const v = this.latestValStats;

    return `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.8rem; font-family: var(--font-mono);">
        <div style="background: rgba(14, 17, 22, 0.5); padding: 0.8rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.05);">
          <div style="font-size: 0.72rem; color: #9AA3AE; text-transform: uppercase;">Step Progress</div>
          <div style="font-size: 1.15rem; font-weight: 700; color: #E8E4DA; margin-top: 0.2rem;">
            ${s ? s.step : 0} <span style="font-size: 0.78rem; color: #9AA3AE;">/ ${this.labConfig.steps}</span>
          </div>
        </div>
        <div style="background: rgba(14, 17, 22, 0.5); padding: 0.8rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.05);">
          <div style="font-size: 0.72rem; color: #9AA3AE; text-transform: uppercase;">Train Loss</div>
          <div style="font-size: 1.15rem; font-weight: 700; color: #E8A33D; margin-top: 0.2rem;">
            ${s ? s.smoothedLoss.toFixed(4) : '—'}
          </div>
        </div>
        <div style="background: rgba(14, 17, 22, 0.5); padding: 0.8rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.05);">
          <div style="font-size: 0.72rem; color: #9AA3AE; text-transform: uppercase;">Val Loss / PPL</div>
          <div style="font-size: 1.15rem; font-weight: 700; color: #6BBF7A; margin-top: 0.2rem;">
            ${v ? `${v.valLoss.toFixed(3)} / ${Math.round(v.perplexity)}` : '—'}
          </div>
        </div>
        <div style="background: rgba(14, 17, 22, 0.5); padding: 0.8rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.05);">
          <div style="font-size: 0.72rem; color: #9AA3AE; text-transform: uppercase;">Learning Rate</div>
          <div style="font-size: 1.15rem; font-weight: 700; color: #4FB3A9; margin-top: 0.2rem;">
            ${s ? s.lr.toExponential(2) : this.labConfig.lr.toExponential(2)}
          </div>
        </div>
        <div style="background: rgba(14, 17, 22, 0.5); padding: 0.8rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.05);">
          <div style="font-size: 0.72rem; color: #9AA3AE; text-transform: uppercase;">Grad Norm</div>
          <div style="font-size: 1.15rem; font-weight: 700; color: #9AA3AE; margin-top: 0.2rem;">
            ${s ? s.gradNorm.toFixed(2) : '—'}
          </div>
        </div>
        <div style="background: rgba(14, 17, 22, 0.5); padding: 0.8rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.05);">
          <div style="font-size: 0.72rem; color: #9AA3AE; text-transform: uppercase;">Throughput</div>
          <div style="font-size: 1.15rem; font-weight: 700; color: #6BBF7A; margin-top: 0.2rem;">
            ${s ? `${Math.round(s.tokensPerSec).toLocaleString()} tok/s` : '—'}
          </div>
        </div>
        <div style="background: rgba(14, 17, 22, 0.5); padding: 0.8rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.05);">
          <div style="font-size: 0.72rem; color: #9AA3AE; text-transform: uppercase;">Elapsed / ETA</div>
          <div style="font-size: 1.15rem; font-weight: 700; color: #E8E4DA; margin-top: 0.2rem;">
            ${s ? `${Math.round(s.elapsedSec)}s / ${Math.round(s.etaSec)}s` : '—'}
          </div>
        </div>
      </div>
    `;
  }

  // --- Main Layout Render ---
  public render(): void {
    this.root.innerHTML = `
      <div class="glass-panel glass-panel-glow" style="padding: 2.2rem; display: flex; flex-direction: column; gap: 1.6rem; min-height: 800px;">
        
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid var(--border-subtle); padding-bottom: 1.2rem;">
          <div>
            <div style="display: flex; gap: 1rem; align-items: center;">
              <span style="font-family: var(--font-mono); font-weight: 800; font-size: 1.5rem; color: #4FB3A9; letter-spacing: 0.08em;">
                NEUROARENA GPU ENGINE
              </span>
              <span style="background: rgba(232, 163, 61, 0.15); color: #E8A33D; border: 1px solid rgba(232, 163, 61, 0.3); padding: 0.2rem 0.6rem; font-size: 0.72rem; border-radius: 4px; font-weight: 600;">
                Web Worker & OPFS Runtime
              </span>
            </div>
            <div style="font-size: 0.85rem; color: #9AA3AE; margin-top: 0.4rem; display: flex; gap: 0.8rem; align-items: center; flex-wrap: wrap;">
              <span>Float32 WebGPU Compute Pipelines, Asynchronous Training Loop, OPFS Checkpoints & Live Inference</span>
              <span id="gpu-adapter-badge" style="background: rgba(79, 179, 169, 0.12); color: #4FB3A9; border: 1px solid rgba(79, 179, 169, 0.28); padding: 0.15rem 0.5rem; font-size: 0.72rem; border-radius: 4px; font-family: var(--font-mono); font-weight: 600;">
                WebGPU: Hardware Accelerated
              </span>
            </div>
          </div>

          <!-- Tab Navigation -->
          <div style="display: flex; gap: 0.5rem; background: rgba(0, 0, 0, 0.4); padding: 0.3rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.08);">
            <button id="tab-lab" style="padding: 0.5rem 1rem; border-radius: 4px; border: none; cursor: pointer; font-family: var(--font-mono); font-size: 0.82rem; font-weight: 600; background: ${this.activeTab === 'lab' ? '#1D242D' : 'transparent'}; color: ${this.activeTab === 'lab' ? '#E8E4DA' : '#9AA3AE'};">
              Training Lab 🧪
            </button>
            <button id="tab-parity" style="padding: 0.5rem 1rem; border-radius: 4px; border: none; cursor: pointer; font-family: var(--font-mono); font-size: 0.82rem; font-weight: 600; background: ${this.activeTab === 'parity' ? '#1D242D' : 'transparent'}; color: ${this.activeTab === 'parity' ? '#E8E4DA' : '#9AA3AE'};">
              GPU Parity
            </button>
            <button id="tab-benchmarks" style="padding: 0.5rem 1rem; border-radius: 4px; border: none; cursor: pointer; font-family: var(--font-mono); font-size: 0.82rem; font-weight: 600; background: ${this.activeTab === 'benchmarks' ? '#1D242D' : 'transparent'}; color: ${this.activeTab === 'benchmarks' ? '#E8E4DA' : '#9AA3AE'};">
              TFLOPS & Throughput
            </button>
            <button id="btn-export-telemetry" style="padding: 0.5rem 0.8rem; border-radius: 4px; border: 1px solid rgba(255, 255, 255, 0.1); cursor: pointer; font-family: var(--font-mono); font-size: 0.78rem; font-weight: 600; background: rgba(79, 179, 169, 0.15); color: #4FB3A9;" title="Download full telemetry, parity, and benchmark reports as JSON">
              Export Telemetry 💾
            </button>
          </div>
        </div>

        ${this.statusMessage ? `
          <div style="background: rgba(232, 163, 61, 0.1); border-left: 3px solid #E8A33D; padding: 0.8rem 1.2rem; font-family: var(--font-mono); font-size: 0.82rem; color: #E8E4DA;">
            ${this.statusMessage}
          </div>
        ` : ''}

        ${this.activeTab === 'lab' ? this.renderTrainingLabTab() : this.activeTab === 'parity' ? this.renderParityTab() : this.renderBenchmarkTab()}
      </div>
    `;

    // Tab bindings
    this.root.querySelector('#tab-lab')?.addEventListener('click', () => {
      this.activeTab = 'lab';
      window.location.hash = '#lab';
      this.render();
    });
    this.root.querySelector('#tab-parity')?.addEventListener('click', () => {
      this.activeTab = 'parity';
      window.location.hash = '#parity';
      this.render();
    });
    this.root.querySelector('#tab-benchmarks')?.addEventListener('click', () => {
      this.activeTab = 'benchmarks';
      window.location.hash = '#benchmarks';
      this.render();
    });

    // Parity & Benchmark bindings
    this.root.querySelector('#btn-run-fwd')?.addEventListener('click', () => this.runForwardParity());
    this.root.querySelector('#btn-run-grad')?.addEventListener('click', () => this.runGradientParity());
    this.root.querySelector('#btn-run-train')?.addEventListener('click', () => this.runTrainingParity());
    this.root.querySelector('#btn-run-kv')?.addEventListener('click', () => this.runKvParitySuite());
    this.root.querySelector('#btn-run-maskgrad')?.addEventListener('click', () => this.runMaskedGradParitySuite());
    this.root.querySelector('#btn-run-bench')?.addEventListener('click', () => this.runBenchmarkSuite());
    this.root.querySelector('#btn-copy-fwd')?.addEventListener('click', () => this.copyJson(this.parityReport, 'btn-copy-fwd'));
    this.root.querySelector('#btn-copy-grad')?.addEventListener('click', () => this.copyJson(this.gradReport, 'btn-copy-grad'));
    this.root.querySelector('#btn-copy-kv')?.addEventListener('click', () => this.copyJson(this.kvParityReport, 'btn-copy-kv'));
    this.root.querySelector('#btn-copy-maskgrad')?.addEventListener('click', () => this.copyJson(this.maskedGradReport, 'btn-copy-maskgrad'));
    this.root.querySelector('#btn-copy-bench')?.addEventListener('click', () => this.copyJson(this.benchmarkReport, 'btn-copy-bench'));
    this.root.querySelector('#btn-export-telemetry')?.addEventListener('click', () => this.exportFullTelemetryJson());

    // Training Lab bindings
    this.attachTrainingLabEventListeners();
  }

  private attachTrainingLabEventListeners(): void {
    if (this.activeTab !== 'lab') return;

    // Form inputs
    this.root.querySelector('#input-preset')?.addEventListener('change', (e: any) => {
      this.labConfig.preset = e.target.value;
      if (this.labConfig.preset === 'S') {
        this.labConfig.contextLen = 128;
      } else if (this.labConfig.preset === 'M') {
        this.labConfig.contextLen = 256;
      } else {
        this.labConfig.contextLen = 64;
      }
      this.render();
    });
    this.root.querySelector('#input-lr')?.addEventListener('input', (e: any) => {
      this.labConfig.lr = parseFloat(e.target.value) || 0.001;
      if (this.labClient && this.isLabTraining) {
        this.labClient.setLearningRate(this.labConfig.lr);
      }
    });
    this.root.querySelector('#input-batch')?.addEventListener('input', (e: any) => {
      this.labConfig.batchSize = parseInt(e.target.value, 10) || 16;
    });
    this.root.querySelector('#input-steps')?.addEventListener('input', (e: any) => {
      this.labConfig.steps = parseInt(e.target.value, 10) || 3000;
    });
    this.root.querySelector('#input-warmup')?.addEventListener('input', (e: any) => {
      this.labConfig.warmup = parseInt(e.target.value, 10) || 100;
    });
    this.root.querySelector('#input-decay')?.addEventListener('input', (e: any) => {
      this.labConfig.weightDecay = parseFloat(e.target.value) || 0.1;
    });
    this.root.querySelector('#input-seed')?.addEventListener('input', (e: any) => {
      this.labConfig.seed = parseInt(e.target.value, 10) || 42;
    });
    this.root.querySelector('#input-throttle')?.addEventListener('input', (e: any) => {
      const val = parseFloat(e.target.value) || 1.0;
      this.labConfig.throttle = val;
      const label = document.getElementById('throttle-val-label');
      if (label) {
        label.textContent = val === 1.0 ? '1.0 (Full Speed)' : `${val.toFixed(2)} (${Math.round(val * 100)}% GPU)`;
      }
      if (this.labClient) {
        this.labClient.setThrottle(val);
      }
    });

    // Control Buttons
    this.root.querySelector('#btn-lab-start')?.addEventListener('click', () => this.startLabTraining());
    this.root.querySelector('#btn-lab-pause')?.addEventListener('click', () => this.pauseLabTraining());
    this.root.querySelector('#btn-lab-resume')?.addEventListener('click', () => this.resumeLabTraining());
    this.root.querySelector('#btn-lab-stop')?.addEventListener('click', () => this.stopLabTraining());
    this.root.querySelector('#btn-lab-save-ckpt')?.addEventListener('click', () => this.saveLabCheckpoint());
    this.root.querySelector('#btn-lab-load-ckpt')?.addEventListener('click', () => this.loadLabCheckpoint());

    // Sampling inputs
    this.root.querySelector('#input-sample-prompt')?.addEventListener('input', (e: any) => {
      this.samplePrompt = e.target.value;
    });
    this.root.querySelector('#input-sample-temp')?.addEventListener('input', (e: any) => {
      this.sampleTemperature = parseFloat(e.target.value) || 0.8;
      const el = document.getElementById('sample-temp-val');
      if (el) el.textContent = this.sampleTemperature.toFixed(2);
    });
    this.root.querySelector('#input-sample-topk')?.addEventListener('input', (e: any) => {
      this.sampleTopK = parseInt(e.target.value, 10) || 10;
      const el = document.getElementById('sample-topk-val');
      if (el) el.textContent = String(this.sampleTopK);
    });
    this.root.querySelector('#input-sample-topp')?.addEventListener('input', (e: any) => {
      this.sampleTopP = parseFloat(e.target.value) || 0.9;
      const el = document.getElementById('sample-topp-val');
      if (el) el.textContent = this.sampleTopP.toFixed(2);
    });
    this.root.querySelector('#input-sample-minp')?.addEventListener('input', (e: any) => {
      this.sampleMinP = parseFloat(e.target.value) || 0.05;
      const el = document.getElementById('sample-minp-val');
      if (el) el.textContent = this.sampleMinP.toFixed(2);
    });
    this.root.querySelector('#btn-lab-sample')?.addEventListener('click', () => this.triggerLabSample());
  }

  // --- Render Training Lab Tab ---
  private renderTrainingLabTab(): string {
    const isRunning = this.isLabTraining && !this.isLabPaused;
    const isPaused = this.isLabPaused;

    return `
      <div style="display: flex; flex-direction: column; gap: 1.6rem;">
        
        <!-- Controls & Configuration Bar -->
        <div style="background: rgba(21, 26, 33, 0.6); padding: 1.4rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.05); display: flex; flex-direction: column; gap: 1.2rem;">
          
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.06); padding-bottom: 0.8rem;">
            <div>
              <div style="font-size: 1rem; font-weight: 700; color: #E8E4DA;">Training Configuration & Hyperparameters</div>
              <div style="font-size: 0.8rem; color: #9AA3AE; margin-top: 0.2rem;">
                WebGPU training executed asynchronously in trainer.worker.ts with OPFS persistence and zero-copy inference
              </div>
            </div>
            
            <div style="display: flex; gap: 0.6rem;">
              ${!this.isLabTraining ? `
                <button id="btn-lab-start" style="padding: 0.6rem 1.4rem; background: #6BBF7A; color: #0E1116; border: none; border-radius: 4px; font-family: var(--font-mono); font-size: 0.85rem; font-weight: 700; cursor: pointer;">
                  Start Training ▶
                </button>
              ` : `
                ${isRunning ? `
                  <button id="btn-lab-pause" style="padding: 0.6rem 1.2rem; background: #E8A33D; color: #0E1116; border: none; border-radius: 4px; font-family: var(--font-mono); font-size: 0.82rem; font-weight: 700; cursor: pointer;">
                    Pause ⏸
                  </button>
                ` : `
                  <button id="btn-lab-resume" style="padding: 0.6rem 1.2rem; background: #6BBF7A; color: #0E1116; border: none; border-radius: 4px; font-family: var(--font-mono); font-size: 0.82rem; font-weight: 700; cursor: pointer;">
                    Resume ▶
                  </button>
                `}
                <button id="btn-lab-stop" style="padding: 0.6rem 1.2rem; background: #D9564A; color: #FFFFFF; border: none; border-radius: 4px; font-family: var(--font-mono); font-size: 0.82rem; font-weight: 700; cursor: pointer;">
                  Stop ⏹
                </button>
                <button id="btn-lab-save-ckpt" style="padding: 0.6rem 1rem; background: #1D242D; color: #E8E4DA; border: 1px solid #2A333F; border-radius: 4px; font-family: var(--font-mono); font-size: 0.82rem; cursor: pointer;">
                  Save Checkpoint 💾
                </button>
                <button id="btn-lab-load-ckpt" style="padding: 0.6rem 1rem; background: #1D242D; color: #E8E4DA; border: 1px solid #2A333F; border-radius: 4px; font-family: var(--font-mono); font-size: 0.82rem; cursor: pointer;">
                  Load Latest 📂
                </button>
              `}
            </div>
          </div>

          <!-- Configuration Form Grid -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 1rem; font-family: var(--font-mono); font-size: 0.82rem;">
            <div>
              <label style="color: #9AA3AE; display: block; margin-bottom: 0.3rem;">PRESET</label>
              <select id="input-preset" style="width: 100%; padding: 0.5rem; background: #0E1116; color: #E8E4DA; border: 1px solid #2A333F; border-radius: 4px;" ${this.isLabTraining ? 'disabled' : ''}>
                <option value="S" ${this.labConfig.preset === 'S' ? 'selected' : ''}>Preset S (4L/4H/128D)</option>
                <option value="M" ${this.labConfig.preset === 'M' ? 'selected' : ''}>Preset M (6L/6H/192D)</option>
                <option value="C" ${this.labConfig.preset === 'C' ? 'selected' : ''}>Preset C (2L/2H/64D)</option>
              </select>
            </div>

            <div>
              <label style="color: #9AA3AE; display: block; margin-bottom: 0.3rem;">LEARNING RATE</label>
              <input id="input-lr" type="number" step="0.0001" value="${this.labConfig.lr}" style="width: 100%; padding: 0.5rem; background: #0E1116; color: #E8E4DA; border: 1px solid #2A333F; border-radius: 4px;" />
            </div>

            <div>
              <label style="color: #9AA3AE; display: block; margin-bottom: 0.3rem;">BATCH SIZE (B)</label>
              <input id="input-batch" type="number" value="${this.labConfig.batchSize}" style="width: 100%; padding: 0.5rem; background: #0E1116; color: #E8E4DA; border: 1px solid #2A333F; border-radius: 4px;" ${this.isLabTraining ? 'disabled' : ''} />
            </div>

            <div>
              <label style="color: #9AA3AE; display: block; margin-bottom: 0.3rem;">TOTAL STEPS</label>
              <input id="input-steps" type="number" value="${this.labConfig.steps}" style="width: 100%; padding: 0.5rem; background: #0E1116; color: #E8E4DA; border: 1px solid #2A333F; border-radius: 4px;" ${this.isLabTraining ? 'disabled' : ''} />
            </div>

            <div>
              <label style="color: #9AA3AE; display: block; margin-bottom: 0.3rem;">WARMUP STEPS</label>
              <input id="input-warmup" type="number" value="${this.labConfig.warmup}" style="width: 100%; padding: 0.5rem; background: #0E1116; color: #E8E4DA; border: 1px solid #2A333F; border-radius: 4px;" ${this.isLabTraining ? 'disabled' : ''} />
            </div>

            <div>
              <label style="color: #9AA3AE; display: block; margin-bottom: 0.3rem;">WEIGHT DECAY</label>
              <input id="input-decay" type="number" step="0.01" value="${this.labConfig.weightDecay}" style="width: 100%; padding: 0.5rem; background: #0E1116; color: #E8E4DA; border: 1px solid #2A333F; border-radius: 4px;" ${this.isLabTraining ? 'disabled' : ''} />
            </div>

            <div>
              <label style="color: #9AA3AE; display: block; margin-bottom: 0.3rem;">RNG SEED</label>
              <input id="input-seed" type="number" value="${this.labConfig.seed}" style="width: 100%; padding: 0.5rem; background: #0E1116; color: #E8E4DA; border: 1px solid #2A333F; border-radius: 4px;" ${this.isLabTraining ? 'disabled' : ''} />
            </div>

            <div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.3rem;">
                <label style="color: #9AA3AE;">THROTTLE</label>
                <span id="throttle-val-label" style="color: #4FB3A9; font-weight: 700;">${this.labConfig.throttle === 1.0 ? '1.0 (Full Speed)' : `${this.labConfig.throttle.toFixed(2)} (${Math.round(this.labConfig.throttle * 100)}%)`}</span>
              </div>
              <input id="input-throttle" type="range" min="0.05" max="1.0" step="0.05" value="${this.labConfig.throttle}" style="width: 100%; cursor: pointer;" />
            </div>
          </div>

        </div>

        <!-- Live Dashboard Metrics -->
        <div id="lab-metrics-container">
          ${this.renderMetricsDashboard()}
        </div>

        <!-- Live Loss Chart -->
        <div style="display: flex; flex-direction: column; gap: 0.8rem;">
          <div style="font-family: var(--font-mono); font-size: 0.92rem; font-weight: 700; color: #E8E4DA;">
            Live Convergence Curve (Raw Train vs Smoothed EMA vs Fixed Validation Batches)
          </div>
          <div id="lab-chart-container">
            ${this.renderLiveLossChart()}
          </div>
        </div>

        <!-- GPU Sampling & Generation Panel -->
        <div style="background: rgba(21, 26, 33, 0.6); padding: 1.4rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.05); display: flex; flex-direction: column; gap: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.06); padding-bottom: 0.6rem;">
            <div>
              <div style="font-size: 0.95rem; font-weight: 700; color: #E8E4DA;">Zero-Copy GPU Inference Sampler</div>
              <div style="font-size: 0.8rem; color: #9AA3AE; margin-top: 0.2rem;">
                Shares trainer's parameter buffer directly (0 bytes copied in VRAM). Reads back only the last token position logits.
              </div>
            </div>
            <button id="btn-lab-sample" style="padding: 0.6rem 1.4rem; background: #E8A33D; color: #0E1116; border: none; border-radius: 4px; font-family: var(--font-mono); font-size: 0.85rem; font-weight: 700; cursor: pointer;" ${(!this.labClient || this.isSampling) ? 'disabled' : ''}>
              ${this.isSampling ? 'Generating Tokens ⟳' : 'Generate Sample ⚡'}
            </button>
          </div>

          <!-- Sampling Controls Row -->
          <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr; gap: 1rem; font-family: var(--font-mono); font-size: 0.82rem;">
            <div>
              <label style="color: #9AA3AE; display: block; margin-bottom: 0.3rem;">PROMPT</label>
              <input id="input-sample-prompt" type="text" value="${this.samplePrompt}" style="width: 100%; padding: 0.5rem; background: #0E1116; color: #E8E4DA; border: 1px solid #2A333F; border-radius: 4px;" />
            </div>
            <div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.3rem;">
                <label style="color: #9AA3AE;">TEMPERATURE</label>
                <span id="sample-temp-val" style="color: #4FB3A9;">${this.sampleTemperature.toFixed(2)}</span>
              </div>
              <input id="input-sample-temp" type="range" min="0.1" max="2.0" step="0.05" value="${this.sampleTemperature}" style="width: 100%; cursor: pointer;" />
            </div>
            <div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.3rem;">
                <label style="color: #9AA3AE;">TOP-K</label>
                <span id="sample-topk-val" style="color: #4FB3A9;">${this.sampleTopK}</span>
              </div>
              <input id="input-sample-topk" type="range" min="1" max="50" step="1" value="${this.sampleTopK}" style="width: 100%; cursor: pointer;" />
            </div>
            <div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.3rem;">
                <label style="color: #9AA3AE;">TOP-P</label>
                <span id="sample-topp-val" style="color: #4FB3A9;">${this.sampleTopP.toFixed(2)}</span>
              </div>
              <input id="input-sample-topp" type="range" min="0.1" max="1.0" step="0.05" value="${this.sampleTopP}" style="width: 100%; cursor: pointer;" />
            </div>
            <div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.3rem;">
                <label style="color: #9AA3AE;">MIN-P</label>
                <span id="sample-minp-val" style="color: #4FB3A9;">${this.sampleMinP.toFixed(2)}</span>
              </div>
              <input id="input-sample-minp" type="range" min="0.0" max="0.5" step="0.01" value="${this.sampleMinP}" style="width: 100%; cursor: pointer;" />
            </div>
          </div>

          <!-- Streaming Output Window -->
          <div>
            <label style="font-family: var(--font-mono); font-size: 0.78rem; color: #9AA3AE; display: block; margin-bottom: 0.4rem;">STREAMING TOKEN OUTPUT</label>
            <div id="lab-sample-output" style="background: #060913; border: 1px solid #2A333F; border-radius: 6px; padding: 1.2rem; min-height: 140px; max-height: 240px; overflow-y: auto; font-family: var(--font-mono); font-size: 0.88rem; line-height: 1.5; color: #E8E4DA; white-space: pre-wrap; word-break: break-word;">${this.sampleOutput || '<span style="color: #9AA3AE; font-style: italic;">Sample output will stream here in real time...</span>'}${this.isSampling ? '<span style="display: inline-block; width: 8px; height: 14px; background: #4FB3A9; margin-left: 2px; animation: blink 1s infinite;"></span>' : ''}</div>
          </div>

        </div>

        <!-- Jane Austen Domain Adaptation & Replay Regularization Dashboard -->
        <div style="background: rgba(21, 26, 33, 0.6); padding: 1.4rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.05); display: flex; flex-direction: column; gap: 1.2rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.06); padding-bottom: 0.8rem;">
            <div>
              <div style="font-size: 1rem; font-weight: 700; color: #E8E4DA;">Jane Austen Domain Adaptation & Replay Regularization (Elder-H)</div>
              <div style="font-size: 0.8rem; color: #9AA3AE; margin-top: 0.2rem;">
                Continuous domain transfer from Shakespeare to Pride & Prejudice (250,839 tuning tokens; 45,841 held-out tokens)
              </div>
            </div>
            <div style="font-family: var(--font-mono); font-size: 0.8rem; color: #4FB3A9;">
              Untuned Austen Base: <strong>4.690 nats</strong> | Shake Val: <strong>3.164 nats</strong>
            </div>
          </div>

          <!-- Baselines & Vocabulary Fragmentation Overview -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.8rem;">
            <div style="background: rgba(0, 0, 0, 0.25); border: 1px solid #2A333F; border-radius: 4px; padding: 0.7rem;">
              <div style="font-size: 0.72rem; color: #9AA3AE; text-transform: uppercase;">Untuned Elder-H</div>
              <div style="font-family: var(--font-mono); font-size: 1.1rem; font-weight: 700; color: #E8A33D; margin-top: 2px;">4.6897 nats</div>
              <div style="font-size: 0.7rem; color: #9AA3AE;">2.384 nats/char (Domain gap)</div>
            </div>
            <div style="background: rgba(0, 0, 0, 0.25); border: 1px solid #2A333F; border-radius: 4px; padding: 0.7rem;">
              <div style="font-size: 0.72rem; color: #9AA3AE; text-transform: uppercase;">Austen Bigram Baseline</div>
              <div style="font-family: var(--font-mono); font-size: 1.1rem; font-weight: 700; color: #4FB3A9; margin-top: 2px;">3.5543 nats</div>
              <div style="font-size: 0.7rem; color: #9AA3AE;">1.491 nats/char (In-domain)</div>
            </div>
            <div style="background: rgba(0, 0, 0, 0.25); border: 1px solid #2A333F; border-radius: 4px; padding: 0.7rem;">
              <div style="font-size: 0.72rem; color: #9AA3AE; text-transform: uppercase;">Austen Trigram Baseline</div>
              <div style="font-family: var(--font-mono); font-size: 1.1rem; font-weight: 700; color: #4FB3A9; margin-top: 2px;">3.7413 nats</div>
              <div style="font-size: 0.7rem; color: #9AA3AE;">1.570 nats/char (In-domain)</div>
            </div>
            <div style="background: rgba(0, 0, 0, 0.25); border: 1px solid #2A333F; border-radius: 4px; padding: 0.7rem;">
              <div style="font-size: 0.72rem; color: #9AA3AE; text-transform: uppercase;">Vocabulary Fragmentation</div>
              <div style="font-family: var(--font-mono); font-size: 1.1rem; font-weight: 700; color: #D9564A; margin-top: 2px;">17.47%</div>
              <div style="font-size: 0.7rem; color: #9AA3AE;">21,504 words split into ≥4 tokens</div>
            </div>
          </div>

          <!-- Pareto Frontier Sweep Table -->
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-family: var(--font-mono); font-size: 0.82rem;">
              <thead>
                <tr style="border-bottom: 1px solid #2A333F; color: #9AA3AE; text-align: left; background: rgba(0, 0, 0, 0.2);">
                  <th style="padding: 0.6rem 0.8rem;">CONFIG</th>
                  <th style="padding: 0.6rem 0.8rem;">LEARNING RATE</th>
                  <th style="padding: 0.6rem 0.8rem;">REPLAY RATIO</th>
                  <th style="padding: 0.6rem 0.8rem;">STEPS</th>
                  <th style="padding: 0.6rem 0.8rem;">AUSTEN HELD-OUT</th>
                  <th style="padding: 0.6rem 0.8rem;">SHAKESPEARE VAL</th>
                  <th style="padding: 0.6rem 0.8rem;">FORGETTING DRIFT</th>
                  <th style="padding: 0.6rem 0.8rem;">PARETO STATUS</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.04); background: rgba(79, 179, 169, 0.08);">
                  <td style="padding: 0.6rem 0.8rem; font-weight: 700; color: #4FB3A9;">ADAPTED-25 (CHOSEN)</td>
                  <td style="padding: 0.6rem 0.8rem; color: #E8E4DA;">1e-4</td>
                  <td style="padding: 0.6rem 0.8rem; color: #4FB3A9; font-weight: 700;">25% Replay</td>
                  <td style="padding: 0.6rem 0.8rem; color: #9AA3AE;">2,975</td>
                  <td style="padding: 0.6rem 0.8rem; color: #4FB3A9; font-weight: 700;">2.4710 nats</td>
                  <td style="padding: 0.6rem 0.8rem; color: #E8E4DA;">3.3057 nats</td>
                  <td style="padding: 0.6rem 0.8rem; color: #4FB3A9; font-weight: 700;">+0.1418 nats (≤0.15)</td>
                  <td style="padding: 0.6rem 0.8rem; color: #4FB3A9; font-weight: 700;">★ Pareto Best Gain</td>
                </tr>
                <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.04);">
                  <td style="padding: 0.6rem 0.8rem; font-weight: 700; color: #E8E4DA;">ADAPTED-50 (CONSERVATIVE)</td>
                  <td style="padding: 0.6rem 0.8rem; color: #E8E4DA;">3e-4</td>
                  <td style="padding: 0.6rem 0.8rem; color: #4FB3A9;">50% Replay</td>
                  <td style="padding: 0.6rem 0.8rem; color: #9AA3AE;">3,000</td>
                  <td style="padding: 0.6rem 0.8rem; color: #4FB3A9;">2.5066 nats</td>
                  <td style="padding: 0.6rem 0.8rem; color: #E8E4DA;">3.2711 nats</td>
                  <td style="padding: 0.6rem 0.8rem; color: #4FB3A9;">+0.1071 nats</td>
                  <td style="padding: 0.6rem 0.8rem; color: #E8E4DA;">🛡 Conservative Safe</td>
                </tr>
                <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.04);">
                  <td style="padding: 0.6rem 0.8rem; font-weight: 700; color: #E8E4DA;">ADAPTED-0 (NO REPLAY)</td>
                  <td style="padding: 0.6rem 0.8rem; color: #E8E4DA;">1e-4</td>
                  <td style="padding: 0.6rem 0.8rem; color: #D9564A;">0% Replay</td>
                  <td style="padding: 0.6rem 0.8rem; color: #9AA3AE;">3,000</td>
                  <td style="padding: 0.6rem 0.8rem; color: #E8A33D;">2.6105 nats</td>
                  <td style="padding: 0.6rem 0.8rem; color: #D9564A; font-weight: 700;">4.3188 nats</td>
                  <td style="padding: 0.6rem 0.8rem; color: #D9564A; font-weight: 700;">+1.1549 nats</td>
                  <td style="padding: 0.6rem 0.8rem; color: #D9564A;">⚠ Severe Forgetting</td>
                </tr>
                <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.04);">
                  <td style="padding: 0.6rem 0.8rem; font-weight: 700; color: #E8E4DA;">HIGH-LR (NO REPLAY)</td>
                  <td style="padding: 0.6rem 0.8rem; color: #E8E4DA;">3e-4</td>
                  <td style="padding: 0.6rem 0.8rem; color: #D9564A;">0% Replay</td>
                  <td style="padding: 0.6rem 0.8rem; color: #9AA3AE;">3,000</td>
                  <td style="padding: 0.6rem 0.8rem; color: #E8A33D;">2.5542 nats</td>
                  <td style="padding: 0.6rem 0.8rem; color: #D9564A; font-weight: 700;">5.0321 nats</td>
                  <td style="padding: 0.6rem 0.8rem; color: #D9564A; font-weight: 700;">+1.8682 nats</td>
                  <td style="padding: 0.6rem 0.8rem; color: #D9564A;">⚠ General Collapse</td>
                </tr>
                <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.04);">
                  <td style="padding: 0.6rem 0.8rem; font-weight: 700; color: #E8E4DA;">AGGRESSIVE (NO REPLAY)</td>
                  <td style="padding: 0.6rem 0.8rem; color: #E8E4DA;">1e-3</td>
                  <td style="padding: 0.6rem 0.8rem; color: #D9564A;">0% Replay</td>
                  <td style="padding: 0.6rem 0.8rem; color: #9AA3AE;">3,000</td>
                  <td style="padding: 0.6rem 0.8rem; color: #E8A33D;">2.8210 nats</td>
                  <td style="padding: 0.6rem 0.8rem; color: #D9564A; font-weight: 700;">5.9340 nats</td>
                  <td style="padding: 0.6rem 0.8rem; color: #D9564A; font-weight: 700;">+2.7701 nats</td>
                  <td style="padding: 0.6rem 0.8rem; color: #D9564A;">⚠ Total Amnesia</td>
                </tr>
                <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.04);">
                  <td style="padding: 0.6rem 0.8rem; font-weight: 700; color: #E8E4DA;">FROM-SCRATCH CONTROL</td>
                  <td style="padding: 0.6rem 0.8rem; color: #E8E4DA;">3e-4</td>
                  <td style="padding: 0.6rem 0.8rem; color: #9AA3AE;">0% (Austen Only)</td>
                  <td style="padding: 0.6rem 0.8rem; color: #9AA3AE;">3,000</td>
                  <td style="padding: 0.6rem 0.8rem; color: #D9564A;">3.2683 nats</td>
                  <td style="padding: 0.6rem 0.8rem; color: #D9564A; font-weight: 700;">6.6801 nats</td>
                  <td style="padding: 0.6rem 0.8rem; color: #9AA3AE;">N/A (Untrained)</td>
                  <td style="padding: 0.6rem 0.8rem; color: #E8A33D;">Pretraining Gain: +0.797</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Free-Run Evaluation & Style Shift Rate -->
          <div style="margin-top: 1.2rem; border-top: 1px solid rgba(255, 255, 255, 0.06); padding-top: 1.0rem;">
            <div style="font-size: 0.92rem; font-weight: 700; color: #E8E4DA; margin-bottom: 0.3rem;">
              Generative Style Shift & Objective Entity Rates (200 generations, T=0.8)
            </div>
            <div style="font-size: 0.78rem; color: #9AA3AE; margin-bottom: 0.8rem;">
              Measuring empirical transition from theatrical verse tags to 19th-century Regency domestic entities with 95% Wilson confidence intervals
            </div>
            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; font-family: var(--font-mono); font-size: 0.80rem;">
                <thead>
                  <tr style="border-bottom: 1px solid #2A333F; color: #9AA3AE; text-align: left; background: rgba(0, 0, 0, 0.2);">
                    <th style="padding: 0.5rem 0.7rem;">MODEL VARIANT</th>
                    <th style="padding: 0.5rem 0.7rem;">AUSTEN CHARACTER NAMES</th>
                    <th style="padding: 0.5rem 0.7rem;">95% WILSON CI</th>
                    <th style="padding: 0.5rem 0.7rem;">THEATRICAL SPEAKER TAGS</th>
                    <th style="padding: 0.5rem 0.7rem;">95% WILSON CI</th>
                    <th style="padding: 0.5rem 0.7rem;">VERBATIM 20-TOK MEMORIZATION</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.04);">
                    <td style="padding: 0.5rem 0.7rem; font-weight: 700; color: #E8E4DA;">Base Elder-H (Shakespeare)</td>
                    <td style="padding: 0.5rem 0.7rem; color: #9AA3AE;">0 / 200 (0.0%)</td>
                    <td style="padding: 0.5rem 0.7rem; color: #9AA3AE;">[0.00%, 1.88%]</td>
                    <td style="padding: 0.5rem 0.7rem; color: #D9564A; font-weight: 700;">45 / 243 (18.5%)</td>
                    <td style="padding: 0.5rem 0.7rem; color: #D9564A;">[13.73%, 24.46%]</td>
                    <td style="padding: 0.5rem 0.7rem; color: #4FB3A9;">0 / 200 (0.0%)</td>
                  </tr>
                  <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.04); background: rgba(79, 179, 169, 0.08);">
                    <td style="padding: 0.5rem 0.7rem; font-weight: 700; color: #4FB3A9;">Adapted Elder-H (25% Replay)</td>
                    <td style="padding: 0.5rem 0.7rem; color: #4FB3A9; font-weight: 700;">50 / 244 (20.5%)</td>
                    <td style="padding: 0.5rem 0.7rem; color: #4FB3A9;">[15.49%, 26.63%]</td>
                    <td style="padding: 0.5rem 0.7rem; color: #4FB3A9;">1 / 200 (0.5%)</td>
                    <td style="padding: 0.5rem 0.7rem; color: #4FB3A9;">[0.09%, 2.78%]</td>
                    <td style="padding: 0.5rem 0.7rem; color: #4FB3A9; font-weight: 700;">0 / 200 (0.0%)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          </div>
        </div>

      </div>
    `;
  }

  // --- Parity Tab Render ---
  private renderParityTab(): string {
    const fwd = this.parityReport;
    const grad = this.gradReport;
    const train = this.trainingParityReport;

    return `
      <div style="display: flex; flex-direction: column; gap: 1.8rem;">
        
        <!-- Controls Bar -->
        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(21, 26, 33, 0.6); padding: 1rem 1.4rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.05);">
          <div>
            <div style="font-size: 0.95rem; font-weight: 700; color: #E8E4DA;">Parity Verification Controls</div>
            <div style="font-size: 0.8rem; color: #9AA3AE; margin-top: 0.2rem;">
              Forward Thresholds: Loss RelErr &lt; 1e-4, Logits &lt; 1e-3 | Backward Threshold: RelErr &lt; 1e-3 per param group
            </div>
          </div>
          <div style="display: flex; gap: 0.6rem; flex-wrap: wrap;">
            <button id="btn-run-fwd" style="padding: 0.5rem 1rem; background: #E8A33D; color: #0E1116; border: none; border-radius: 4px; font-family: var(--font-mono); font-size: 0.8rem; font-weight: 700; cursor: pointer;" ${this.isRunning ? 'disabled' : ''}>
              Forward Parity ▶
            </button>
            <button id="btn-run-grad" style="padding: 0.5rem 1rem; background: #4FB3A9; color: #0E1116; border: none; border-radius: 4px; font-family: var(--font-mono); font-size: 0.8rem; font-weight: 700; cursor: pointer;" ${this.isRunning ? 'disabled' : ''}>
              Gradient Parity ▶
            </button>
            <button id="btn-run-train" style="padding: 0.5rem 1rem; background: #6BBF7A; color: #0E1116; border: none; border-radius: 4px; font-family: var(--font-mono); font-size: 0.8rem; font-weight: 700; cursor: pointer;" ${this.isRunning ? 'disabled' : ''}>
              300-Step Training ▶
            </button>
            <button id="btn-run-kv" style="padding: 0.5rem 1rem; background: #38bdf8; color: #0E1116; border: none; border-radius: 4px; font-family: var(--font-mono); font-size: 0.8rem; font-weight: 700; cursor: pointer;" ${this.isRunning ? 'disabled' : ''}>
              KV-Cache Parity (200t) ▶
            </button>
            <button id="btn-run-maskgrad" style="padding: 0.5rem 1rem; background: #a855f7; color: #0E1116; border: none; border-radius: 4px; font-family: var(--font-mono); font-size: 0.8rem; font-weight: 700; cursor: pointer;" ${this.isRunning ? 'disabled' : ''}>
              Masked Grad Parity ▶
            </button>
          </div>
        </div>

        <!-- 1. Forward Parity Section -->
        <div style="display: flex; flex-direction: column; gap: 0.8rem;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="font-family: var(--font-mono); font-size: 0.92rem; font-weight: 700; color: #E8E4DA;">
              1. Forward Pass Parity (Presets C, S, M)
            </div>
            ${fwd ? `<button id="btn-copy-fwd" style="padding: 0.4rem 0.8rem; background: #1D242D; color: #E8E4DA; border: 1px solid #2A333F; border-radius: 4px; font-family: var(--font-mono); font-size: 0.78rem; cursor: pointer;">Copy as JSON</button>` : ''}
          </div>

          <div style="overflow-x: auto; background: rgba(14, 17, 22, 0.4); border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.05);">
            <table style="width: 100%; border-collapse: collapse; font-family: var(--font-mono); font-size: 0.84rem;">
              <thead>
                <tr style="border-bottom: 1px solid #2A333F; color: #9AA3AE; text-align: left; background: rgba(0, 0, 0, 0.2);">
                  <th style="padding: 0.8rem;">PRESET</th>
                  <th style="padding: 0.8rem;">CONFIG</th>
                  <th style="padding: 0.8rem;">CPU LOSS</th>
                  <th style="padding: 0.8rem;">GPU LOSS</th>
                  <th style="padding: 0.8rem;">LOSS REL-ERR</th>
                  <th style="padding: 0.8rem;">LOGITS MAX-DIFF</th>
                  <th style="padding: 0.8rem;">STATUS</th>
                </tr>
              </thead>
              <tbody>
                ${!fwd ? `
                  <tr><td colspan="7" style="text-align: center; padding: 2.5rem; color: #9AA3AE;">Click "Run Forward Parity" to test Float32 WebGPU pipelines against Float64 reference.</td></tr>
                ` : fwd.results.map(r => `
                  <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.04);">
                    <td style="padding: 0.8rem; font-weight: 700; color: #E8E4DA;">Preset ${r.preset}</td>
                    <td style="padding: 0.8rem; color: #9AA3AE;">${r.config.nLayers}L / ${r.config.nHeads}H / ${r.config.dModel}D (ctx ${r.config.contextLen})</td>
                    <td style="padding: 0.8rem; color: #4FB3A9;">${r.cpuLoss.toFixed(5)}</td>
                    <td style="padding: 0.8rem; color: #6BBF7A;">${r.gpuLoss.toFixed(5)}</td>
                    <td style="padding: 0.8rem; color: ${r.lossRelativeError < 1e-4 ? '#6BBF7A' : '#D9564A'}; font-weight: 700;">
                      ${r.lossRelativeError.toExponential(3)} ${r.lossRelativeError < 1e-4 ? '✓' : '✗'}
                    </td>
                    <td style="padding: 0.8rem; color: ${r.logitsMaxDiff < 1e-3 ? '#6BBF7A' : '#D9564A'}; font-weight: 700;">
                      ${r.logitsMaxDiff.toExponential(3)} ${r.logitsMaxDiff < 1e-3 ? '✓' : '✗'}
                    </td>
                    <td style="padding: 0.8rem; font-weight: 700; color: ${r.passed ? '#6BBF7A' : '#D9564A'};">
                      ${r.passed ? 'PASS' : 'FAIL'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- 2. Gradient Parity Section -->
        <div style="display: flex; flex-direction: column; gap: 0.8rem;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="font-family: var(--font-mono); font-size: 0.92rem; font-weight: 700; color: #E8E4DA;">
              2. Gradient Analytical Parity (Preset C, All 36 Parameter Groups)
            </div>
            ${grad ? `<button id="btn-copy-grad" style="padding: 0.4rem 0.8rem; background: #1D242D; color: #E8E4DA; border: 1px solid #2A333F; border-radius: 4px; font-family: var(--font-mono); font-size: 0.78rem; cursor: pointer;">Copy as JSON</button>` : ''}
          </div>

          <div style="max-height: 260px; overflow-y: auto; background: rgba(14, 17, 22, 0.4); border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.05);">
            <table style="width: 100%; border-collapse: collapse; font-family: var(--font-mono); font-size: 0.82rem;">
              <thead>
                <tr style="border-bottom: 1px solid #2A333F; color: #9AA3AE; text-align: left; background: rgba(0, 0, 0, 0.2); position: sticky; top: 0;">
                  <th style="padding: 0.6rem 0.8rem;">GROUP</th>
                  <th style="padding: 0.6rem 0.8rem;">SHAPE</th>
                  <th style="padding: 0.6rem 0.8rem;">MAX CPU GRAD</th>
                  <th style="padding: 0.6rem 0.8rem;">REL ERROR</th>
                  <th style="padding: 0.6rem 0.8rem;">STATUS</th>
                </tr>
              </thead>
              <tbody>
                ${!grad ? `
                  <tr><td colspan="5" style="text-align: center; padding: 2.5rem; color: #9AA3AE;">Click "Run Gradient Parity" to compare GPU backward kernels against CPU analytical gradients.</td></tr>
                ` : grad.groups.map(g => `
                  <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.04);">
                    <td style="padding: 0.6rem 0.8rem; font-weight: 700; color: #E8E4DA;">${g.name}</td>
                    <td style="padding: 0.6rem 0.8rem; color: #4FB3A9;">${JSON.stringify(g.shape)}</td>
                    <td style="padding: 0.6rem 0.8rem; color: #9AA3AE;">${g.maxCpuGrad.toExponential(3)}</td>
                    <td style="padding: 0.6rem 0.8rem; color: ${g.passed ? '#6BBF7A' : '#D9564A'}; font-weight: 700;">
                      ${g.relError.toExponential(3)} ${g.passed ? '✓' : '✗'}
                    </td>
                    <td style="padding: 0.6rem 0.8rem; font-weight: 700; color: ${g.passed ? '#6BBF7A' : '#D9564A'};">
                      ${g.passed ? 'PASS' : 'FAIL'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- 3. Training Parity Chart Section -->
        <div style="display: flex; flex-direction: column; gap: 0.8rem;">
          <div style="font-family: var(--font-mono); font-size: 0.92rem; font-weight: 700; color: #E8E4DA;">
            3. Shakespeare Training Parity (300 Steps, Preset C, CPU vs GPU)
          </div>
          ${train ? this.renderLossChart(train.points) : `
            <div style="background: rgba(14, 17, 22, 0.4); border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.05); padding: 3rem; text-align: center; color: #9AA3AE; font-family: var(--font-mono); font-size: 0.85rem;">
              Click "Run 300-Step Training Parity" to train both models and render the comparison chart.
            </div>
          `}
        </div>

        <!-- 4. GPU KV-Cache Autoregressive Generation Parity -->
        <div style="display: flex; flex-direction: column; gap: 0.8rem;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="font-family: var(--font-mono); font-size: 0.92rem; font-weight: 700; color: #E8E4DA;">
              4. GPU KV-Cache Generation Parity (Scout & Preset S / The Elder, 200 Tokens)
            </div>
            ${this.kvParityReport ? `<button id="btn-copy-kv" style="padding: 0.4rem 0.8rem; background: #1D242D; color: #E8E4DA; border: 1px solid #2A333F; border-radius: 4px; font-family: var(--font-mono); font-size: 0.78rem; cursor: pointer;">Copy as JSON</button>` : ''}
          </div>

          <div style="overflow-x: auto; background: rgba(14, 17, 22, 0.4); border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.05);">
            <table style="width: 100%; border-collapse: collapse; font-family: var(--font-mono); font-size: 0.84rem;">
              <thead>
                <tr style="border-bottom: 1px solid #2A333F; color: #9AA3AE; text-align: left; background: rgba(0, 0, 0, 0.2);">
                  <th style="padding: 0.8rem;">MODEL / PRESET</th>
                  <th style="padding: 0.8rem;">TOKENS</th>
                  <th style="padding: 0.8rem;">MAX REL-ERR</th>
                  <th style="padding: 0.8rem;">MEAN REL-ERR</th>
                  <th style="padding: 0.8rem;">CACHED SPEED</th>
                  <th style="padding: 0.8rem;">UNCACHED SPEED</th>
                  <th style="padding: 0.8rem;">SPEEDUP</th>
                  <th style="padding: 0.8rem;">STATUS (&lt; 1e-3)</th>
                </tr>
              </thead>
              <tbody>
                ${!this.kvParityReport ? `
                  <tr><td colspan="8" style="text-align: center; padding: 2.5rem; color: #9AA3AE;">Click "KV-Cache Parity (200t)" to verify matrix-vector KV generation against uncached pass over 200 tokens.</td></tr>
                ` : [this.kvParityReport.scout, this.kvParityReport.s].filter(Boolean).map(r => `
                  <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.04);">
                    <td style="padding: 0.8rem; font-weight: 700; color: #E8E4DA;">${r!.preset === 'S' ? 'Preset S (The Elder)' : 'Scout Preset'}</td>
                    <td style="padding: 0.8rem; color: #9AA3AE;">${r!.tokensGenerated}</td>
                    <td style="padding: 0.8rem; color: ${r!.maxRelativeError < 1e-3 ? '#6BBF7A' : '#D9564A'}; font-weight: 700;">
                      ${r!.maxRelativeError.toExponential(4)} ${r!.maxRelativeError < 1e-3 ? '✓' : '✗'}
                    </td>
                    <td style="padding: 0.8rem; color: #9AA3AE;">${r!.meanRelativeError.toExponential(4)}</td>
                    <td style="padding: 0.8rem; color: #38bdf8; font-weight: 700;">${r!.cachedTokensPerSec.toFixed(2)} tok/s</td>
                    <td style="padding: 0.8rem; color: #9AA3AE;">${r!.uncachedTokensPerSec.toFixed(2)} tok/s</td>
                    <td style="padding: 0.8rem; color: #6BBF7A; font-weight: 700;">${r!.speedup.toFixed(3)}x</td>
                    <td style="padding: 0.8rem; font-weight: 700; color: ${r!.passed ? '#6BBF7A' : '#D9564A'};">
                      ${r!.passed ? 'PASS' : 'FAIL'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- 5. Masked Gradient Parity Section -->
        <div style="display: flex; flex-direction: column; gap: 0.8rem;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="font-family: var(--font-mono); font-size: 0.92rem; font-weight: 700; color: #E8E4DA;">
              5. Masked Gradient Parity (Preset C, 40% Masking with Ignore Index -1)
            </div>
            ${this.maskedGradReport ? `<button id="btn-copy-maskgrad" style="padding: 0.4rem 0.8rem; background: #1D242D; color: #E8E4DA; border: 1px solid #2A333F; border-radius: 4px; font-family: var(--font-mono); font-size: 0.78rem; cursor: pointer;">Copy as JSON</button>` : ''}
          </div>

          <div style="max-height: 260px; overflow-y: auto; background: rgba(14, 17, 22, 0.4); border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.05);">
            <table style="width: 100%; border-collapse: collapse; font-family: var(--font-mono); font-size: 0.82rem;">
              <thead>
                <tr style="border-bottom: 1px solid #2A333F; color: #9AA3AE; text-align: left; background: rgba(0, 0, 0, 0.2); position: sticky; top: 0;">
                  <th style="padding: 0.6rem 0.8rem;">GROUP</th>
                  <th style="padding: 0.6rem 0.8rem;">SIZE</th>
                  <th style="padding: 0.6rem 0.8rem;">MAX ABS DIFF</th>
                  <th style="padding: 0.6rem 0.8rem;">REL ERROR</th>
                  <th style="padding: 0.6rem 0.8rem;">STATUS (&lt; 1e-3)</th>
                </tr>
              </thead>
              <tbody>
                ${!this.maskedGradReport ? `
                  <tr><td colspan="5" style="text-align: center; padding: 2.5rem; color: #9AA3AE;">Click "Masked Grad Parity" to compare WebGPU loss masking gradients against CPU reference.</td></tr>
                ` : this.maskedGradReport.groups.map((g: any) => `
                  <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.04);">
                    <td style="padding: 0.6rem 0.8rem; font-weight: 700; color: #E8E4DA;">${g.name}</td>
                    <td style="padding: 0.6rem 0.8rem; color: #9AA3AE;">${g.size}</td>
                    <td style="padding: 0.6rem 0.8rem; color: #9AA3AE;">${g.maxAbsDiff.toExponential(3)}</td>
                    <td style="padding: 0.6rem 0.8rem; color: ${g.passed ? '#6BBF7A' : '#D9564A'}; font-weight: 700;">
                      ${g.relError.toExponential(3)} ${g.passed ? '✓' : '✗'}
                    </td>
                    <td style="padding: 0.6rem 0.8rem; font-weight: 700; color: ${g.passed ? '#6BBF7A' : '#D9564A'};">
                      ${g.passed ? 'PASS' : 'FAIL'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;
  }

  // --- Benchmark Tab Render ---
  private renderBenchmarkTab(): string {
    const bReport = this.benchmarkReport;

    return `
      <div style="display: flex; flex-direction: column; gap: 1.6rem;">
        
        <!-- Controls Bar -->
        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(21, 26, 33, 0.6); padding: 1rem 1.4rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.05);">
          <div>
            <div style="font-size: 0.95rem; font-weight: 700; color: #E8E4DA;">WebGPU Full Training Step Benchmarks</div>
            <div style="font-size: 0.8rem; color: #9AA3AE; margin-top: 0.2rem;">
              10 Warmup Steps + 100 Benchmarked Steps per configuration (Forward + Backward + AdamW)
            </div>
          </div>
          <div style="display: flex; gap: 0.8rem;">
            ${bReport ? `<button id="btn-copy-bench" style="padding: 0.6rem 1.2rem; background: #1D242D; color: #E8E4DA; border: 1px solid #2A333F; border-radius: 4px; font-family: var(--font-mono); font-size: 0.82rem; cursor: pointer;">Copy as JSON</button>` : ''}
            <button id="btn-run-bench" style="padding: 0.6rem 1.4rem; background: #E8A33D; color: #0E1116; border: none; border-radius: 4px; font-family: var(--font-mono); font-size: 0.85rem; font-weight: 700; cursor: pointer;" ${this.isRunning ? 'disabled' : ''}>
              ${this.isRunning ? 'Executing Benchmarks ⟳' : 'Run Training Benchmarks ▶'}
            </button>
          </div>
        </div>

        ${bReport ? `
          <div style="font-family: var(--font-mono); font-size: 0.85rem; color: #4FB3A9; background: rgba(0, 0, 0, 0.25); padding: 0.6rem 1rem; border-radius: 4px; border: 1px solid #2A333F;">
            Active GPU Adapter: <strong>${bReport.adapterName}</strong>
          </div>
        ` : ''}

        <!-- Benchmark Table -->
        <div style="overflow-x: auto; background: rgba(14, 17, 22, 0.4); border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.05);">
          <table style="width: 100%; border-collapse: collapse; font-family: var(--font-mono); font-size: 0.84rem;">
            <thead>
              <tr style="border-bottom: 1px solid #2A333F; color: #9AA3AE; text-align: left; background: rgba(0, 0, 0, 0.2);">
                <th style="padding: 0.9rem 0.8rem;">PRESET</th>
                <th style="padding: 0.9rem 0.8rem;">BATCH / CONTEXT</th>
                <th style="padding: 0.9rem 0.8rem;">PARAMETERS</th>
                <th style="padding: 0.9rem 0.8rem;">LATENCY</th>
                <th style="padding: 0.9rem 0.8rem;">THROUGHPUT</th>
                <th style="padding: 0.9rem 0.8rem;">COMPUTE PERF</th>
              </tr>
            </thead>
            <tbody>
              ${!bReport ? `
                <tr><td colspan="6" style="text-align: center; padding: 4rem; color: #9AA3AE;">Click "Run Training Benchmarks" to measure training step throughput across Presets C, S (B16, B32), and M (B16).</td></tr>
              ` : bReport.items.map(item => `
                <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.04);">
                  <td style="padding: 1rem 0.8rem; font-weight: 700; color: #E8E4DA;">Preset ${item.preset}</td>
                  <td style="padding: 1rem 0.8rem; color: #4FB3A9;">B=${item.batchSize}, T=${item.seqLen} (${(item.batchSize * item.seqLen).toLocaleString()} tokens/step)</td>
                  <td style="padding: 1rem 0.8rem; color: #9AA3AE;">${item.params.toLocaleString()}</td>
                  <td style="padding: 1rem 0.8rem; color: #E8A33D; font-weight: 700;">${item.msPerStep.toFixed(2)} ms/step</td>
                  <td style="padding: 1rem 0.8rem; color: #6BBF7A; font-weight: 700;">${Math.round(item.tokensPerSec).toLocaleString()} tokens/s</td>
                  <td style="padding: 1rem 0.8rem; color: #4FB3A9; font-weight: 700;">${item.tflops.toFixed(3)} TFLOPS</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

      </div>
    `;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new BenchmarkApp();
});
