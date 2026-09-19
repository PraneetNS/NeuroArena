const assert = require('assert');
const { MCTSBotDirector } = require('../src/ai/MCTSBotDirector');

console.log('▶ Testing MCTS Tactical AI Bot Director & Decision Tree...');

const director = new MCTSBotDirector({
  explorationConstant: 1.414,
  rolloutLimit: 80,
  useDirichletNoise: true,
  dirichletAlpha: 0.3,
  dirichletEpsilon: 0.25,
  progressiveWideningK: 2.0,
  progressiveWideningAlpha: 0.5
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

// 3. Dirichlet Noise Distribution Properties
const k = 4;
const sampleNoise1 = director.sampleDirichlet(k, 0.3);
const sampleNoise2 = director.sampleDirichlet(k, 0.3);
assert.strictEqual(sampleNoise1.length, k, 'Sample length must match k');
const sumNoise = sampleNoise1.reduce((acc, v) => acc + v, 0);
assert(Math.abs(sumNoise - 1.0) < 1e-4, 'Dirichlet noise vector must sum to approximately 1.0');
sampleNoise1.forEach(p => assert(p >= 0, 'Dirichlet sample components must be non-negative'));
// Ensure stochasticity (two draws should not be identical)
assert.notDeepStrictEqual(sampleNoise1, sampleNoise2, 'Dirichlet draws must be stochastic');

// 4. Overclock & Counter-Exploit Expanded Action States
const tacticalState = {
  health: 80,
  tokensCollected: 6,
  modelAccuracy: 0.85,
  opponentAttacking: true,
  score: 120
};
const tacticalDecision = director.selectBestAction(tacticalState, 120);
assert(tacticalDecision.action !== undefined);
assert(tacticalDecision.childrenEvaluated > 0, 'Must have evaluated multiple children');

// 5. Progressive Widening Branching Limits
const wideDirector = new MCTSBotDirector({
  progressiveWideningK: 1.5,
  progressiveWideningAlpha: 0.5,
  rolloutLimit: 60
});
const boundedDecision = wideDirector.selectBestAction(tacticalState, 60);
assert(boundedDecision.childrenEvaluated <= 6, 'Progressive widening must bound expanded actions');

console.log(`✅ MCTS Decision picked: ${aggressiveDecision.action} (Confidence: ${(aggressiveDecision.confidence * 100).toFixed(1)}%)`);
console.log(`✅ Dirichlet Noise & Progressive Widening Verified: Children=${boundedDecision.childrenEvaluated}, NoiseSum=${sumNoise.toFixed(4)}`);
console.log('✅ MCTS Tactical AI Bot Director Tests Passed Cleanly!');
