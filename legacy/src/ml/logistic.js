/**
 * @file logistic.js
 * @description Logistic Regression with numerically stable Sigmoid, Binary Cross-Entropy loss,
 * hand-derived analytic gradients, and explicit decision boundary (w·x + b = 0) extraction.
 */

import { Matrix } from './Matrix.js';
import { Metrics } from './Metrics.js';

const EPSILON = 1e-15;

/**
 * Numerically stable Sigmoid function preventing floating point overflow.
 * σ(z) = 1 / (1 + e^{-z}) for z >= 0, and e^z / (1 + e^z) for z < 0.
 * @param {number} z
 * @returns {number}
 */
export function stableSigmoid(z) {
  if (z >= 0) {
    const expNegZ = Math.exp(-z);
    return 1.0 / (1.0 + expNegZ);
  } else {
    const expZ = Math.exp(z);
    return expZ / (1.0 + expZ);
  }
}

export class LogisticRegression {
  /**
   * @param {number} nFeatures - Feature dimensionality D
   */
  constructor(nFeatures = 2) {
    this.nFeatures = Math.max(1, nFeatures);
    this.weights = new Float64Array(this.nFeatures);
    this.bias = 0.0;

    // Combined params array [w_0, ..., w_{D-1}, bias]
    this.params = new Float64Array(this.nFeatures + 1);
    this.grads = new Float64Array(this.nFeatures + 1);
  }

  /**
   * Resets weights and bias.
   * @param {number} [initWeight=0.0]
   * @param {number} [initBias=0.0]
   */
  reset(initWeight = 0.0, initBias = 0.0) {
    this.weights.fill(initWeight);
    this.bias = initBias;
    this.syncToParams();
  }

  syncToParams() {
    for (let i = 0; i < this.nFeatures; i++) {
      this.params[i] = this.weights[i];
    }
    this.params[this.nFeatures] = this.bias;
  }

  syncFromParams() {
    for (let i = 0; i < this.nFeatures; i++) {
      this.weights[i] = this.params[i];
    }
    this.bias = this.params[this.nFeatures];
  }

  /**
   * Computes predicted class probabilities p = σ(X * w + b).
   * @param {Matrix} X - Feature matrix (N x D)
   * @returns {Float64Array} Probabilities in [0, 1]
   */
  predictProba(X) {
    const N = X.rows;
    const D = this.nFeatures;
    const probs = new Float64Array(N);

    for (let i = 0; i < N; i++) {
      let z = this.bias;
      for (let j = 0; j < D; j++) {
        z += X.get(i, j) * this.weights[j];
      }
      probs[i] = stableSigmoid(z);
    }
    return probs;
  }

  /**
   * Discretized class predictions {0, 1} based on decision threshold.
   * @param {Matrix} X
   * @param {number} [threshold=0.5]
   * @returns {Float64Array}
   */
  predict(X, threshold = 0.5) {
    const probs = this.predictProba(X);
    const N = probs.length;
    const preds = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      preds[i] = probs[i] >= threshold ? 1.0 : 0.0;
    }
    return preds;
  }

  /**
   * Computes Binary Cross-Entropy (Log-Loss):
   * J = - (1/N) * sum_{i=1}^N [y_i * log(p_i) + (1 - y_i) * log(1 - p_i)]
   *
   * @param {Matrix} X
   * @param {Matrix} y
   * @returns {number}
   */
  loss(X, y) {
    const probs = this.predictProba(X);
    return Metrics.logLoss(y, probs);
  }

  /**
   * Computes exact hand-derived analytic gradients:
   * For loss J = -1/N sum [y log(σ(z)) + (1-y) log(1-σ(z))]:
   * dJ/dz_i = σ(z_i) - y_i
   * dJ/dw_j = (1/N) * sum_{i=1}^N (σ(z_i) - y_i) * x_{i, j}
   * dJ/db   = (1/N) * sum_{i=1}^N (σ(z_i) - y_i)
   *
   * @param {Matrix} X
   * @param {Matrix} y
   * @returns {{ gradWeights: Float64Array, gradBias: number, gradNorm: number }}
   */
  computeGradients(X, y) {
    const N = X.rows;
    const D = this.nFeatures;
    const probs = this.predictProba(X);

    this.grads.fill(0);

    for (let i = 0; i < N; i++) {
      const error = probs[i] - y.get(i, 0); // (p_i - y_i)

      for (let j = 0; j < D; j++) {
        this.grads[j] += error * X.get(i, j);
      }
      this.grads[D] += error; // bias gradient
    }

    const invN = 1.0 / N;
    let sumSq = 0.0;
    for (let j = 0; j <= D; j++) {
      this.grads[j] *= invN;
      sumSq += this.grads[j] * this.grads[j];
    }

    const gradNorm = Math.sqrt(sumSq);

    const gradWeights = new Float64Array(D);
    for (let j = 0; j < D; j++) gradWeights[j] = this.grads[j];

    return {
      gradWeights,
      gradBias: this.grads[D],
      gradNorm
    };
  }

  /**
   * Single optimization step.
   * @param {Matrix} X
   * @param {Matrix} y
   * @param {import('./optimizers.js').BaseOptimizer} optimizer
   * @returns {{ loss: number, gradNorm: number }}
   */
  fitStep(X, y, optimizer) {
    const { gradNorm } = this.computeGradients(X, y);
    optimizer.step(this.params, this.grads);
    this.syncFromParams();
    const currentLoss = this.loss(X, y);
    return { loss: currentLoss, gradNorm };
  }

  /**
   * Exposes linear decision boundary equation w · x + b = 0.
   * In 2D space (x_1, x_2): w_1 * x_1 + w_2 * x_2 + b = 0
   * x_2 = - (w_1 / w_2) * x_1 - (b / w_2)
   *
   * @returns {{
   *   is2D: boolean,
   *   slope: number | null,
   *   intercept: number | null,
   *   weights: Float64Array,
   *   bias: number
   * }}
   */
  getDecisionBoundary() {
    if (this.nFeatures === 2) {
      const w1 = this.weights[0];
      const w2 = this.weights[1];
      if (Math.abs(w2) > 1e-9) {
        return {
          is2D: true,
          slope: -w1 / w2,
          intercept: -this.bias / w2,
          weights: new Float64Array(this.weights),
          bias: this.bias
        };
      }
    }

    return {
      is2D: this.nFeatures === 2,
      slope: null,
      intercept: null,
      weights: new Float64Array(this.weights),
      bias: this.bias
    };
  }

  /**
   * Computes 2D decision boundary line endpoints for direct rendering on canvas or 3D world.
   * @param {number} xMin
   * @param {number} xMax
   * @returns {{ p1: { x: number, y: number }, p2: { x: number, y: number } } | null}
   */
  getBoundaryEndpoints(xMin, xMax) {
    const boundary = this.getDecisionBoundary();
    if (!boundary.is2D || boundary.slope === null) return null;

    const y1 = boundary.slope * xMin + boundary.intercept;
    const y2 = boundary.slope * xMax + boundary.intercept;

    return {
      p1: { x: xMin, y: y1 },
      p2: { x: xMax, y: y2 }
    };
  }
}
