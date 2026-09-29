/**
 * neural_ode_hypergraph_ebm.test.js
 *
 * Comprehensive integration test suite for:
 * 1. Continuous-Time Neural ODE Engine (RK4, DOPRI5, Adjoint Sensitivity)
 * 2. Energy-Based World Model (EBM, Langevin MCMC, Contrastive Divergence)
 * 3. Spatio-Temporal Hypergraph Attention Network (ST-HyperGAT, Incidence H)
 * 4. Neuro-Symbolic First-Order Logic Verifier (t-norms, safety envelopes)
 * 5. Primal-Dual Interior-Point Trajectory Optimizer (Log-barriers, KKT)
 * 6. Proof-of-Gameplay Engine (Merkle trace, zero-knowledge kinematic proofs)
 * 7. Multipath QUIC Congestion Engine (BBRv3, min-RTT scheduling)
 */

const assert = require('assert');
const NeuralODEEngine = require('../src/ml/NeuralODEEngine');
const EnergyBasedWorldModel = require('../src/ml/EnergyBasedWorldModel');
const HypergraphAttentionNetwork = require('../src/ml/HypergraphAttentionNetwork');
const NeuroSymbolicLogicVerifier = require('../src/ml/NeuroSymbolicLogicVerifier');
const InteriorPointTrajectoryOptimizer = require('../src/ml/InteriorPointTrajectoryOptimizer');
const ProofOfGameplayEngine = require('../src/security/ProofOfGameplayEngine');
const MultipathCongestionEngine = require('../src/network/MultipathCongestionEngine');

console.log('================================================================');
console.log('🧪 RUNNING NEURAL ODE, HYPERGRAPH, EBM & PROOF-OF-GAMEPLAY SUITE');
console.log('================================================================\n');

// -------------------------------------------------------------
// 1. Neural Ordinary Differential Equations (Neural ODEs)
// -------------------------------------------------------------
console.log('[1/7] Testing NeuralODEEngine (Continuous Trajectories & DOPRI5)...');
const ode = new NeuralODEEngine({ stateDim: 4, tolerance: 1e-3, defaultDt: 0.05 });
const z0 = [1.0, 0.5, 0.2, -0.1];

// Test RK4 Integration
const rk4Res = ode.integrate(z0, 0.0, 0.2, 'rk4');
assert(rk4Res.trajectory.length >= 4, 'RK4 must produce trajectory points');
assert(rk4Res.finalState.length === 4, 'Final state dimension must be 4');
assert(Number.isFinite(rk4Res.finalState[0]), 'Final state values must be finite');

// Test Adaptive DOPRI5 Integration
const dopriRes = ode.integrate(z0, 0.0, 0.2, 'dopri5');
assert(dopriRes.trajectory.length >= 2, 'DOPRI5 must produce trajectory');
assert(Number.isFinite(dopriRes.finalState[0]), 'DOPRI5 state must be finite');

// Test Adjoint Training Step
const zTarget = [1.2, 0.6, 0.1, -0.05];
const trainRes = ode.trainTrajectoryStep(z0, 0.0, 0.1, zTarget);
assert(trainRes.loss >= 0, 'Adjoint loss must be non-negative');
console.log(`  ✅ NeuralODEEngine Validated! RK4 steps: ${rk4Res.steps}, Train Loss: ${trainRes.loss.toFixed(4)}`);

// -------------------------------------------------------------
// 2. Energy-Based World Model (EBM & Langevin MCMC)
// -------------------------------------------------------------
console.log('\n[2/7] Testing EnergyBasedWorldModel (Langevin MCMC & CD-k)...');
const ebm = new EnergyBasedWorldModel({ stateDim: 3, actionDim: 2, langevinSteps: 10 });
const s = [0.5, 1.0, -0.2];
const a = [0.1, 0.5];
const sNextPos = [0.55, 1.05, -0.18];

const energyVal = ebm.computeEnergy(s, a, sNextPos);
assert(Number.isFinite(energyVal), 'Energy scalar must be finite');

// Negative sampling via Langevin MCMC
const sNextNeg = ebm.sampleNextStateLangevin(s, a);
assert(sNextNeg.length === 3, 'Sampled negative state dimension must match stateDim');

// Contrastive Divergence training step
const cdResult = ebm.trainContrastiveDivergence(s, a, sNextPos);
assert(Number.isFinite(cdResult.loss), 'CD-k loss must be finite');
console.log(`  ✅ EnergyBasedWorldModel Validated! Pos Energy: ${cdResult.posEnergy.toFixed(3)}, Neg Energy: ${cdResult.negEnergy.toFixed(3)}`);

// -------------------------------------------------------------
// 3. Spatio-Temporal Hypergraph Attention Network (ST-HyperGAT)
// -------------------------------------------------------------
console.log('\n[3/7] Testing HypergraphAttentionNetwork (Incidence & Attention)...');
const hyperGAT = new HypergraphAttentionNetwork({ featureDim: 4, hyperedgeDim: 4 });
const nodeFeatures = [
    [1, 0, 0.5, 0],
    [0.8, 0.2, 0.4, 0.1],
    [0, 1, 0.2, 0.8],
    [0.1, 0.9, 0.1, 0.7]
];
const hyperedges = [
    [0, 1],       // Pair hyperedge
    [1, 2, 3]     // Triadic hyperedge squad
];

const fwd = hyperGAT.forward(nodeFeatures, hyperedges);
assert(fwd.updatedNodeFeatures.length === 4, 'Must return 4 updated node feature vectors');
assert(fwd.hyperedgeEmbeddings.length === 2, 'Must compute 2 hyperedge representations');
assert(fwd.hyperedgeDegrees[1] === 3, 'Hyperedge 1 degree must be 3');

const synergy = hyperGAT.evaluateSquadSynergy([0, 1], nodeFeatures);
assert(synergy >= 0.0 && synergy <= 1.0, 'Synergy score must be bounded in [0, 1]');
console.log(`  ✅ HypergraphAttentionNetwork Validated! Hyperedges: 2, Squad Synergy: ${(synergy * 100).toFixed(1)}%`);

// -------------------------------------------------------------
// 4. Neuro-Symbolic First-Order Logic Verifier
// -------------------------------------------------------------
console.log('\n[4/7] Testing NeuroSymbolicLogicVerifier (Differentiable Fuzzy Logic)...');
const logic = new NeuroSymbolicLogicVerifier({ maxSpeed: 20.0, minBorderDist: 2.0, safeDistance: 1.5 });

// Test fuzzy t-norms
assert(Math.abs(logic.and(0.8, 0.5) - 0.4) < 1e-4, 'Product t-norm AND error');
assert(Math.abs(logic.or(0.5, 0.5) - 0.75) < 1e-4, 'Product t-conorm OR error');
assert(Math.abs(logic.not(0.3) - 0.7) < 1e-4, 'Negation NOT error');

// Verify compliant trajectory
const safeTrajectory = [
    { t: 0.0, pos: [0, 0, 0], vel: [5, 0, 0], borderDist: 15.0 },
    { t: 0.1, pos: [0.5, 0, 0], vel: [5, 0, 0], borderDist: 14.5 }
];
const safeReport = logic.verifyTrajectory(safeTrajectory);
assert(safeReport.satisfied === true, 'Safe trajectory must satisfy rules');
assert(safeReport.truthValue > 0.9, 'Truth value must be near 1.0');

// Verify violating trajectory (excessive speed)
const unsafeTrajectory = [
    { t: 0.0, pos: [0, 0, 0], vel: [35, 0, 0], borderDist: 1.0 }
];
const unsafeReport = logic.verifyTrajectory(unsafeTrajectory);
assert(unsafeReport.satisfied === false, 'Unsafe trajectory must be flagged');
assert(unsafeReport.violationCount > 0, 'Violations must be logged');
console.log(`  ✅ NeuroSymbolicLogicVerifier Validated! Safe Truth: ${safeReport.truthValue.toFixed(3)}, Caught Violations: ${unsafeReport.violationCount}`);

// -------------------------------------------------------------
// 5. Primal-Dual Interior-Point Trajectory Optimizer
// -------------------------------------------------------------
console.log('\n[5/7] Testing InteriorPointTrajectoryOptimizer (Logarithmic Barriers)...');
const ipOptimizer = new InteriorPointTrajectoryOptimizer({
    numWaypoints: 6,
    barrierMu: 0.5,
    boundaryClearance: 30.0,
    maxOuterIters: 4,
    maxNewtonIters: 5
});

const startPos = [-10.0, -10.0];
const goalPos = [10.0, 10.0];
const obstacles = [{ x: 0.0, y: 0.0, radius: 3.0 }];

const optResult = ipOptimizer.optimizeTrajectory(startPos, goalPos, obstacles);
assert(optResult.optimizedWaypoints.length === 6, 'Must generate 6 waypoints');
assert(optResult.isFeasible === true, 'Final trajectory must be barrier-feasible');
console.log(`  ✅ InteriorPointTrajectoryOptimizer Validated! Total iterations: ${optResult.totalIterations}, Final Mu: ${optResult.finalMu.toFixed(5)}`);

// -------------------------------------------------------------
// 6. Proof-of-Gameplay Verifiable Execution Trace Engine
// -------------------------------------------------------------
console.log('\n[6/7] Testing ProofOfGameplayEngine (Zero-Knowledge Invariants)...');
const pogp = new ProofOfGameplayEngine({ maxSpeed: 25.0, maxAcceleration: 15.0, tickRate: 60 });

const transitions = [];
for (let tick = 1; tick <= 10; tick++) {
    const pos = [(tick - 1) * 0.2, 0, 0];
    const nextPos = [tick * 0.2, 0, 0];
    transitions.push({
        tick,
        pos,
        vel: [12.0, 0, 0],
        action: [0.5, 0, 0],
        nextPos
    });
}

const merkleRoot = pogp.buildTraceMerkleRoot(transitions);
assert(typeof merkleRoot === 'string' && merkleRoot.length === 64, 'Merkle root must be a valid 64-char SHA-256');

// Complete audit
const audit = pogp.verifyExecutionTrace({
    matchId: 'match_test_01',
    playerId: 'agent_alpha',
    transitions,
    claimedMerkleRoot: merkleRoot
});
assert(audit.verified === true, 'Compliant trace must verify cleanly');
assert(audit.ticksAudited === 10, 'All 10 ticks must be audited');

// Inject impossible teleportation exploit
transitions[5].nextPos = [100.0, 0, 0];
const hackedAudit = pogp.verifyExecutionTrace({
    matchId: 'match_test_01',
    playerId: 'hacker_01',
    transitions
});
assert(hackedAudit.verified === false, 'Teleportation exploit must be rejected');
console.log(`  ✅ ProofOfGameplayEngine Validated! Merkle Root: ${merkleRoot.substring(0, 16)}..., Exploit Caught: ${hackedAudit.violationsCount > 0}`);

// -------------------------------------------------------------
// 7. Multipath QUIC Congestion Engine
// -------------------------------------------------------------
console.log('\n[7/7] Testing MultipathCongestionEngine (BBRv3 & Min-RTT Pacing)...');
const mpquic = new MultipathCongestionEngine();
mpquic.registerSubflow('wifi', 20.0, 5000000);
mpquic.registerSubflow('cellular', 60.0, 2000000);

const chosenPaths = mpquic.selectPathForPacket(256, 'NORMAL');
assert(chosenPaths[0] === 'wifi', 'Min-RTT scheduler must prioritize Wi-Fi path');

// Acknowledge packet on wifi
mpquic.onPacketAck('wifi', 256, 18.0);
const metrics = mpquic.getMultipathMetrics();
assert(metrics.activeSubflows === 2, 'Must have 2 active subflows');
console.log(`  ✅ MultipathCongestionEngine Validated! Selected: ${chosenPaths[0]}, Agg Bandwidth: ${metrics.totalBandwidthKbps} Kbps`);

console.log('\n================================================================');
console.log('🎉 ALL 7 ADVANCED ML, NEURAL ODE & PROOF-OF-GAMEPLAY TESTS PASSED!');
console.log('================================================================\n');
