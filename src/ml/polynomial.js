/**
 * @file polynomial.js
 * @description Polynomial feature expansion up to degree 15 with column-wise standardization
 * to prevent numerical instability, floating-point overflow, and ill-conditioned normal equations.
 */

import { Matrix } from './Matrix.js';

const EPSILON = 1e-12;
const MAX_DEGREE = 15;

export class PolynomialFeatures {
  /**
   * @param {number} [degree=2] - Maximum polynomial exponent (1 to 15)
   * @param {Object} [options]
   * @param {boolean} [options.standardize=true] - Standardizes each feature power column
   */
  constructor(degree = 2, { standardize = true } = {}) {
    this.degree = Math.max(1, Math.min(MAX_DEGREE, Math.floor(degree)));
    this.standardize = standardize;
    this.means = null;
    this.stds = null;
    this.isFitted = false;
  }

  /**
   * Fits mean and standard deviation for each polynomial degree column.
   * Input is assumed to be N x 1 (or 1D feature).
   * @param {Matrix | Float64Array | number[]} X
   * @returns {PolynomialFeatures} this
   */
  fit(X) {
    const xData = X instanceof Matrix ? X.data : (X instanceof Float64Array ? X : new Float64Array(X));
    const N = xData.length;
    const D = this.degree;

    this.means = new Float64Array(D);
    this.stds = new Float64Array(D);

    if (!this.standardize) {
      this.stds.fill(1.0);
      this.isFitted = true;
      return this;
    }

    // Accumulate sums for each power k = 1..D
    for (let i = 0; i < N; i++) {
      const base = xData[i];
      let powerVal = base;
      for (let k = 0; k < D; k++) {
        this.means[k] += powerVal;
        powerVal *= base;
      }
    }

    for (let k = 0; k < D; k++) {
      this.means[k] /= N;
    }

    // Accumulate squared variance for each power
    for (let i = 0; i < N; i++) {
      const base = xData[i];
      let powerVal = base;
      for (let k = 0; k < D; k++) {
        const diff = powerVal - this.means[k];
        this.stds[k] += diff * diff;
        powerVal *= base;
      }
    }

    for (let k = 0; k < D; k++) {
      const variance = this.stds[k] / N;
      this.stds[k] = Math.sqrt(variance);
      if (this.stds[k] < EPSILON) {
        this.stds[k] = 1.0;
      }
    }

    this.isFitted = true;
    return this;
  }

  /**
   * Expands input X into [x^1, x^2, ..., x^degree], applying fitted standardization.
   * @param {Matrix | Float64Array | number[]} X
   * @returns {Matrix} Expanded feature matrix of dimension N x degree
   */
  transform(X) {
    if (this.standardize && !this.isFitted) {
      throw new Error('[PolynomialFeatures] fit() must be called before transform()');
    }

    const xData = X instanceof Matrix ? X.data : (X instanceof Float64Array ? X : new Float64Array(X));
    const N = xData.length;
    const D = this.degree;

    const outMatrix = new Matrix(N, D);
    const outData = outMatrix.data;

    for (let i = 0; i < N; i++) {
      const base = xData[i];
      let powerVal = base;
      const rowOffset = i * D;

      for (let k = 0; k < D; k++) {
        if (this.standardize && this.means && this.stds) {
          outData[rowOffset + k] = (powerVal - this.means[k]) / this.stds[k];
        } else {
          outData[rowOffset + k] = powerVal;
        }
        powerVal *= base;
      }
    }

    return outMatrix;
  }

  /**
   * Fits and transforms in a single call.
   * @param {Matrix | Float64Array | number[]} X
   * @returns {Matrix}
   */
  fitTransform(X) {
    return this.fit(X).transform(X);
  }

  /**
   * Returns list of polynomial powers [1, 2, ..., degree].
   * @returns {number[]}
   */
  getPowers() {
    return Array.from({ length: this.degree }, (_, i) => i + 1);
  }
}
