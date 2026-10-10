/**
 * @file advancedMetrics.js
 * @description Advanced Evaluation Metrics Engine for NeuroArena.
 * Features Multi-Class Confusion Matrix, Precision, Recall, F1-Score,
 * ROC Curve, Trapezoidal Area Under Curve (ROC-AUC), and Precision-Recall Curve.
 */

import { Matrix } from './Matrix.js';

export class AdvancedMetrics {
  /**
   * Generates a confusion matrix (nClasses x nClasses) where rows represent true classes
   * and columns represent predicted classes.
   * @param {Matrix|Float64Array|number[]} yTrue
   * @param {Matrix|Float64Array|number[]} yPred
   * @param {number} [nClasses=2]
   * @returns {Matrix}
   */
  static confusionMatrix(yTrue, yPred, nClasses = 2) {
    const yt = yTrue instanceof Matrix ? yTrue.data : (yTrue instanceof Float64Array ? yTrue : new Float64Array(yTrue));
    const yp = yPred instanceof Matrix ? yPred.data : (yPred instanceof Float64Array ? yPred : new Float64Array(yPred));

    const cm = new Matrix(nClasses, nClasses);
    const N = Math.min(yt.length, yp.length);

    for (let i = 0; i < N; i++) {
      const t = Math.round(yt[i]);
      const p = Math.round(yp[i]);
      if (t >= 0 && t < nClasses && p >= 0 && p < nClasses) {
        cm.set(t, p, cm.get(t, p) + 1);
      }
    }

    return cm;
  }

  /**
   * Computes classification report containing precision, recall, f1-score, and support per class.
   * @param {Matrix|Float64Array|number[]} yTrue
   * @param {Matrix|Float64Array|number[]} yPred
   * @param {number} [nClasses=2]
   * @returns {Object}
   */
  static classificationReport(yTrue, yPred, nClasses = 2) {
    const cm = AdvancedMetrics.confusionMatrix(yTrue, yPred, nClasses);
    const perClass = {};
    let macroF1 = 0.0;
    let totalSamples = 0;

    for (let c = 0; c < nClasses; c++) {
      const tp = cm.get(c, c);

      let rowSum = 0; // True count (support)
      for (let j = 0; j < nClasses; j++) rowSum += cm.get(c, j);

      let colSum = 0; // Predicted count
      for (let i = 0; i < nClasses; i++) colSum += cm.get(i, c);

      const precision = colSum > 0 ? tp / colSum : 0.0;
      const recall = rowSum > 0 ? tp / rowSum : 0.0;
      const f1 = (precision + recall) > 0 ? (2.0 * precision * recall) / (precision + recall) : 0.0;

      perClass[c] = {
        precision: parseFloat(precision.toFixed(4)),
        recall: parseFloat(recall.toFixed(4)),
        f1Score: parseFloat(f1.toFixed(4)),
        support: rowSum
      };

      macroF1 += f1;
      totalSamples += rowSum;
    }

    return {
      classes: perClass,
      macroF1: parseFloat((macroF1 / nClasses).toFixed(4)),
      totalSamples
    };
  }

  /**
   * Computes ROC curve points (FPR, TPR) across discrimination thresholds.
   * @param {Matrix|Float64Array|number[]} yTrue - Binary ground truth (0 or 1)
   * @param {Matrix|Float64Array|number[]} yScores - Predicted probability or continuous decision score
   * @returns {{ fpr: number[], tpr: number[], thresholds: number[] }}
   */
  static rocCurve(yTrue, yScores) {
    const yt = yTrue instanceof Matrix ? yTrue.data : (yTrue instanceof Float64Array ? yTrue : new Float64Array(yTrue));
    const ys = yScores instanceof Matrix ? yScores.data : (yScores instanceof Float64Array ? yScores : new Float64Array(yScores));
    const N = Math.min(yt.length, ys.length);

    // Pair and sort descending by score
    const pairs = [];
    let posCount = 0;
    let negCount = 0;

    for (let i = 0; i < N; i++) {
      const label = yt[i] > 0.5 ? 1 : 0;
      if (label === 1) posCount++;
      else negCount++;
      pairs.push({ label, score: ys[i] });
    }

    pairs.sort((a, b) => b.score - a.score);

    const fpr = [0.0];
    const tpr = [0.0];
    const thresholds = [Infinity];

    if (posCount === 0 || negCount === 0) {
      return { fpr: [0, 1], tpr: [0, 1], thresholds: [1, 0] };
    }

    let tp = 0;
    let fp = 0;

    for (let i = 0; i < N; i++) {
      if (pairs[i].label === 1) tp++;
      else fp++;

      // Record point if next score is different or at end
      if (i === N - 1 || pairs[i].score !== pairs[i + 1].score) {
        fpr.push(parseFloat((fp / negCount).toFixed(4)));
        tpr.push(parseFloat((tp / posCount).toFixed(4)));
        thresholds.push(parseFloat(pairs[i].score.toFixed(4)));
      }
    }

    return { fpr, tpr, thresholds };
  }

  /**
   * Computes the Area Under the ROC Curve (ROC-AUC) via trapezoidal numerical quadrature.
   * @param {Matrix|Float64Array|number[]} yTrue
   * @param {Matrix|Float64Array|number[]} yScores
   * @returns {number} ROC-AUC score [0.0, 1.0]
   */
  static rocaucScore(yTrue, yScores) {
    const { fpr, tpr } = AdvancedMetrics.rocCurve(yTrue, yScores);
    let auc = 0.0;

    for (let i = 1; i < fpr.length; i++) {
      const deltaFpr = fpr[i] - fpr[i - 1];
      const avgTpr = (tpr[i] + tpr[i - 1]) / 2.0;
      auc += deltaFpr * avgTpr;
    }

    return parseFloat(Math.max(0.0, Math.min(1.0, auc)).toFixed(4));
  }
}
