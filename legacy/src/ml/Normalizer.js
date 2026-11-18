/**
 * @file Normalizer.js
 * @description Feature scaling and normalization:
 * 1. StandardScaler (z-score standardization to zero mean, unit variance)
 * 2. MinMaxScaler (scaling to arbitrary bounded interval [featureMin, featureMax])
 * Stores fitted distribution statistics for consistent out-of-sample inference.
 */

import { Matrix } from './Matrix.js';

const EPSILON = 1e-12;

export class StandardScaler {
  constructor() {
    this.mean = null;
    this.std = null;
    this.isFitted = false;
    this.nFeatures = 0;
  }

  /**
   * Computes mean and standard deviation per column.
   * @param {Matrix} X - Feature matrix (N x D)
   * @returns {StandardScaler} this
   */
  fit(X) {
    const N = X.rows;
    const D = X.cols;
    this.nFeatures = D;
    this.mean = new Float64Array(D);
    this.std = new Float64Array(D);

    // First pass: compute mean
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < D; c++) {
        this.mean[c] += X.get(r, c);
      }
    }
    for (let c = 0; c < D; c++) {
      this.mean[c] /= N;
    }

    // Second pass: compute variance and standard deviation
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < D; c++) {
        const diff = X.get(r, c) - this.mean[c];
        this.std[c] += diff * diff;
      }
    }
    for (let c = 0; c < D; c++) {
      const variance = this.std[c] / N;
      this.std[c] = Math.sqrt(variance) || 1.0; // Avoid division by zero
    }

    this.isFitted = true;
    return this;
  }

  /**
   * Transforms X using fitted mean and std: z = (x - mean) / std.
   * @param {Matrix} X
   * @returns {Matrix} Scaled copy
   */
  transform(X) {
    if (!this.isFitted) throw new Error('[StandardScaler] Must call fit() before transform()');
    if (X.cols !== this.nFeatures) throw new Error('[StandardScaler] Feature dimension mismatch');

    const result = new Matrix(X.rows, X.cols);
    const N = X.rows;
    const D = X.cols;

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < D; c++) {
        const z = (X.get(r, c) - this.mean[c]) / this.std[c];
        result.set(r, c, z);
      }
    }
    return result;
  }

  /**
   * Fits and transforms in a single call.
   * @param {Matrix} X
   * @returns {Matrix}
   */
  fitTransform(X) {
    return this.fit(X).transform(X);
  }

  /**
   * Inverts standardization: x = z * std + mean.
   * @param {Matrix} Z
   * @returns {Matrix}
   */
  inverseTransform(Z) {
    if (!this.isFitted) throw new Error('[StandardScaler] Must call fit() before inverseTransform()');
    const result = new Matrix(Z.rows, Z.cols);
    const N = Z.rows;
    const D = Z.cols;

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < D; c++) {
        const x = Z.get(r, c) * this.std[c] + this.mean[c];
        result.set(r, c, x);
      }
    }
    return result;
  }
}

export class MinMaxScaler {
  /**
   * @param {number} [featureMin=0.0]
   * @param {number} [featureMax=1.0]
   */
  constructor(featureMin = 0.0, featureMax = 1.0) {
    this.featureMin = featureMin;
    this.featureMax = featureMax;
    this.min = null;
    this.max = null;
    this.range = null;
    this.isFitted = false;
    this.nFeatures = 0;
  }

  /**
   * Fits min and max per feature column.
   * @param {Matrix} X
   * @returns {MinMaxScaler} this
   */
  fit(X) {
    const N = X.rows;
    const D = X.cols;
    this.nFeatures = D;
    this.min = new Float64Array(D).fill(Infinity);
    this.max = new Float64Array(D).fill(-Infinity);
    this.range = new Float64Array(D);

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < D; c++) {
        const val = X.get(r, c);
        if (val < this.min[c]) this.min[c] = val;
        if (val > this.max[c]) this.max[c] = val;
      }
    }

    for (let c = 0; c < D; c++) {
      const r = this.max[c] - this.min[c];
      this.range[c] = r > EPSILON ? r : 1.0;
    }

    this.isFitted = true;
    return this;
  }

  /**
   * Scales features into [featureMin, featureMax].
   * @param {Matrix} X
   * @returns {Matrix}
   */
  transform(X) {
    if (!this.isFitted) throw new Error('[MinMaxScaler] Must call fit() before transform()');
    if (X.cols !== this.nFeatures) throw new Error('[MinMaxScaler] Feature dimension mismatch');

    const result = new Matrix(X.rows, X.cols);
    const scale = this.featureMax - this.featureMin;
    const N = X.rows;
    const D = X.cols;

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < D; c++) {
        const normalized01 = (X.get(r, c) - this.min[c]) / this.range[c];
        const scaled = this.featureMin + normalized01 * scale;
        result.set(r, c, scaled);
      }
    }
    return result;
  }

  /**
   * Fits and transforms in a single call.
   * @param {Matrix} X
   * @returns {Matrix}
   */
  fitTransform(X) {
    return this.fit(X).transform(X);
  }

  /**
   * Inverts min-max scaling back to raw space.
   * @param {Matrix} S
   * @returns {Matrix}
   */
  inverseTransform(S) {
    if (!this.isFitted) throw new Error('[MinMaxScaler] Must call fit() before inverseTransform()');
    const result = new Matrix(S.rows, S.cols);
    const scale = this.featureMax - this.featureMin;
    const N = S.rows;
    const D = S.cols;

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < D; c++) {
        const normalized01 = (S.get(r, c) - this.featureMin) / scale;
        const raw = this.min[c] + normalized01 * this.range[c];
        result.set(r, c, raw);
      }
    }
    return result;
  }
}
