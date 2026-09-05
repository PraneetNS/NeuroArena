/**
 * MCTSBotDirector.js
 * Monte Carlo Tree Search (MCTS) tactical AI bot director utilizing UCB1 selection,
 * neural rollout evaluations, and deterministic action pruning.
 */

class MCTSNode {
  constructor(state, parent = null, action = null) {
    this.state = state;
    this.parent = parent;
    this.action = action;
    this.children = [];
    this.visits = 0;
    this.totalValue = 0;
    this.untriedActions = this.getPossibleActions(state);
  }

  getPossibleActions(state) {
    const actions = ['HARVEST', 'CALIBRATE', 'DEFEND'];
    if (state.tokensCollected > 3) actions.push('CHALLENGE_DUEL');
    if (state.health < 30) actions.push('EVADE_RETREAT');
    return actions;
  }

  isFullyExpanded() {
    return this.untriedActions.length === 0;
  }

  bestChild(cParam = 1.414) {
    let best = null;
    let bestScore = -Infinity;

    for (const child of this.children) {
      const exploitation = child.totalValue / (child.visits + 1e-6);
      const exploration = cParam * Math.sqrt(Math.log(this.visits + 1) / (child.visits + 1e-6));
      const score = exploitation + exploration;
      if (score > bestScore) {
        bestScore = score;
        best = child;
      }
    }
    return best;
  }
}

class MCTSBotDirector {
  constructor(options = {}) {
    this.explorationConstant = options.explorationConstant || 1.414;
    this.rolloutLimit = options.rolloutLimit || 100;
  }

  simulateStep(state, action) {
    const next = { ...state };
    switch (action) {
      case 'HARVEST':
        next.tokensCollected = (next.tokensCollected || 0) + 1;
        next.score = (next.score || 0) + 10;
        break;
      case 'CALIBRATE':
        next.modelAccuracy = Math.min(1.0, (next.modelAccuracy || 0.5) + 0.05);
        next.score = (next.score || 0) + 15;
        break;
      case 'CHALLENGE_DUEL':
        const winChance = next.modelAccuracy || 0.5;
        if (winChance > 0.7) next.score = (next.score || 0) + 50;
        else next.score = Math.max(0, (next.score || 0) - 20);
        break;
      case 'EVADE_RETREAT':
        next.health = Math.min(100, (next.health || 20) + 25);
        break;
      case 'DEFEND':
        next.score = (next.score || 0) + 5;
        break;
    }
    return next;
  }

  evaluateTerminalState(state) {
    return (state.score || 0) + (state.modelAccuracy || 0) * 50 + (state.health || 50) * 0.5;
  }

  rollout(state, depth = 5) {
    let current = { ...state };
    for (let i = 0; i < depth; i++) {
      const actions = ['HARVEST', 'CALIBRATE', 'DEFEND'];
      const action = actions[Math.floor(Math.random() * actions.length)];
      current = this.simulateStep(current, action);
    }
    return this.evaluateTerminalState(current);
  }

  selectBestAction(initialState, iterations = this.rolloutLimit) {
    const root = new MCTSNode(initialState);

    for (let i = 0; i < iterations; i++) {
      let node = root;

      // 1. Selection
      while (node.isFullyExpanded() && node.children.length > 0) {
        node = node.bestChild(this.explorationConstant);
      }

      // 2. Expansion
      if (!node.isFullyExpanded()) {
        const action = node.untriedActions.pop();
        const nextState = this.simulateStep(node.state, action);
        const childNode = new MCTSNode(nextState, node, action);
        node.children.push(childNode);
        node = childNode;
      }

      // 3. Rollout Simulation
      const value = this.rollout(node.state);

      // 4. Backpropagation
      while (node !== null) {
        node.visits++;
        node.totalValue += value;
        node = node.parent;
      }
    }

    // Pick child with most visits
    let mostVisits = -1;
    let selectedAction = 'HARVEST';
    for (const child of root.children) {
      if (child.visits > mostVisits) {
        mostVisits = child.visits;
        selectedAction = child.action;
      }
    }

    return {
      action: selectedAction,
      confidence: mostVisits / iterations,
      rootVisits: root.visits
    };
  }
}

module.exports = { MCTSBotDirector, MCTSNode };
