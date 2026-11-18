/**
 * nasEngine.js
 * Server-side Neural Architecture Search (NAS) exploration engine.
 * Discovers optimal neural topologies for player-crafted bots and boss archetypes.
 */

'use strict';

class NASEngine {
  constructor(inputDim = 8, outputDim = 2, seed = 42) {
    this.inputDim = inputDim;
    this.outputDim = outputDim;
    this.population = [];
    this.generation = 0;
    this.unitPool = [16, 32, 64, 128, 256];
    this.activationPool = ['relu', 'leaky_relu', 'gelu', 'swish', 'tanh'];
  }

  /**
   * Generates a randomized base candidate architecture.
   */
  generateSeedCandidate(layerCount = 2) {
    const layers = [];
    for (let i = 0; i < layerCount; i++) {
      layers.push({
        units: this.unitPool[Math.floor(Math.random() * this.unitPool.length)],
        activation: this.activationPool[Math.floor(Math.random() * this.activationPool.length)],
        dropout: Math.random() > 0.5 ? Number((Math.random() * 0.3 + 0.1).toFixed(2)) : 0,
        skipConnection: i > 0 && Math.random() > 0.6
      });
    }

    const candidate = {
      id: `nas_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      layers,
      learningRate: 0.001,
      regularizationL2: 0.0001,
      totalParameters: 0,
      flops: 0,
      validationLoss: 0,
      validationAccuracy: 0,
      paretoScore: 0
    };

    this.calculateComplexity(candidate);
    return candidate;
  }

  /**
   * Calculates parameter count and multiply-accumulate FLOPs.
   */
  calculateComplexity(candidate) {
    let prev = this.inputDim;
    let totalParams = 0;
    let totalFlops = 0;

    for (const layer of candidate.layers) {
      const weights = prev * layer.units;
      const biases = layer.units;
      totalParams += (weights + biases);
      totalFlops += weights * 2;
      prev = layer.units;
    }

    const outWeights = prev * this.outputDim;
    const outBiases = this.outputDim;
    totalParams += (outWeights + outBiases);
    totalFlops += outWeights * 2;

    candidate.totalParameters = totalParams;
    candidate.flops = totalFlops;
  }

  /**
   * Mutates an architecture candidate.
   */
  mutate(parent) {
    const child = {
      id: `nas_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      layers: JSON.parse(JSON.stringify(parent.layers)),
      learningRate: Math.max(1e-4, Math.min(0.1, parent.learningRate * (0.8 + Math.random() * 0.4))),
      regularizationL2: Math.max(1e-6, Math.min(1e-2, parent.regularizationL2 * (0.8 + Math.random() * 0.4))),
      totalParameters: 0,
      flops: 0,
      validationLoss: 0,
      validationAccuracy: 0,
      paretoScore: 0
    };

    const roll = Math.random();
    if (roll < 0.25 && child.layers.length < 6) {
      // Add layer
      child.layers.push({
        units: this.unitPool[Math.floor(Math.random() * this.unitPool.length)],
        activation: this.activationPool[Math.floor(Math.random() * this.activationPool.length)],
        dropout: Math.random() > 0.5 ? 0.2 : 0,
        skipConnection: Math.random() > 0.7
      });
    } else if (roll < 0.45 && child.layers.length > 1) {
      // Remove layer
      child.layers.pop();
    } else {
      // Mutate existing layer
      const idx = Math.floor(Math.random() * child.layers.length);
      child.layers[idx].units = this.unitPool[Math.floor(Math.random() * this.unitPool.length)];
      child.layers[idx].activation = this.activationPool[Math.floor(Math.random() * this.activationPool.length)];
    }

    this.calculateComplexity(child);
    return child;
  }

  /**
   * Rank candidates using multi-objective Pareto scoring.
   */
  rankCandidates(candidates, accuracyWeight = 0.7, flopWeight = 0.3) {
    return candidates.map(c => {
      const accScore = Math.max(0, Math.min(1, c.validationAccuracy || 0.5));
      const flopEfficiency = Math.max(0, Math.min(1, 1 - (c.flops / 200000)));
      c.paretoScore = Number(((accScore * accuracyWeight) + (flopEfficiency * flopWeight)).toFixed(4));
      return c;
    }).sort((a, b) => b.paretoScore - a.paretoScore);
  }
}

module.exports = NASEngine;
