/**
 * TerritoryControlEngine.js
 * Guild Territory Warfare Engine managing biome control points, computational power staking,
 * dynamic siphon yields, and weekly reward distributions.
 */

class TerritoryControlEngine {
  constructor() {
    this.nodes = new Map();
    this.initializeNodes();
  }

  initializeNodes() {
    const defaultNodes = [
      { id: 'node_linear_ridge', biome: 'LinearSteppes', baseYield: 100, controllingGuildId: null, controlPoints: 0 },
      { id: 'node_binary_delta', biome: 'BinaryMarshlands', baseYield: 150, controllingGuildId: null, controlPoints: 0 },
      { id: 'node_tundra_core', biome: 'VarianceTundra', baseYield: 200, controllingGuildId: null, controlPoints: 0 },
      { id: 'node_canopy_nexus', biome: 'BranchingCanopy', baseYield: 250, controllingGuildId: null, controlPoints: 0 },
      { id: 'node_citadel_monolith', biome: 'DeepSynapseCitadel', baseYield: 350, controllingGuildId: null, controlPoints: 0 },
      { id: 'node_semantic_singularity', biome: 'SemanticExpanse', baseYield: 500, controllingGuildId: null, controlPoints: 0 }
    ];

    defaultNodes.forEach(n => {
      this.nodes.set(n.id, {
        ...n,
        stakedPower: new Map(), // guildId -> totalFlopsStaked
        contested: false
      });
    });
  }

  stakeCompute(nodeId, guildId, flopsAmount) {
    const node = this.nodes.get(nodeId);
    if (!node) throw new Error(`Territory node ${nodeId} not found`);

    const current = node.stakedPower.get(guildId) || 0;
    node.stakedPower.set(guildId, current + flopsAmount);

    this.recalculateControl(node);
    return this.getNodeState(nodeId);
  }

  unstakeCompute(nodeId, guildId, flopsAmount) {
    const node = this.nodes.get(nodeId);
    if (!node) throw new Error(`Territory node ${nodeId} not found`);

    const current = node.stakedPower.get(guildId) || 0;
    node.stakedPower.set(guildId, Math.max(0, current - flopsAmount));

    this.recalculateControl(node);
    return this.getNodeState(nodeId);
  }

  recalculateControl(node) {
    let topGuild = null;
    let topFlops = 0;
    let runnerUpFlops = 0;

    for (const [guildId, flops] of node.stakedPower.entries()) {
      if (flops > topFlops) {
        runnerUpFlops = topFlops;
        topFlops = flops;
        topGuild = guildId;
      } else if (flops > runnerUpFlops) {
        runnerUpFlops = flops;
      }
    }

    if (!topGuild || topFlops === 0) {
      node.controllingGuildId = null;
      node.controlPoints = 0;
      node.contested = false;
      return;
    }

    const margin = topFlops - runnerUpFlops;
    const ratio = topFlops / (topFlops + runnerUpFlops + 1e-6);

    node.contested = (margin / (topFlops + 1e-6)) < 0.25; // Contested if <25% lead
    if (ratio > 0.55) {
      node.controllingGuildId = topGuild;
      node.controlPoints = Math.min(100, Math.round(ratio * 100));
    }
  }

  calculateDividends(nodeId, elapsedHours = 1.0) {
    const node = this.nodes.get(nodeId);
    if (!node || !node.controllingGuildId) return 0;

    const multiplier = node.contested ? 0.6 : 1.2;
    return Math.floor(node.baseYield * multiplier * elapsedHours * (node.controlPoints / 100));
  }

  getNodeState(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return null;
    return {
      id: node.id,
      biome: node.biome,
      baseYield: node.baseYield,
      controllingGuildId: node.controllingGuildId,
      controlPoints: node.controlPoints,
      contested: node.contested,
      stakedPower: Object.fromEntries(node.stakedPower)
    };
  }

  getAllNodes() {
    return Array.from(this.nodes.values()).map(n => this.getNodeState(n.id));
  }
}

module.exports = { TerritoryControlEngine };
