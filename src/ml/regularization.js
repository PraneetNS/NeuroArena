/**
 * @file regularization.js
 * @description Elastic Net Regularization engine combining L2 Ridge (weight shrinkage)
 * and L1 Lasso (sparsity inducing) via exact Proximal Gradient Descent (ISTA soft-thresholding)
 * alongside closed-form Cholesky Ridge solutions, coefficient sparsity tracking,
 * and bias-variance overfit gap evaluations. Zero external dependencies.
 */

import { Matrix } from './Matrix.js';
import { Metrics } from './Metrics.js';

const EPSILON = 1e-12;

/**
 * Soft-thresholding operator S_γ(v) for L1 proximal step:
 * S_γ(v) = sign(v) * max(0, |v| - γ).
 * Guarantees coefficients genuinely collapse to exactly zero.
 * @param {number} v - Intermediate parameter value
 * @param {number} gamma - Shrinkage threshold (η * λ1)
 * @returns {number}
 */
export function softThreshold(v, gamma) {
  if (v > gamma) return v - gamma;
  if (v < -gamma) return v + gamma;
  return 0.0;
}

export class RegularizedRegression {
  /**
   * @param {number} nFeatures - Number of input/expanded features D
   * @param {Object} [options]
   * @param {number} [options.lambda1=0.0] - L1 Lasso penalty (sparsity)
   * @param {number} [options.lambda2=0.0] - L2 Ridge penalty (curvature damping)
   */
  constructor(nFeatures, { lambda1 = 0.0, lambda2 = 0.0 } = {}) {
    this.nFeatures = Math.max(1, nFeatures);
    this.lambda1 = Math.max(0.0, lambda1);
    this.lambda2 = Math.max(0.0, lambda2);

    this.weights = new Float64Array(this.nFeatures);
    this.bias = 0.0;

    // Scratch buffers to avoid memory allocation during training steps
    this._grads = new Float64Array(this.nFeatures);
    this._residuals = null;
  }

  /**
   * Updates penalty coefficients live.
   * @param {number} l1
   * @param {number} l2
   */
  setPenalties(l1, l2) {
    this.lambda1 = Math.max(0.0, l1);
    this.lambda2 = Math.max(0.0, l2);
  }

  /**
   * Resets weights and bias.
   */
  reset() {
    this.weights.fill(0);
    this.bias = 0.0;
  }

  /**
   * Forward pass: computes predictions ŷ = X * w + b.
   * @param {Matrix} X - Feature matrix (N x D)
   * @returns {Float64Array}
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
   * Computes composite regularized loss:
   * Loss = MSE + λ2 * ‖w‖₂² + λ1 * ‖w‖₁
   * where MSE = (1 / 2N) * sum((ŷ - y)²).
   *
   * @param {Matrix} X
   * @param {Matrix} y
   * @returns {{ totalLoss: number, mse: number, ridgePenalty: number, lassoPenalty: number }}
   */
  loss(X, y) {
    const N = X.rows;
    const yPred = this.predict(X);

    let sse = 0.0;
    for (let i = 0; i < N; i++) {
      const err = yPred[i] - y.get(i, 0);
      sse += err * err;
    }
    const mse = sse / (2.0 * N);

    let l1Sum = 0.0;
    let l2Sum = 0.0;
    for (let j = 0; j < this.nFeatures; j++) {
      const w = this.weights[j];
      l1Sum += Math.abs(w);
      l2Sum += w * w;
    }

    const ridgePenalty = this.lambda2 * l2Sum;
    const lassoPenalty = this.lambda1 * l1Sum;
    const totalLoss = mse + ridgePenalty + lassoPenalty;

    return { totalLoss, mse, ridgePenalty, lassoPenalty };
  }

  /**
   * Executes a single Proximal Gradient Descent step (ISTA):
   * 1. Intermediate gradient step on smooth part (MSE + L2 Ridge gradient 2*λ2*w).
   * 2. Proximal soft-thresholding on L1 Lasso penalty, snapping coefficients to 0.
   *
   * @param {Matrix} X - Feature matrix (N x D)
   * @param {Matrix} y - Target matrix (N x 1)
   * @param {number} lr - Learning rate η
   * @returns {{ totalLoss: number, mse: number, gradNorm: number, zeroCount: number }}
   */
  stepISTA(X, y, lr = 0.01) {
    const N = X.rows;
    const D = this.nFeatures;
    const invN = 1.0 / N;

    const yPred = this.predict(X);
    this._grads.fill(0);
    let gradBias = 0.0;

    // Step 1: Smooth MSE gradients
    for (let i = 0; i < N; i++) {
      const residual = yPred[i] - y.get(i, 0); // (ŷ - y)
      for (let j = 0; j < D; j++) {
        this._grads[j] += residual * X.get(i, j);
      }
      gradBias += residual;
    }

    gradBias *= invN;

    // Add L2 Ridge gradient: + 2 * λ2 * w
    const twoLambda2 = 2.0 * this.lambda2;
    let gradNormSq = 0.0;

    // Step 2 & 3: Forward smooth update + Soft-thresholding proximal step
    const gamma = lr * this.lambda1; // L1 shrinkage threshold
    let zeroCount = 0;

    for (let j = 0; j < D; j++) {
      const smoothGrad = this._grads[j] * invN + twoLambda2 * this.weights[j];
      gradNormSq += smoothGrad * smoothGrad;

      // Intermediate gradient step on smooth objective
      const intermediateW = this.weights[j] - lr * smoothGrad;

      // Proximal soft-thresholding operator
      const sparseW = softThreshold(intermediateW, gamma);
      this.weights[j] = sparseW;

      if (sparseW === 0.0) {
        zeroCount++;
      }
    }

    // Update unregularized bias
    this.bias -= lr * gradBias;

    const lossStats = this.loss(X, y);
    return {
      totalLoss: lossStats.totalLoss,
      mse: lossStats.mse,
      gradNorm: Math.sqrt(gradNormSq),
      zeroCount
    };
  }

  /**
   * Closed-form analytical Ridge regression via Cholesky decomposition:
   * w̃ = (X̃^T * X̃ + 2N * λ2 * diag([1, ..., 1, 0]))^{-1} * X̃^T * y
   * where X̃ = [X, 1].
   *
   * @param {Matrix} X - Feature matrix (N x D)
   * @param {Matrix} y - Target matrix (N x 1)
   * @param {number} [lambda2=this.lambda2] - Ridge regularization parameter
   * @returns {{ weights: Float64Array, bias: number, mse: number, r2: number }}
   */
  solveClosedFormRidge(X, y, lambda2 = this.lambda2) {
    const N = X.rows;
    const D = X.cols;
    const augmentedCols = D + 1;

    // Construct augmented matrix X̃ = [X, 1]
    const X_aug = new Matrix(N, augmentedCols);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < D; j++) {
        X_aug.set(i, j, X.get(i, j));
      }
      X_aug.set(i, D, 1.0); // Bias column
    }

    // A = X̃^T * X̃ + 2N * λ2 * I_weights + εI
    const XT = X_aug.transpose();
    const A = XT.matmul(X_aug);
    const ridgeScale = 2.0 * N * lambda2;

    for (let k = 0; k < D; k++) {
      A.set(k, k, A.get(k, k) + ridgeScale + EPSILON);
    }
    // Small numerical stabilizer for bias entry
    A.set(D, D, A.get(D, D) + EPSILON);

    const b = XT.matmul(y);

    // Solve SPD system via Cholesky decomposition
    const w_aug = Matrix.solveCholesky(A, b);

    for (let j = 0; j < D; j++) {
      this.weights[j] = w_aug.get(j, 0);
    }
    this.bias = w_aug.get(D, 0);

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
   * Exposes coefficient vector, absolute magnitudes, and sparsity ratio for visualization.
   * @returns {{
   *   weights: Float64Array,
   *   bias: number,
   *   magnitudes: Float64Array,
   *   zeroCount: number,
   *   nonZeroCount: number,
   *   sparsity: number,
   *   l1Norm: number,
   *   l2Norm: number
   * }}
   */
  getCoefficients() {
    const D = this.nFeatures;
    const magnitudes = new Float64Array(D);
    let zeroCount = 0;
    let l1Sum = 0.0;
    let l2SumSq = 0.0;

    for (let j = 0; j < D; j++) {
      const mag = Math.abs(this.weights[j]);
      magnitudes[j] = mag;
      if (this.weights[j] === 0.0) zeroCount++;
      l1Sum += mag;
      l2SumSq += this.weights[j] * this.weights[j];
    }

    return {
      weights: new Float64Array(this.weights),
      bias: this.bias,
      magnitudes,
      zeroCount,
      nonZeroCount: D - zeroCount,
      sparsity: parseFloat((zeroCount / D).toFixed(3)),
      l1Norm: parseFloat(l1Sum.toFixed(4)),
      l2Norm: parseFloat(Math.sqrt(l2SumSq).toFixed(4))
    };
  }

  /**
   * Evaluates bias-variance trade-off across train, validation, and hidden-test sets.
   * Exposes the "overfit gap" (J_val - J_train) as a primary diagnostic indicator.
   *
   * @param {Matrix} trainX
   * @param {Matrix} trainY
   * @param {Matrix} valX
   * @param {Matrix} valY
   * @param {function(function(Matrix): Matrix, function(Matrix, Matrix): number): { score: number }} [hiddenEvalFn=null]
   * @returns {{
   *   trainMse: number,
   *   valMse: number,
   *   hiddenMse: number | null,
   *   overfitGap: number,
   *   isOverfitting: boolean
   * }}
   */
  evaluateBiasVariance(trainX, trainY, valX, valY, hiddenEvalFn = null) {
    const trainPred = this.predict(trainX);
    const valPred = this.predict(valX);

    const trainMse = Metrics.mse(trainY, trainPred);
    const valMse = Metrics.mse(valY, valPred);
    const overfitGap = valMse - trainMse;

    let hiddenMse = null;
    if (typeof hiddenEvalFn === 'function') {
      const evalRes = hiddenEvalFn(
        (X) => new Matrix(X.rows, 1, this.predict(X)),
        (yTrue, yPred) => Metrics.mse(yTrue, yPred)
      );
      hiddenMse = evalRes.score;
    }

    return {
      trainMse: parseFloat(trainMse.toFixed(4)),
      valMse: parseFloat(valMse.toFixed(4)),
      hiddenMse: hiddenMse !== null ? parseFloat(hiddenMse.toFixed(4)) : null,
      overfitGap: parseFloat(overfitGap.toFixed(4)),
      isOverfitting: overfitGap > 0.15 && trainMse < 0.25
    };
  }
}
