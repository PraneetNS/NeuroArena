/**
 * @file modelSelection.js
 * @description Model Selection, K-Fold Cross Validation, and GridSearchCV Engine for NeuroArena.
 * Features KFold, StratifiedKFold, cross-validation scoring, parameter grid Cartesian product generation,
 * and automated best-estimator refitting.
 */

import { Matrix } from './Matrix.js';

export class KFold {
  /**
   * @param {Object} options
   * @param {number} [options.nSplits=5]
   * @param {boolean} [options.shuffle=true]
   * @param {number|null} [options.seed=null]
   */
  constructor(options = {}) {
    this.nSplits = Math.max(2, options.nSplits ?? 5);
    this.shuffle = options.shuffle ?? true;
    this.seed = options.seed ?? null;
  }

  /**
   * Generates train and validation index splits for N samples.
   * @param {number} N
   * @returns {Array<{ trainIndices: number[], valIndices: number[] }>}
   */
  split(N) {
    const indices = Array.from({ length: N }, (_, i) => i);

    if (this.shuffle) {
      let seed = this.seed ?? 42;
      const rng = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };
      for (let i = N - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
    }

    const foldSize = Math.floor(N / this.nSplits);
    const remainder = N % this.nSplits;
    const splits = [];

    let cur = 0;
    for (let k = 0; k < this.nSplits; k++) {
      const thisFoldSize = foldSize + (k < remainder ? 1 : 0);
      const valIndices = indices.slice(cur, cur + thisFoldSize);
      const trainIndices = indices.slice(0, cur).concat(indices.slice(cur + thisFoldSize));

      splits.push({ trainIndices, valIndices });
      cur += thisFoldSize;
    }

    return splits;
  }
}

export class StratifiedKFold {
  /**
   * @param {Object} options
   * @param {number} [options.nSplits=5]
   */
  constructor(options = {}) {
    this.nSplits = Math.max(2, options.nSplits ?? 5);
  }

  /**
   * Splits N samples while preserving class distributions per fold.
   * @param {Float64Array|number[]} y - Target class labels
   * @returns {Array<{ trainIndices: number[], valIndices: number[] }>}
   */
  split(y) {
    const N = y.length;
    const classToIndices = new Map();

    for (let i = 0; i < N; i++) {
      const c = y[i];
      if (!classToIndices.has(c)) classToIndices.set(c, []);
      classToIndices.get(c).push(i);
    }

    const foldValBuckets = Array.from({ length: this.nSplits }, () => []);

    for (const indices of classToIndices.values()) {
      for (let i = 0; i < indices.length; i++) {
        const foldIdx = i % this.nSplits;
        foldValBuckets[foldIdx].push(indices[i]);
      }
    }

    const allIndices = new Set(Array.from({ length: N }, (_, i) => i));
    const splits = [];

    for (let k = 0; k < this.nSplits; k++) {
      const valIndices = foldValBuckets[k];
      const valSet = new Set(valIndices);
      const trainIndices = [];
      for (let i = 0; i < N; i++) {
        if (!valSet.has(i)) trainIndices.push(i);
      }
      splits.push({ trainIndices, valIndices });
    }

    return splits;
  }
}

/**
 * Slices a Matrix by given row indices.
 * @param {Matrix} X
 * @param {number[]} indices
 * @returns {Matrix}
 */
export function sliceMatrixRows(X, indices) {
  const n = indices.length;
  const d = X.cols;
  const out = new Matrix(n, d);
  for (let i = 0; i < n; i++) {
    const origRow = indices[i];
    for (let j = 0; j < d; j++) {
      out.set(i, j, X.get(origRow, j));
    }
  }
  return out;
}

/**
 * Evaluates an estimator across K folds.
 * @param {function(Object): Object} estimatorFactory - Returns a new estimator instance with options
 * @param {Matrix} X
 * @param {Matrix} y
 * @param {Object} [options={}]
 * @param {number} [options.cv=5]
 * @returns {{ scores: number[], meanScore: number, stdScore: number }}
 */
export function crossValScore(estimatorFactory, X, y, options = {}) {
  const cv = options.cv ?? 5;
  const kf = new KFold({ nSplits: cv });
  const splits = kf.split(X.rows);
  const scores = [];

  for (const { trainIndices, valIndices } of splits) {
    const trainX = sliceMatrixRows(X, trainIndices);
    const trainY = sliceMatrixRows(y, trainIndices);
    const valX = sliceMatrixRows(X, valIndices);
    const valY = sliceMatrixRows(y, valIndices);

    const model = estimatorFactory();
    model.fit(trainX, trainY);
    const evalRes = model.score(valX, valY);
    scores.push(evalRes.score);
  }

  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scores.length;

  return {
    scores,
    meanScore: parseFloat(mean.toFixed(4)),
    stdScore: parseFloat(Math.sqrt(variance).toFixed(4))
  };
}

export class GridSearchCV {
  /**
   * @param {function(Object): Object} estimatorFactory
   * @param {Object<string, any[]>} paramGrid - e.g. { maxDepth: [2, 3], criterion: ['gini', 'entropy'] }
   * @param {Object} [options={}]
   * @param {number} [options.cv=3]
   */
  constructor(estimatorFactory, paramGrid, options = {}) {
    this.estimatorFactory = estimatorFactory;
    this.paramGrid = paramGrid;
    this.cv = options.cv ?? 3;

    this.bestParams = null;
    this.bestScore = -Infinity;
    this.bestEstimator = null;
    this.cvResults = [];
  }

  /**
   * Generates Cartesian product of all parameter candidates.
   */
  _generateCombinations() {
    const keys = Object.keys(this.paramGrid);
    if (keys.length === 0) return [{}];

    let combos = [{}];
    for (const key of keys) {
      const values = this.paramGrid[key];
      const newCombos = [];
      for (const combo of combos) {
        for (const val of values) {
          newCombos.push({ ...combo, [key]: val });
        }
      }
      combos = newCombos;
    }

    return combos;
  }

  /**
   * Searches for optimal hyperparameters across all grid combinations.
   * @param {Matrix} X
   * @param {Matrix} y
   * @returns {GridSearchCV}
   */
  fit(X, y) {
    const combinations = this._generateCombinations();
    this.cvResults = [];
    this.bestScore = -Infinity;
    this.bestParams = null;

    for (const params of combinations) {
      const cvRes = crossValScore(() => this.estimatorFactory(params), X, y, { cv: this.cv });

      this.cvResults.push({
        params,
        meanScore: cvRes.meanScore,
        stdScore: cvRes.stdScore,
        scores: cvRes.scores
      });

      if (cvRes.meanScore > this.bestScore) {
        this.bestScore = cvRes.meanScore;
        this.bestParams = params;
      }
    }

    // Refit best estimator on full dataset
    this.bestEstimator = this.estimatorFactory(this.bestParams);
    this.bestEstimator.fit(X, y);

    return this;
  }

  predict(X) {
    if (!this.bestEstimator) throw new Error('GridSearchCV not fitted yet');
    return this.bestEstimator.predict(X);
  }
}
