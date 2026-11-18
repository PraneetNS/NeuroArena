/**
 * @file kmeans.js
 * @description K-Means Clustering and Voronoi Partitioning Engine for NeuroArena.
 * Features K-Means++ centroid initialization, Lloyd's optimization algorithm,
 * within-cluster sum of squares (Inertia), and Silhouette score validation.
 */

import { Matrix } from './Matrix.js';

export class KMeans {
  /**
   * @param {Object} options
   * @param {number} [options.nClusters=3] - Number of clusters k
   * @param {number} [options.maxIter=300] - Maximum iterations of Lloyd's algorithm
   * @param {number} [options.tol=1e-4] - Convergence tolerance for centroid movement
   * @param {'k-means++' | 'random'} [options.init='k-means++']
   */
  constructor(options = {}) {
    this.nClusters = Math.max(1, options.nClusters ?? 3);
    this.maxIter = options.maxIter ?? 300;
    this.tol = options.tol ?? 1e-4;
    this.init = options.init || 'k-means++';

    this.clusterCenters = null; // Matrix (k x D)
    this.labels = null; // Int32Array (N)
    this.inertia = 0.0; // WCSS
    this.nIter = 0;
  }

  /**
   * Squared Euclidean distance between two vectors.
   */
  static _sqDist(X, rowX, C, rowC, D) {
    let sum = 0.0;
    for (let j = 0; j < D; j++) {
      const diff = X.get(rowX, j) - C.get(rowC, j);
      sum += diff * diff;
    }
    return sum;
  }

  /**
   * K-Means++ initialization: picks first centroid randomly, then chooses subsequent
   * centroids with probability proportional to D(x)^2.
   */
  _initKMeansPlusPlus(X, N, D, k) {
    const centers = new Matrix(k, D);

    // Pick first center randomly
    const firstIdx = Math.floor(Math.random() * N);
    for (let j = 0; j < D; j++) {
      centers.set(0, j, X.get(firstIdx, j));
    }

    const minDistSq = new Float64Array(N);

    for (let c = 1; c < k; c++) {
      let sumDist = 0.0;
      for (let i = 0; i < N; i++) {
        let minD = Infinity;
        for (let prevC = 0; prevC < c; prevC++) {
          const d = KMeans._sqDist(X, i, centers, prevC, D);
          if (d < minD) minD = d;
        }
        minDistSq[i] = minD;
        sumDist += minD;
      }

      // Sample proportional to distance squared
      let target = Math.random() * sumDist;
      let chosenIdx = 0;
      for (let i = 0; i < N; i++) {
        target -= minDistSq[i];
        if (target <= 0) {
          chosenIdx = i;
          break;
        }
      }

      for (let j = 0; j < D; j++) {
        centers.set(c, j, X.get(chosenIdx, j));
      }
    }

    return centers;
  }

  /**
   * Fits K-Means on feature matrix X.
   * @param {Matrix} X - Feature matrix (N x D)
   * @returns {KMeans}
   */
  fit(X) {
    const N = X.rows;
    const D = X.cols;
    const k = Math.min(this.nClusters, N);

    this.clusterCenters = this.init === 'k-means++'
      ? this._initKMeansPlusPlus(X, N, D, k)
      : new Matrix(k, D);

    if (this.init === 'random') {
      const chosen = new Set();
      for (let c = 0; c < k; c++) {
        let idx = Math.floor(Math.random() * N);
        while (chosen.has(idx)) idx = Math.floor(Math.random() * N);
        chosen.add(idx);
        for (let j = 0; j < D; j++) this.clusterCenters.set(c, j, X.get(idx, j));
      }
    }

    this.labels = new Int32Array(N);
    let prevInertia = Infinity;

    for (let iter = 0; iter < this.maxIter; iter++) {
      this.nIter = iter + 1;
      let curInertia = 0.0;

      // 1. Assignment step
      for (let i = 0; i < N; i++) {
        let bestDist = Infinity;
        let bestC = 0;

        for (let c = 0; c < k; c++) {
          const d = KMeans._sqDist(X, i, this.clusterCenters, c, D);
          if (d < bestDist) {
            bestDist = d;
            bestC = c;
          }
        }

        this.labels[i] = bestC;
        curInertia += bestDist;
      }

      this.inertia = curInertia;

      // Check convergence
      if (Math.abs(prevInertia - curInertia) < this.tol) {
        break;
      }
      prevInertia = curInertia;

      // 2. Update step
      const counts = new Int32Array(k);
      const newCenters = new Matrix(k, D);

      for (let i = 0; i < N; i++) {
        const c = this.labels[i];
        counts[c]++;
        for (let j = 0; j < D; j++) {
          newCenters.set(c, j, newCenters.get(c, j) + X.get(i, j));
        }
      }

      for (let c = 0; c < k; c++) {
        if (counts[c] > 0) {
          for (let j = 0; j < D; j++) {
            this.clusterCenters.set(c, j, newCenters.get(c, j) / counts[c]);
          }
        }
      }
    }

    return this;
  }

  /**
   * Predicts cluster assignment for each sample in X.
   * @param {Matrix} X
   * @returns {Int32Array}
   */
  predict(X) {
    const N = X.rows;
    const D = X.cols;
    const k = this.clusterCenters.rows;
    const out = new Int32Array(N);

    for (let i = 0; i < N; i++) {
      let bestDist = Infinity;
      let bestC = 0;

      for (let c = 0; c < k; c++) {
        const d = KMeans._sqDist(X, i, this.clusterCenters, c, D);
        if (d < bestDist) {
          bestDist = d;
          bestC = c;
        }
      }
      out[i] = bestC;
    }

    return out;
  }

  /**
   * Computes Silhouette score across all samples in X [-1.0, 1.0].
   * @param {Matrix} X
   * @returns {number}
   */
  silhouetteScore(X) {
    const N = X.rows;
    const D = X.cols;
    const k = this.clusterCenters.rows;
    if (k < 2 || N < 3) return 0.0;

    let totalSil = 0.0;

    for (let i = 0; i < N; i++) {
      const myCluster = this.labels[i];

      // Compute intra-cluster mean distance a(i)
      let aSum = 0.0;
      let aCount = 0;

      // Compute inter-cluster distances
      const clusterDistSums = new Float64Array(k);
      const clusterCounts = new Int32Array(k);

      for (let j = 0; j < N; j++) {
        if (i === j) continue;
        const d = Math.sqrt(KMeans._sqDist(X, i, X, j, D));
        const otherCluster = this.labels[j];

        if (otherCluster === myCluster) {
          aSum += d;
          aCount++;
        } else {
          clusterDistSums[otherCluster] += d;
          clusterCounts[otherCluster]++;
        }
      }

      const a_i = aCount > 0 ? aSum / aCount : 0.0;

      let b_i = Infinity;
      for (let c = 0; c < k; c++) {
        if (c !== myCluster && clusterCounts[c] > 0) {
          const meanDist = clusterDistSums[c] / clusterCounts[c];
          if (meanDist < b_i) b_i = meanDist;
        }
      }

      if (b_i === Infinity) b_i = 0.0;

      const maxDenom = Math.max(a_i, b_i);
      const s_i = maxDenom > 0 ? (b_i - a_i) / maxDenom : 0.0;
      totalSil += s_i;
    }

    return parseFloat((totalSil / N).toFixed(4));
  }
}
