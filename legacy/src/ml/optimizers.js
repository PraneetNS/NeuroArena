/**
 * @file optimizers.js
 * @description First-order gradient-based optimizers for parameter updates:
 * SGD, Momentum, RMSprop, and Adam (with bias correction).
 * Supports per-parameter state, L2 weight decay, and dynamic learning-rate schedules.
 * Zero dependencies, Float64Array-based, zero allocation in step loops.
 */

const DEFAULT_LR = 0.05;
const DEFAULT_EPSILON = 1e-8;

/**
 * Base optimizer class defining common interface and schedule hooks.
 */
export class BaseOptimizer {
  /**
   * @param {Object} options
   * @param {number} [options.lr=0.05]
   * @param {number} [options.l2=0.0] - L2 weight decay regularization coefficient
   * @param {function(number, number): number | null} [options.lrSchedule=null] - (step, currentLr) => scheduledLr
   */
  constructor({ lr = DEFAULT_LR, l2 = 0.0, lrSchedule = null } = {}) {
    this.lr = Math.max(1e-7, lr);
    this.l2 = Math.max(0.0, l2);
    this.lrSchedule = lrSchedule;
    this.stepCount = 0;
  }

  /**
   * Sets a new base learning rate.
   * @param {number} newLr
   */
  setLr(newLr) {
    this.lr = Math.max(1e-7, newLr);
  }

  /**
   * Gets effective learning rate for current step.
   * @returns {number}
   */
  getEffectiveLr() {
    if (typeof this.lrSchedule === 'function') {
      return this.lrSchedule(this.stepCount, this.lr);
    }
    return this.lr;
  }

  /**
   * Resets internal optimizer momentum/velocity buffers.
   */
  reset() {
    this.stepCount = 0;
  }
}

/**
 * Standard Stochastic Gradient Descent with optional L2 weight decay.
 * θ_{t+1} = θ_t - η * (g_t + λ * θ_t)
 */
export class SGD extends BaseOptimizer {
  constructor(options = {}) {
    super(options);
    this.name = 'SGD';
  }

  /**
   * Updates parameter array in-place.
   * @param {Float64Array} params - Writable parameter weights
   * @param {Float64Array} grads - Analytic gradients
   */
  step(params, grads) {
    const len = params.length;
    if (len !== grads.length) {
      throw new Error(`[SGD.step] Dimension mismatch: params=${len}, grads=${grads.length}`);
    }

    this.stepCount++;
    const eta = this.getEffectiveLr();
    const l2 = this.l2;

    for (let i = 0; i < len; i++) {
      const gradWithDecay = grads[i] + l2 * params[i];
      params[i] -= eta * gradWithDecay;
    }
  }
}

/**
 * Momentum Optimizer (Polyak Classical Momentum).
 * v_{t+1} = β * v_t + (g_t + λ * θ_t)
 * θ_{t+1} = θ_t - η * v_{t+1}
 */
export class Momentum extends BaseOptimizer {
  /**
   * @param {Object} options
   * @param {number} [options.beta=0.9] - Momentum damping factor [0..1)
   */
  constructor({ beta = 0.9, ...rest } = {}) {
    super(rest);
    this.name = 'Momentum';
    this.beta = beta;
    this.v = null;
  }

  reset() {
    super.reset();
    if (this.v) this.v.fill(0);
  }

  /**
   * @param {Float64Array} params
   * @param {Float64Array} grads
   */
  step(params, grads) {
    const len = params.length;
    if (!this.v || this.v.length !== len) {
      this.v = new Float64Array(len);
    }

    this.stepCount++;
    const eta = this.getEffectiveLr();
    const beta = this.beta;
    const l2 = this.l2;
    const v = this.v;

    for (let i = 0; i < len; i++) {
      const gradWithDecay = grads[i] + l2 * params[i];
      v[i] = beta * v[i] + gradWithDecay;
      params[i] -= eta * v[i];
    }
  }
}

/**
 * RMSprop Optimizer (Root Mean Square Propagation).
 * s_{t+1} = β * s_t + (1 - β) * g_t²
 * θ_{t+1} = θ_t - (η / (sqrt(s_{t+1}) + ε)) * (g_t + λ * θ_t)
 */
export class RMSprop extends BaseOptimizer {
  /**
   * @param {Object} options
   * @param {number} [options.beta=0.99] - Moving average discount factor
   * @param {number} [options.eps=1e-8]
   */
  constructor({ beta = 0.99, eps = DEFAULT_EPSILON, ...rest } = {}) {
    super(rest);
    this.name = 'RMSprop';
    this.beta = beta;
    this.eps = eps;
    this.s = null;
  }

  reset() {
    super.reset();
    if (this.s) this.s.fill(0);
  }

  /**
   * @param {Float64Array} params
   * @param {Float64Array} grads
   */
  step(params, grads) {
    const len = params.length;
    if (!this.s || this.s.length !== len) {
      this.s = new Float64Array(len);
    }

    this.stepCount++;
    const eta = this.getEffectiveLr();
    const beta = this.beta;
    const oneMinusBeta = 1.0 - beta;
    const eps = this.eps;
    const l2 = this.l2;
    const s = this.s;

    for (let i = 0; i < len; i++) {
      const g = grads[i] + l2 * params[i];
      s[i] = beta * s[i] + oneMinusBeta * g * g;
      params[i] -= (eta / (Math.sqrt(s[i]) + eps)) * g;
    }
  }
}

/**
 * Adam Optimizer (Adaptive Moment Estimation) with exact bias corrections.
 * m_t = β₁ * m_{t-1} + (1 - β₁) * g_t
 * v_t = β₂ * v_{t-1} + (1 - β₂) * g_t²
 * m̂_t = m_t / (1 - β₁^t)
 * v̂_t = v_t / (1 - β₂^t)
 * θ_t = θ_{t-1} - (η / (sqrt(v̂_t) + ε)) * m̂_t
 */
export class Adam extends BaseOptimizer {
  /**
   * @param {Object} options
   * @param {number} [options.beta1=0.9] - First moment decay
   * @param {number} [options.beta2=0.999] - Second moment decay
   * @param {number} [options.eps=1e-8]
   */
  constructor({ beta1 = 0.9, beta2 = 0.999, eps = DEFAULT_EPSILON, ...rest } = {}) {
    super(rest);
    this.name = 'Adam';
    this.beta1 = beta1;
    this.beta2 = beta2;
    this.eps = eps;
    this.m = null;
    this.v = null;
  }

  reset() {
    super.reset();
    if (this.m) this.m.fill(0);
    if (this.v) this.v.fill(0);
  }

  /**
   * @param {Float64Array} params
   * @param {Float64Array} grads
   */
  step(params, grads) {
    const len = params.length;
    if (!this.m || this.m.length !== len) {
      this.m = new Float64Array(len);
      this.v = new Float64Array(len);
    }

    this.stepCount++;
    const t = this.stepCount;
    const eta = this.getEffectiveLr();
    const beta1 = this.beta1;
    const beta2 = this.beta2;
    const oneMinusBeta1 = 1.0 - beta1;
    const oneMinusBeta2 = 1.0 - beta2;
    const eps = this.eps;
    const l2 = this.l2;

    const m = this.m;
    const v = this.v;

    // Bias corrections
    const biasCorrection1 = 1.0 - Math.pow(beta1, t);
    const biasCorrection2 = 1.0 - Math.pow(beta2, t);
    const stepSize = eta * Math.sqrt(biasCorrection2) / biasCorrection1;

    for (let i = 0; i < len; i++) {
      const g = grads[i] + l2 * params[i];

      // Update biased 1st and 2nd moment estimates
      m[i] = beta1 * m[i] + oneMinusBeta1 * g;
      v[i] = beta2 * v[i] + oneMinusBeta2 * g * g;

      // Update parameters using bias-corrected scale
      params[i] -= (stepSize * m[i]) / (Math.sqrt(v[i]) + eps * Math.sqrt(biasCorrection2));
    }
  }
}

/**
 * Factory creating an optimizer by type name.
 * @param {string} type - 'sgd' | 'momentum' | 'rmsprop' | 'adam'
 * @param {Object} options
 * @returns {BaseOptimizer}
 */
export function createOptimizer(type, options = {}) {
  const normType = (type || 'sgd').toLowerCase();
  switch (normType) {
    case 'momentum':
      return new Momentum(options);
    case 'rmsprop':
      return new RMSprop(options);
    case 'adam':
      return new Adam(options);
    case 'sgd':
    default:
      return new SGD(options);
  }
}
