const crypto = require("crypto");
const { SeededPRNG } = require("../ml/ProceduralVariantEngine");
const { AuthoritativeValidator } = require("../security/AuthoritativeValidator");
const { auditLogger } = require("../security/AuditLogger");

/**
 * CustomChallengeEngine
 * Lightweight Mod-Tools & Creator-Driven Live-Service Engine.
 * 
 * Defines core challenge schemas, allowed function families, and constrained difficulty envelopes.
 */
class CustomChallengeEngine {
  constructor() {
    this.challenges = new Map();

    // Valid Function Families
    this.ALLOWED_FAMILIES = [
      "LINEAR_REGRESSION",
      "LOGISTIC_CLASSIFICATION",
      "POLYNOMIAL_REGRESSION",
      "DECISION_TREE_ENSEMBLE"
    ];

    // Official Move-Set Archetypes
    this.ALLOWED_MOVE_SETS = [
      "GRADIENT_AVALANCHE",
      "RESIDUAL_SHOCKWAVE",
      "MOMENTUM_SURGE",
      "SIGMOID_BREATH",
      "BCE_POISON_POOLS",
      "DUAL_HYPERPLANE_CLEAVE",
      "POLYNOMIAL_OSCILLATION",
      "BLIZZARD_OVERFIT",
      "LASSO_SPARSE_SHARDS",
      "GINI_BRANCH_CLEAVE",
      "ENSEMBLE_ROAR",
      "PRUNING_GALE"
    ];
  }

  /**
   * Analytical Solvability Prover matching Prompt 9 Procedural Generator
   * Computes closed-form OLS optimal inlier MSE for Linear Steppes and class separability.
   */
  _generateDatasetAndProof(functionFamily, params, prng) {
    const sampleCount = Number(params.sampleCount) || 30;
    const noiseSigma = Number(params.noiseSigma) || 0.10;
    const outlierRate = Number(params.outlierRate !== undefined ? params.outlierRate : 0.04);

    switch (functionFamily) {
      case "LINEAR_REGRESSION": {
        const slopeW = Number(params.slopeW !== undefined ? params.slopeW : prng.range(1.5, 3.2));
        const interceptB = Number(params.interceptB !== undefined ? params.interceptB : prng.range(-2.0, 2.0));

        const samples = [];
        for (let i = 0; i < sampleCount; i++) {
          const x = Number(prng.range(-4.0, 4.0).toFixed(3));
          const isOutlier = prng.next() < outlierRate;
          let y = slopeW * x + interceptB + prng.gaussian(0, noiseSigma * 2.0);
          if (isOutlier) {
            y += (prng.next() > 0.5 ? 1 : -1) * prng.range(5.0, 8.0);
          }
          samples.push({ id: i, x, y: Number(y.toFixed(3)), isOutlier });
        }

        const inliers = samples.filter(s => !s.isOutlier);
        if (inliers.length < 10) {
          return { solvability: { isSolvable: false, reason: "Insufficient inlier count for reliable mathematical regression." } };
        }

        const meanX = inliers.reduce((sum, s) => sum + s.x, 0) / inliers.length;
        const meanY = inliers.reduce((sum, s) => sum + s.y, 0) / inliers.length;

        let num = 0, den = 0;
        for (const s of inliers) {
          num += (s.x - meanX) * (s.y - meanY);
          den += Math.pow(s.x - meanX, 2);
        }

        if (Math.abs(den) < 0.05) {
          return { solvability: { isSolvable: false, reason: "Feature X distribution has degenerate variance (< 0.05)." } };
        }

        const optimalW = num / den;
        const optimalB = meanY - optimalW * meanX;

        let mse = 0;
        for (const s of inliers) {
          const pred = optimalW * s.x + optimalB;
          mse += Math.pow(pred - s.y, 2);
        }
        mse /= inliers.length;

        const maxMseThreshold = 0.05;
        const isSolvable = mse <= maxMseThreshold;

        return {
          dataset: samples,
          datasetParams: { slopeW, interceptB },
          solvability: {
            isSolvable,
            metric: "MSE",
            theoreticalMinMse: Number(mse.toFixed(4)),
            targetMseThreshold: Number((mse * 1.5).toFixed(4)),
            solvabilityCeiling: maxMseThreshold,
            optimalParameters: { w: Number(optimalW.toFixed(4)), b: Number(optimalB.toFixed(4)) },
            reason: isSolvable ? null : `Optimal inlier MSE (${mse.toFixed(4)}) exceeds mathematical solvability threshold (${maxMseThreshold.toFixed(4)}). Dataset is too noisy.`
          }
        };
      }

      case "LOGISTIC_CLASSIFICATION": {
        const boundaryShape = params.boundaryShape || "linear_hyperplane";
        const margin = Number(params.marginDistance || 0.50);
        const overlapRate = Number(params.overlapRate !== undefined ? params.overlapRate : 0.04);

        const samples = [];
        for (let i = 0; i < sampleCount; i++) {
          const x1 = Number(prng.range(-3.5, 3.5).toFixed(3));
          const x2 = Number(prng.range(-3.5, 3.5).toFixed(3));
          let rawScore = 0.8 * x1 + 0.6 * x2 - 0.2;
          if (boundaryShape === "circular_boundary") {
            rawScore = Math.sqrt(x1 * x1 + x2 * x2) - 2.0;
          }

          let classLabel = rawScore >= 0 ? 1 : 0;
          const isOverlap = prng.next() < overlapRate;
          if (isOverlap) classLabel = classLabel === 1 ? 0 : 1;

          samples.push({ id: i, x1, x2, classLabel, isOverlap });
        }

        const nonOverlap = samples.filter(s => !s.isOverlap);
        const theoreticalAccuracy = nonOverlap.length / samples.length;
        const targetAccuracyThreshold = 0.90;
        const isSolvable = theoreticalAccuracy >= targetAccuracyThreshold;

        return {
          dataset: samples,
          datasetParams: { boundaryShape, marginDistance: margin, overlapRate },
          solvability: {
            isSolvable,
            metric: "ACCURACY",
            theoreticalAccuracy: Number(theoreticalAccuracy.toFixed(4)),
            targetAccuracyThreshold,
            reason: isSolvable ? null : `Theoretical classification accuracy (${(theoreticalAccuracy * 100).toFixed(1)}%) is below the minimum required solvability bound of 90.0%.`
          }
        };
      }

      case "POLYNOMIAL_REGRESSION": {
        const polyDegree = params.polyDegree === 3 ? 3 : 2;
        const c0 = Number(params.c0 !== undefined ? params.c0 : 0.5);
        const c1 = Number(params.c1 !== undefined ? params.c1 : -1.2);
        const c2 = Number(params.c2 !== undefined ? params.c2 : 0.4);
        const c3 = polyDegree === 3 ? Number(params.c3 !== undefined ? params.c3 : -0.15) : 0;

        const samples = [];
        for (let i = 0; i < sampleCount; i++) {
          const x = Number(prng.range(-3.0, 3.0).toFixed(3));
          const noise = prng.gaussian(0, noiseSigma);
          const y = c0 + c1 * x + c2 * Math.pow(x, 2) + c3 * Math.pow(x, 3) + noise;
          samples.push({ id: i, x, y: Number(y.toFixed(3)) });
        }

        const isSolvable = noiseSigma <= 0.28;
        return {
          dataset: samples,
          datasetParams: { polyDegree, c0, c1, c2, c3 },
          solvability: {
            isSolvable,
            metric: "MSE",
            theoreticalMinMse: Number((noiseSigma * noiseSigma).toFixed(4)),
            targetMseThreshold: Number((noiseSigma * noiseSigma * 1.5).toFixed(4)),
            reason: isSolvable ? null : `Polynomial variance noise sigma (${noiseSigma.toFixed(3)}) exceeds polynomial solvability ceiling (0.280).`
          }
        };
      }

      case "DECISION_TREE_ENSEMBLE":
      default: {
        const splitThresholdX1 = Number(params.splitThresholdX1 !== undefined ? params.splitThresholdX1 : 0.0);
        const splitThresholdX2 = Number(params.splitThresholdX2 !== undefined ? params.splitThresholdX2 : 0.0);

        const samples = [];
        let class1Count = 0;
        for (let i = 0; i < sampleCount; i++) {
          const x1 = Number(prng.range(-3.0, 3.0).toFixed(3));
          const x2 = Number(prng.range(-3.0, 3.0).toFixed(3));
          const classLabel = (x1 > splitThresholdX1 && x2 > splitThresholdX2) ? 1 : 0;
          if (classLabel === 1) class1Count++;
          samples.push({ id: i, x1, x2, classLabel });
        }

        const ratio = class1Count / sampleCount;
        const isSolvable = ratio >= 0.15 && ratio <= 0.85;

        return {
          dataset: samples,
          datasetParams: { splitThresholdX1, splitThresholdX2 },
          solvability: {
            isSolvable,
            metric: "GINI",
            theoreticalPurity: 0.95,
            splitBalanceRatio: Number(ratio.toFixed(3)),
            reason: isSolvable ? null : `Decision boundary is heavily skewed (${(ratio * 100).toFixed(1)}% class 1).`
          }
        };
      }
    }
  }
}

module.exports = {
  CustomChallengeEngine
};
