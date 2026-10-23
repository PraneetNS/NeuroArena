/**
 * WebGPU Training Worker (trainer.worker.ts).
 * 
 * Runs the complete WebGPU GPT training pipeline inside a dedicated Web Worker:
 * - GpuContext lifecycle & device.lost auto-recovery
 * - Forward + Backward + Norm Clip + AdamW in single command buffer dispatches
 * - Throttling loop with idle time insertion for concurrent UI rendering
 * - Periodic metrics emission (step, loss, smoothedLoss, gradNorm, lr, tokens/s, elapsed, ETA)
 * - Forward-only validation path emitting valLoss and perplexity
 * - OPFS checkpoint persistence (last K + best-by-val-loss retention)
 * - Concurrent zero-copy inference sampling streaming tokens via sampleToken events
 */

import { PRESETS } from '../types.js';
import { CosineLRScheduler } from '../optimizer.js';
import { Xoshiro128StarStar } from '../rng.js';
import { ByteBPE } from '../tokenizers/bpe.js';
import { CharTokenizer } from '../tokenizers/char.js';
import { GpuContext } from './context.js';
import { GpuModel } from './model.js';
import { GpuTrainer } from './trainer.js';
import { GpuInferenceSampler, TokenizerInterface } from './sampler.js';
import { OpfsCheckpointStorage } from './storage.js';
import {
  TrainerWorkerInMessage,
  TrainerWorkerOutEvent,
  TrainingRunConfig,
  TrainingHyperparameters,
  RunManifest,
  SampleRequest
} from './types.js';

declare const self: any;

class TrainingWorkerRuntime {
  private ctx: GpuContext | null = null;
  private model: GpuModel | null = null;
  private trainer: GpuTrainer | null = null;
  private inferenceSampler: GpuInferenceSampler | null = null;
  private storage: OpfsCheckpointStorage = new OpfsCheckpointStorage();

  // State
  private isRunning = false;
  private isPaused = false;
  private isStopped = false;
  private pauseResolver: (() => void) | null = null;

  private hyperparameters!: TrainingHyperparameters;
  private runId!: string;
  private manifest!: RunManifest;

  // Datasets
  private trainTokens: Uint32Array = new Uint32Array(0);
  private fixedValBatches: Array<{ inputs: Uint16Array; targets: Uint16Array }> = [];
  private tokenizer?: TokenizerInterface;

  // Sampling queue
  private pendingSampleRequests: SampleRequest[] = [];

  // RNG
  private rng!: Xoshiro128StarStar;
  private rngCallCount = 0;

  // Metrics
  private smoothedLoss = 0;
  private startTime = 0;
  private lastStatsTime = 0;
  private lastStatsTokens = 0;
  private totalTokensTrained = 0;

  constructor() {
    self.onmessage = async (e: MessageEvent<TrainerWorkerInMessage>) => {
      try {
        await this.handleMessage(e.data);
      } catch (err: any) {
        this.emit({
          type: 'ERROR',
          data: { message: err?.message || String(err), stack: err?.stack }
        });
      }
    };
  }

  private emit(event: TrainerWorkerOutEvent): void {
    self.postMessage(event);
  }

  private async handleMessage(msg: TrainerWorkerInMessage): Promise<void> {
    switch (msg.type) {
      case 'START':
        await this.start(msg.config);
        break;
      case 'PAUSE':
        this.pause();
        break;
      case 'RESUME':
        this.resume();
        break;
      case 'STOP':
        this.stop();
        break;
      case 'SET_LR':
        this.setLearningRate(msg.lr);
        break;
      case 'SET_THROTTLE':
        this.setThrottle(msg.throttle);
        break;
      case 'SAMPLE':
        this.queueSample(msg.request);
        break;
      case 'SAVE_CHECKPOINT':
        await this.saveCheckpoint();
        break;
      case 'LOAD_CHECKPOINT':
        await this.loadCheckpoint(msg.checkpointId);
        break;
    }
  }

  public async start(config: TrainingRunConfig): Promise<void> {
    if (this.isRunning) {
      this.stop();
      await new Promise(r => setTimeout(r, 100));
    }

    this.runId = config.runId || `run_${Date.now()}`;
    const presetName = config.preset || 'S';
    const baseConfig = config.gptConfig || PRESETS[presetName] || PRESETS.S;

    const hp: TrainingHyperparameters = {
      preset: presetName,
      lr: config.lr ?? config.hyperparameters?.lr ?? 1e-3,
      batchSize: config.batchSize ?? config.hyperparameters?.batchSize ?? 16,
      contextLen: config.contextLen ?? config.hyperparameters?.contextLen ?? baseConfig.contextLen,
      totalSteps: config.steps ?? config.hyperparameters?.totalSteps ?? 3000,
      warmupSteps: config.warmupSteps ?? config.hyperparameters?.warmupSteps ?? 100,
      weightDecay: config.weightDecay ?? config.hyperparameters?.weightDecay ?? 0.1,
      seed: config.seed ?? config.hyperparameters?.seed ?? 42,
      throttle: config.throttle ?? config.hyperparameters?.throttle ?? 1.0,
      logInterval: config.logInterval ?? config.hyperparameters?.logInterval ?? 10,
      valInterval: config.valInterval ?? config.hyperparameters?.valInterval ?? 50,
      valBatches: config.valBatches ?? config.hyperparameters?.valBatches ?? 5,
      checkpointInterval: config.checkpointInterval ?? config.hyperparameters?.checkpointInterval ?? 250,
      keepCheckpoints: config.keepCheckpoints ?? config.hyperparameters?.keepCheckpoints ?? 3
    };
    this.hyperparameters = hp;

    // Initialize RNG
    this.rng = new Xoshiro128StarStar(hp.seed);
    this.rngCallCount = 0;

    // Initialize tokenizer
    if (config.tokenizer) {
      if (config.tokenizer.type === 'bpe') {
        const bpeJson = JSON.stringify({
          type: 'byte_bpe',
          vocabSize: config.tokenizer.vocabSize,
          merges: config.tokenizer.merges || []
        });
        this.tokenizer = ByteBPE.fromJSON(bpeJson);
      } else if (config.tokenizer.type === 'char') {
        const charTok = new CharTokenizer();
        if (config.tokenizer.chars) {
          charTok.charToId.clear();
          charTok.idToChar.clear();
          for (let i = 0; i < config.tokenizer.chars.length; i++) {
            const ch = config.tokenizer.chars[i];
            charTok.charToId.set(ch, i);
            charTok.idToChar.set(i, ch);
          }
        }
        this.tokenizer = charTok;
      }
    }

    // Process dataset tokens
    const rawTokens = config.tokens || [];
    const valSplit = config.valSplit ?? 0.1;
    let trainArr: Uint32Array;
    let valArr: Uint32Array;

    if (config.valTokens && config.valTokens.length > 0) {
      trainArr = new Uint32Array(rawTokens);
      valArr = new Uint32Array(config.valTokens);
    } else {
      const totalLen = rawTokens.length;
      const splitIdx = Math.max(1, Math.floor(totalLen * (1 - valSplit)));
      trainArr = new Uint32Array(rawTokens.slice(0, splitIdx));
      valArr = new Uint32Array(rawTokens.slice(splitIdx));
    }
    this.trainTokens = trainArr;

    // Pre-extract fixed validation batches for consistent validation measurement
    const B = hp.batchSize;
    const T = hp.contextLen;
    this.fixedValBatches = [];
    const valRng = new Xoshiro128StarStar(999999);
    for (let i = 0; i < hp.valBatches; i++) {
      const inputs = new Uint16Array(B * T);
      const targets = new Uint16Array(B * T);
      const maxOffset = Math.max(1, valArr.length - T - 1);
      for (let b = 0; b < B; b++) {
        const offset = Math.floor(valRng.nextFloat() * maxOffset);
        for (let t = 0; t < T; t++) {
          inputs[b * T + t] = valArr[offset + t] ?? 0;
          targets[b * T + t] = valArr[offset + t + 1] ?? 0;
        }
      }
      this.fixedValBatches.push({ inputs, targets });
    }

    // Initialize WebGPU & Models
    await this.initGpuAndModels(baseConfig, config.initialWeights);

    // Initialize Manifest
    this.manifest = {
      runId: this.runId,
      config: baseConfig,
      tokenizer: config.tokenizer || { type: 'bpe', vocabSize: baseConfig.vocabSize },
      hyperparameters: hp,
      step: 0,
      seed: hp.seed,
      rngCallCount: 0,
      bestValLoss: Infinity,
      bestStep: 0,
      metricHistory: [],
      diagnosticsHistory: [],
      checkpoints: []
    };

    this.isRunning = true;
    this.isPaused = false;
    this.isStopped = false;
    this.smoothedLoss = 0;
    this.startTime = performance.now();
    this.lastStatsTime = performance.now();
    this.lastStatsTokens = 0;
    this.totalTokensTrained = 0;

    // Start training loop
    this.runLoop().catch(err => {
      this.emit({
        type: 'ERROR',
        data: { message: err?.message || String(err), stack: err?.stack }
      });
    });
  }

  private async initGpuAndModels(config: any, initialWeights?: Float32Array): Promise<void> {
    const B = this.hyperparameters.batchSize;
    const T = this.hyperparameters.contextLen;

    this.ctx = await GpuContext.create((info: GPUDeviceLostInfo) => {
      this.handleDeviceLost(info);
    });

    const scheduler = new CosineLRScheduler({
      maxLR: this.hyperparameters.lr,
      warmupSteps: this.hyperparameters.warmupSteps,
      totalSteps: this.hyperparameters.totalSteps,
      minLR: this.hyperparameters.lr * 0.1
    });

    // 1. Trainer Model (B = batchSize, T = contextLen)
    this.model = new GpuModel(this.ctx, config, initialWeights, B, T);
    this.trainer = new GpuTrainer(this.model, {
      lr: this.hyperparameters.lr,
      weightDecay: this.hyperparameters.weightDecay,
      logInterval: this.hyperparameters.logInterval,
      diagInterval: 25,
      scheduler,
      onDiagnostics: (snapshot) => {
        if (!this.manifest.diagnosticsHistory) {
          this.manifest.diagnosticsHistory = [];
        }
        this.manifest.diagnosticsHistory.push(snapshot);
        this.emit({
          type: 'DIAGNOSTICS',
          data: snapshot
        });
      }
    });

    // 2. Zero-Copy Inference Model (B = 1, T = contextLen, SHARES paramsBuffer)
    this.inferenceSampler = new GpuInferenceSampler(
      this.ctx,
      config,
      this.model.paramsBuffer,
      this.tokenizer
    );
  }

  private async handleDeviceLost(info: GPUDeviceLostInfo): Promise<void> {
    console.warn('[Worker] GPU Device Lost:', info.message);
    const lostStep = this.trainer?.stepCount ?? 0;
    this.emit({
      type: 'DEVICE_LOST',
      data: { reason: info.reason, message: info.message, recovered: false, step: lostStep }
    });

    // Auto-rebuild context and restore from latest checkpoint
    try {
      await this.initGpuAndModels(this.manifest.config);
      const latest = await this.storage.loadCheckpoint(this.runId, 'latest');
      if (latest && this.trainer) {
        this.trainer.setParams(latest.weights);
        this.trainer.stepCount = latest.manifest.step;
        this.manifest = latest.manifest;
      }
      this.emit({
        type: 'DEVICE_LOST',
        data: { reason: info.reason, message: 'Successfully recovered device', recovered: true, step: this.trainer?.stepCount ?? 0 }
      });
    } catch (e: any) {
      this.emit({
        type: 'ERROR',
        data: { message: `Device recovery failed: ${e.message}` }
      });
    }
  }

  private async runLoop(): Promise<void> {
    const hp = this.hyperparameters;
    const B = hp.batchSize;
    const T = hp.contextLen;
    const tokensPerStep = B * T;
    const maxOffset = Math.max(1, this.trainTokens.length - T - 1);

    const inputBatch = new Uint16Array(tokensPerStep);
    const targetBatch = new Uint16Array(tokensPerStep);

    while (this.isRunning && !this.isStopped && this.trainer && this.trainer.stepCount < hp.totalSteps) {
      // 1. Handle Pause
      if (this.isPaused) {
        await new Promise<void>(resolve => {
          this.pauseResolver = resolve;
        });
      }

      if (this.isStopped) break;

      // 2. Handle Pending Sampling Requests between steps
      if (this.pendingSampleRequests.length > 0) {
        const req = this.pendingSampleRequests.shift()!;
        await this.executeSample(req);
      }

      const t0 = performance.now();

      // 3. Draw random batch from train set
      for (let b = 0; b < B; b++) {
        this.rngCallCount++;
        const offset = Math.floor(this.rng.nextFloat() * maxOffset);
        for (let t = 0; t < T; t++) {
          inputBatch[b * T + t] = this.trainTokens[offset + t] ?? 0;
          targetBatch[b * T + t] = this.trainTokens[offset + t + 1] ?? 0;
        }
      }

      // 4. Execute single training step
      const metrics = await this.trainer.step(inputBatch, targetBatch);
      this.totalTokensTrained += tokensPerStep;
      const currentStep = this.trainer.stepCount;

      const stepTimeMs = performance.now() - t0;

      // 5. Emit Stats every logInterval
      if (metrics && (currentStep % hp.logInterval === 0 || currentStep === 1)) {
        const now = performance.now();
        const elapsedSec = (now - this.startTime) / 1000;
        const windowSec = (now - this.lastStatsTime) / 1000;
        const windowTokens = this.totalTokensTrained - this.lastStatsTokens;
        const tokensPerSec = windowSec > 0 ? windowTokens / windowSec : 0;
        const stepsRemaining = hp.totalSteps - currentStep;
        const stepsPerSec = windowSec > 0 ? (hp.logInterval / windowSec) : 1;
        const etaSec = stepsRemaining / Math.max(stepsPerSec, 0.001);

        this.lastStatsTime = now;
        this.lastStatsTokens = this.totalTokensTrained;

        if (this.smoothedLoss === 0) {
          this.smoothedLoss = metrics.loss;
        } else {
          this.smoothedLoss = 0.9 * this.smoothedLoss + 0.1 * metrics.loss;
        }

        this.emit({
          type: 'STATS',
          data: {
            step: currentStep,
            trainLoss: metrics.loss,
            smoothedLoss: this.smoothedLoss,
            gradNorm: metrics.globalNorm,
            lr: metrics.lr,
            tokensPerSec,
            elapsedSec,
            etaSec
          }
        });
      }

      // 6. Forward-only Validation every valInterval
      if (currentStep % hp.valInterval === 0 || currentStep === hp.totalSteps) {
        await this.runValidation(currentStep);
      }

      // 7. Checkpoints every checkpointInterval
      if (currentStep % hp.checkpointInterval === 0 || currentStep === hp.totalSteps) {
        await this.saveCheckpoint();
      }

      // 8. Throttle: Insert idle time to release worker event loop and GPU queue
      if (hp.throttle < 1.0) {
        const idleMs = (stepTimeMs * (1.0 - hp.throttle)) / Math.max(hp.throttle, 0.01);
        if (idleMs > 0.5) {
          await new Promise(r => setTimeout(r, idleMs));
        }
      }
    }

    if (this.isRunning && !this.isStopped) {
      this.isRunning = false;
      const elapsedSec = (performance.now() - this.startTime) / 1000;
      this.emit({
        type: 'FINISHED',
        data: {
          runId: this.runId,
          totalSteps: this.trainer?.stepCount ?? 0,
          finalLoss: this.trainer?.lastLoggedMetrics?.loss ?? 0,
          finalValLoss: this.manifest.bestValLoss,
          elapsedSec
        }
      });
    }
  }

  private async runValidation(currentStep: number): Promise<void> {
    if (!this.model || this.fixedValBatches.length === 0) return;

    let totalValLoss = 0;
    for (const batch of this.fixedValBatches) {
      const res = await this.model.forward(batch.inputs, batch.targets, {
        readbackLoss: true,
        readbackLogits: false
      });
      totalValLoss += res.loss ?? 0;
    }

    const valLoss = totalValLoss / this.fixedValBatches.length;
    const perplexity = Math.exp(valLoss);

    if (valLoss < this.manifest.bestValLoss) {
      this.manifest.bestValLoss = valLoss;
      this.manifest.bestStep = currentStep;
    }

    this.manifest.metricHistory.push({
      step: currentStep,
      trainLoss: this.trainer?.lastLoggedMetrics?.loss ?? 0,
      smoothedLoss: this.smoothedLoss,
      gradNorm: this.trainer?.lastLoggedMetrics?.globalNorm ?? 0,
      lr: this.trainer?.lastLoggedMetrics?.lr ?? 0,
      valLoss,
      perplexity,
      timestamp: Date.now()
    });

    this.emit({
      type: 'VAL_STATS',
      data: {
        step: currentStep,
        valLoss,
        perplexity
      }
    });
  }

  public async saveCheckpoint(): Promise<void> {
    if (!this.trainer || !this.model) return;
    const step = this.trainer.stepCount;
    this.manifest.step = step;
    this.manifest.rngCallCount = this.rngCallCount;

    // Read flat weights
    const weights = await this.trainer.getParams();

    // Read optimizer state (m and v concatenated)
    const m = await this.ctx!.readBufferFloat32(this.model.mBuffer, this.model.totalParams);
    const v = await this.ctx!.readBufferFloat32(this.model.vBuffer, this.model.totalParams);
    const optimizerState = new Float32Array(this.model.totalParams * 2);
    optimizerState.set(m, 0);
    optimizerState.set(v, this.model.totalParams);

    const path = await this.storage.saveCheckpoint(
      this.runId,
      this.manifest,
      weights,
      optimizerState
    );

    this.emit({
      type: 'CHECKPOINT',
      data: {
        runId: this.runId,
        step,
        path,
        valLoss: this.manifest.metricHistory[this.manifest.metricHistory.length - 1]?.valLoss,
        trainLoss: this.trainer.lastLoggedMetrics?.loss,
        manifest: this.manifest
      }
    });
  }

  public async loadCheckpoint(checkpointId?: string | number): Promise<void> {
    const ckpt = await this.storage.loadCheckpoint(this.runId, checkpointId);
    if (!ckpt || !this.trainer || !this.model) {
      throw new Error(`Checkpoint ${checkpointId ?? 'latest'} not found for run ${this.runId}`);
    }

    this.trainer.setParams(ckpt.weights);
    if (ckpt.optimizer) {
      const half = ckpt.optimizer.length / 2;
      const m = ckpt.optimizer.subarray(0, half);
      const v = ckpt.optimizer.subarray(half);
      this.ctx!.device.queue.writeBuffer(this.model.mBuffer, 0, m as unknown as BufferSource);
      this.ctx!.device.queue.writeBuffer(this.model.vBuffer, 0, v as unknown as BufferSource);
    }

    this.trainer.stepCount = ckpt.manifest.step;
    this.manifest = ckpt.manifest;
    this.rngCallCount = ckpt.manifest.rngCallCount;

    // Fast-forward RNG to exact state
    this.rng = new Xoshiro128StarStar(this.manifest.seed);
    for (let i = 0; i < this.rngCallCount; i++) {
      this.rng.nextFloat();
    }

    this.emit({
      type: 'CHECKPOINT',
      data: {
        runId: this.runId,
        step: ckpt.manifest.step,
        path: `neuroarena_runs/${this.runId}/step_${ckpt.manifest.step}`,
        valLoss: ckpt.manifest.metricHistory[ckpt.manifest.metricHistory.length - 1]?.valLoss,
        trainLoss: ckpt.manifest.metricHistory[ckpt.manifest.metricHistory.length - 1]?.trainLoss,
        manifest: this.manifest
      }
    });
  }

  public queueSample(request: SampleRequest): void {
    this.pendingSampleRequests.push(request);
    // If paused or idle, execute immediately
    if (!this.isRunning || this.isPaused) {
      const req = this.pendingSampleRequests.shift();
      if (req) this.executeSample(req);
    }
  }

  private async executeSample(request: SampleRequest): Promise<void> {
    if (!this.inferenceSampler) return;

    for await (const tokenData of this.inferenceSampler.generate(request)) {
      this.emit({
        type: 'SAMPLE_TOKEN',
        data: tokenData
      });
    }
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    if (this.isPaused) {
      this.isPaused = false;
      if (this.pauseResolver) {
        this.pauseResolver();
        this.pauseResolver = null;
      }
    }
  }

  public stop(): void {
    this.isStopped = true;
    this.isRunning = false;
    this.resume();
  }

  public setLearningRate(lr: number): void {
    this.hyperparameters.lr = lr;
    if (this.trainer) {
      this.trainer.options.lr = lr;
    }
  }

  public setThrottle(throttle: number): void {
    this.hyperparameters.throttle = Math.max(0, Math.min(1, throttle));
  }
}

// Instantiate worker runtime
new TrainingWorkerRuntime();
