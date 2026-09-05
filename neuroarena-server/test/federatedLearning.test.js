const assert = require('assert');
const { FederatedConsensusEngine } = require('../src/ml/FederatedConsensusEngine');

console.log('▶ Testing Federated Learning Consensus & Differential Privacy Engine...');

const engine = new FederatedConsensusEngine({
  clipNorm: 2.0,
  epsilon: 3.0,
  delta: 1e-5,
  initialWeights: [1.0, 2.0, -1.0]
});

// 1. L2 Norm Clipping Test
const largeVector = [10.0, 20.0, -30.0];
const clipped = engine.clipL2(largeVector, 2.0);
const clippedNorm = Math.sqrt(clipped.reduce((a, b) => a + b * b, 0));
assert(Math.abs(clippedNorm - 2.0) < 1e-5, `Clipped norm (${clippedNorm}) must equal target maxNorm (2.0)`);

// 2. DP Noise Scale Verification
const sigma = engine.computeNoiseSigma();
assert(sigma > 0 && sigma < 5.0, `Gaussian noise sigma (${sigma}) must be finite and positive`);

// 3. Byzantine Outlier Rejection Test
const honestClients = [
  { weights: [1.2, 2.1, -0.9], numSamples: 50 },
  { weights: [1.1, 1.9, -1.1], numSamples: 40 },
  { weights: [1.3, 2.0, -1.0], numSamples: 60 },
  { weights: [1.0, 2.2, -0.8], numSamples: 50 }
];

const poisonedClients = [
  { weights: [500.0, -900.0, 300.0], numSamples: 100 } // Adversary trying to destroy global model
];

const allUpdates = [...honestClients, ...poisonedClients];
const result = engine.aggregateRound(allUpdates, false);

assert.strictEqual(result.rejectedClients, 1, 'Poisoned gradient update must be detected and rejected by Byzantine filter');
assert.strictEqual(result.participatingClients, 4, 'All 4 honest clients must be aggregated');
assert(result.globalWeights[0] > 0.8 && result.globalWeights[0] < 1.5, `Global weight w0 (${result.globalWeights[0]}) must remain stable`);

console.log('✅ Federated Learning Consensus & Byzantine Filter Tests Passed Cleanly!');
