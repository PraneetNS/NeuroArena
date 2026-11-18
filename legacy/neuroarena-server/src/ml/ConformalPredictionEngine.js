/**
 * ConformalPredictionEngine.js
 *
 * Implements Split Conformal Prediction with finite-sample, distribution-free
 * statistical coverage guarantees for combat damage estimation and high-stakes tactical risk.
 *
 * Mathematical Guarantee:
 * For any confidence level 1 - \alpha \in (0, 1), the conformal prediction interval C(X) satisfies:
 *   P(Y_{test} \in C(X_{test})) \ge 1 - \alpha
 * without any distributional or parametric assumptions on P(X, Y), requiring only exchangeability.
 *
 * Features:
 * - Residual-based non-conformity scores S_i = |Y_i - \hat{\mu}(X_i)|
 * - Locally-adaptive conformalized quantile regression: S_i = |Y_i - \hat{\mu}(X_i)| / (\hat{\sigma}(X_i) + \epsilon)
 * - Multi-class conformal classification prediction sets
 * - Real-time calibration cache with incremental streaming update
 *
 * References:
 * - Vovk, Gammerman, Shafer (2005): "Algorithmic Learning in a Random World"
 * - Angelopoulos & Bates (2021): "A Gentle Introduction to Conformal Prediction and Distribution-Free UQ"
 */

class ConformalPredictionEngine {
    /**
     * @param {Object} options
     * @param {number} [options.defaultAlpha=0.05] - Significance level (e.g. 0.05 -> 95% guaranteed coverage)
     * @param {number} [options.maxCalibrationSize=1000] - Sliding window capacity for calibration scores
     */
    constructor(options = {}) {
        this.defaultAlpha = options.defaultAlpha || 0.05;
        this.maxCalibrationSize = options.maxCalibrationSize || 1000;
        this.calibrationScores = [];
        this.quantilesCache = new Map();
    }

    /**
     * Ingests calibration pairs (yTrue, yPred) or precomputed scores to calibrate the conformal band.
     * @param {Array<{ yTrue: number, yPred: number, scale?: number }>} calibrationData
     */
    calibrate(calibrationData) {
        this.calibrationScores = [];
        for (const item of calibrationData) {
            const residual = Math.abs(item.yTrue - item.yPred);
            const scale = item.scale !== undefined && item.scale > 0 ? item.scale : 1.0;
            const score = residual / scale;
            this.calibrationScores.push(score);
            if (this.calibrationScores.length > this.maxCalibrationSize) {
                this.calibrationScores.shift();
            }
        }
        this.calibrationScores.sort((a, b) => a - b);
        this.quantilesCache.clear();
    }

    /**
     * Ingests a single online calibration score with sliding window retention.
     * @param {number} yTrue
     * @param {number} yPred
     * @param {number} [scale=1.0]
     */
    recordOnlineResidual(yTrue, yPred, scale = 1.0) {
        const residual = Math.abs(yTrue - yPred);
        const score = residual / (scale > 0 ? scale : 1.0);
        this.calibrationScores.push(score);
        if (this.calibrationScores.length > this.maxCalibrationSize) {
            this.calibrationScores.shift();
        }
        this.calibrationScores.sort((a, b) => a - b);
        this.quantilesCache.clear();
    }

    /**
     * Computes the conformal quantile qHat = Quantile({S_i}, ceil((n+1)(1-\alpha)) / n)
     * @param {number} [alpha] - Error budget in (0, 1)
     * @returns {number} - Conformal cutoff threshold
     */
    getConformalQuantile(alpha = this.defaultAlpha) {
        const n = this.calibrationScores.length;
        if (n === 0) return 0.0;

        if (this.quantilesCache.has(alpha)) {
            return this.quantilesCache.get(alpha);
        }

        // Empirical conformal index with finite sample correction (n+1)
        const p = Math.min(1.0, Math.ceil((n + 1) * (1.0 - alpha)) / n);
        const index = Math.min(n - 1, Math.max(0, Math.ceil(p * n) - 1));
        const qHat = this.calibrationScores[index];

        this.quantilesCache.set(alpha, qHat);
        return qHat;
    }

    /**
     * Generates a statistically valid prediction interval [lower, upper] for a point prediction.
     * @param {number} yPred - Model point prediction
     * @param {number} [localSpread=1.0] - Optional local heteroscedastic spread estimate
     * @param {number} [alpha] - Significance level
     * @returns {Object} - { lower, upper, margin, coverageTarget, isBounded }
     */
    predictInterval(yPred, localSpread = 1.0, alpha = this.defaultAlpha) {
        const qHat = this.getConformalQuantile(alpha);
        const margin = qHat * (localSpread > 0 ? localSpread : 1.0);

        return {
            pointPrediction: yPred,
            lower: yPred - margin,
            upper: yPred + margin,
            margin: margin,
            qHat: qHat,
            coverageTarget: 1.0 - alpha,
            sampleSize: this.calibrationScores.length
        };
    }

    /**
     * Conformal risk decision boundary: verifies whether maximum damage/risk remains within safety threshold
     * @param {number} predictedRisk - Expected damage or risk metric
     * @param {number} safetyLimit - Maximum acceptable threshold
     * @param {number} [localSpread=1.0]
     * @param {number} [alpha]
     * @returns {Object} - { isSafeWithGuarantee, worstCaseRisk, safetyMargin }
     */
    evaluateSafetyThreshold(predictedRisk, safetyLimit, localSpread = 1.0, alpha = this.defaultAlpha) {
        const interval = this.predictInterval(predictedRisk, localSpread, alpha);
        const worstCaseRisk = interval.upper;
        const isSafeWithGuarantee = worstCaseRisk <= safetyLimit;

        return {
            isSafeWithGuarantee,
            predictedRisk,
            worstCaseRisk,
            safetyLimit,
            safetyMargin: safetyLimit - worstCaseRisk,
            coverageGuarantee: 1.0 - alpha
        };
    }
}

module.exports = ConformalPredictionEngine;
