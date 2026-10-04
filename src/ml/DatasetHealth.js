/**
 * @file DatasetHealth.js
 * @description Computes empirical Dataset Health Score:
 * Health = 0.35 * Balance + 0.35 * Cleanliness + 0.30 * Coverage
 *
 * Balance = 1 - |ratio0 - ratio1| (classification) or residual symmetry around median (regression).
 * Cleanliness = clamp(1 - 3.5 * (outliers / N)), where outliers are identified via robust Median / MAD z-scores.
 * Coverage = (observed span / target domain span) blended with sample partition density.
 *
 * Returns all mathematical constituent metrics, not just the composite scalar.
 */

import { Matrix } from './Matrix.js';

const NUM_PARTITIONS = 6;
const MODIFIED_Z_OUTLIER_THRESHOLD = 3.5;
const EPSILON = 1e-9;

/**
 * Computes median of a numerical array.
 * @param {number[] | Float64Array} values
 * @returns {number}
 */
function computeMedian(values) {
  const sorted = Array.from(values).sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2.0;
}

export class DatasetHealth {
  /**
   * Evaluates the health score of a dataset.
   *
   * @param {Object} params
   * @param {Matrix | number[][]} params.X - Feature matrix (N x D)
   * @param {Matrix | number[] | number[][]} params.y - Target matrix or vector (N x 1)
   * @param {number[]} [params.targetDomain=[-5.0, 5.0]] - Expected domain bounds
   * @returns {{
   *   totalHealth: number,
   *   balance: number,
   *   cleanliness: number,
   *   coverage: number,
   *   outlierCount: number,
   *   outlierIndices: number[],
   *   modifiedZScores: Float64Array,
   *   median: number,
   *   mad: number,
   *   observedSpan: number,
   *   targetSpan: number,
   *   isClassification: boolean,
   *   summary: string
   * }}
   */
  static evaluate({ X, y, targetDomain = [-5.0, 5.0] }) {
    const xMat = X instanceof Matrix ? X : Matrix.from2D(X);
    const yMat = y instanceof Matrix ? y : (Array.isArray(y[0]) ? Matrix.from2D(y) : new Matrix(y.length, 1, y));

    const N = xMat.rows;
    if (N === 0) {
      throw new Error('[DatasetHealth] Dataset must contain at least 1 sample.');
    }

    // 1. Detect if target is binary classification or regression
    let isClassification = true;
    for (let i = 0; i < N; i++) {
      const val = yMat.get(i, 0);
      if (Math.abs(val - 0.0) > 0.05 && Math.abs(val - 1.0) > 0.05) {
        isClassification = false;
        break;
      }
    }

    // =========================================================================
    // 2. BALANCE COMPONENT (0.35 WEIGHT)
    // =========================================================================
    let balance = 1.0;
    if (isClassification) {
      let count0 = 0;
      let count1 = 0;
      for (let i = 0; i < N; i++) {
        if (yMat.get(i, 0) < 0.5) count0++;
        else count1++;
      }
      const ratio0 = count0 / N;
      const ratio1 = count1 / N;
      balance = Math.max(0.0, 1.0 - Math.abs(ratio0 - ratio1));
    } else {
      // Regression: residual / target symmetry around median
      const yVals = new Float64Array(N);
      for (let i = 0; i < N; i++) yVals[i] = yMat.get(i, 0);
      const medianY = computeMedian(yVals);

      let above = 0;
      let below = 0;
      for (let i = 0; i < N; i++) {
        if (yVals[i] >= medianY) above++;
        else below++;
      }
      const ratioAbove = above / N;
      const ratioBelow = below / N;
      balance = Math.max(0.0, 1.0 - Math.abs(ratioAbove - ratioBelow) * 2.0);
    }

    // =========================================================================
    // 3. CLEANLINESS COMPONENT (0.35 WEIGHT) - ROBUST MEDIAN / MAD Z-SCORE
    // =========================================================================
    const sampleValues = new Float64Array(N);
    // Use target values for 1D or primary variation
    for (let i = 0; i < N; i++) {
      sampleValues[i] = yMat.get(i, 0);
    }

    const median = computeMedian(sampleValues);
    const absDeviations = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      absDeviations[i] = Math.abs(sampleValues[i] - median);
    }
    const mad = computeMedian(absDeviations);

    const modifiedZScores = new Float64Array(N);
    const outlierIndices = [];

    // Scale factor 0.6745 relates MAD to standard deviation for normal distributions
    const madDivisor = mad > EPSILON ? mad : EPSILON;
    for (let i = 0; i < N; i++) {
      const modZ = (0.6745 * absDeviations[i]) / madDivisor;
      modifiedZScores[i] = modZ;
      if (modZ > MODIFIED_Z_OUTLIER_THRESHOLD) {
        outlierIndices.push(i);
      }
    }

    const outlierCount = outlierIndices.length;
    const outlierFraction = outlierCount / N;
    // Cleanliness = clamp(1 - 3.5 * (outliers / N), 0, 1)
    const cleanliness = Math.max(0.0, Math.min(1.0, 1.0 - 3.5 * outlierFraction));

    // =========================================================================
    // 4. COVERAGE COMPONENT (0.30 WEIGHT)
    // =========================================================================
    // Find min and max across primary feature axis
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < N; i++) {
      const xVal = xMat.get(i, 0);
      if (xVal < minX) minX = xVal;
      if (xVal > maxX) maxX = xVal;
    }

    const observedSpan = Math.max(0.0, maxX - minX);
    const targetSpan = Math.max(EPSILON, targetDomain[1] - targetDomain[0]);
    const spanRatio = Math.min(1.0, observedSpan / targetSpan);

    // Spatial partition bin occupancy
    const bucketCounts = new Uint32Array(NUM_PARTITIONS);
    for (let i = 0; i < N; i++) {
      const xVal = xMat.get(i, 0);
      const normalized01 = (xVal - targetDomain[0]) / targetSpan;
      const bIdx = Math.max(0, Math.min(NUM_PARTITIONS - 1, Math.floor(normalized01 * NUM_PARTITIONS)));
      bucketCounts[bIdx]++;
    }

    let occupiedBuckets = 0;
    for (let b = 0; b < NUM_PARTITIONS; b++) {
      if (bucketCounts[b] > 0) occupiedBuckets++;
    }
    const densityRatio = occupiedBuckets / NUM_PARTITIONS;

    // Blend observed span (60%) with partition density (40%)
    const coverage = 0.60 * spanRatio + 0.40 * densityRatio;

    // =========================================================================
    // 5. COMPOSITE TOTAL HEALTH SCORE
    // =========================================================================
    const totalHealth = 0.35 * balance + 0.35 * cleanliness + 0.30 * coverage;

    // Diagnostic summary
    let summary = 'High Generalization Expected (>85%)';
    if (totalHealth < 0.50) {
      summary = 'Severe Generalization Failure Predicted (<50%)';
    } else if (totalHealth < 0.75) {
      summary = 'Sub-optimal Training Distribution (50-75%)';
    }

    return {
      totalHealth: parseFloat(totalHealth.toFixed(4)),
      balance: parseFloat(balance.toFixed(4)),
      cleanliness: parseFloat(cleanliness.toFixed(4)),
      coverage: parseFloat(coverage.toFixed(4)),
      outlierCount,
      outlierIndices,
      modifiedZScores,
      median: parseFloat(median.toFixed(3)),
      mad: parseFloat(mad.toFixed(3)),
      observedSpan: parseFloat(observedSpan.toFixed(3)),
      targetSpan: parseFloat(targetSpan.toFixed(3)),
      isClassification,
      summary
    };
  }
}
