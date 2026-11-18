/**
 * curriculumTransfer.test.js
 * Comprehensive integration test suite for:
 * 1. CurriculumTransferCoordinator (Wasserstein distance, MMD discrepancy, layer freezing)
 * 2. DynamicBatchingEngine (SLA-driven micro-batching, priority queues, telemetry)
 * 3. ActiveUncertaintySampler (Shannon entropy, margin uncertainty, least confidence ranking)
 * 4. ReplayAttestationEngine (Merkle root, HMAC signature, kinematic tamper detection)
 */

'use strict';

const assert = require('assert');
const { CurriculumTransferCoordinator } = require('../src/ml/CurriculumTransferCoordinator');
const { DynamicBatchingEngine } = require('../src/ml/DynamicBatchingEngine');
const { ActiveUncertaintySampler } = require('../src/ml/ActiveUncertaintySampler');
const { ReplayAttestationEngine } = require('../src/security/ReplayAttestationEngine');

console.log('================================================================');
console.log('🧪 RUNNING CURRICULUM TRANSFER & BATCHING TEST SUITE');
console.log('================================================================');

async function runTestSuite() {
  // --- 1. CurriculumTransferCoordinator Tests ---
  console.log('\n[1/4] Testing CurriculumTransferCoordinator (Wasserstein, MMD & Freezing)...');
  const coordinator = new CurriculumTransferCoordinator();

  // Test Wasserstein distance
  const distA = [1.0, 2.0, 3.0, 4.0];
  const distB = [1.5, 2.5, 3.5, 4.5];
  const wDist = coordinator.computeWassersteinDistance(distA, distB);
  assert(Math.abs(wDist - 0.5) < 1e-4, `Expected Wasserstein 0.5, got ${wDist}`);

  // Test MMD discrepancy
  const featSource = [0.1, 0.2, 0.3];
  const featTargetClose = [0.12, 0.22, 0.31];
  const featTargetFar = [5.0, 6.0, 7.0];
  const mmdClose = coordinator.computeMMD(featSource, featTargetClose);
  const mmdFar = coordinator.computeMMD(featSource, featTargetFar);
  assert(mmdClose < mmdFar, `MMD for close representations should be lower than distant: ${mmdClose} vs ${mmdFar}`);

  // Test transfer evaluation from Steppes (0) to Marshlands (1) vs Steppes (0) to Semantic Expanse (5)
  const evalNear = coordinator.evaluateTransfer(0, 1);
  const evalFar = coordinator.evaluateTransfer(0, 5);
  assert(evalNear.transferabilityScore > evalFar.transferabilityScore, 'Adjacent biome transfer should score higher');
  assert.strictEqual(evalNear.negativeTransferRisk, 'LOW');
  assert(evalNear.recommendedFrozenLayers >= 1, 'Should recommend freezing feature layers for adjacent biome');
  assert(evalNear.distillationAlpha > evalFar.distillationAlpha, 'Near biome should have higher distillation alpha');

  // Test agent progression record
  const progRecord = coordinator.recordProgression('agent_77', 0, 1, { acc: 0.88 });
  assert.strictEqual(progRecord.agentId, 'agent_77');
  const fetched = coordinator.getAgentRecord('agent_77');
  assert.strictEqual(fetched.sourceBiomeId, 0);
  assert.strictEqual(fetched.targetBiomeId, 1);
  console.log('  ✅ CurriculumTransferCoordinator Verified (Transfer Score: ' + evalNear.transferabilityScore + ', Frozen Layers: ' + evalNear.recommendedFrozenLayers + ')');

  // --- 2. DynamicBatchingEngine Tests ---
  console.log('\n[2/4] Testing DynamicBatchingEngine (SLA Micro-Batching & Priority Lanes)...');
  let forwardPassCount = 0;
  const batchEngine = new DynamicBatchingEngine({
    maxBatchSize: 4,
    maxWaitMs: 15,
    inferenceHandler: async (batchInputs) => {
      forwardPassCount++;
      return batchInputs.map(vec => vec.map(v => v * 2.0));
    }
  });

  // Enqueue 4 items concurrently to trigger immediate maxBatchSize flush
  const p1 = batchEngine.enqueue([1.0, 2.0], { priority: 'NORMAL' });
  const p2 = batchEngine.enqueue([2.0, 3.0], { priority: 'NORMAL' });
  const p3 = batchEngine.enqueue([3.0, 4.0], { priority: 'HIGH' });
  const p4 = batchEngine.enqueue([4.0, 5.0], { priority: 'LOW' });

  const [r1, r2, r3, r4] = await Promise.all([p1, p2, p3, p4]);
  assert.deepStrictEqual(r1, [2.0, 4.0]);
  assert.deepStrictEqual(r3, [6.0, 8.0]);
  assert.strictEqual(forwardPassCount, 1, 'Should have coalesced 4 inputs into exactly 1 batch execution');

  // Test SLA deadline timeout flush for underfilled batch
  const singlePromise = batchEngine.enqueue([10.0], { priority: 'HIGH' });
  const singleResult = await singlePromise;
  assert.deepStrictEqual(singleResult, [20.0]);

  const telemetry = batchEngine.getTelemetry();
  assert(telemetry.totalRequests >= 5);
  assert(telemetry.totalBatches >= 2);
  assert(telemetry.avgBatchSize > 0);
  console.log('  ✅ DynamicBatchingEngine Verified (Batches: ' + telemetry.totalBatches + ', Avg Batch Size: ' + telemetry.avgBatchSize + ', P95: ' + telemetry.p95LatencyMs + 'ms)');

  // --- 3. ActiveUncertaintySampler Tests ---
  console.log('\n[3/4] Testing ActiveUncertaintySampler (Entropy, Margin & Candidate Ranking)...');
  const sampler = new ActiveUncertaintySampler();

  // High uncertainty (uniform distribution over 3 classes: [0.33, 0.33, 0.34])
  const uncertainProbs = [0.333, 0.333, 0.334];
  const entropyHigh = sampler.computeShannonEntropy(uncertainProbs);
  const marginHigh = sampler.computeMarginUncertainty(uncertainProbs);

  // Low uncertainty (confident distribution: [0.95, 0.03, 0.02])
  const confidentProbs = [0.95, 0.03, 0.02];
  const entropyLow = sampler.computeShannonEntropy(confidentProbs);
  const marginLow = sampler.computeMarginUncertainty(confidentProbs);

  assert(entropyHigh > 0.95, `High entropy should be close to 1.0, got ${entropyHigh}`);
  assert(entropyLow < 0.35, `Confident distribution should have low entropy, got ${entropyLow}`);
  assert(marginHigh > marginLow, 'Ambiguous point should have higher margin uncertainty');

  const c1 = sampler.evaluateCandidate({ x: 10, y: 15 }, uncertainProbs);
  const c2 = sampler.evaluateCandidate({ x: 0, y: 0 }, confidentProbs);
  assert.strictEqual(c1.isHighValueCandidate, true);
  assert.strictEqual(c2.isHighValueCandidate, false);

  const ranked = sampler.rankCandidates([c2, c1]);
  assert.strictEqual(ranked[0].position.x, 10, 'Uncertain candidate should be ranked first for exploration');
  console.log('  ✅ ActiveUncertaintySampler Verified (Entropy High: ' + entropyHigh.toFixed(4) + ', Confident: ' + entropyLow.toFixed(4) + ')');

  // --- 4. ReplayAttestationEngine Tests ---
  console.log('\n[4/4] Testing ReplayAttestationEngine (Merkle Root & Anti-Tamper Attestation)...');
  const attestationEngine = new ReplayAttestationEngine();

  const validFrames = [
    { tick: 0, timestamp: 1000, position: { x: 0, y: 0 }, velocity: { x: 2, y: 0 }, action: 1 },
    { tick: 1, timestamp: 1050, position: { x: 2, y: 0 }, velocity: { x: 3, y: 0 }, action: 1 },
    { tick: 2, timestamp: 1100, position: { x: 5, y: 0 }, velocity: { x: 4, y: 0 }, action: 1 },
    { tick: 3, timestamp: 1150, position: { x: 9, y: 0 }, velocity: { x: 5, y: 0 }, action: 1 }
  ];

  const cert = attestationEngine.attestReplay('match_1001', 'player_alpha', validFrames);
  assert.strictEqual(cert.verified, true);
  assert(cert.merkleRoot && cert.merkleRoot.length === 64, 'Merkle root must be valid SHA-256');
  assert(cert.signature && cert.signature.length === 64, 'Signature must be HMAC-SHA256');

  // Verify valid certificate passes
  const isValidSig = attestationEngine.verifyCertificate(cert);
  assert.strictEqual(isValidSig, true, 'Valid certificate should pass verification');

  // Tampered certificate payload must fail verification
  const tamperedCert = { ...cert, frameCount: 999 };
  const isTamperedValid = attestationEngine.verifyCertificate(tamperedCert);
  assert.strictEqual(isTamperedValid, false, 'Tampered certificate must be rejected');

  // Kinematic anomaly frame (impossible teleport / extreme acceleration)
  const anomalousFrames = [
    { tick: 0, timestamp: 1000, position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, action: 0 },
    { tick: 1, timestamp: 1050, position: { x: 500, y: 0 }, velocity: { x: 9999, y: 0 }, action: 1 }
  ];
  const anomalousCert = attestationEngine.attestReplay('match_1002', 'cheater_bot', anomalousFrames);
  assert.strictEqual(anomalousCert.verified, false);
  assert(anomalousCert.rejectionReason.includes('PHYSICS_ANOMALY'), 'Should flag kinematic impossibility');

  console.log('  ✅ ReplayAttestationEngine Verified (Merkle Root: ' + cert.merkleRoot.substring(0, 16) + '..., Sig Check: PASS, Anomaly Check: CAUGHT)');

  console.log('\n================================================================');
  console.log('🎉 ALL CURRICULUM TRANSFER & BATCHING TESTS PASSED (4/4)');
  console.log('================================================================\n');
}

runTestSuite().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
