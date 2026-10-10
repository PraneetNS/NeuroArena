/**
 * @file tree.js
 * @description Decision Tree Classifier and Regressor engine for NeuroArena (Biome 4: The Branching Canopy).
 * Supports Gini impurity, Shannon entropy, MSE variance reduction, greedy split optimization,
 * recursive tree synthesis, probabilistic routing, and Mean Decrease Impurity (MDI) feature importances.
 */

import { Matrix } from './Matrix.js';
import { Metrics } from './Metrics.js';

export class TreeNode {
  constructor(options = {}) {
    this.featureIndex = options.featureIndex ?? null;
    this.threshold = options.threshold ?? null;
    this.left = options.left ?? null;
    this.right = options.right ?? null;
    this.value = options.value ?? null; // Leaf prediction (class index or continuous scalar)
    this.probabilities = options.probabilities ?? null; // For classification: Float64Array of class probabilities
    this.impurity = options.impurity ?? 0.0;
    this.samples = options.samples ?? 0;
    this.isLeaf = options.isLeaf ?? false;
  }
}

export class DecisionTree {
  /**
   * @param {Object} options
   * @param {'classification' | 'regression'} [options.task='classification']
   * @param {'gini' | 'entropy' | 'mse'} [options.criterion='gini']
   * @param {number} [options.maxDepth=10]
   * @param {number} [options.minSamplesSplit=2]
   * @param {number} [options.minSamplesLeaf=1]
   * @param {number|null} [options.maxFeatures=null] - Max features considered at each split (null = all)
   * @param {number} [options.nClasses=2]
   */
  constructor(options = {}) {
    this.task = options.task || 'classification';
    this.criterion = options.criterion || (this.task === 'classification' ? 'gini' : 'mse');
    this.maxDepth = options.maxDepth ?? 10;
    this.minSamplesSplit = Math.max(2, options.minSamplesSplit ?? 2);
    this.minSamplesLeaf = Math.max(1, options.minSamplesLeaf ?? 1);
    this.maxFeatures = options.maxFeatures ?? null;
    this.nClasses = options.nClasses ?? 2;

    this.root = null;
    this.nFeatures = 0;
    this.featureImportances = null;
  }

  /**
   * Calculates impurity for target array y at a subset of indices.
   * @param {Float64Array|number[]} y
   * @param {number[]} indices
   * @returns {number}
   */
  _calculateImpurity(y, indices) {
    const n = indices.length;
    if (n === 0) return 0.0;

    if (this.task === 'classification') {
      const counts = new Map();
      for (let i = 0; i < n; i++) {
        const val = y[indices[i]];
        counts.set(val, (counts.get(val) || 0) + 1);
      }

      if (this.criterion === 'entropy') {
        let entropy = 0.0;
        for (const count of counts.values()) {
          const p = count / n;
          if (p > 0) entropy -= p * Math.log2(p);
        }
        return entropy;
      }

      // Default: Gini impurity = 1 - sum(p_i^2)
      let sumSq = 0.0;
      for (const count of counts.values()) {
        const p = count / n;
        sumSq += p * p;
      }
      return 1.0 - sumSq;
    } else {
      // Regression: MSE variance reduction = sum((y_i - mean)^2) / n
      let sum = 0.0;
      for (let i = 0; i < n; i++) sum += y[indices[i]];
      const mean = sum / n;

      let variance = 0.0;
      for (let i = 0; i < n; i++) {
        const diff = y[indices[i]] - mean;
        variance += diff * diff;
      }
      return variance / n;
    }
  }

  /**
   * Evaluates leaf node prediction value for indices.
   * @param {Float64Array|number[]} y
   * @param {number[]} indices
   * @returns {{ value: number, probabilities: Float64Array|null }}
   */
  _computeLeafValue(y, indices) {
    const n = indices.length;
    if (n === 0) return { value: 0, probabilities: null };

    if (this.task === 'classification') {
      const counts = new Map();
      for (let i = 0; i < n; i++) {
        const c = y[indices[i]];
        counts.set(c, (counts.get(c) || 0) + 1);
      }

      let maxCount = -1;
      let majorityClass = 0;
      const proba = new Float64Array(this.nClasses);

      for (let c = 0; c < this.nClasses; c++) {
        const count = counts.get(c) || 0;
        proba[c] = count / n;
        if (count > maxCount) {
          maxCount = count;
          majorityClass = c;
        }
      }

      return { value: majorityClass, probabilities: proba };
    } else {
      let sum = 0.0;
      for (let i = 0; i < n; i++) sum += y[indices[i]];
      return { value: sum / n, probabilities: null };
    }
  }

  /**
   * Finds the optimal feature split using greedy axis-aligned search.
   * @param {Matrix} X
   * @param {Float64Array|number[]} y
   * @param {number[]} indices
   * @param {number[]} featurePool
   * @returns {{ bestFeature: number, bestThreshold: number, bestGain: number, leftIdx: number[], rightIdx: number[] } | null}
   */
  _bestSplit(X, y, indices, featurePool) {
    const n = indices.length;
    if (n < this.minSamplesSplit) return null;

    const currentImpurity = this._calculateImpurity(y, indices);
    let bestGain = -Infinity;
    let bestFeature = -1;
    let bestThreshold = 0;
    let bestLeft = null;
    let bestRight = null;

    for (const f of featurePool) {
      // Gather values for feature f
      const vals = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        vals[i] = X.get(indices[i], f);
      }

      // Sort unique thresholds
      const sortedVals = Array.from(new Set(vals)).sort((a, b) => a - b);
      if (sortedVals.length <= 1) continue;

      for (let k = 0; k < sortedVals.length - 1; k++) {
        const threshold = (sortedVals[k] + sortedVals[k + 1]) / 2.0;

        const leftIdx = [];
        const rightIdx = [];
        for (let i = 0; i < n; i++) {
          const idx = indices[i];
          if (X.get(idx, f) <= threshold) {
            leftIdx.push(idx);
          } else {
            rightIdx.push(idx);
          }
        }

        if (leftIdx.length < this.minSamplesLeaf || rightIdx.length < this.minSamplesLeaf) {
          continue;
        }

        const leftImpurity = this._calculateImpurity(y, leftIdx);
        const rightImpurity = this._calculateImpurity(y, rightIdx);

        // Information gain = Impurity(parent) - [w_L * Impurity(L) + w_R * Impurity(R)]
        const weightedImpurity = (leftIdx.length / n) * leftImpurity + (rightIdx.length / n) * rightImpurity;
        const gain = currentImpurity - weightedImpurity;

        if (gain > bestGain) {
          bestGain = gain;
          bestFeature = f;
          bestThreshold = threshold;
          bestLeft = leftIdx;
          bestRight = rightIdx;
        }
      }
    }

    if (bestGain <= 0 || bestFeature === -1) return null;

    return {
      bestFeature,
      bestThreshold,
      bestGain,
      leftIdx: bestLeft,
      rightIdx: bestRight,
      currentImpurity
    };
  }

  /**
   * Recursively builds tree nodes.
   * @param {Matrix} X
   * @param {Float64Array|number[]} y
   * @param {number[]} indices
   * @param {number} depth
   * @returns {TreeNode}
   */
  _buildTree(X, y, indices, depth) {
    const impurity = this._calculateImpurity(y, indices);
    const n = indices.length;

    // Check termination conditions
    if (depth >= this.maxDepth || n < this.minSamplesSplit || impurity <= 1e-7) {
      const leaf = this._computeLeafValue(y, indices);
      return new TreeNode({
        value: leaf.value,
        probabilities: leaf.probabilities,
        impurity,
        samples: n,
        isLeaf: true
      });
    }

    // Determine candidate features
    let featurePool = Array.from({ length: this.nFeatures }, (_, i) => i);
    if (this.maxFeatures !== null && this.maxFeatures < this.nFeatures) {
      // Shuffle and slice for Random Forest random subspace
      for (let i = featurePool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [featurePool[i], featurePool[j]] = [featurePool[j], featurePool[i]];
      }
      featurePool = featurePool.slice(0, this.maxFeatures);
    }

    const split = this._bestSplit(X, y, indices, featurePool);
    if (!split) {
      const leaf = this._computeLeafValue(y, indices);
      return new TreeNode({
        value: leaf.value,
        probabilities: leaf.probabilities,
        impurity,
        samples: n,
        isLeaf: true
      });
    }

    // Accumulate MDI feature importance
    if (this.featureImportances) {
      this.featureImportances[split.bestFeature] += (n / this._totalSamples) * split.bestGain;
    }

    const leftChild = this._buildTree(X, y, split.leftIdx, depth + 1);
    const rightChild = this._buildTree(X, y, split.rightIdx, depth + 1);

    return new TreeNode({
      featureIndex: split.bestFeature,
      threshold: split.bestThreshold,
      left: leftChild,
      right: rightChild,
      impurity,
      samples: n,
      isLeaf: false
    });
  }

  /**
   * Fits the decision tree onto feature matrix X and target y.
   * @param {Matrix} X - Feature matrix (N x D)
   * @param {Matrix|Float64Array|number[]} y - Target vector (N x 1)
   * @returns {DecisionTree}
   */
  fit(X, y) {
    const N = X.rows;
    this.nFeatures = X.cols;
    this._totalSamples = N;
    this.featureImportances = new Float64Array(this.nFeatures);

    const yData = y instanceof Matrix ? y.data : (y instanceof Float64Array ? y : new Float64Array(y));
    const allIndices = Array.from({ length: N }, (_, i) => i);

    this.root = this._buildTree(X, yData, allIndices, 0);

    // Normalize feature importances
    let totalImp = 0.0;
    for (let f = 0; f < this.nFeatures; f++) totalImp += this.featureImportances[f];
    if (totalImp > 0) {
      for (let f = 0; f < this.nFeatures; f++) this.featureImportances[f] /= totalImp;
    }

    return this;
  }

  /**
   * Routes a single sample through the decision tree to retrieve its leaf.
   * @param {Matrix} X
   * @param {number} row
   * @returns {TreeNode}
   */
  _predictSample(X, row) {
    let node = this.root;
    while (!node.isLeaf) {
      const val = X.get(row, node.featureIndex);
      if (val <= node.threshold) {
        node = node.left;
      } else {
        node = node.right;
      }
    }
    return node;
  }

  /**
   * Generates predictions for Matrix X.
   * @param {Matrix} X - Feature matrix (N x D)
   * @returns {Matrix} Predictions (N x 1)
   */
  predict(X) {
    const N = X.rows;
    const out = new Matrix(N, 1);
    for (let i = 0; i < N; i++) {
      const leaf = this._predictSample(X, i);
      out.set(i, 0, leaf.value);
    }
    return out;
  }

  /**
   * Predicts class probabilities for classification tasks.
   * @param {Matrix} X
   * @returns {Matrix} Probability matrix (N x nClasses)
   */
  predictProba(X) {
    if (this.task !== 'classification') {
      throw new Error('predictProba is only supported for classification trees');
    }
    const N = X.rows;
    const out = new Matrix(N, this.nClasses);
    for (let i = 0; i < N; i++) {
      const leaf = this._predictSample(X, i);
      if (leaf.probabilities) {
        for (let c = 0; c < this.nClasses; c++) {
          out.set(i, c, leaf.probabilities[c]);
        }
      }
    }
    return out;
  }

  /**
   * Evaluates accuracy (classification) or R2/MSE (regression).
   * @param {Matrix} X
   * @param {Matrix} y
   * @returns {{ score: number, metricName: string }}
   */
  score(X, y) {
    const pred = this.predict(X);
    if (this.task === 'classification') {
      return { score: Metrics.accuracy(y, pred), metricName: 'accuracy' };
    } else {
      return { score: Metrics.r2(y, pred), metricName: 'r2' };
    }
  }
}
