/**
 * ActiveUncertaintySampler.js
 * Active learning uncertainty sampling engine for boundary crystal exploration.
 * Evaluates Shannon Entropy, Margin Sampling, and Least Confidence metrics
 * over neural predictions to guide agents towards maximally informative training samples.
 */

'use strict';

class ActiveUncertaintySampler {
  constructor(options = {}) {
    this.entropyThreshold = options.entropyThreshold || 0.65; // High uncertainty boundary
    this.marginThreshold = options.marginThreshold || 0.20;   // Narrow decision boundary
  }

  /**
   * Computes normalized Shannon Entropy over a probability distribution.
   * H(p) = -sum(p_i * ln(p_i)) / ln(K)
   * @param {number[]} probabilities - Array of probabilities summing to ~1.0
   * @returns {number} Normalized entropy in [0, 1]
   */
  computeShannonEntropy(probabilities) {
    if (!probabilities || probabilities.length <= 1) return 0;

    const k = probabilities.length;
    let entropy = 0;

    for (let i = 0; i < k; i++) {
      const p = Math.max(1e-12, Math.min(1.0, probabilities[i]));
      entropy -= p * Math.log(p);
    }

    const maxEntropy = Math.log(k);
    return Math.max(0, Math.min(1.0, entropy / maxEntropy));
  }

  /**
   * Computes Decision Margin: 1.0 - (p_first - p_second)
   * Closer to 1.0 means extremely ambiguous / ambiguous decision boundary.
   * @param {number[]} probabilities
   * @returns {number} Margin uncertainty in [0, 1]
   */
  computeMarginUncertainty(probabilities) {
    if (!probabilities || probabilities.length < 2) return 0;

    const sorted = [...probabilities].sort((a, b) => b - a);
    const margin = sorted[0] - sorted[1];
    return Math.max(0, Math.min(1.0, 1.0 - margin));
  }

  /**
   * Computes Least Confidence score: (K / (K - 1)) * (1.0 - max(p))
   * @param {number[]} probabilities
   * @returns {number}
   */
  computeLeastConfidence(probabilities) {
    if (!probabilities || probabilities.length <= 1) return 0;

    const k = probabilities.length;
    const maxP = Math.max(...probabilities);
    return Math.max(0, Math.min(1.0, (k / (k - 1)) * (1.0 - maxP)));
  }

  /**
   * Assesses a point in arena space with model predictions.
   * @param {{ x: number, y: number }} position
   * @param {number[]} probabilities
   * @returns {{
   *   position: {x: number, y: number},
   *   entropy: number,
   *   marginUncertainty: number,
   *   leastConfidence: number,
   *   compositeScore: number,
   *   isHighValueCandidate: boolean
   * }}
   */
  evaluateCandidate(position, probabilities) {
    const entropy = this.computeShannonEntropy(probabilities);
    const margin = this.computeMarginUncertainty(probabilities);
    const leastConf = this.computeLeastConfidence(probabilities);

    // Composite active learning priority score
    const compositeScore = (entropy * 0.45) + (margin * 0.35) + (leastConf * 0.20);
    const isHighValue = (entropy >= this.entropyThreshold) || (margin >= (1.0 - this.marginThreshold));

    return {
      position,
      entropy: parseFloat(entropy.toFixed(4)),
      marginUncertainty: parseFloat(margin.toFixed(4)),
      leastConfidence: parseFloat(leastConf.toFixed(4)),
      compositeScore: parseFloat(compositeScore.toFixed(4)),
      isHighValueCandidate: isHighValue
    };
  }

  /**
   * Ranks an array of candidates by active learning information gain.
   */
  rankCandidates(candidates) {
    return [...candidates].sort((a, b) => b.compositeScore - a.compositeScore);
  }
}

module.exports = {
  ActiveUncertaintySampler
};
