/**
 * @file forest.js
 * @description Random Forest Ensemble Classifier & Regressor for NeuroArena (Biome 4: Branching Canopy).
 * Implements Bootstrap Aggregation (Bagging), random subspace feature sampling, out-of-bag (OOB) error estimation,
 * soft probability voting, and ensemble-wide Mean Decrease Impurity (MDI) feature importances.
 */

import { Matrix } from './Matrix.js';
import { Metrics } from './Metrics.js';
import { DecisionTree } from './tree.js';

export class RandomForest {
  /**
   * @param {Object} options
   * @param {'classification' | 'regression'} [options.task='classification']
   * @param {number} [options.nEstimators=10] - Number of trees in the forest
   * @param {number} [options.maxDepth=10] - Maximum depth of each tree
   * @param {number} [options.minSamplesSplit=2]
   * @param {number} [options.minSamplesLeaf=1]
   * @param {'sqrt' | 'log2' | number | null} [options.maxFeatures='sqrt']
   * @param {number} [options.nClasses=2]
   * @param {number|null} [options.randomState=null]
   */
  constructor(options = {}) {
    this.task = options.task || 'classification';
    this.nEstimators = Math.max(1, options.nEstimators ?? 10);
    this.maxDepth = options.maxDepth ?? 10;
    this.minSamplesSplit = options.minSamplesSplit ?? 2;
    this.minSamplesLeaf = options.minSamplesLeaf ?? 1;
    this.maxFeatures = options.maxFeatures ?? (this.task === 'classification' ? 'sqrt' : null);
    this.nClasses = options.nClasses ?? 2;
    this.randomState = options.randomState ?? null;

    this.trees = [];
    this.featureImportances = null;
    this.oobScore = null;
    this.nFeatures = 0;
  }

  /**
   * Resolves the numeric count of features to evaluate per split.
   * @param {number} totalFeatures
   * @returns {number}
   */
  _resolveMaxFeatures(totalFeatures) {
    if (this.maxFeatures === 'sqrt') {
      return Math.max(1, Math.round(Math.sqrt(totalFeatures)));
    }
    if (this.maxFeatures === 'log2') {
      return Math.max(1, Math.round(Math.log2(totalFeatures)));
    }
    if (typeof this.maxFeatures === 'number') {
      return Math.min(totalFeatures, Math.max(1, Math.round(this.maxFeatures)));
    }
    return totalFeatures;
  }

  /**
   * Generates a bootstrap sample of indices with replacement.
   * @param {number} N
   * @returns {{ inBag: number[], outOfBag: number[] }}
   */
  _bootstrapSample(N) {
    const inBag = new Array(N);
    const selected = new Uint8Array(N);

    for (let i = 0; i < N; i++) {
      const idx = Math.floor(Math.random() * N);
      inBag[i] = idx;
      selected[idx] = 1;
    }

    const outOfBag = [];
    for (let i = 0; i < N; i++) {
      if (!selected[i]) outOfBag.push(i);
    }

    return { inBag, outOfBag };
  }

  /**
   * Fits the ensemble of Decision Trees with bootstrap bagging.
   * @param {Matrix} X - Feature matrix (N x D)
   * @param {Matrix|Float64Array|number[]} y - Target vector (N x 1)
   * @returns {RandomForest}
   */
  fit(X, y) {
    const N = X.rows;
    this.nFeatures = X.cols;
    const yData = y instanceof Matrix ? y.data : (y instanceof Float64Array ? y : new Float64Array(y));
    const maxFeatCount = this._resolveMaxFeatures(this.nFeatures);

    this.trees = [];
    this.featureImportances = new Float64Array(this.nFeatures);

    // Track OOB predictions for each sample
    const oobPredictions = Array.from({ length: N }, () => []);

    for (let t = 0; t < this.nEstimators; t++) {
      const { inBag, outOfBag } = this._bootstrapSample(N);

      // Create in-bag Matrix
      const xBag = new Matrix(N, this.nFeatures);
      const yBag = new Float64Array(N);

      for (let i = 0; i < N; i++) {
        const origIdx = inBag[i];
        for (let j = 0; j < this.nFeatures; j++) {
          xBag.set(i, j, X.get(origIdx, j));
        }
        yBag[i] = yData[origIdx];
      }

      const tree = new DecisionTree({
        task: this.task,
        criterion: this.task === 'classification' ? 'gini' : 'mse',
        maxDepth: this.maxDepth,
        minSamplesSplit: this.minSamplesSplit,
        minSamplesLeaf: this.minSamplesLeaf,
        maxFeatures: maxFeatCount,
        nClasses: this.nClasses
      });

      tree.fit(xBag, yBag);
      this.trees.push(tree);

      // Accumulate MDI feature importance
      if (tree.featureImportances) {
        for (let f = 0; f < this.nFeatures; f++) {
          this.featureImportances[f] += tree.featureImportances[f];
        }
      }

      // Record OOB evaluations
      for (const oobIdx of outOfBag) {
        if (this.task === 'classification') {
          const proba = tree.predictProba(new Matrix(1, this.nFeatures, X.data.subarray(oobIdx * this.nFeatures, (oobIdx + 1) * this.nFeatures)));
          oobPredictions[oobIdx].push(proba);
        } else {
          const val = tree.predict(new Matrix(1, this.nFeatures, X.data.subarray(oobIdx * this.nFeatures, (oobIdx + 1) * this.nFeatures)));
          oobPredictions[oobIdx].push(val.get(0, 0));
        }
      }
    }

    // Normalize ensemble feature importances
    for (let f = 0; f < this.nFeatures; f++) {
      this.featureImportances[f] /= this.nEstimators;
    }

    // Compute Out-Of-Bag (OOB) score
    this._computeOobScore(yData, oobPredictions, N);

    return this;
  }

  /**
   * Aggregates Out-Of-Bag predictions to estimate generalization score.
   * @param {Float64Array} yData
   * @param {Array} oobPredictions
   * @param {number} N
   */
  _computeOobScore(yData, oobPredictions, N) {
    let validOobCount = 0;

    if (this.task === 'classification') {
      let correct = 0;
      for (let i = 0; i < N; i++) {
        const preds = oobPredictions[i];
        if (preds.length === 0) continue;

        validOobCount++;
        const avgProba = new Float64Array(this.nClasses);
        for (const p of preds) {
          for (let c = 0; c < this.nClasses; c++) {
            avgProba[c] += p.get(0, c);
          }
        }

        let maxClass = 0;
        let maxVal = -1;
        for (let c = 0; c < this.nClasses; c++) {
          if (avgProba[c] > maxVal) {
            maxVal = avgProba[c];
            maxClass = c;
          }
        }

        if (maxClass === yData[i]) correct++;
      }

      this.oobScore = validOobCount > 0 ? parseFloat((correct / validOobCount).toFixed(4)) : null;
    } else {
      let sse = 0.0;
      let yMean = 0.0;
      let count = 0;

      for (let i = 0; i < N; i++) {
        const preds = oobPredictions[i];
        if (preds.length === 0) continue;
        count++;
        yMean += yData[i];
        const meanPred = preds.reduce((a, b) => a + b, 0) / preds.length;
        const diff = yData[i] - meanPred;
        sse += diff * diff;
      }

      if (count > 0) {
        yMean /= count;
        let sst = 0.0;
        for (let i = 0; i < N; i++) {
          if (oobPredictions[i].length > 0) {
            const diff = yData[i] - yMean;
            sst += diff * diff;
          }
        }
        this.oobScore = sst > 1e-9 ? parseFloat((1.0 - sse / sst).toFixed(4)) : 0.0;
      }
    }
  }

  /**
   * Predicts class labels or continuous values across the entire forest.
   * @param {Matrix} X
   * @returns {Matrix}
   */
  predict(X) {
    const N = X.rows;
    const out = new Matrix(N, 1);

    if (this.task === 'classification') {
      const probas = this.predictProba(X);
      for (let i = 0; i < N; i++) {
        let maxClass = 0;
        let maxVal = -1;
        for (let c = 0; c < this.nClasses; c++) {
          const val = probas.get(i, c);
          if (val > maxVal) {
            maxVal = val;
            maxClass = c;
          }
        }
        out.set(i, 0, maxClass);
      }
    } else {
      // Mean prediction over all trees
      const treePreds = this.trees.map(t => t.predict(X));
      for (let i = 0; i < N; i++) {
        let sum = 0.0;
        for (let t = 0; t < this.nEstimators; t++) {
          sum += treePreds[t].get(i, 0);
        }
        out.set(i, 0, sum / this.nEstimators);
      }
    }

    return out;
  }

  /**
   * Predicts class probabilities via soft voting.
   * @param {Matrix} X
   * @returns {Matrix}
   */
  predictProba(X) {
    if (this.task !== 'classification') {
      throw new Error('predictProba is only supported for classification forests');
    }
    const N = X.rows;
    const out = new Matrix(N, this.nClasses);
    const treeProbas = this.trees.map(t => t.predictProba(X));

    for (let i = 0; i < N; i++) {
      for (let c = 0; c < this.nClasses; c++) {
        let sum = 0.0;
        for (let t = 0; t < this.nEstimators; t++) {
          sum += treeProbas[t].get(i, c);
        }
        out.set(i, c, sum / this.nEstimators);
      }
    }

    return out;
  }

  /**
   * Scores model against ground truth.
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
