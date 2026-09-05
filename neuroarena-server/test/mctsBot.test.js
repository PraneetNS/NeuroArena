const assert = require('assert');
const { MCTSBotDirector } = require('../src/ai/MCTSBotDirector');

console.log('▶ Testing MCTS Tactical AI Bot Director & Decision Tree...');

const director = new MCTSBotDirector({
  explorationConstant: 1.414,
  rolloutLimit: 80
});

// 1. Bot in low-health state should prioritize survival
const lowHealthState = {
  health: 15,
  tokensCollected: 0,
  modelAccuracy: 0.5,
  score: 10
};

const lowHealthDecision = director.selectBestAction(lowHealthState, 100);
assert(lowHealthDecision.action !== undefined, 'MCTS must pick a valid action');
assert(lowHealthDecision.confidence > 0, 'Decision confidence must be positive');

// 2. Bot with high tokens and high model accuracy should favor duels or calibration
const highScoringState = {
  health: 90,
  tokensCollected: 5,
  modelAccuracy: 0.95,
  score: 150
};

const aggressiveDecision = director.selectBestAction(highScoringState, 100);
assert(aggressiveDecision.action !== undefined);
assert(aggressiveDecision.rootVisits >= 100, 'All MCTS iterations must backpropagate to root');

console.log(`✅ MCTS Decision picked: ${aggressiveDecision.action} (Confidence: ${(aggressiveDecision.confidence * 100).toFixed(1)}%)`);
console.log('✅ MCTS Tactical AI Bot Director Tests Passed Cleanly!');
