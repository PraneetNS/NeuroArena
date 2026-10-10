/**
 * @file pca.js
 * @description Principal Component Analysis (PCA) Dimensionality Reduction Engine for NeuroArena.
 * Features data centering, sample covariance estimation, Jacobi eigenvalue decomposition,
 * explained variance ratios, orthogonal subspace projection, and high-dimensional reconstruction.
 */

import { Matrix } from './Matrix.js';

export class PCA {
  /**
   * @param {Object} options
   * @param {number} [options.nComponents=2] - Number of principal components to retain
   * @param {boolean} [options.whiten=false] - Whether to scale components to unit variance
   */
  constructor(options = {}) {
    this.nComponents = Math.max(1, options.nComponents ?? 2);
    this.whiten = options.whiten ?? false;

    this.mean = null; // Float64Array (D)
    this.components = null; // Matrix (nComponents x D) - rows are principal directions
    this.explainedVariance = null; // Float64Array (nComponents)
    this.explainedVarianceRatio = null; // Float64Array (nComponents)
    this.totalVariance = 0.0;
  }

  /**
   * Fits PCA model on Matrix X.
   * @param {Matrix} X - Feature matrix (N x D)
   * @returns {PCA}
   */
  fit(X) {
    const N = X.rows;
    const D = X.cols;
    const k = Math.min(this.nComponents, D);

    // 1. Compute empirical mean per feature
    this.mean = new Float64Array(D);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < D; j++) {
        this.mean[j] += X.get(i, j);
      }
    }
    for (let j = 0; j < D; j++) this.mean[j] /= N;

    // 2. Center feature matrix X_c = X - mean
    const Xc = new Matrix(N, D);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < D; j++) {
        Xc.set(i, j, X.get(i, j) - this.mean[j]);
      }
    }

    // 3. Covariance matrix Cov = (1 / (N - 1)) * X_c^T * X_c
    const div = Math.max(1, N - 1);
    const XcT = Xc.transpose();
    const cov = XcT.matmul(Xc);
    for (let i = 0; i < cov.data.length; i++) {
      cov.data[i] /= div;
    }

    // 4. Compute total variance (trace of covariance matrix)
    this.totalVariance = 0.0;
    for (let j = 0; j < D; j++) {
      this.totalVariance += cov.get(j, j);
    }

    // 5. Symmetric Jacobi Eigenvalue Decomposition
    const { eigenvalues, eigenvectors } = this._jacobiEigen(cov);

    // Sort eigenvalues descending
    const indices = Array.from({ length: D }, (_, i) => i);
    indices.sort((a, b) => eigenvalues[b] - eigenvalues[a]);

    this.explainedVariance = new Float64Array(k);
    this.explainedVarianceRatio = new Float64Array(k);
    this.components = new Matrix(k, D);

    const safeTotal = this.totalVariance > 1e-12 ? this.totalVariance : 1.0;

    for (let i = 0; i < k; i++) {
      const idx = indices[i];
      const ev = Math.max(0, eigenvalues[idx]);
      this.explainedVariance[i] = ev;
      this.explainedVarianceRatio[i] = ev / safeTotal;

      // Extract eigenvector column
      for (let j = 0; j < D; j++) {
        this.components.set(i, j, eigenvectors.get(j, idx));
      }
    }

    return this;
  }

  /**
   * Projects Matrix X onto the principal component subspace: Z = (X - mean) * components^T
   * @param {Matrix} X - Feature matrix (N x D)
   * @returns {Matrix} Projected matrix (N x nComponents)
   */
  transform(X) {
    const N = X.rows;
    const D = X.cols;
    const k = this.components.rows;

    const Xc = new Matrix(N, D);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < D; j++) {
        Xc.set(i, j, X.get(i, j) - this.mean[j]);
      }
    }

    const compT = this.components.transpose(); // D x k
    const Z = Xc.matmul(compT); // N x k

    if (this.whiten) {
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < k; j++) {
          const std = Math.sqrt(this.explainedVariance[j] + 1e-12);
          Z.set(i, j, Z.get(i, j) / std);
        }
      }
    }

    return Z;
  }

  /**
   * Fits model and immediately projects input X.
   * @param {Matrix} X
   * @returns {Matrix}
   */
  fitTransform(X) {
    return this.fit(X).transform(X);
  }

  /**
   * Reconstructs original feature space from principal coordinates: X_hat = Z * components + mean
   * @param {Matrix} Z - Reduced matrix (N x nComponents)
   * @returns {Matrix} Reconstructed matrix (N x D)
   */
  inverseTransform(Z) {
    const N = Z.rows;
    const D = this.components.cols;
    const k = this.components.rows;

    const Z_unwhiten = new Matrix(N, k);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < k; j++) {
        let val = Z.get(i, j);
        if (this.whiten) {
          val *= Math.sqrt(this.explainedVariance[j] + 1e-12);
        }
        Z_unwhiten.set(i, j, val);
      }
    }

    const Xhat = Z_unwhiten.matmul(this.components); // N x D
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < D; j++) {
        Xhat.set(i, j, Xhat.get(i, j) + this.mean[j]);
      }
    }

    return Xhat;
  }

  /**
   * Jacobi Eigenvalue Decomposition for real symmetric matrices.
   * @param {Matrix} A - Symmetric matrix (D x D)
   * @param {number} [maxIter=100]
   * @returns {{ eigenvalues: Float64Array, eigenvectors: Matrix }}
   */
  _jacobiEigen(A, maxIter = 100) {
    const n = A.rows;
    const V = Matrix.eye(n);
    const S = A.clone();

    for (let iter = 0; iter < maxIter; iter++) {
      // Find maximum off-diagonal element
      let maxOff = 0.0;
      let p = 0;
      let q = 1;

      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const absVal = Math.abs(S.get(i, j));
          if (absVal > maxOff) {
            maxOff = absVal;
            p = i;
            q = j;
          }
        }
      }

      if (maxOff < 1e-12) break;

      const spq = S.get(p, q);
      const spp = S.get(p, p);
      const sqq = S.get(q, q);

      const theta = (sqq - spp) / (2.0 * spq);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1.0));
      const c = 1.0 / Math.sqrt(t * t + 1.0);
      const s = t * c;

      // Rotate S
      for (let r = 0; r < n; r++) {
        if (r !== p && r !== q) {
          const srp = S.get(r, p);
          const srq = S.get(r, q);
          S.set(r, p, c * srp - s * srq);
          S.set(p, r, S.get(r, p));
          S.set(r, q, s * srp + c * srq);
          S.set(q, r, S.get(r, q));
        }
      }

      S.set(p, p, spp - t * spq);
      S.set(q, q, sqq + t * spq);
      S.set(p, q, 0.0);
      S.set(q, p, 0.0);

      // Accumulate eigenvectors in V
      for (let r = 0; r < n; r++) {
        const vrp = V.get(r, p);
        const vrq = V.get(r, q);
        V.set(r, p, c * vrp - s * vrq);
        V.set(r, q, s * vrp + c * vrq);
      }
    }

    const eigenvalues = new Float64Array(n);
    for (let i = 0; i < n; i++) eigenvalues[i] = S.get(i, i);

    return { eigenvalues, eigenvectors: V };
  }
}
