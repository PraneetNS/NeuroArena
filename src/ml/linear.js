/**
 * @file linear.js
 * @description Linear Regression (univariate and multivariate) with exact hand-derived
 * analytical gradients, loss computation, and closed-form OLS (Normal Equations via Cholesky)
 * used as the analytical ground truth reference and for mathematical solvability checks.
 */

import { Matrix } from './Matrix.js';
import { Metrics } from './Metrics.js';

export class LinearRegression {
  /**
   * @param {number} nFeatures - Number of input features D
   */
  constructor(nFeatures = 1) {
    this.nFeatures = Math.max(1, nFeatures);
    this.weights = new Float64Array(this.nFeatures);
    this.bias = 0.0;

    // Packed parameters array [w_0, ..., w_{D-1}, bias] of length D + 1
    this.params = new Float64Array(this.nFeatures + 1);
    this.grads = new Float64Array(this.nFeatures + 1);
  }

  /**
   * Resets weights and bias to zeros or initial values.
   * @param {number} [initWeight=0.0]
   * @param {number} [initBias=0.0]
   */
  reset(initWeight = 0.0, initBias = 0.0) {
    this.weights.fill(initWeight);
    this.bias = initBias;
    this.syncToParams();
  }

  /**
   * Synchronizes weights and bias into packed params array.
   */
  syncToParams() {
    for (let i = 0; i < this.nFeatures; i++) {
      this.params[i] = this.weights[i];
    }
    this.params[this.nFeatures] = this.bias;
  }

  /**
   * Synchronizes packed params array back to weights and bias.
   */
  syncFromParams() {
    for (let i = 0; i < this.nFeatures; i++) {
      this.weights[i] = this.params[i];
    }
    this.bias = this.params[this.nFeatures];
  }

  /**
   * Forward pass: computes predictions ŷ = X * w + b.
   * @param {Matrix} X - Feature matrix (N x D)
   * @returns {Float64Array} Predictions ŷ (length N)
   */
  predict(X) {
    const N = X.rows;
    const D = this.nFeatures;
    const yPred = new Float64Array(N);

    for (let i = 0; i < N; i++) {
      let sum = this.bias;
      for (let j = 0; j < D; j++) {
        sum += X.get(i, j) * this.weights[j];
      }
      yPred[i] = sum;
    }
    return yPred;
  }

  /**
   * Computes Mean Squared Error loss J = (1 / 2N) * sum((ŷ - y)^2).
   * Note the standard 1/(2N) scaling making dJ/dŷ = (ŷ - y)/N.
   * @param {Matrix} X
   * @param {Matrix} y
   * @returns {number}
   */
  loss(X, y) {
    const N = X.rows;
    const yPred = this.predict(X);
    let sse = 0.0;
    for (let i = 0; i < N; i++) {
      const err = yPred[i] - y.get(i, 0);
      sse += err * err;
    }
    return sse / (2.0 * N);
  }

  /**
   * Computes exact hand-derived analytical gradients:
   * dJ/dw_j = (1/N) * sum_{i=1}^N (ŷ_i - y_i) * x_{i, j}
   * dJ/db   = (1/N) * sum_{i=1}^N (ŷ_i - y_i)
   *
   * @param {Matrix} X - Feature matrix (N x D)
   * @param {Matrix} y - Target matrix (N x 1)
   * @returns {{ gradWeights: Float64Array, gradBias: number, gradNorm: number }}
   */
  computeGradients(X, y) {
    const N = X.rows;
    const D = this.nFeatures;
    const yPred = this.predict(X);

    this.grads.fill(0);

    for (let i = 0; i < N; i++) {
      const residual = yPred[i] - y.get(i, 0); // (ŷ - y)

      for (let j = 0; j < D; j++) {
        this.grads[j] += residual * X.get(i, j);
      }
      this.grads[D] += residual; // bias gradient
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
   * Executes a single optimization step using an optimizer.
   * @param {Matrix} X - Feature matrix (N x D)
   * @param {Matrix} y - Target matrix (N x 1)
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
   * Closed-form Ordinary Least Squares (Normal Equations via Cholesky decomposition).
   * Solves: (X̃^T * X̃ + λI) * w̃ = X̃^T * y, where X̃ = [X, 1].
   * Used as the analytical reference and for mathematical solvability certificates.
   *
   * @param {Matrix} X - Feature matrix (N x D)
   * @param {Matrix} y - Target matrix (N x 1)
   * @param {number} [ridgeLambda=1e-6] - Small Tikhonov regularization for positive-definiteness
   * @returns {{ weights: Float64Array, bias: number, mse: number, r2: number }}
   */
  solveOLS(X, y, ridgeLambda = 1e-6) {
    const N = X.rows;
    const D = X.cols;
    const augmentedCols = D + 1; // [features, bias column]

    // Construct augmented matrix X̃
    const X_aug = new Matrix(N, augmentedCols);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < D; j++) {
        X_aug.set(i, j, X.get(i, j));
      }
      X_aug.set(i, D, 1.0); // Bias intercept column
    }

    // Compute A = X̃^T * X̃ + λI
    const XT = X_aug.transpose();
    const A = XT.matmul(X_aug);
    for (let k = 0; k < augmentedCols; k++) {
      A.set(k, k, A.get(k, k) + ridgeLambda);
    }

    // Compute b = X̃^T * y
    const b = XT.matmul(y);

    // Solve SPD system via Cholesky decomposition
    const w_aug = Matrix.solveCholesky(A, b);

    // Update model weights and bias
    for (let j = 0; j < D; j++) {
      this.weights[j] = w_aug.get(j, 0);
    }
    this.bias = w_aug.get(D, 0);
    this.syncToParams();

    const yPred = this.predict(X);
    const mse = Metrics.mse(y, yPred);
    const r2 = Metrics.r2(y, yPred);

    return {
      weights: new Float64Array(this.weights),
      bias: this.bias,
      mse,
      r2
    };
  }

  /**
   * Validates mathematical solvability of a candidate dataset before presenting to player.
   * @param {Matrix} X
   * @param {Matrix} y
   * @param {number} [thresholdMse=0.08]
   * @returns {{ solvable: boolean, optimalMse: number, optimalR2: number }}
   */
  static checkSolvability(X, y, thresholdMse = 0.08) {
    const probe = new LinearRegression(X.cols);
    const result = probe.solveOLS(X, y);
    return {
      solvable: result.mse <= thresholdMse,
      optimalMse: result.mse,
      optimalR2: result.r2,
      weights: result.weights,
      bias: result.bias
    };
  }
}
