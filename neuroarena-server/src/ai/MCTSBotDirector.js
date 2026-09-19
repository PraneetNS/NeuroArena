/**
 * MCTSBotDirector.js
 * Monte Carlo Tree Search (MCTS) tactical AI bot director utilizing UCB1 selection,
 * AlphaZero-style root Dirichlet exploration noise, progressive widening, and deterministic rollout pruning.
 */

class MCTSNode {
  constructor(state, parent = null, action = null, priorProb = 1.0) {
    this.state = state;
    this.parent = parent;
    this.action = action;
    this.priorProb = priorProb;
    this.children = [];
    this.visits = 0;
    this.totalValue = 0;
    this.untriedActions = this.getPossibleActions(state);
  }

  getPossibleActions(state) {
    const actions = ['HARVEST', 'CALIBRATE', 'DEFEND'];
    if (state.tokensCollected > 3) actions.push('CHALLENGE_DUEL');
    if (state.health < 30) actions.push('EVADE_RETREAT');
    if (state.modelAccuracy > 0.8 && state.tokensCollected > 5) actions.push('OVERCLOCK_GRADIENT');
    if (state.opponentAttacking) actions.push('COUNTER_EXPLOIT');
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
      const exploration = cParam * child.priorProb * Math.sqrt(Math.log(this.visits + 1) / (child.visits + 1e-6));
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
    this.useDirichletNoise = options.useDirichletNoise ?? true;
    this.dirichletAlpha = options.dirichletAlpha || 0.3;
    this.dirichletEpsilon = options.dirichletEpsilon || 0.25;
    // Progressive widening parameters: maxChildren = floor(k * N^alpha)
    this.progressiveWideningK = options.progressiveWideningK || 2.0;
    this.progressiveWideningAlpha = options.progressiveWideningAlpha || 0.5;
  }

  /**
   * Sample gamma distribution approximations to construct symmetric Dirichlet distribution vector.
   */
  sampleDirichlet(k, alpha = 0.3) {
    // Marsaglia and Tsang approximation for gamma distribution
    const samples = [];
    for (let i = 0; i < k; i++) {
      // Simplified gamma sampling for alpha <= 1: -ln(U)^(1/alpha) * V
      const u = Math.max(Math.random(), 1e-6);
      const sample = Math.pow(-Math.log(u), 1.0 / alpha);
      samples.push(sample);
    }
    const sum = samples.reduce((acc, v) => acc + v, 0);
    return samples.map(v => v / (sum + 1e-8));
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
      case 'OVERCLOCK_GRADIENT':
        next.modelAccuracy = Math.min(1.0, (next.modelAccuracy || 0.5) + 0.12);
        next.score = (next.score || 0) + 35;
        next.tokensCollected = Math.max(0, (next.tokensCollected || 0) - 3);
        break;
      case 'COUNTER_EXPLOIT':
        next.score = (next.score || 0) + 40;
        next.opponentAttacking = false;
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

    // Inject AlphaZero-style Dirichlet noise into root prior probabilities
    if (this.useDirichletNoise && root.untriedActions.length > 0) {
      const numActions = root.untriedActions.length;
      const noise = this.sampleDirichlet(numActions, this.dirichletAlpha);
      root.actionPriors = new Map();
      for (let i = 0; i < numActions; i++) {
        const basePrior = 1.0 / numActions;
        const noisyPrior = (1 - this.dirichletEpsilon) * basePrior + (this.dirichletEpsilon * noise[i]);
        root.actionPriors.set(root.untriedActions[i], noisyPrior);
      }
    }

    for (let i = 0; i < iterations; i++) {
      let node = root;

      // 1. Selection with Progressive Widening guard
      while (
        (node.isFullyExpanded() || 
         node.children.length >= Math.floor(this.progressiveWideningK * Math.pow(Math.max(node.visits, 1), this.progressiveWideningAlpha))) &&
        node.children.length > 0
      ) {
        node = node.bestChild(this.explorationConstant);
      }

      // 2. Expansion
      if (!node.isFullyExpanded()) {
        const action = node.untriedActions.pop();
        const nextState = this.simulateStep(node.state, action);
        const prior = (node === root && root.actionPriors && root.actionPriors.has(action)) 
          ? root.actionPriors.get(action) 
          : 1.0;
        const childNode = new MCTSNode(nextState, node, action, prior);
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
      confidence: mostVisits / Math.max(iterations, 1),
      rootVisits: root.visits,
      childrenEvaluated: root.children.length
    };
  }
}

module.exports = { MCTSBotDirector, MCTSNode };
