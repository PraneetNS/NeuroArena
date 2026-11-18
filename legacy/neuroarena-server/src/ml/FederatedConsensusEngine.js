/**
 * FederatedConsensusEngine.js
 * Federated Learning (FedAvg) consensus engine with differential privacy noise injection,
 * L2 gradient clipping, and Byzantine-robust aggregation.
 */

class FederatedConsensusEngine {
  constructor(options = {}) {
    this.clipNorm = options.clipNorm || 1.0;
    this.epsilon = options.epsilon || 2.0;
    this.delta = options.delta || 1e-5;
    this.byzantineThreshold = options.byzantineThreshold || 2.5; // max allowed standard deviations
    this.globalWeights = options.initialWeights ? [...options.initialWeights] : [0, 0, 0];
    this.round = 0;
  }

  /**
   * Clip L2 norm of gradient or delta vector to max C
   */
  clipL2(deltaVector, maxNorm = this.clipNorm) {
    let sumSq = 0;
    for (let i = 0; i < deltaVector.length; i++) {
      sumSq += deltaVector[i] * deltaVector[i];
    }
    const norm = Math.sqrt(sumSq);
    if (norm <= maxNorm || norm === 0) return [...deltaVector];

    const scale = maxNorm / norm;
    return deltaVector.map(v => v * scale);
  }

  /**
   * Sample Gaussian noise using Box-Muller transform
   */
  sampleGaussian(mean = 0, stdDev = 1) {
    let u1 = 0, u2 = 0;
    while (u1 === 0) u1 = Math.random();
    while (u2 === 0) u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z0 * stdDev + mean;
  }

  /**
   * Compute DP noise scale sigma = (sqrt(2*ln(1.25/delta)) / epsilon) * C
   */
  computeNoiseSigma() {
    return (Math.sqrt(2.0 * Math.log(1.25 / this.delta)) / this.epsilon) * this.clipNorm;
  }

  /**
   * Filter out adversarial / poisoned gradient updates
   */
  filterByzantineUpdates(clientUpdates) {
    if (clientUpdates.length <= 2) return clientUpdates;

    const numWeights = clientUpdates[0].weights.length;
    // Compute median of each coordinate
    const median = new Array(numWeights).fill(0);
    for (let i = 0; i < numWeights; i++) {
      const vals = clientUpdates.map(u => u.weights[i]).sort((a, b) => a - b);
      median[i] = vals[Math.floor(vals.length / 2)];
    }

    // Compute distance from median
    const scored = clientUpdates.map(u => {
      let distSq = 0;
      u.weights.forEach((w, i) => distSq += (w - median[i]) ** 2);
      return { update: u, dist: Math.sqrt(distSq) };
    });

    const dists = scored.map(s => s.dist).sort((a, b) => a - b);
    const medianDist = dists[Math.floor(dists.length / 2)];
    const mad = dists.map(d => Math.abs(d - medianDist)).sort((a, b) => a - b)[Math.floor(dists.length / 2)] || 1e-4;

    // Reject updates with distance > medianDist + 3.0 * (1.4826 * mad)
    const cutoff = medianDist + (this.byzantineThreshold * 1.4826 * mad);
    return scored
      .filter(s => s.dist <= cutoff)
      .map(s => s.update);
  }

  /**
   * Aggregate client updates into new global model
   */
  aggregateRound(clientUpdates, addDPNoise = true) {
    if (!clientUpdates || clientUpdates.length === 0) return this.globalWeights;

    const validUpdates = this.filterByzantineUpdates(clientUpdates);
    const numParams = this.globalWeights.length;
    const aggregatedDeltas = new Array(numParams).fill(0);

    let totalSamples = 0;
    validUpdates.forEach(u => {
      totalSamples += (u.numSamples || 1);
    });

    validUpdates.forEach(u => {
      const weight = (u.numSamples || 1) / totalSamples;
      const clipped = this.clipL2(u.weights);
      for (let i = 0; i < numParams; i++) {
        aggregatedDeltas[i] += (clipped[i] - this.globalWeights[i]) * weight;
      }
    });

    const sigma = this.computeNoiseSigma() / Math.sqrt(validUpdates.length);

    for (let i = 0; i < numParams; i++) {
      let noise = addDPNoise ? this.sampleGaussian(0, sigma) : 0;
      this.globalWeights[i] += aggregatedDeltas[i] + noise;
    }

    this.round++;
    return {
      round: this.round,
      globalWeights: [...this.globalWeights],
      participatingClients: validUpdates.length,
      rejectedClients: clientUpdates.length - validUpdates.length,
      dpSigma: sigma
    };
  }
}

module.exports = { FederatedConsensusEngine };
