/**
 * High-Performance WebGPU Training Loop with Staging Buffer Rings.
 * 
 * - Encodes forward, backward, grad-norm, clip, and AdamW into ONE command buffer and submits it once.
 * - Uploads batches through a mapped staging buffer ring.
 * - Asynchronously reads back loss and grad-norm every N steps through a staging ring using mapAsync
 *   so the GPU compute queue never stalls waiting for the host CPU.
 * - Supports getParams() and setParams().
 */

import { CosineLRScheduler } from '../optimizer.js';
import { DiagnosticsSnapshot } from '../diagnostics.js';
import { GpuModel } from './model.js';

export interface GpuTrainerOptions {
  lr?: number;
  beta1?: number;
  beta2?: number;
  eps?: number;
  weightDecay?: number;
  maxGradNorm?: number;
  scheduler?: CosineLRScheduler;
  logInterval?: number;  // default 10
  diagInterval?: number; // default 25
  ringSize?: number;     // default 4
  onLog?: (metrics: TrainingMetrics) => void;
  onDiagnostics?: (snapshot: DiagnosticsSnapshot) => void;
}

export interface TrainingMetrics {
  step: number;
  loss: number;
  globalNorm: number;
  clipScale: number;
  lr: number;
}

export class GpuTrainer {
  public model: GpuModel;
  public options: Required<Omit<GpuTrainerOptions, 'scheduler' | 'onLog' | 'onDiagnostics'>> & {
    scheduler?: CosineLRScheduler;
    onLog?: (metrics: TrainingMetrics) => void;
    onDiagnostics?: (snapshot: DiagnosticsSnapshot) => void;
  };
  public stepCount = 0;
  public lastLoggedMetrics: TrainingMetrics | null = null;
  public metricsHistory: TrainingMetrics[] = [];
  public lastDiagnosticsSnapshot: DiagnosticsSnapshot | null = null;
  public diagnosticsHistory: DiagnosticsSnapshot[] = [];

  // Upload staging buffer ring
  private uploadRing: Array<{
    inputs: GPUBuffer;
    targets: GPUBuffer;
  }> = [];
  private uploadRingIndex = 0;

  // Download staging buffer ring for loss & grad-norm & diagnostics
  private downloadRing: Array<{
    buffer: GPUBuffer;
    isBusy: boolean;
    isDiag?: boolean;
  }> = [];
  private downloadRingIndex = 0;
  private diagByteSize: number;

  constructor(model: GpuModel, options: GpuTrainerOptions = {}) {
    this.model = model;
    const ringSize = options.ringSize ?? 4;
    this.diagByteSize = Math.max(2048, (model.config.nLayers * GpuModel.DIAG_LAYER_STRIDE + 32) * 4);

    this.options = {
      lr: options.lr ?? 0.001,
      beta1: options.beta1 ?? 0.9,
      beta2: options.beta2 ?? 0.95,
      eps: options.eps ?? 1e-8,
      weightDecay: options.weightDecay ?? 0.1,
      maxGradNorm: options.maxGradNorm ?? 1.0,
      logInterval: options.logInterval ?? 10,
      diagInterval: options.diagInterval ?? 25,
      ringSize,
      scheduler: options.scheduler,
      onLog: options.onLog,
      onDiagnostics: options.onDiagnostics
    };

    const device = model.context.device;
    const M = model.B * model.T;

    // Allocate upload ring staging buffers
    for (let i = 0; i < ringSize; i++) {
      this.uploadRing.push({
        inputs: device.createBuffer({
          label: `upload_inputs_staging_${i}`,
          size: M * 4,
          usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
        }),
        targets: device.createBuffer({
          label: `upload_targets_staging_${i}`,
          size: M * 4,
          usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
        })
      });
    }

    // Allocate download ring staging buffers (diagByteSize bytes: loss, globalNorm, clipScale, diagnostics)
    for (let i = 0; i < ringSize; i++) {
      this.downloadRing.push({
        buffer: device.createBuffer({
          label: `download_staging_${i}`,
          size: this.diagByteSize,
          usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
        }),
        isBusy: false
      });
    }
  }

  /**
   * Executes a single end-to-end training step encoded in ONE command buffer.
   */
  public async step(
    batchInputs: Uint32Array | Uint16Array | number[],
    batchTargets: Uint32Array | Uint16Array | number[]
  ): Promise<TrainingMetrics | null> {
    this.stepCount++;
    const currentStep = this.stepCount;
    const device = this.model.context.device;
    const M = this.model.B * this.model.T;

    // 1. Determine learning rate from schedule
    let currentLR = this.options.lr;
    if (this.options.scheduler) {
      currentLR = this.options.scheduler.getLR(currentStep - 1);
    }

    // 2. Upload batch data through upload staging ring
    const uploadSlot = this.uploadRing[this.uploadRingIndex];
    this.uploadRingIndex = (this.uploadRingIndex + 1) % this.options.ringSize;

    const u32Inputs = batchInputs instanceof Uint32Array ? batchInputs : new Uint32Array(batchInputs);
    const u32Targets = batchTargets instanceof Uint32Array ? batchTargets : new Uint32Array(batchTargets);
    device.queue.writeBuffer(uploadSlot.inputs, 0, u32Inputs as unknown as BufferSource);
    device.queue.writeBuffer(uploadSlot.targets, 0, u32Targets as unknown as BufferSource);

    // 3. Encode everything into ONE Command Buffer
    const encoder = device.createCommandEncoder({ label: `TrainStep_${currentStep}_Encoder` });

    // Copy uploaded inputs and targets into model activation buffers
    encoder.copyBufferToBuffer(uploadSlot.inputs, 0, this.model.inputIdsBuffer, 0, M * 4);
    encoder.copyBufferToBuffer(uploadSlot.targets, 0, this.model.targetsBuffer, 0, M * 4);

    // Encode Forward, Backward, GradNorm, Clip, and AdamW
    this.model.encodeFullStep(
      encoder,
      currentLR,
      currentStep,
      this.options.weightDecay,
      this.options.maxGradNorm,
      this.options.beta1,
      this.options.beta2,
      this.options.eps
    );

    // 4. Asynchronous Metrics & Diagnostics Readback via download staging ring
    const shouldDiag = currentStep % this.options.diagInterval === 0 || currentStep === 1;
    const shouldLog = shouldDiag || (currentStep % this.options.logInterval === 0);
    let activeDownloadSlot: (typeof this.downloadRing)[0] | null = null;

    if (shouldLog) {
      // Find an available download slot
      const slot = this.downloadRing[this.downloadRingIndex];
      this.downloadRingIndex = (this.downloadRingIndex + 1) % this.options.ringSize;

      if (!slot.isBusy) {
        activeDownloadSlot = slot;
        slot.isBusy = true;
        slot.isDiag = shouldDiag;

        if (shouldDiag) {
          // Encode GPU-side diagnostics reduction pass
          this.model.encodeDiagnostics(encoder);
          // Copy diagnostics buffer into staging buffer
          encoder.copyBufferToBuffer(this.model.diagnosticsBuffer, 0, slot.buffer, 0, this.diagByteSize);
        } else {
          // Standard fast metrics copy
          encoder.copyBufferToBuffer(this.model.meanLossBuffer, 0, slot.buffer, 0, 4);
          encoder.copyBufferToBuffer(this.model.normClipBuffer, 0, slot.buffer, 4, 8);
        }
      }
    }

    // 5. Submit ONE single command buffer to GPU
    device.queue.submit([encoder.finish()]);

    // 6. Handle non-blocking asynchronous mapAsync for download slot
    if (activeDownloadSlot) {
      const slot = activeDownloadSlot;
      const isDiag = slot.isDiag;
      // Background async readback so CPU does not block GPU execution
      slot.buffer.mapAsync(GPUMapMode.READ).then(() => {
        try {
          const raw = new Float32Array(slot.buffer.getMappedRange());
          if (isDiag) {
            const nLayers = this.model.config.nLayers;
            const nHeads = this.model.config.nHeads;
            const stride = GpuModel.DIAG_LAYER_STRIDE;
            const gOffset = nLayers * stride;

            const maxLogit = raw[gOffset + 0];
            const logitEntropy = raw[gOffset + 2] > 0 ? raw[gOffset + 1] / raw[gOffset + 2] : 0;
            const hasNanOrInf = raw[gOffset + 3] > 0.5;
            const loss = raw[gOffset + 4];
            const globalNorm = raw[gOffset + 5];
            const clipScale = raw[gOffset + 6];

            const layers = [];
            for (let l = 0; l < nLayers; l++) {
              const base = l * stride;
              const pNorm = Math.sqrt(Math.max(0, raw[base + 0]));
              const gNorm = Math.sqrt(Math.max(0, raw[base + 1]));
              const updateParamRatio = currentLR * (gNorm * clipScale) / (pNorm + 1e-12);
              const actCount = raw[base + 4];
              const actMean = actCount > 0 ? raw[base + 2] / actCount : 0;
              const actVar = actCount > 0 ? Math.max(0, raw[base + 3] / actCount - actMean * actMean) : 0;
              const actStd = Math.sqrt(actVar);
              const dFF = raw[base + 6];
              const geluDeadFraction = dFF > 0 ? raw[base + 5] / dFF : 0;
              const rowCount = raw[base + 9];
              const attnFirstTokenMass = (rowCount * nHeads) > 0 ? raw[base + 7] / (rowCount * nHeads) : 0;
              const attnCurrentTokenMass = (rowCount * nHeads) > 0 ? raw[base + 8] / (rowCount * nHeads) : 0;
              const attentionEntropy: number[] = [];
              for (let h = 0; h < nHeads; h++) {
                attentionEntropy.push(rowCount > 0 ? raw[base + 10 + h] / rowCount : 0);
              }

              layers.push({
                layer: l,
                paramNorm: pNorm,
                gradNorm: gNorm,
                updateParamRatio,
                activationMean: actMean,
                activationStd: actStd,
                geluDeadFraction,
                attentionEntropy,
                attnFirstTokenMass,
                attnCurrentTokenMass
              });
            }

            const snapshot: DiagnosticsSnapshot = {
              step: currentStep,
              timestamp: Date.now(),
              loss,
              globalGradNorm: globalNorm,
              clipScale,
              learningRate: currentLR,
              maxLogit,
              logitEntropy,
              hasNanOrInf,
              layers
            };

            this.lastDiagnosticsSnapshot = snapshot;
            this.diagnosticsHistory.push(snapshot);
            if (this.diagnosticsHistory.length > 100) {
              this.diagnosticsHistory.shift();
            }
            if (this.options.onDiagnostics) {
              this.options.onDiagnostics(snapshot);
            }

            const metrics: TrainingMetrics = {
              step: currentStep,
              loss,
              globalNorm,
              clipScale,
              lr: currentLR
            };
            this.lastLoggedMetrics = metrics;
            this.metricsHistory.push(metrics);
            if (this.metricsHistory.length > 1000) {
              this.metricsHistory.shift();
            }
            if (this.options.onLog) {
              this.options.onLog(metrics);
            }
          } else {
            const metrics: TrainingMetrics = {
              step: currentStep,
              loss: raw[0],
              globalNorm: raw[1],
              clipScale: raw[2],
              lr: currentLR
            };
            this.lastLoggedMetrics = metrics;
            this.metricsHistory.push(metrics);
            if (this.metricsHistory.length > 1000) {
              this.metricsHistory.shift();
            }
            if (this.options.onLog) {
              this.options.onLog(metrics);
            }
          }
          slot.buffer.unmap();
          slot.isBusy = false;
        } catch (e) {
          try { slot.buffer.unmap(); } catch (_) {}
          slot.isBusy = false;
        }
      });
    }

    return this.lastLoggedMetrics;
  }

  /**
   * Downloads flat parameters from GPU.
   */
  public async getParams(): Promise<Float32Array> {
    return this.model.getParams();
  }

  /**
   * Uploads flat parameters to GPU.
   */
  public setParams(params: Float32Array | Float64Array): void {
    this.model.setParams(params);
  }

  /**
   * Resets trainer step count and optimizer moments.
   */
  public reset(): void {
    this.stepCount = 0;
    this.metricsHistory = [];
    this.lastLoggedMetrics = null;
    const zero = new Float32Array(this.model.totalParams);
    this.model.context.device.queue.writeBuffer(this.model.mBuffer, 0, zero);
    this.model.context.device.queue.writeBuffer(this.model.vBuffer, 0, zero);
  }
}
