const assert = require('assert');
const { ModelRegistryService } = require('../src/ml/ModelRegistryService');

console.log('▶ Testing ModelRegistryService SHA-256 Checksum, Champion Staging & Rollback...');

const registry = new ModelRegistryService({
  minAccuracyForChampion: 0.85,
  maxWeightCount: 5000
});

// 1. Valid Registration
const validWeights = [0.125, -0.45, 1.82, -0.05, 0.99];
const validBiases = [0.01, -0.02];
const model1 = registry.registerModel('architect_01', {
  modelName: 'ResNet-Alpha',
  biomeId: 1,
  architecture: 'FeedForward',
  weights: validWeights,
  biases: validBiases,
  validationLoss: 0.22,
  validationAccuracy: 0.89
});

assert(model1.modelId.startsWith('model_1_'), 'Model ID must incorporate biome ID');
assert.strictEqual(model1.checksum.length, 64, 'Checksum must be 64-char hex SHA-256');
assert.strictEqual(model1.weights.length, 5, 'Weights array preserved');
assert.strictEqual(model1.isChampion, false, 'Model must not be champion on registration');
console.log(`  ✅ Valid registration verified! ID: ${model1.modelId}, Hash: ${model1.checksum.slice(0, 12)}...`);

// 2. Reject Malformed / Non-Finite Weights
assert.throws(() => {
  registry.registerModel('architect_02', {
    biomeId: 1,
    weights: [0.1, NaN, 0.5],
    biases: [0.0]
  });
}, /MODEL_REJECTED: WEIGHT_NON_FINITE_OR_NAN/, 'Must reject NaN weights');

assert.throws(() => {
  registry.registerModel('architect_03', {
    biomeId: 1,
    weights: [0.1, Infinity, 0.5],
    biases: [0.0]
  });
}, /MODEL_REJECTED: WEIGHT_NON_FINITE_OR_NAN/, 'Must reject Infinity weights');

assert.throws(() => {
  registry.registerModel('architect_04', {
    biomeId: 1,
    weights: [0.1, 5000.0, 0.5],
    biases: [0.0]
  });
}, /MODEL_REJECTED: WEIGHT_OUT_OF_BOUNDS/, 'Must reject out of bounds weights');
console.log('  ✅ Non-finite and out-of-bounds weight rejection verified!');

// 3. Reject Checksum Mismatch (Tampering Protection)
assert.throws(() => {
  registry.registerModel('architect_05', {
    biomeId: 1,
    weights: validWeights,
    biases: validBiases,
    clientChecksum: 'bad_checksum_hash_1234567890abcdef'
  });
}, /CHECKSUM_MISMATCH_POTENTIAL_TAMPERING/, 'Must reject mismatched client checksum');
console.log('  ✅ Tampering checksum rejection verified!');

// 4. Champion Promotion & Threshold Enforcements
const lowAccModel = registry.registerModel('architect_06', {
  biomeId: 1,
  weights: [0.1, 0.2, 0.3],
  validationAccuracy: 0.72
});
assert.throws(() => {
  registry.promoteChampion(1, lowAccModel.modelId);
}, /ACCURACY_BELOW_CHAMPION_THRESHOLD/, 'Cannot promote model with sub-par accuracy');

const promoResult = registry.promoteChampion(1, model1.modelId);
assert.strictEqual(promoResult.promotedModelId, model1.modelId);
assert.strictEqual(registry.getBiomeChampion(1).modelId, model1.modelId);
console.log(`  ✅ Champion promotion verified! Champion: ${model1.modelId}`);

// 5. Successor Promotion and Demotion Tracking
const model2 = registry.registerModel('architect_07', {
  modelName: 'ResNet-Beta',
  biomeId: 1,
  weights: [0.13, -0.42, 1.85, -0.04, 1.01],
  biases: [0.01, -0.01],
  validationLoss: 0.15,
  validationAccuracy: 0.94
});
const promoResult2 = registry.promoteChampion(1, model2.modelId);
assert.strictEqual(promoResult2.previousChampionId, model1.modelId);
assert.strictEqual(registry.getBiomeChampion(1).modelId, model2.modelId);
assert.strictEqual(model1.isChampion, false, 'Previous champion must be demoted');
assert.strictEqual(model2.isChampion, true, 'New champion must be active');
console.log('  ✅ Successor champion promotion and previous demotion verified!');

// 6. Zero-Downtime Rollback
const rollbackResult = registry.rollbackChampion(1);
assert.strictEqual(rollbackResult.restoredChampionId, model1.modelId);
assert.strictEqual(rollbackResult.rolledBackFrom, model2.modelId);
assert.strictEqual(registry.getBiomeChampion(1).modelId, model1.modelId);
console.log(`  ✅ Rollback verified! Restored champion: ${model1.modelId}`);

// 7. Model Differential Comparison
const comparison = registry.compareModels(model1.modelId, model2.modelId);
assert(comparison.deltaLoss < 0, 'Model 2 has lower loss');
assert(comparison.deltaAccuracy > 0, 'Model 2 has higher accuracy');
assert(comparison.weightDistance > 0, 'Weight distance must be non-zero');
assert.strictEqual(comparison.isSuperior, true, 'Model 2 is superior to Model 1');
console.log(`  ✅ Model comparison verified! Delta Acc: +${(comparison.deltaAccuracy * 100).toFixed(1)}%, Dist: ${comparison.weightDistance.toFixed(4)}`);

console.log('🎉 All ModelRegistryService Tests Passed Cleanly!');
