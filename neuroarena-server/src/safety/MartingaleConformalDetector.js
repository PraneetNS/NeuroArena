/**
 * MartingaleConformalDetector.js
 *
 * Implements Online Conformal Martingales for non-exchangeable distribution shift
 * and real-time adversarial cheat/telemetry anomaly detection.
 *
 * Mathematical Foundations:
 * Given a streaming sequence of non-conformity scores \alpha_1, \alpha_2, \dots,
 * conformal p-values u_t are computed online against a calibration history:
 *   u_t = \frac{1}{|C_t| + 1} ( 1 + \sum_{i \in C_t} \mathbf{1}_{\alpha_i \ge \alpha_t} )
 *
 * Under the null hypothesis of exchangeability (IID benign gameplay), u_t \sim Uniform(0, 1).
 * The testing betting martingale accumulates evidence:
 *   M_n = \prod_{t=1}^n f(u_t), \quad f(u) = \epsilon u^{\epsilon - 1} \quad (0 < \epsilon < 1)
 *
 * Ville's Maximal Inequality guarantees strict, non-asymptotic type-I error control:
 *   \mathbb{P}\left( \sup_{n \ge 1} M_n \ge \lambda \right) \le \frac{1}{\lambda}
 *
 * References:
 * - Vovk, Gammerman, Shafer (Springer 2005): "Algorithmic Learning in a Random World"
 * - Ramdas et al. (Statist. Sci. 2023): "Game-theoretic statistics and safe anytime-valid inference"
 */

class MartingaleConformalDetector {
    /**
     * @param {Object} options
     * @param {number} [options.threshold=100.0] - Critical alert wealth \lambda (p <= 1/100 = 0.01)
     * @param {number} [options.epsilon=0.7] - Betting power exponent
     * @param {number} [options.windowSize=200] - Sliding reference score buffer
     */
    constructor(options = {}) {
        this.threshold = options.threshold || 100.0;
        this.epsilon = options.epsilon || 0.7;
        this.windowSize = options.windowSize || 200;

        this.referenceScores = [];
        this.wealth = 1.0;
        this.alertTriggered = false;
        this.history = [];
    }

    /**
     * Seed initial calibration scores from benign verified sessions
     * @param {Array<number>} scores
     */
    seedCalibration(scores) {
        this.referenceScores = scores.slice(-this.windowSize);
    }

    /**
     * Computes smoothed conformal p-value for new test score
     * @param {number} score Non-conformity score
     * @returns {number} Conformal p-value in (0, 1)
     */
    computePValue(score) {
        if (this.referenceScores.length === 0) return 0.5;

        let greaterOrEqual = 0;
        const n = this.referenceScores.length;
        for (let i = 0; i < n; i++) {
            if (this.referenceScores[i] >= score) {
                greaterOrEqual++;
            }
        }

        // Smoothed p-value with tie-breaking
        const pValue = (greaterOrEqual + Math.random()) / (n + 1);
        return Math.max(0.0001, Math.min(0.9999, pValue));
    }

    /**
     * Ingests a new telemetry sample score and updates the testing martingale
     * @param {number} score
     * @returns {{ wealth: number, pValue: number, isAnomaly: boolean }}
     */
    update(score) {
        const pValue = this.computePValue(score);

        // Power martingale multiplier
        const factor = this.epsilon * Math.pow(pValue, this.epsilon - 1.0);
        this.wealth *= factor;

        if (this.wealth >= this.threshold) {
            this.alertTriggered = true;
        }

        // Add to reference window to adapt to legitimate gradual shift
        this.referenceScores.push(score);
        if (this.referenceScores.length > this.windowSize) {
            this.referenceScores.shift();
        }

        this.history.push({ score, pValue, wealth: this.wealth });
        if (this.history.length > 500) this.history.shift();

        return {
            wealth: this.wealth,
            pValue,
            isAnomaly: this.alertTriggered
        };
    }

    reset() {
        this.wealth = 1.0;
        this.alertTriggered = false;
    }
}

module.exports = MartingaleConformalDetector;
