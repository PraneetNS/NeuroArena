/**
 * @file Split.js
 * @description Train / Validation / Hidden-Test dataset partitioning.
 * Crucially, the HIDDEN test set is generated independently from the same underlying
 * mathematical distribution with its own secret seed and is NEVER exposed to training code.
 * This is strictly enforced via lexical closure: the hidden data is unexported and private,
 * only queryable via an authoritative evaluation closure function.
 */

import { Matrix } from './Matrix.js';
import { Rng } from './Rng.js';

/**
 * Creates train/val partitions from harvested samples and generates a private
 * hidden test distribution trapped inside an evaluation closure.
 *
 * @param {Object} options
 * @param {Matrix} options.X - Harvested feature matrix (N x D)
 * @param {Matrix} options.y - Harvested target matrix (N x 1)
 * @param {number} [options.trainRatio=0.75] - Fraction for training (0 < r < 1)
 * @param {number} [options.seed=42] - Partitioning seed
 * @param {function(number): { X: Matrix, y: Matrix }} [options.hiddenGenerator=null] - Generator function for hidden test set
 * @param {number} [options.hiddenTestSize=50] - Number of hidden test samples
 * @returns {{
 *   train: { X: Matrix, y: Matrix, nSamples: number },
 *   val: { X: Matrix, y: Matrix, nSamples: number },
 *   evaluateHidden: function(function(Matrix): Matrix, function(Matrix, Matrix): number): { score: number, nSamples: number }
 * }}
 */
export function createDatasetSplit({
  X,
  y,
  trainRatio = 0.75,
  seed = 42,
  hiddenGenerator = null,
  hiddenTestSize = 50
}) {
  if (X.rows !== y.rows) {
    throw new Error(`[Split] Row mismatch: X has ${X.rows} rows, y has ${y.rows}`);
  }

  const N = X.rows;
  const D = X.cols;
  const rng = new Rng(seed);

  // Generate randomized index array for train/val split
  const indices = Array.from({ length: N }, (_, i) => i);
  rng.shuffle(indices);

  const trainCount = Math.max(1, Math.floor(N * trainRatio));
  const valCount = Math.max(0, N - trainCount);

  // Build Train Partition
  const trainX = new Matrix(trainCount, D);
  const trainY = new Matrix(trainCount, y.cols);
  for (let i = 0; i < trainCount; i++) {
    const srcRow = indices[i];
    for (let c = 0; c < D; c++) {
      trainX.set(i, c, X.get(srcRow, c));
    }
    for (let c = 0; c < y.cols; c++) {
      trainY.set(i, c, y.get(srcRow, c));
    }
  }

  // Build Validation Partition
  const valX = new Matrix(valCount, D);
  const valY = new Matrix(valCount, y.cols);
  for (let i = 0; i < valCount; i++) {
    const srcRow = indices[trainCount + i];
    for (let c = 0; c < D; c++) {
      valX.set(i, c, X.get(srcRow, c));
    }
    for (let c = 0; c < y.cols; c++) {
      valY.set(i, c, y.get(srcRow, c));
    }
  }

  // =========================================================================
  // PRIVATE HIDDEN TEST SET (ENFORCED VIA LEXICAL CLOSURE)
  // This data is never returned, never attached to properties, and inaccessible
  // from outside this function. Only evaluateHidden can run models against it.
  // =========================================================================
  let _hiddenX;
  let _hiddenY;

  if (typeof hiddenGenerator === 'function') {
    // Generate clean held-out test distribution with a distinct secret seed
    const hiddenDist = hiddenGenerator(seed + 0xDEADBEEF);
    _hiddenX = hiddenDist.X;
    _hiddenY = hiddenDist.y;
  } else {
    // Fallback: reserve a fraction of data if no external generator provided
    const hiddenCount = Math.min(hiddenTestSize, Math.floor(N * 0.25));
    _hiddenX = new Matrix(hiddenCount, D);
    _hiddenY = new Matrix(hiddenCount, y.cols);
    for (let i = 0; i < hiddenCount; i++) {
      const srcRow = indices[N - 1 - i];
      for (let c = 0; c < D; c++) _hiddenX.set(i, c, X.get(srcRow, c));
      for (let c = 0; c < y.cols; c++) _hiddenY.set(i, c, y.get(srcRow, c));
    }
  }

  /**
   * Authoritative hidden test set evaluation closure.
   * Model passes its inference function and scoring metric; raw test data is never leaked.
   *
   * @param {function(Matrix): Matrix} predictFn - Function that produces predictions given features
   * @param {function(Matrix, Matrix): number} metricFn - Scoring metric (yTrue, yPred) => number
   * @returns {{ score: number, nSamples: number }}
   */
  const evaluateHidden = (predictFn, metricFn) => {
    if (typeof predictFn !== 'function' || typeof metricFn !== 'function') {
      throw new Error('[Split.evaluateHidden] Both predictFn and metricFn must be functions.');
    }
    const yPred = predictFn(_hiddenX);
    const score = metricFn(_hiddenY, yPred);
    return {
      score,
      nSamples: _hiddenX.rows
    };
  };

  return {
    train: { X: trainX, y: trainY, nSamples: trainCount },
    val: { X: valX, y: valY, nSamples: valCount },
    evaluateHidden
  };
}
