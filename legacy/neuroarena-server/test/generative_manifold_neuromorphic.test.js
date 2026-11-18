/**
 * generative_manifold_neuromorphic.test.js
 *
 * Comprehensive integration test suite for:
 * 1. Conditional Flow Matching Motion Planner (CFM, Optimal Transport, RK4 quadrature)
 * 2. Conformal Prediction Engine (Distribution-free coverage guarantees, non-conformity quantiles)
 * 3. Riemannian Manifold Optimizer on SE(3) & SO(3) (Lie algebra, Exp/Log maps, Geodesics)
 * 4. Neuromorphic Spiking Policy Engine (LIF membrane dynamics, surrogate gradient, STDP)
 * 5. Continuum Mean Field Game Engine (Coupled HJB-FP equations, Nash drift fields)
 * 6. Contrastive Trajectory Encoder (InfoNCE, VICReg invariance & variance metrics)
 * 7. Continuous-Time Temporal Graph Network (Hawkes intensity cascades, node memory)
 */

const assert = require('assert');
const FlowMatchingMotionPlanner = require('../src/ml/FlowMatchingMotionPlanner');
const ConformalPredictionEngine = require('../src/ml/ConformalPredictionEngine');
const RiemannianManifoldOptimizer = require('../src/ml/RiemannianManifoldOptimizer');
const SpikingNeuralPolicyEngine = require('../src/ml/SpikingNeuralPolicyEngine');
const MeanFieldGameEngine = require('../src/ml/MeanFieldGameEngine');
const ContrastiveTrajectoryEncoder = require('../src/ml/ContrastiveTrajectoryEncoder');
const TemporalInteractionGraphEngine = require('../src/ml/TemporalInteractionGraphEngine');

console.log('================================================================');
console.log('🧪 RUNNING GENERATIVE FLOW, RIEMANNIAN & NEUROMORPHIC SUITE');
console.log('================================================================\n');

// -------------------------------------------------------------
// 1. Conditional Flow Matching Motion Planner
// -------------------------------------------------------------
console.log('[1/7] Testing FlowMatchingMotionPlanner (CFM & Vector Field RK4)...');
const flowPlanner = new FlowMatchingMotionPlanner({ stateDim: 6, numIntegrationSteps: 10 });
const x0 = [0, 0, 0, 0, 0, 0];
const x1 = [10, 5, 2, 2, 1, 0];

const loss = flowPlanner.trainStep(x0, x1, 0.5);
assert(Number.isFinite(loss) && loss >= 0, 'CFM training loss must be finite and non-negative');

const genTrajectory = flowPlanner.generateTrajectory(x0, 'rk4');
assert(genTrajectory.trajectory.length === 11, 'Trajectory must contain 11 steps for 10 discretization intervals');
assert(genTrajectory.finalState.length === 6, 'Final state dimension must be 6');
console.log(`  ✅ FlowMatchingMotionPlanner Validated! Loss: ${loss.toFixed(4)}, Generated Points: ${genTrajectory.trajectory.length}`);

// -------------------------------------------------------------
// 2. Conformal Prediction Engine (Finite Sample Coverage)
// -------------------------------------------------------------
console.log('\n[2/7] Testing ConformalPredictionEngine (Distribution-Free Guarantees)...');
const cpEngine = new ConformalPredictionEngine({ defaultAlpha: 0.05 });
const calibData = [];
for (let i = 0; i < 200; i++) {
    const yPred = 50 + Math.random() * 20;
    const yTrue = yPred + (Math.random() * 8 - 4); // Noise in [-4, 4]
    calibData.push({ yTrue, yPred });
}
cpEngine.calibrate(calibData);

const qHat = cpEngine.getConformalQuantile(0.05);
assert(qHat > 0 && qHat <= 4.5, `Conformal quantile ${qHat} must bound residual distribution`);

const interval = cpEngine.predictInterval(60.0, 1.0, 0.05);
assert(interval.lower < 60.0 && interval.upper > 60.0, 'Interval must bracket point prediction');
assert(interval.coverageTarget === 0.95, 'Coverage target must be 95%');

const safetyCheck = cpEngine.evaluateSafetyThreshold(20.0, 30.0);
assert(safetyCheck.isSafeWithGuarantee === true, 'Low risk must pass guaranteed safety check');
console.log(`  ✅ ConformalPredictionEngine Validated! 95% Quantile qHat: ${qHat.toFixed(3)}, Interval: [${interval.lower.toFixed(2)}, ${interval.upper.toFixed(2)}]`);

// -------------------------------------------------------------
// 3. Riemannian Manifold Optimizer on SE(3) and SO(3)
// -------------------------------------------------------------
console.log('\n[3/7] Testing RiemannianManifoldOptimizer (Lie Groups & Geodesics)...');
const wTest = [0.1, 0.2, 0.3];
const R = RiemannianManifoldOptimizer.expSO3(wTest);
assert(R.length === 9, 'SO(3) rotation matrix must have 9 elements');

const recoveredW = RiemannianManifoldOptimizer.logSO3(R);
const diffW = Math.abs(wTest[0] - recoveredW[0]) + Math.abs(wTest[1] - recoveredW[1]) + Math.abs(wTest[2] - recoveredW[2]);
assert(diffW < 1e-4, 'Lie log(exp(w)) must recover original Lie algebra vector');

const twist = [1.0, 2.0, 0.5, 0.1, -0.2, 0.05];
const se3Pose = RiemannianManifoldOptimizer.expSE3(twist);
assert(se3Pose.p.length === 3 && se3Pose.R.length === 9, 'SE(3) exponential map must produce R and p');

const distSO3 = RiemannianManifoldOptimizer.geodesicDistanceSO3(R, R);
assert(distSO3 < 1e-6, 'Geodesic distance to self on SO(3) must be 0');
console.log(`  ✅ RiemannianManifoldOptimizer Validated! Recovered Norm: ${Math.sqrt(recoveredW[0]**2 + recoveredW[1]**2 + recoveredW[2]**2).toFixed(4)}, Diff: ${diffW.toExponential(2)}`);

// -------------------------------------------------------------
// 4. Neuromorphic Spiking Policy Engine
// -------------------------------------------------------------
console.log('\n[4/7] Testing SpikingNeuralPolicyEngine (LIF Membrane & STDP)...');
const snn = new SpikingNeuralPolicyEngine({ inputNeurons: 4, hiddenNeurons: 8, outputNeurons: 2, timeSteps: 6 });
const analogInputs = [0.9, 0.1, 0.8, 0.05];

const snnOut = snn.forward(analogInputs);
assert(snnOut.actionRates.length === 2, 'Output action rates length must match outputNeurons');
assert(snnOut.hiddenSpikes.length === 6, 'Simulation must record spikes across all timeSteps');

const preSpikes = new Float32Array([1, -1, 2, -1]);
const postSpikes = new Float32Array([2, 4, -1, 3, -1, -1, 5, -1]);
snn.applySTDP(preSpikes, postSpikes);
console.log(`  ✅ SpikingNeuralPolicyEngine Validated! Action Rates: [${snnOut.actionRates.map(r => r.toFixed(2)).join(', ')}], Fired Spikes: ${snnOut.outputSpikeCount.reduce((a, b) => a + b, 0)}`);

// -------------------------------------------------------------
// 5. Mean Field Game Continuum Solver
// -------------------------------------------------------------
console.log('\n[5/7] Testing MeanFieldGameEngine (Coupled HJB-FP Nash Flow)...');
const mfg = new MeanFieldGameEngine({ gridSize: 8, timeHorizon: 5, diffusion: 0.05 });
const agentSwarm = [
    { x: 2, y: 2 },
    { x: 3, y: 2 },
    { x: 2, y: 3 },
    { x: 7, y: 7 }
];
mfg.initializeDensity(agentSwarm);
mfg.solveEquilibriumStep(2);

const drift = mfg.getOptimalDrift(2.5, 2.5, 0);
assert(Number.isFinite(drift.vx) && Number.isFinite(drift.vy), 'Optimal drift velocities must be finite');
assert(drift.localDensity >= 0, 'Local continuum density must be non-negative');
console.log(`  ✅ MeanFieldGameEngine Validated! Drift Vector at (2.5, 2.5): [${drift.vx.toFixed(3)}, ${drift.vy.toFixed(3)}], Density: ${drift.localDensity.toFixed(4)}`);

// -------------------------------------------------------------
// 6. Contrastive Trajectory Representation Learning
// -------------------------------------------------------------
console.log('\n[6/7] Testing ContrastiveTrajectoryEncoder (InfoNCE & VICReg)...');
const encoder = new ContrastiveTrajectoryEncoder({ featureDim: 6, seqLength: 8, embeddingDim: 4 });
const seqA = new Float32Array(48).map(() => Math.random());
const seqB = new Float32Array(48).map(() => Math.random());

const zA = encoder.encode(seqA);
const zB = encoder.encode(seqB);

let normA = 0;
for (let i = 0; i < zA.length; i++) normA += zA[i] * zA[i];
assert(Math.abs(Math.sqrt(normA) - 1.0) < 1e-4, 'Latent embedding must be normalized to unit hypersphere');

const infoNceLoss = encoder.computeInfoNCELoss([zA], [encoder.encode(encoder.augment(seqA))]);
assert(Number.isFinite(infoNceLoss) && infoNceLoss >= 0, 'InfoNCE loss must be non-negative');

const vicreg = encoder.computeVICRegMetrics([zA, zB], [zA, zB]);
assert(vicreg.invariance === 0.0, 'Identity pairs must have 0 invariance loss');
console.log(`  ✅ ContrastiveTrajectoryEncoder Validated! InfoNCE Loss: ${infoNceLoss.toFixed(4)}, Embedding Norm: ${Math.sqrt(normA).toFixed(4)}`);

// -------------------------------------------------------------
// 7. Continuous-Time Temporal Graph Network
// -------------------------------------------------------------
console.log('\n[7/7] Testing TemporalInteractionGraphEngine (Hawkes Cascades)...');
const tgn = new TemporalInteractionGraphEngine({ memoryDim: 6, decayBeta: 2.0 });

tgn.recordInteraction('player_1', 'boss_alpha', 10.0, 'attack', 2.5);
tgn.recordInteraction('player_2', 'boss_alpha', 10.2, 'attack', 1.8);
tgn.recordInteraction('player_1', 'player_2', 10.4, 'shield', 1.2);

const intensityImmediate = tgn.predictCombatIntensity(10.5);
assert(intensityImmediate.currentIntensity > 0.05, 'Combat intensity must elevate following dense interactions');

const affinity = tgn.computeNodeAffinity('player_1', 'boss_alpha');
assert(Number.isFinite(affinity), 'Node affinity must be finite');
console.log(`  ✅ TemporalInteractionGraphEngine Validated! Cascade Intensity: ${intensityImmediate.currentIntensity.toFixed(3)}, Cascade Alert: ${intensityImmediate.isCascadeAlert}`);

console.log('\n================================================================');
console.log('🎉 ALL 7 GENERATIVE, MANIFOLD & NEUROMORPHIC TESTS PASSED!');
console.log('================================================================\n');
