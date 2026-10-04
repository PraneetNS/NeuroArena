/**
 * @file Metrics.js
 * @description Standard empirical evaluation metrics for regression and classification:
 * MSE, MAE, R², Binary Log-Loss, Accuracy, Precision, Recall, F1 score, and Confusion Matrix.
 * Written from scratch using pure JS and Float64Array. Zero external dependencies.
 */

import { Matrix } from './Matrix.js';

const EPSILON = 1e-15;

/**
 * Extracts a flat Float64Array or number array from Matrix or Array.
 * @param {Matrix | Float64Array | number[]} input
 * @returns {Float64Array | number[]}
 */
function extractData(input) {
  if (input instanceof Matrix) return input.data;
  return input;
}

export class Metrics {
  /**
   * Mean Squared Error: MSE = (1/N) * sum((y_true - y_pred)^2).
   * @param {Matrix | number[]} yTrue
   * @param {Matrix | number[]} yPred
   * @returns {number}
   */
  static mse(yTrue, yPred) {
    const yt = extractData(yTrue);
    const yp = extractData(yPred);
    const n = yt.length;
    if (n === 0 || n !== yp.length) {
      throw new Error(`[Metrics.mse] Array length mismatch: ${n} vs ${yp.length}`);
    }

    let sum = 0.0;
    for (let i = 0; i < n; i++) {
      const diff = yt[i] - yp[i];
      sum += diff * diff;
    }
    return sum / n;
  }

  /**
   * Mean Absolute Error: MAE = (1/N) * sum(|y_true - y_pred|).
   * @param {Matrix | number[]} yTrue
   * @param {Matrix | number[]} yPred
   * @returns {number}
   */
  static mae(yTrue, yPred) {
    const yt = extractData(yTrue);
    const yp = extractData(yPred);
    const n = yt.length;
    if (n === 0 || n !== yp.length) {
      throw new Error('[Metrics.mae] Array length mismatch');
    }

    let sum = 0.0;
    for (let i = 0; i < n; i++) {
      sum += Math.abs(yt[i] - yp[i]);
    }
    return sum / n;
  }

  /**
   * Coefficient of Determination: R² = 1 - (SS_res / SS_tot).
   * @param {Matrix | number[]} yTrue
   * @param {Matrix | number[]} yPred
   * @returns {number}
   */
  static r2(yTrue, yPred) {
    const yt = extractData(yTrue);
    const yp = extractData(yPred);
    const n = yt.length;
    if (n === 0 || n !== yp.length) {
      throw new Error('[Metrics.r2] Array length mismatch');
    }

    let meanY = 0.0;
    for (let i = 0; i < n; i++) meanY += yt[i];
    meanY /= n;

    let ssRes = 0.0;
    let ssTot = 0.0;
    for (let i = 0; i < n; i++) {
      const diffRes = yt[i] - yp[i];
      const diffTot = yt[i] - meanY;
      ssRes += diffRes * diffRes;
      ssTot += diffTot * diffTot;
    }

    if (ssTot < EPSILON) return 1.0; // Perfect fit or zero variance
    return 1.0 - (ssRes / ssTot);
  }

  /**
   * Binary Cross-Entropy / Log-Loss: -1/N * sum(y*log(p) + (1-y)*log(1-p)).
   * @param {Matrix | number[]} yTrue - Binary ground truth in {0, 1}
   * @param {Matrix | number[]} yPredProb - Predicted probabilities in [0, 1]
   * @returns {number}
   */
  static logLoss(yTrue, yPredProb) {
    const yt = extractData(yTrue);
    const yp = extractData(yPredProb);
    const n = yt.length;
    if (n === 0 || n !== yp.length) {
      throw new Error('[Metrics.logLoss] Array length mismatch');
    }

    let sum = 0.0;
    for (let i = 0; i < n; i++) {
      const p = Math.max(EPSILON, Math.min(1.0 - EPSILON, yp[i]));
      const y = yt[i];
      sum += y * Math.log(p) + (1.0 - y) * Math.log(1.0 - p);
    }
    return -sum / n;
  }

  /**
   * Classification Accuracy: fraction of correct predictions in [0, 1].
   * @param {Matrix | number[]} yTrue
   * @param {Matrix | number[]} yPred - Discretized predictions or labels
   * @param {number} [threshold=0.5] - Decision threshold if probabilities supplied
   * @returns {number}
   */
  static accuracy(yTrue, yPred, threshold = 0.5) {
    const yt = extractData(yTrue);
    const yp = extractData(yPred);
    const n = yt.length;
    if (n === 0 || n !== yp.length) {
      throw new Error('[Metrics.accuracy] Array length mismatch');
    }

    let correct = 0;
    for (let i = 0; i < n; i++) {
      const predLabel = yp[i] >= threshold ? 1 : 0;
      const trueLabel = yt[i] >= 0.5 ? 1 : 0;
      if (predLabel === trueLabel) correct++;
    }
    return correct / n;
  }

  /**
   * Confusion matrix for binary classification.
   * @param {Matrix | number[]} yTrue
   * @param {Matrix | number[]} yPred
   * @param {number} [threshold=0.5]
   * @returns {{ matrix: number[][], tn: number, fp: number, fn: number, tp: number }}
   */
  static confusionMatrix(yTrue, yPred, threshold = 0.5) {
    const yt = extractData(yTrue);
    const yp = extractData(yPred);
    const n = yt.length;

    let tn = 0, fp = 0, fn = 0, tp = 0;
    for (let i = 0; i < n; i++) {
      const trueVal = yt[i] >= 0.5 ? 1 : 0;
      const predVal = yp[i] >= threshold ? 1 : 0;

      if (trueVal === 1 && predVal === 1) tp++;
      else if (trueVal === 0 && predVal === 0) tn++;
      else if (trueVal === 0 && predVal === 1) fp++;
      else if (trueVal === 1 && predVal === 0) fn++;
    }

    return {
      matrix: [[tn, fp], [fn, tp]],
      tn, fp, fn, tp
    };
  }

  /**
   * Precision, Recall, and F1 Score for binary classification.
   * @param {Matrix | number[]} yTrue
   * @param {Matrix | number[]} yPred
   * @param {number} [threshold=0.5]
   * @returns {{ precision: number, recall: number, f1: number }}
   */
  static precisionRecallF1(yTrue, yPred, threshold = 0.5) {
    const { tp, fp, fn } = Metrics.confusionMatrix(yTrue, yPred, threshold);

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0.0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0.0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0.0;

    return { precision, recall, f1 };
  }
}
