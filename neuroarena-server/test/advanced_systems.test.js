/**
 * advanced_systems.test.js
 * Comprehensive integration test suite for:
 * 1. ModelQuantizer (INT8 quantization, magnitude pruning, error bounds)
 * 2. NASEngine (Pareto frontier ranking, micro-topology mutation, FLOPs calculation)
 * 3. ConceptDriftDetector (Kolmogorov-Smirnov & Page-Hinkley drift tests)
 * 4. GeoMatchmaker (Latency matrix routing, ping thresholding, MMR relaxation)
 * 5. AdaptiveWAF (Shannon entropy inspection, rate limiting, nonce replay guards)
 * 6. SpectatorDirector (Frame evaluation, loss velocity detection, win probability)
 */

'use strict';

const assert = require('assert');
const ModelQuantizer = require('../src/ml/modelQuantizer');
const NASEngine = require('../src/ai/nasEngine');
const ConceptDriftDetector = require('../src/ml/conceptDriftDetector');
const GeoMatchmaker = require('../src/cluster/geoMatchmaker');
const AdaptiveWAF = require('../src/security/adaptiveWAF');
const SpectatorDirector = require('../src/rooms/spectatorDirector');

console.log('================================================================');
console.log('🧪 RUNNING ADVANCED SYSTEMS INTEGRATION TEST SUITE');
console.log('================================================================');

// --- 1. Model Quantization & Pruning Tests ---
console.log('\n[1/6] Testing ModelQuantizer INT8 Calibration & Pruning...');
const originalWeights = [0.125, -1.45, 2.87, -0.05, 0.99, -3.14, 0.001, 1.72];
const quantized = ModelQuantizer.quantizeToInt8(originalWeights);
assert.strictEqual(quantized.precision, 'INT8');
assert.strictEqual(quantized.originalLength, originalWeights.length);
assert.strictEqual(quantized.packed.length, originalWeights.length);

const restoredWeights = ModelQuantizer.dequantizeFromInt8(quantized);
const metrics = ModelQuantizer.evaluateMetrics(originalWeights, restoredWeights);
assert(metrics.meanSquaredError < 0.01, `MSE too high: ${metrics.meanSquaredError}`);
assert(metrics.compressionRatio >= 2.0, `Compression ratio insufficient: ${metrics.compressionRatio}`);

const pruned = ModelQuantizer.pruneMagnitude(originalWeights, 0.5);
const zeroCount = pruned.filter(w => w === 0).length;
assert(zeroCount >= 4, `Expected at least 4 zeroed weights after 50% pruning, got ${zeroCount}`);
console.log('  ✅ ModelQuantizer INT8 & Pruning Validated (MSE: ' + metrics.meanSquaredError.toFixed(6) + ', Ratio: ' + metrics.compressionRatio + 'x)');

// --- 2. Neural Architecture Search (NAS) Tests ---
console.log('\n[2/6] Testing NASEngine Micro-Topologies & Pareto Optimization...');
const nas = new NASEngine(8, 2);
const seed = nas.generateSeedCandidate(3);
assert.strictEqual(seed.layers.length, 3);
assert(seed.totalParameters > 0);
assert(seed.flops > 0);

const child = nas.mutate(seed);
assert(child.id !== seed.id);
assert(child.totalParameters > 0);

seed.validationAccuracy = 0.92;
child.validationAccuracy = 0.95;
const ranked = nas.rankCandidates([seed, child]);
assert.strictEqual(ranked.length, 2);
assert(ranked[0].paretoScore >= ranked[1].paretoScore);
console.log('  ✅ NASEngine Complexity & Pareto Ranking Validated (Top Score: ' + ranked[0].paretoScore + ')');

// --- 3. Concept Drift Detector Tests ---
console.log('\n[3/6] Testing ConceptDriftDetector Statistical Tests...');
const driftDetector = new ConceptDriftDetector({ windowSize: 40, pageHinkleyThreshold: 30.0 });
const baseline = Array.from({ length: 50 }, () => Math.random() * 2 + 10);
driftDetector.setReferenceDistribution(baseline);

// Push normal samples
for (let i = 0; i < 30; i++) {
  driftDetector.addSample(Math.random() * 2 + 10);
}

// Push sudden shifted anomaly values to trigger Page-Hinkley / KS Drift
let driftTriggered = false;
for (let i = 0; i < 45; i++) {
  const result = driftDetector.addSample(Math.random() * 5 + 30); // massive mean shift
  if (result.driftDetected) {
    driftTriggered = true;
    break;
  }
}
assert(driftTriggered, 'ConceptDriftDetector failed to trigger on significant distribution shift');
console.log('  ✅ ConceptDriftDetector Anomaly Shift Detection Validated!');

// --- 4. Geo-Distributed Matchmaker Tests ---
console.log('\n[4/6] Testing GeoMatchmaker Latency Matrix & MMR Pairing...');
const geo = new GeoMatchmaker({ maxPingThresholdMs: 80 });
const p1 = { id: 'p1', mmr: 1500, pingMatrix: { 'us-east': 25, 'eu-central': 120, 'ap-east': 210 } };
const p2 = { id: 'p2', mmr: 1520, pingMatrix: { 'us-east': 35, 'eu-central': 110, 'ap-east': 195 } };
const pHighPing = { id: 'p3', mmr: 1510, pingMatrix: { 'us-east': 140, 'eu-central': 150, 'ap-east': 180 } };

const r1 = geo.enqueuePlayer(p1);
const r2 = geo.enqueuePlayer(p2);
assert.strictEqual(r1.enqueuedRegion, 'us-east');
assert.strictEqual(r2.enqueuedRegion, 'us-east');

const matches = geo.findMatchesForRegion('us-east');
assert.strictEqual(matches.length, 1);
assert.strictEqual(matches[0].player1.id, 'p1');
assert.strictEqual(matches[0].player2.id, 'p2');
console.log('  ✅ GeoMatchmaker Regional Routing & Matched Pairing Validated (Match Latency: ' + matches[0].avgLatencyMs + 'ms)');

// --- 5. Adaptive WAF & Entropy Tests ---
console.log('\n[5/6] Testing Adaptive WAF Entropy Defense & Replay Guard...');
const waf = new AdaptiveWAF({ burstCapacity: 3 });
const req1 = waf.inspectRequest({ ip: '127.0.0.1', payload: '{"weights":[1.2,3.4],"epoch":10}', nonce: 'nonce_abc123' });
assert.strictEqual(req1.allowed, true);
assert(req1.entropy > 2.0);

// Test nonce replay
const reqReplay = waf.inspectRequest({ ip: '127.0.0.1', payload: '{"weights":[1.2,3.4]}', nonce: 'nonce_abc123' });
assert.strictEqual(reqReplay.allowed, false);
assert.strictEqual(reqReplay.reason, 'NONCE_REPLAY_DETECTED');

// Test rate limiter exhaustion
waf.inspectRequest({ ip: '127.0.0.1', payload: 'a' });
waf.inspectRequest({ ip: '127.0.0.1', payload: 'b' });
const reqThrottled = waf.inspectRequest({ ip: '127.0.0.1', payload: 'c' });
assert.strictEqual(reqThrottled.allowed, false);
assert.strictEqual(reqThrottled.reason, 'RATE_LIMIT_EXCEEDED');
console.log('  ✅ Adaptive WAF Rate Limiting & Nonce Replay Guards Validated!');

// --- 6. Spectator Director Highlight Tests ---
console.log('\n[6/6] Testing SpectatorDirector Highlight Framing & Win Probability...');
const director = new SpectatorDirector({ lossVelocityThreshold: 0.2 });
const frame = director.evaluateFrame({
  p1: { id: 'p1', name: 'Alpha', currentLoss: 0.15, prevLoss: 0.85, hp: 500 },
  p2: { id: 'p2', name: 'Beta', currentLoss: 0.65, prevLoss: 0.70, hp: 450 },
  elapsedTimeMs: 12000
});

assert.strictEqual(frame.mode, 'CRITICAL_CONVERGENCE');
assert.strictEqual(frame.focusedPlayerId, 'p1');
assert(frame.broadcastCue.includes('breakthrough'));
assert(frame.winProb.p1 > frame.winProb.p2);
console.log('  ✅ SpectatorDirector Critical Convergence Highlight Validated (Win Prob P1: ' + frame.winProb.p1 + ')');

console.log('\n================================================================');
console.log('🎉 ALL ADVANCED SYSTEMS TESTS PASSED SUCCESSFULLY (6/6)');
console.log('================================================================\n');
