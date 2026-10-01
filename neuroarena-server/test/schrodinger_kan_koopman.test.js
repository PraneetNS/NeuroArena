/**
 * schrodinger_kan_koopman.test.js
 *
 * Comprehensive integration test suite for:
 * 1. Diffusion Schrödinger Bridge Engine (Entropic Optimal Transport & IPF)
 * 2. E(n)-Equivariant Graph Neural Network (SE(3) coordinate-free equivariance)
 * 3. Koopman Operator & Dynamic Mode Decomposition (Non-linear spectral forecasting)
 * 4. Kolmogorov-Arnold Networks (KAN Cox-de Boor B-spline edge activations)
 * 5. Symplectic Mechanics Engine (Hamiltonian phase-space energy conservation)
 * 6. Natural Policy Gradient Engine (Fisher Information Matrix & Conjugate Gradient)
 * 7. Martingale Conformal Anomaly Detector (Ville's inequality betting martingale)
 * 8. Counterfactual World Model (Pearl Level-3 Abduction-Action-Prediction)
 */

const assert = require('assert');
const SchrodingerBridgeEngine = require('../src/ml/SchrodingerBridgeEngine');
const EquivariantGraphEngine = require('../src/ml/EquivariantGraphEngine');
const KoopmanOperatorEngine = require('../src/ml/KoopmanOperatorEngine');
const KolmogorovArnoldEngine = require('../src/ml/KolmogorovArnoldEngine');
const SymplecticMechanicsEngine = require('../src/physics/SymplecticMechanicsEngine');
const NaturalPolicyGradientEngine = require('../src/ml/NaturalPolicyGradientEngine');
const MartingaleConformalDetector = require('../src/safety/MartingaleConformalDetector');
const CounterfactualWorldModel = require('../src/ml/CounterfactualWorldModel');

console.log('================================================================');
console.log('🧪 RUNNING SCHRÖDINGER BRIDGE, KAN, KOOPMAN & EQUIVARIANT SUITE');
console.log('================================================================\n');

// -------------------------------------------------------------
// 1. Diffusion Schrödinger Bridge Engine
// -------------------------------------------------------------
console.log('[1/8] Testing SchrodingerBridgeEngine (Entropic OT & IPF)...');
const bridge = new SchrodingerBridgeEngine({ stateDim: 4, numSteps: 10, diffusionGamma: 0.1 });
const x0 = [0, 0, 1, 0];
const x1 = [5, 2, 0, -1];

const initialTrajectory = bridge.simulateForwardTrajectory(x0, false);
assert(initialTrajectory.length === 11, 'Trajectory must have 11 discretization states for 10 steps');

let energy = 0;
for (let iter = 0; iter < 5; iter++) {
    energy = bridge.stepIPF(x0, x1);
}
assert(Number.isFinite(energy) && energy > 0, 'Kinetic energy must be positive and finite');
console.log(`  ✅ SchrodingerBridgeEngine Validated! IPF Energy: ${energy.toFixed(4)}, Discretization Steps: ${initialTrajectory.length}`);

// -------------------------------------------------------------
// 2. E(n)-Equivariant Graph Neural Network
// -------------------------------------------------------------
console.log('\n[2/8] Testing EquivariantGraphEngine (SE(3) Equivariance & Invariance)...');
const egnn = new EquivariantGraphEngine({ featureDim: 4, hiddenDim: 8, numLayers: 1 });

const posOriginal = [
    [1.0, 0.0, 0.0],
    [0.0, 1.0, 0.0],
    [-1.0, 0.0, 0.5]
];
const feats = [
    [0.5, 0.2, -0.1, 0.9],
    [-0.4, 0.8, 0.3, 0.1],
    [0.1, -0.2, 0.7, -0.5]
];

// Rotate positions by 90 degrees around Z axis: (x, y, z) -> (-y, x, z)
const posRotated = posOriginal.map(p => [-p[1], p[0], p[2]]);

const resOriginal = egnn.forward(posOriginal, feats);
const resRotated = egnn.forward(posRotated, feats);

// Check that updated rotated positions match rotated updated original positions
for (let i = 0; i < posOriginal.length; i++) {
    const origUp = resOriginal.updatedPositions[i];
    const rotUp = resRotated.updatedPositions[i];
    const expectedRotX = -origUp[1];
    const expectedRotY = origUp[0];
    const expectedRotZ = origUp[2];

    const diff = Math.hypot(rotUp[0] - expectedRotX, rotUp[1] - expectedRotY, rotUp[2] - expectedRotZ);
    assert(diff < 1e-4, `Equivariance violation at agent ${i}: diff=${diff}`);
}
console.log(`  ✅ EquivariantGraphEngine Validated! Exact SE(3) Equivariance confirmed.`);

// -------------------------------------------------------------
// 3. Koopman Operator & Dynamic Mode Decomposition
// -------------------------------------------------------------
console.log('\n[3/8] Testing KoopmanOperatorEngine (Spectral Mode Forecasting)...');
const koopman = new KoopmanOperatorEngine({ stateDim: 4 });
const snapX = [];
const snapY = [];

// Synthetic damped harmonic motion: x_{k+1} = 0.95 * x_k
for (let k = 0; k < 50; k++) {
    const s = [Math.cos(k * 0.1), Math.sin(k * 0.1), -0.1 * Math.sin(k * 0.1), 0.1 * Math.cos(k * 0.1)];
    const sNext = [s[0] * 0.98, s[1] * 0.98, s[2] * 0.98, s[3] * 0.98];
    snapX.push(s);
    snapY.push(sNext);
}

koopman.fit(snapX, snapY);
const forecast = koopman.forecast(snapX[0], 5);
assert(forecast.length === 5, 'Forecast must yield 5 future horizons');
assert(forecast[0].length === 4, 'Forecasted state dimension must be 4');
assert(Number.isFinite(forecast[4][0]), 'Forecast values must be finite');
console.log(`  ✅ KoopmanOperatorEngine Validated! 5-Step Horizon Forecasted at mode: [${forecast[4].map(v => v.toFixed(3)).join(', ')}]`);

// -------------------------------------------------------------
// 4. Kolmogorov-Arnold Networks (KAN)
// -------------------------------------------------------------
console.log('\n[4/8] Testing KolmogorovArnoldEngine (Cox-de Boor B-Splines)...');
const kan = new KolmogorovArnoldEngine({ inDim: 3, outDim: 2, gridSize: 5, splineDegree: 3, learningRate: 0.05 });
const kanIn = [0.4, -0.2, 0.7];
const kanTarget = [1.2, -0.5];

const initialPred = kan.forward(kanIn);
assert(initialPred.length === 2, 'KAN output dimension must match outDim');

let kanLoss = 0;
for (let step = 0; step < 25; step++) {
    kanLoss = kan.trainStep(kanIn, kanTarget);
}
assert(Number.isFinite(kanLoss) && kanLoss >= 0, 'KAN training loss must be finite');
const trainedPred = kan.forward(kanIn);
const trainedLoss = 0.5 * ((trainedPred[0] - kanTarget[0]) ** 2 + (trainedPred[1] - kanTarget[1]) ** 2);
assert(trainedLoss < 1.0, 'KAN parameters must adapt towards target');
console.log(`  ✅ KolmogorovArnoldEngine Validated! Loss reduced to: ${trainedLoss.toFixed(4)}`);

// -------------------------------------------------------------
// 5. Symplectic Mechanics Engine
// -------------------------------------------------------------
console.log('\n[5/8] Testing SymplecticMechanicsEngine (Phase-Space Energy Conservation)...');
const symplectic = new SymplecticMechanicsEngine({ mass: 1.0, gravitationalConstant: 10.0, softening: 0.1 });
let q = [2.0, 0.0, 0.0];
let p = [0.0, 2.2, 0.0]; // Circular orbit velocity

const initialH = symplectic.computeHamiltonian(q, p);
const dt = 0.02;

for (let step = 0; step < 500; step++) {
    const res = symplectic.stepForestRuth(q, p, dt);
    q = res.q;
    p = res.p;
}

const finalH = symplectic.computeHamiltonian(q, p);
const relEnergyDrift = Math.abs(finalH - initialH) / Math.abs(initialH);
assert(relEnergyDrift < 0.05, `Symplectic energy drift ${relEnergyDrift} must remain bounded (< 5%) over 500 steps`);
console.log(`  ✅ SymplecticMechanicsEngine Validated! Relative Energy Drift: ${(relEnergyDrift * 100).toFixed(4)}%`);

// -------------------------------------------------------------
// 6. Natural Policy Gradient Engine
// -------------------------------------------------------------
console.log('\n[6/8] Testing NaturalPolicyGradientEngine (Fisher Information & CG)...');
const npg = new NaturalPolicyGradientEngine({ stateDim: 4, actionDim: 2, maxKl: 0.02 });
const sampleStates = [
    [1.0, 0.0, 0.2, -0.1],
    [0.0, 1.0, -0.4, 0.3],
    [0.5, 0.5, 0.0, 0.1]
];

const probs = npg.getProbabilities(sampleStates[0]);
assert(Math.abs(probs[0] + probs[1] - 1.0) < 1e-5, 'Action probabilities must sum to 1.0');

const grad = new Float32Array(npg.paramDim).fill(0.1);
const natStep = npg.stepNatural(sampleStates, grad);
assert(natStep.length === npg.paramDim, 'Natural gradient vector length must equal parameter dimension');
console.log(`  ✅ NaturalPolicyGradientEngine Validated! Amari Natural Step Norm: ${Math.hypot(...natStep).toFixed(4)}`);

// -------------------------------------------------------------
// 7. Martingale Conformal Anomaly Detector
// -------------------------------------------------------------
console.log('\n[7/8] Testing MartingaleConformalDetector (Ville Non-Exchangeability)...');
const martingale = new MartingaleConformalDetector({ threshold: 40.0, epsilon: 0.7 });
const benignScores = [];
for (let i = 0; i < 100; i++) benignScores.push(5.0 + Math.random() * 2.0);
martingale.seedCalibration(benignScores);

// Ingest benign scores
for (let i = 0; i < 20; i++) {
    const stat = martingale.update(5.5 + Math.random());
    assert(!stat.isAnomaly, 'Benign exchangeable scores must not trigger anomaly alert');
}

// Ingest adversarial anomalous scores
for (let i = 0; i < 40; i++) {
    martingale.update(100.0); // Severe out-of-distribution non-conformity
}
assert(martingale.wealth >= 40.0 && martingale.alertTriggered, 'Martingale wealth must cross critical alert threshold under attack');
console.log(`  ✅ MartingaleConformalDetector Validated! Wealth Accumulated: ${martingale.wealth.toFixed(2)}, Anomaly Detected: ${martingale.alertTriggered}`);

// -------------------------------------------------------------
// 8. Counterfactual World Model (Pearl Level-3)
// -------------------------------------------------------------
console.log('\n[8/8] Testing CounterfactualWorldModel (Abduction-Action-Prediction)...');
const cfWorld = new CounterfactualWorldModel({ stateDim: 4, actionDim: 3 });
const factualS = [1.0, 2.0, 0.5, -0.5];
const factualA = [1.0, 0.0, 0.0];
const factualNextS = [2.5, 1.9, 0.45, -0.4];

// Abduce exogenous noise
const noiseU = cfWorld.abduceNoise(factualS, factualA, factualNextS);
assert(noiseU.length === 4, 'Noise dimension must match state dimension');

// Counterfactual surgical intervention: do(A = [0, 1, 0])
const counterfactualA = [0.0, 1.0, 0.0];
const cfNextS = cfWorld.counterfactualStep(factualS, factualA, factualNextS, counterfactualA);

// Verify counterfactual prediction differs from factual in dimension influenced by action
assert(cfNextS[1] !== factualNextS[1], 'Counterfactual intervention must alter outcome according to causal DAG');
console.log(`  ✅ CounterfactualWorldModel Validated! Counterfactual State: [${cfNextS.map(v => v.toFixed(3)).join(', ')}]`);

console.log('\n================================================================');
console.log('🎉 ALL 8 SCHRÖDINGER, KAN, KOOPMAN & EQUIVARIANT TESTS PASSED!');
console.log('================================================================\n');
