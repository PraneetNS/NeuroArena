/**
 * CurriculumTransferCoordinator.js
 * Server-authoritative cross-biome curriculum progression and transfer learning engine.
 * Computes feature domain shift, Wasserstein distance, Maximum Mean Discrepancy (MMD),
 * and layer freezing recommendations to prevent negative transfer.
 */

'use strict';

class CurriculumTransferCoordinator {
  constructor(options = {}) {
    this.mmdWeight = options.mmdWeight || 0.05;
    this.negativeTransferThreshold = options.negativeTransferThreshold || 0.35;

    // Biome taxonomy & domain dimensions
    this.biomes = [
      { id: 0, name: 'Linear Steppes', difficulty: 1.0, featureDim: 4 },
      { id: 1, name: 'Binary Marshlands', difficulty: 1.5, featureDim: 8 },
      { id: 2, name: 'Variance Tundra', difficulty: 2.2, featureDim: 12 },
      { id: 3, name: 'Branching Canopy', difficulty: 3.0, featureDim: 16 },
      { id: 4, name: 'Deep Synapse Citadel', difficulty: 4.2, featureDim: 24 },
      { id: 5, name: 'Semantic Expanse', difficulty: 5.5, featureDim: 32 }
    ];

    // Historical student transfer tracking: Map<agentId, TransferRecord>
    this.agentRecords = new Map();
  }

  /**
   * Approximates 1-Wasserstein (Earth Mover's) distance between two 1D empirical feature distributions.
   * @param {number[]} distA - Sorted distribution A
   * @param {number[]} distB - Sorted distribution B
   * @returns {number}
   */
  computeWassersteinDistance(distA, distB) {
    if (!distA || !distB || distA.length === 0 || distB.length === 0) return 0;

    const sortedA = [...distA].sort((a, b) => a - b);
    const sortedB = [...distB].sort((a, b) => a - b);

    const len = Math.min(sortedA.length, sortedB.length);
    let cumulativeWork = 0;

    for (let i = 0; i < len; i++) {
      cumulativeWork += Math.abs(sortedA[i] - sortedB[i]);
    }

    return cumulativeWork / len;
  }

  /**
   * Computes empirical Maximum Mean Discrepancy (MMD) with a Gaussian RBF kernel proxy.
   * @param {number[]} sourceFeatures
   * @param {number[]} targetFeatures
   * @param {number} gamma
   * @returns {number}
   */
  computeMMD(sourceFeatures, targetFeatures, gamma = 1.0) {
    if (!sourceFeatures || !targetFeatures || sourceFeatures.length === 0 || targetFeatures.length === 0) {
      return 0;
    }

    const n = Math.min(sourceFeatures.length, targetFeatures.length);
    let diffSum = 0;

    for (let i = 0; i < n; i++) {
      const d = sourceFeatures[i] - targetFeatures[i];
      diffSum += Math.exp(-gamma * (d * d));
    }

    const kernelSimilarity = diffSum / n;
    // Discrepancy is inversely proportional to kernel overlap
    return Math.max(0, 1.0 - kernelSimilarity);
  }

  /**
   * Evaluates transferability between source biome and target biome for an agent.
   * @param {number} sourceBiomeId
   * @param {number} targetBiomeId
   * @param {number[]} [sourceSampleFeatures]
   * @param {number[]} [targetSampleFeatures]
   * @returns {{
   *   sourceBiome: string,
   *   targetBiome: string,
   *   transferabilityScore: number,
   *   wassersteinDist: number,
   *   mmdScore: number,
   *   isRecommended: boolean,
   *   negativeTransferRisk: 'LOW'|'MEDIUM'|'HIGH',
   *   recommendedFrozenLayers: number,
   *   distillationAlpha: number
   * }}
   */
  evaluateTransfer(sourceBiomeId, targetBiomeId, sourceSampleFeatures = [], targetSampleFeatures = []) {
    const sId = Math.max(0, Math.min(5, sourceBiomeId));
    const tId = Math.max(0, Math.min(5, targetBiomeId));

    const sourceBiome = this.biomes[sId];
    const targetBiome = this.biomes[tId];

    // Compute Wasserstein and MMD if feature distributions provided, else use canonical taxonomy
    let wasserstein = 0;
    let mmd = 0;

    if (sourceSampleFeatures.length > 0 && targetSampleFeatures.length > 0) {
      wasserstein = this.computeWassersteinDistance(sourceSampleFeatures, targetSampleFeatures);
      mmd = this.computeMMD(sourceSampleFeatures, targetSampleFeatures);
    } else {
      // Base domain discrepancy on biome difficulty and feature dim delta
      const diffDelta = Math.abs(targetBiome.difficulty - sourceBiome.difficulty);
      wasserstein = diffDelta * 0.15;
      mmd = Math.min(1.0, diffDelta * 0.12);
    }

    // Transferability decreases with domain distance
    const transferabilityScore = Math.max(0.05, Math.min(1.0, 1.0 - (0.5 * mmd + 0.5 * Math.min(1.0, wasserstein))));

    let negativeTransferRisk = 'LOW';
    if (transferabilityScore < this.negativeTransferThreshold) {
      negativeTransferRisk = 'HIGH';
    } else if (transferabilityScore < 0.65) {
      negativeTransferRisk = 'MEDIUM';
    }

    // Freeze recommendation: high transferability allows freezing more upstream layers
    const totalTopologyLayers = 4;
    let recommendedFrozenLayers = 0;
    if (transferabilityScore >= 0.70) {
      recommendedFrozenLayers = 2; // freeze lower 2 representation layers
    } else if (transferabilityScore >= 0.45) {
      recommendedFrozenLayers = 1; // freeze lowest feature layer
    }

    // Distillation weighting (alpha for teacher/source loss vs target loss)
    const distillationAlpha = Math.max(0.1, Math.min(0.8, transferabilityScore * 0.75));

    return {
      sourceBiome: sourceBiome.name,
      targetBiome: targetBiome.name,
      transferabilityScore: parseFloat(transferabilityScore.toFixed(4)),
      wassersteinDist: parseFloat(wasserstein.toFixed(4)),
      mmdScore: parseFloat(mmd.toFixed(4)),
      isRecommended: negativeTransferRisk !== 'HIGH',
      negativeTransferRisk,
      recommendedFrozenLayers,
      distillationAlpha: parseFloat(distillationAlpha.toFixed(3))
    };
  }

  /**
   * Records agent transfer progression.
   */
  recordProgression(agentId, sourceBiomeId, targetBiomeId, metrics = {}) {
    const evalResult = this.evaluateTransfer(sourceBiomeId, targetBiomeId);
    const record = {
      agentId,
      sourceBiomeId,
      targetBiomeId,
      timestamp: Date.now(),
      evalResult,
      metrics
    };
    this.agentRecords.set(agentId, record);
    return record;
  }

  /**
   * Retrieve transfer history for an agent.
   */
  getAgentRecord(agentId) {
    return this.agentRecords.get(agentId) || null;
  }
}

module.exports = {
  CurriculumTransferCoordinator
};
