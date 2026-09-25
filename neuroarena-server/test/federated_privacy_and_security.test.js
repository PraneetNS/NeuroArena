/**
 * federated_privacy_and_security.test.js
 * Comprehensive test suite verifying Differential Privacy Accounting,
 * Adversarial Defense Validation, Swiss-System Tournaments, Tiered Model Cache,
 * ZK Commitments, and Distributed W3C Tracing.
 */

const assert = require('assert');
const DifferentialPrivacyAccountant = require('../src/security/DifferentialPrivacyAccountant');
const AdversarialDefenseValidator = require('../src/ml/AdversarialDefenseValidator');
const SwissTournamentEngine = require('../src/community/SwissTournamentEngine');
const TieredModelCache = require('../src/cluster/TieredModelCache');
const ZKGradientCommitment = require('../src/security/ZKGradientCommitment');
const DistributedTracingContext = require('../src/telemetry/DistributedTracingContext');

console.log('================================================================');
console.log('🧪 RUNNING FEDERATED PRIVACY, ADVERSARIAL & SYSTEM TEST SUITE');
console.log('================================================================\n');

// 1. Test Differential Privacy Accountant
console.log('[1/6] Testing DifferentialPrivacyAccountant (L2 Clipping, RDP & Budgets)...');
const dp = new DifferentialPrivacyAccountant({ maxEpsilon: 15.0, targetDelta: 1e-5 });

// Test L2 norm clipping
const rawVector = [3.0, 4.0]; // Norm is 5.0
const { clipped, norm, scale } = dp.clipL2Norm(rawVector, 2.5);
assert.strictEqual(norm, 5.0, 'Raw norm should be 5.0');
assert.strictEqual(scale, 0.5, 'Scale factor should be 0.5');
assert.strictEqual(clipped[0], 1.5);
assert.strictEqual(clipped[1], 2.0);

// Test Gaussian noise injection
const noisy = dp.injectGaussianNoise(clipped, 1.0, 2.5);
assert.strictEqual(noisy.length, 2);
assert.notDeepStrictEqual(noisy, clipped, 'Injected noise should modify values');

// Test RDP budget accumulation
let status;
for (let step = 0; step < 5; step++) {
    status = dp.recordStep('client_alpha', 1.2, 0.5);
}
assert.strictEqual(status.stepCount, 5);
assert(status.spentEpsilon > 0, 'Spent epsilon should increase');
assert.strictEqual(status.exhausted, false, 'Budget should not be exhausted yet');

// Simulate heavy training to exhaust budget
for (let step = 0; step < 80; step++) {
    status = dp.recordStep('client_alpha', 0.5, 1.0);
}
assert.strictEqual(dp.isBudgetExhausted('client_alpha'), true, 'Budget should be marked exhausted');
console.log('  ✅ DifferentialPrivacyAccountant Validated! Epsilon Spent: ' + status.spentEpsilon.toFixed(2));

// 2. Test Adversarial Defense Validator
console.log('\n[2/6] Testing AdversarialDefenseValidator (FGSM & Robustness Certificate)...');
const advValidator = new AdversarialDefenseValidator({ maxAllowedAccuracyDrop: 0.30 });
const weights = [2.0, -1.5];
const bias = 0.2;

// Linear separable test set
const dataset = [
    { x: [1.0, -1.0], y: 1 },
    { x: [1.5, -0.5], y: 1 },
    { x: [-1.0, 1.0], y: 0 },
    { x: [-1.5, 0.5], y: 0 }
];

const report = advValidator.validateRobustness(weights, bias, dataset, 0.05);
assert(report.cleanAccuracy >= 0.75, 'Clean accuracy should be high on separable data');
assert(typeof report.robustnessScore === 'number');
assert(report.isCertified === true, 'Robust model should receive certificate');
assert(typeof report.certificateSignature === 'string', 'Certificate should have signature');

// Test fragile model that fails under perturbation
const fragileWeights = [0.01, 0.01];
const fragileReport = advValidator.validateRobustness(fragileWeights, bias, dataset, 0.5);
assert(fragileReport.rejectionReason !== null, 'Fragile model must produce a rejection reason');
console.log('  ✅ AdversarialDefenseValidator Validated! Score: ' + report.robustnessScore + ', Cert: ' + report.certificateSignature.substring(0, 16) + '...');

// 3. Test Swiss Tournament Engine
console.log('\n[3/6] Testing SwissTournamentEngine (Pairing, Byes & Buchholz)...');
const swiss = new SwissTournamentEngine({ maxRounds: 3 });
swiss.registerParticipant('p1', 'Player Alpha', 1600);
swiss.registerParticipant('p2', 'Player Beta', 1550);
swiss.registerParticipant('p3', 'Player Gamma', 1500);

// Round 1 (Odd count -> 1 bye)
const r1 = swiss.generateNextRound();
assert.strictEqual(r1.pairings.length, 2, 'Should create 1 match and 1 bye');
const byeMatch = r1.pairings.find(m => m.isBye);
assert(byeMatch, 'One player should receive a bye');

// Play match
const match1 = r1.pairings.find(m => !m.isBye);
swiss.recordMatchResult(match1.matchId, match1.player1);

// Round 2
const r2 = swiss.generateNextRound();
assert.strictEqual(r2.roundNumber, 2);
for (const m of r2.pairings) {
    if (!m.completed) {
        swiss.recordMatchResult(m.matchId, m.player1);
    }
}

// Round 3
const r3 = swiss.generateNextRound();
for (const m of r3.pairings) {
    if (!m.completed) {
        swiss.recordMatchResult(m.matchId, m.player2);
    }
}

const standings = swiss.getStandings();
assert.strictEqual(standings.length, 3);
assert.strictEqual(standings[0].rank, 1);
assert(standings[0].score >= standings[1].score);
console.log('  ✅ SwissTournamentEngine Validated! Winner: ' + standings[0].name + ' (Score: ' + standings[0].score + ', Buchholz: ' + standings[0].buchholz + ')');

// 4. Test Tiered Model Cache
console.log('\n[4/6] Testing TieredModelCache (LRU-2 Eviction & L1/L2 Promotion)...');
const cache = new TieredModelCache({ l1Capacity: 2, l2Capacity: 5 });

cache.set('m1', { name: 'Model_1', weights: [0.1, 0.2] });
cache.set('m2', { name: 'Model_2', weights: [0.3, 0.4] });

// L1 Hits
const hit1 = cache.get('m1');
assert.strictEqual(hit1.found, true);
assert.strictEqual(hit1.tier, 'L1');

// Adding m3 will cause L1 eviction of m2 (since m1 was accessed twice)
cache.set('m3', { name: 'Model_3', weights: [0.5, 0.6] });
const hit2 = cache.get('m2');
assert.strictEqual(hit2.found, true);
assert.strictEqual(hit2.tier, 'L2', 'm2 should have demoted to L2');

const metrics = cache.getMetrics();
assert(metrics.l1Hits >= 1);
assert(metrics.l2Hits >= 1);
console.log('  ✅ TieredModelCache Validated! Hit Ratio: ' + (metrics.hitRatio * 100).toFixed(1) + '% (L1: ' + metrics.l1Hits + ', L2: ' + metrics.l2Hits + ')');

// 5. Test ZK Gradient Commitment
console.log('\n[5/6] Testing ZKGradientCommitment (Pedersen Commitments & Proof Opening)...');
const zk = new ZKGradientCommitment();
const originalGrad = 0.452;
const commitmentObj = zk.commit(originalGrad);

// Verify valid opening
const isValid = zk.verifyCommitment(commitmentObj.commitment, originalGrad, commitmentObj.blindingFactor);
assert.strictEqual(isValid, true, 'Valid opening must verify successfully');

// Verify false opening rejected
const isFraudValid = zk.verifyCommitment(commitmentObj.commitment, 0.999, commitmentObj.blindingFactor);
assert.strictEqual(isFraudValid, false, 'Tampered gradient must fail verification');

// Test vector commitment Merkle root
const vecCommitment = zk.commitVector([0.1, -0.2, 0.8]);
assert.strictEqual(vecCommitment.commitments.length, 3);
assert.strictEqual(vecCommitment.merkleRoot.length, 64);
console.log('  ✅ ZKGradientCommitment Validated! Merkle Root: ' + vecCommitment.merkleRoot.substring(0, 16) + '...');

// 6. Test Distributed Tracing Context
console.log('\n[6/6] Testing DistributedTracingContext (W3C traceparent & Span Lifecycle)...');
const tracer = new DistributedTracingContext('neuroarena-matchmaker');

// Test traceparent parsing
const sampleHeader = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
const parsed = tracer.parseTraceparent(sampleHeader);
assert.strictEqual(parsed.traceId, '4bf92f3577b34da6a3ce929d0e0e4736');
assert.strictEqual(parsed.parentSpanId, '00f067aa0ba902b7');
assert.strictEqual(parsed.sampled, true);

// Start span and finish
const root = tracer.createRootContext();
const span = tracer.startSpan('evaluate_player_contract', root, { 'player.id': 'p_42' });
assert.strictEqual(span.traceId, root.traceId);
assert(tracer.activeSpans.has(span.spanId));

const endedSpan = tracer.endSpan(span.spanId, 'OK');
assert.strictEqual(endedSpan.status, 'OK');
assert(typeof endedSpan.durationMs === 'number');
assert(!tracer.activeSpans.has(span.spanId));
console.log('  ✅ DistributedTracingContext Validated! Span Duration: ' + endedSpan.durationMs.toFixed(3) + 'ms');

console.log('\n================================================================');
console.log('🎉 ALL 6 FEDERATED PRIVACY, ADVERSARIAL & SECURITY TESTS PASSED!');
console.log('================================================================\n');
