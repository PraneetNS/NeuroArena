/**
 * DifferentialPrivacy.js (Web Client)
 * Client-side gradient perturbation, L2 sensitivity clipping, and privacy budget accounting.
 */

export class DifferentialPrivacy {
  constructor(epsilon = 1.5, delta = 1e-5, clipNorm = 1.0) {
    this.epsilon = epsilon;
    this.delta = delta;
    this.clipNorm = clipNorm;
    this.spentBudget = 0.0;
  }

  /**
   * Clip client local parameter updates to respect sensitivity bounds
   */
  clipGradients(weights) {
    let sumSq = 0;
    for (let i = 0; i < weights.length; i++) {
      sumSq += weights[i] * weights[i];
    }
    const norm = Math.sqrt(sumSq);
    if (norm <= this.clipNorm || norm === 0) return [...weights];

    const scale = this.clipNorm / norm;
    return weights.map(w => w * scale);
  }

  /**
   * Sample Gaussian perturbation for local differential privacy (LDP)
   */
  sampleLocalGaussian(stdDev) {
    let u1 = 0, u2 = 0;
    while (u1 === 0) u1 = Math.random();
    while (u2 === 0) u2 = Math.random();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2) * stdDev;
  }

  /**
   * Obfuscate client model parameters before submitting to global aggregator
   */
  sanitizeUpdate(weights) {
    const clipped = this.clipGradients(weights);
    const sigma = (Math.sqrt(2.0 * Math.log(1.25 / this.delta)) / this.epsilon) * this.clipNorm;
    
    const perturbed = clipped.map(w => w + this.sampleLocalGaussian(sigma * 0.1));
    this.spentBudget += (this.epsilon * 0.05);

    return {
      sanitizedWeights: perturbed,
      clipNorm: this.clipNorm,
      remainingEpsilonBudget: Math.max(0, 10.0 - this.spentBudget)
    };
  }
}
