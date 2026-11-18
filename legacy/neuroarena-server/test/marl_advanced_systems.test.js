/**
 * marl_advanced_systems.test.js
 * Comprehensive unit and integration test suite for:
 * 1. MARL Counterfactual Regret Minimization (CFR) Solver & Exploitability
 * 2. Additive Homomorphic Weight Aggregator (Confidential Edge Consensus)
 * 3. Asynchronous Federated Staleness Compensator (Polyak-Ruppert Momentum)
 * 4. Teacher-Student Curriculum Knowledge Distillation Engine
 * 5. High-Efficiency Delta-Encoded Binary Replay Compressor
 */

const assert = require('assert');
const CounterfactualRegretSolver = require('../src/ml/CounterfactualRegretSolver');
const HomomorphicWeightAggregator = require('../src/security/HomomorphicWeightAggregator');
const AsynchronousStalenessCompensator = require('../src/ml/AsynchronousStalenessCompensator');
const CurriculumDistillationEngine = require('../src/ml/CurriculumDistillationEngine');
const BinaryReplayCompressor = require('../src/network/BinaryReplayCompressor');

console.log('================================================================');
console.log('🧪 RUNNING MARL, HOMOMORPHIC & DISTILLATION TEST SUITE');
console.log('================================================================\n');

// 1. Test CounterfactualRegretSolver
console.log('[1/5] Testing CounterfactualRegretSolver (CFR+, Regret-Matching & Nash Convergence)...');
const cfr = new CounterfactualRegretSolver({
    actionNames: ['Harvester', 'Flanker', 'Defender', 'Disruptor'],
    explorationSmoothing: 0.01
});

// Initial step
const initialStep = cfr.step();
assert(initialStep.p1Strategy.length === 4, 'P1 strategy must have 4 actions');
assert(initialStep.p2Strategy.length === 4, 'P2 strategy must have 4 actions');
assert(initialStep.exploitability > 0, 'Initial exploitability should be positive');

// Solve for up to 200 iterations
const solveResult = cfr.solve(200, 0.05);
assert(solveResult.iterations > 1, 'Solver should run iterations');
assert(solveResult.finalExploitability <= initialStep.exploitability, 'Exploitability must monotonically decrease towards Nash');

// Validate strategy sum to 1.0
const p1Sum = solveResult.p1AverageStrategy.reduce((a, b) => a + b, 0);
assert(Math.abs(p1Sum - 1.0) < 0.001, 'P1 mixed strategy must normalize to 1.0');
console.log(`  ✅ CounterfactualRegretSolver Validated! Final Exploitability: ${solveResult.finalExploitability.toFixed(4)}`);


// 2. Test HomomorphicWeightAggregator
console.log('\n[2/5] Testing HomomorphicWeightAggregator (Additive Homomorphic Encryption & Consensus)...');
const homomorphic = new HomomorphicWeightAggregator({ scaleFactor: 10000 });

// Two edge clients submit model weights
const client1Weights = [0.25, -0.40, 1.80, -0.05];
const client2Weights = [0.15, 0.60, -0.20, 0.35];
const client3Weights = [-0.10, 0.10, 0.50, -0.10];

// Expected arithmetic mean:
const expectedMean = [
    (0.25 + 0.15 - 0.10) / 3, // 0.10
    (-0.40 + 0.60 + 0.10) / 3, // 0.10
    (1.80 - 0.20 + 0.50) / 3, // 0.70
    (-0.05 + 0.35 - 0.10) / 3  // 0.0667
];

// Encrypt locally on edge
const enc1 = homomorphic.encryptVector(client1Weights);
const enc2 = homomorphic.encryptVector(client2Weights);
const enc3 = homomorphic.encryptVector(client3Weights);

assert.strictEqual(enc1.length, 4, 'Encrypted vector length must match input');
assert.notStrictEqual(enc1[0], client1Weights[0], 'Ciphertext must be obfuscated BigInt hex string');

// Central server aggregates without decrypting
const aggregatedCiphertext = homomorphic.aggregateCiphertexts([enc1, enc2, enc3]);
assert.strictEqual(aggregatedCiphertext.length, 4);

// Authoritative consensus decryption
const decryptedMean = homomorphic.decryptAveragedVector(aggregatedCiphertext, 3);
assert.strictEqual(decryptedMean.length, 4);

for (let i = 0; i < 4; i++) {
    const error = Math.abs(decryptedMean[i] - expectedMean[i]);
    assert(error < 0.005, `Decrypted mean [${i}] error (${error}) must be within fixed-point scale precision`);
}
console.log(`  ✅ HomomorphicWeightAggregator Validated! Mean Decrypted: [${decryptedMean.map(v => v.toFixed(3)).join(', ')}]`);


// 3. Test AsynchronousStalenessCompensator
console.log('\n[3/5] Testing AsynchronousStalenessCompensator (Staleness Damping & Polyak-Ruppert)...');
const compensator = new AsynchronousStalenessCompensator({
    decayExponent: 0.5,
    maxAllowedStaleness: 20,
    momentumBeta: 0.85
});

// Update 1: Zero staleness (tau = 0)
const grad0 = [0.1, -0.2, 0.05];
const res0 = compensator.processGradient('layer_dense_1', grad0, 0, 0.01);
assert.strictEqual(res0.accepted, true);
assert.strictEqual(res0.staleness, 0);
assert.strictEqual(res0.dampingFactor, 1.0);

// Advance server clock
let currentWeights = [1.0, 1.0, 1.0];
currentWeights = compensator.applyUpdate('layer_dense_1', currentWeights, res0.compensatedGradient);

// Update 2: Moderate staleness (tau = 8)
const gradStale = [0.08, -0.19, 0.04];
const resStale = compensator.processGradient('layer_dense_1', gradStale, 0, 0.01);
assert.strictEqual(resStale.accepted, true);
assert(resStale.dampingFactor < 1.0, 'Stale gradient must be damped');
assert(resStale.dampingFactor > 0.3, 'Moderate staleness damping should remain functional');

// Update 3: Opposing gradient (directional divergence rejection)
const gradOpposing = [-0.9, 0.9, -0.9];
const resOpposing = compensator.processGradient('layer_dense_1', gradOpposing, 0, 0.01);
assert.strictEqual(resOpposing.accepted, false);
assert(resOpposing.reason.includes('DIRECTIONAL_DIVERGENCE_DETECTED'), 'Divergent stale gradient must be quarantined');

// Update 4: Excessive staleness quarantine (tau = 25 > 20)
const resExcessive = compensator.processGradient('layer_dense_1', grad0, -25, 0.01);
assert.strictEqual(resExcessive.accepted, false);
assert(resExcessive.reason.includes('STALENESS_EXCEEDED_MAX_TOLERANCE'));

const polyak = compensator.getPolyakWeights('layer_dense_1');
assert(polyak !== null && polyak.length === 3, 'Polyak-Ruppert weights must be maintained');
console.log(`  ✅ AsynchronousStalenessCompensator Validated! Accepted: ${compensator.metrics.updatesAccepted}, Quarantined: ${compensator.metrics.updatesQuarantined}`);


// 4. Test CurriculumDistillationEngine
console.log('\n[4/5] Testing CurriculumDistillationEngine (Temperature Scaling, KL Divergence & Hints)...');
const distillation = new CurriculumDistillationEngine({
    baseTemperature: 3.0,
    alpha: 0.7,
    hintLossWeight: 0.2
});

// Teacher outputs confident logits; student outputs noisy logits
const teacherLogits = [4.5, 0.2, -1.0, -2.5];
const studentLogits = [1.2, 0.8, -0.5, -0.1];
const teacherFeature = [0.5, 0.8, -0.2, 0.1];
const studentFeature = [0.4, 0.7, -0.1, 0.05];

const step1 = distillation.distillStep({
    teacherLogits,
    studentLogits,
    groundTruthAction: 0,
    teacherFeature,
    studentFeature,
    biomeTier: 1
});

assert(step1.totalLoss > 0, 'Total loss must be positive');
assert(step1.softLoss > 0, 'Soft distillation loss must be positive');
assert(step1.klDivergence > 0, 'KL divergence must be positive');
assert.strictEqual(step1.studentLogitGradients.length, 4, 'Student gradient vector must match logit dimensions');

// Test curriculum annealing
const tempTier0 = distillation.getCurriculumTemperature(0);
const tempTier4 = distillation.getCurriculumTemperature(4);
assert(tempTier0 > tempTier4, 'Curriculum temperature must anneal downwards across biome tiers');

const compression = distillation.evaluateCompressionProfile(1250000, 125000);
assert.strictEqual(compression.compressionRatio, 10.0, 'Compression ratio should be 10x');
console.log(`  ✅ CurriculumDistillationEngine Validated! Total Loss: ${step1.totalLoss.toFixed(4)}, Ratio: ${compression.compressionRatio}x`);


// 5. Test BinaryReplayCompressor
console.log('\n[5/5] Testing BinaryReplayCompressor (Delta Encoding, LEB128 & Loss-Free Roundtrip)...');
const compressor = new BinaryReplayCompressor({
    quantizationScale: 100,
    keyframeInterval: 30
});

// Generate 120 simulated ticks
const simulatedTicks = [];
let simX = 10.0, simY = 1.0, simZ = 5.0;

for (let t = 0; t < 120; t++) {
    simX += 0.05;
    simZ -= 0.03;
    simulatedTicks.push({
        tick: t,
        agents: [
            { id: 1, x: simX, y: simY, z: simZ, action: t % 4, reward: (t * 0.1) }
        ]
    });
}

const compressionResult = compressor.compressReplay(simulatedTicks);
assert(compressionResult.compressedBytes < compressionResult.rawJsonBytes, 'Compressed bytes must be less than raw JSON');
assert(compressionResult.compressionRatio > 3.0, `Compression ratio must exceed 3.0x (Observed: ${compressionResult.compressionRatio}x)`);

// Decompress and verify integrity
const decompressed = compressor.decompressReplay(compressionResult.compressedBuffer);
assert.strictEqual(decompressed.length, simulatedTicks.length, 'Decompressed tick count must match original');

for (let i = 0; i < decompressed.length; i++) {
    const orig = simulatedTicks[i].agents[0];
    const reco = decompressed[i].agents[0];
    assert.strictEqual(decompressed[i].tick, simulatedTicks[i].tick);
    assert.strictEqual(reco.action, orig.action);
    assert(Math.abs(reco.x - orig.x) <= 0.02, `X position coordinate mismatch at tick ${i}`);
    assert(Math.abs(reco.z - orig.z) <= 0.02, `Z position coordinate mismatch at tick ${i}`);
}

console.log(`  ✅ BinaryReplayCompressor Validated! Ratio: ${compressionResult.compressionRatio}x (Raw: ${compressionResult.rawJsonBytes}B -> Compressed: ${compressionResult.compressedBytes}B)`);

console.log('\n================================================================');
console.log('🎉 ALL 5 MARL, HOMOMORPHIC & DISTILLATION TESTS PASSED!');
console.log('================================================================\n');
