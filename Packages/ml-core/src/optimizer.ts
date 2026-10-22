/**
 * AdamW Optimizer with selective decoupled weight decay, global gradient norm clipping,
 * and Cosine Learning Rate Schedule with Linear Warmup.
 */

import { TinyGPT } from './model.js';

export interface AdamWOptions {
  lr?: number;
  beta1?: number;
  beta2?: number;
  eps?: number;
  weightDecay?: number;
  maxGradNorm?: number;
  scheduler?: CosineLRScheduler;
}

export interface LRSchedulerOptions {
  maxLR: number;
  minLR?: number;
  warmupSteps: number;
  totalSteps: number;
}

export class CosineLRScheduler {
  public maxLR: number;
  public minLR: number;
  public warmupSteps: number;
  public totalSteps: number;

  constructor(options: LRSchedulerOptions) {
    this.maxLR = options.maxLR;
    this.minLR = options.minLR ?? 0;
    this.warmupSteps = Math.max(1, options.warmupSteps);
    this.totalSteps = Math.max(this.warmupSteps + 1, options.totalSteps);
  }

  public getLR(step: number): number {
    if (step < this.warmupSteps) {
      // Linear warmup
      return this.maxLR * ((step + 1) / this.warmupSteps);
    }
    if (step >= this.totalSteps) {
      return this.minLR;
    }
    // Cosine decay
    const ratio = (step - this.warmupSteps) / (this.totalSteps - this.warmupSteps);
    const coeff = 0.5 * (1.0 + Math.cos(Math.PI * ratio));
    return this.minLR + coeff * (this.maxLR - this.minLR);
  }
}

export class AdamW {
  public model: TinyGPT;
  public lr: number;
  public beta1: number;
  public beta2: number;
  public eps: number;
  public weightDecay: number;
  public maxGradNorm: number;
  public scheduler?: CosineLRScheduler;

  public m: Float64Array;
  public v: Float64Array;
  public stepCount = 0;

  constructor(model: TinyGPT, options: AdamWOptions = {}) {
    this.model = model;
    this.lr = options.lr ?? 0.001;
    this.beta1 = options.beta1 ?? 0.9;
    this.beta2 = options.beta2 ?? 0.95;
    this.eps = options.eps ?? 1e-8;
    this.weightDecay = options.weightDecay ?? 0.1;
    this.maxGradNorm = options.maxGradNorm ?? 1.0;
    this.scheduler = options.scheduler;

    this.m = new Float64Array(model.totalParams);
    this.v = new Float64Array(model.totalParams);
  }

  /**
   * Clips gradients by global L2 norm across all parameters.
   * Returns computed global norm.
   */
  public clipGradients(): number {
    const grads = this.model.grads;
    const len = grads.length;
    let sumSq = 0;
    for (let i = 0; i < len; i++) {
      const g = grads[i];
      sumSq += g * g;
    }
    const globalNorm = Math.sqrt(sumSq);

    if (this.maxGradNorm > 0 && globalNorm > this.maxGradNorm) {
      const scale = this.maxGradNorm / (globalNorm + 1e-12);
      for (let i = 0; i < len; i++) {
        grads[i] *= scale;
      }
    }

    return globalNorm;
  }

  /**
   * Performs a single optimization step.
   * Weight decay is selectively applied only to 2D linear weights (meta.decay === true),
   * strictly omitting biases, LayerNorm parameters, and embeddings.
   */
  public step(currentLR?: number): void {
    this.stepCount++;
    let lr = this.lr;
    if (typeof currentLR === 'number') {
      lr = currentLR;
    } else if (this.scheduler) {
      lr = this.scheduler.getLR(this.stepCount - 1);
    }
    const beta1 = this.beta1;
    const beta2 = this.beta2;
    const eps = this.eps;
    const wd = this.weightDecay;

    // 1. Clip gradients
    this.clipGradients();

    // 2. Bias corrections
    const bc1 = 1.0 - Math.pow(beta1, this.stepCount);
    const bc2 = 1.0 - Math.pow(beta2, this.stepCount);

    const params = this.model.params;
    const grads = this.model.grads;
    const m = this.m;
    const v = this.v;

    // 3. Update parameter groups according to decay rule
    for (const meta of this.model.paramList) {
      const start = meta.offset;
      const end = meta.offset + meta.size;
      const applyDecay = meta.decay && wd > 0;

      for (let i = start; i < end; i++) {
        const g = grads[i];

        // Decoupled weight decay (only on weights)
        if (applyDecay) {
          params[i] -= lr * wd * params[i];
        }

        // Momentum updates
        m[i] = beta1 * m[i] + (1.0 - beta1) * g;
        v[i] = beta2 * v[i] + (1.0 - beta2) * g * g;

        // Bias correction
        const mHat = m[i] / bc1;
        const vHat = v[i] / bc2;

        // In-place parameter update
        params[i] -= (lr * mHat) / (Math.sqrt(vHat) + eps);
      }
    }
  }

  public reset(): void {
    this.stepCount = 0;
    this.m.fill(0);
    this.v.fill(0);
  }
}
