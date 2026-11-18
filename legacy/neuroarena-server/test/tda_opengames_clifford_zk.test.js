/**
 * tda_opengames_clifford_zk.test.js
 *
 * Comprehensive integration test suite for:
 * 1. Persistent Homology Engine (TDA, Vietoris-Rips & \beta_0, \beta_1 loops)
 * 2. Category-Theoretic Open Games (Lenses, \circ, \otimes, Bayesian Nash Equilibrium)
 * 3. Clifford Geometric Algebra (Cl(3,0) Multivectors, Rotors, Slerp & Torques)
 * 4. Path Integral Stochastic Optimal Control (MPPI, Feynman-Kac & Evasion)
 * 5. Multi-Compartment Dendritic Computing (NMDA Spikes & Burst Coincidence)
 * 6. Zero-Knowledge Rollup Engine (BN254 Field, Kinematic Circuits & State Roots)
 * 7. Adiabatic Quantum Annealing QUBO (Trotter Spin-Flips & Target Assignment)
 * 8. Asynchronous Time-Warp Speculative Engine (Anti-Messages & Rollback)
 */

const assert = require('assert');
const PersistentHomologyEngine = require('../src/ml/PersistentHomologyEngine');
const { OpenGame, OpenGameEngine } = require('../src/ml/OpenGameEngine');
const { Multivector, CliffordGeometricAlgebra } = require('../src/physics/CliffordGeometricAlgebra');
const PathIntegralControlEngine = require('../src/ml/PathIntegralControlEngine');
const DendriticNeuronEngine = require('../src/ml/DendriticNeuronEngine');
const ZKRollupEngine = require('../src/security/ZKRollupEngine');
const QuantumAnnealingQUBOEngine = require('../src/ml/QuantumAnnealingQUBOEngine');
const TimeWarpSpeculativeEngine = require('../src/network/TimeWarpSpeculativeEngine');

console.log('================================================================');
console.log('🧪 RUNNING TDA, OPEN GAMES, CLIFFORD, CONTROL & ZK TEST SUITE');
console.log('================================================================\n');

// -------------------------------------------------------------
// 1. Persistent Homology Engine (TDA)
// -------------------------------------------------------------
console.log('[1/8] Testing PersistentHomologyEngine (Vietoris-Rips & Homology Loops)...');
const phe = new PersistentHomologyEngine({ maxDistance: 40.0, filtrationSteps: 15 });

// 8 points forming an octagon with a large central void
const octagon = [];
for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * 2 * Math.PI;
    octagon.push([15 * Math.cos(angle), 15 * Math.sin(angle)]);
}

const tdaResult = phe.analyzeSwarmTopology(octagon);
assert(tdaResult.intervals.pairs0.length >= 8, 'H0 must contain connected component pairs');
assert(tdaResult.intervals.pairs1.length >= 1, 'H1 must detect at least one topological 1-cycle/void');
assert(tdaResult.bettiCurve.length === 16, 'Betti curve must evaluate at 16 filtration steps');
console.log(`  ✅ PersistentHomologyEngine Validated! Simplicies: ${tdaResult.simplexCount}, 1-Cycles: ${tdaResult.intervals.pairs1.length}, Entropy: ${tdaResult.persistentEntropy1.toFixed(3)}`);

// -------------------------------------------------------------
// 2. Category-Theoretic Open Games
// -------------------------------------------------------------
console.log('\n[2/8] Testing OpenGameEngine (Compositional Optics & Bayesian Nash)...');
const openGameEngine = new OpenGameEngine();

const stage1 = openGameEngine.createAtomicDecisionGame('p1', ['coop', 'defect'], (action) => {
    return action === 'coop' ? 4 : 6;
});

const stage2 = openGameEngine.createAtomicDecisionGame('p2', ['coop', 'defect'], (action) => {
    return action === 'coop' ? 5 : 7;
});

const seqGame = openGameEngine.composeSequential(stage1, stage2);
const eqSeq = openGameEngine.solveEquilibrium(seqGame, {}, () => 0);
assert(eqSeq.isNash === true, 'Sequential composition must converge to Subgame Perfect Nash Equilibrium');
assert(eqSeq.expectedTotalPayoff === 13, 'Sequential defect-defect payoff must equal 6 + 7 = 13');

const tensorGame = openGameEngine.composeTensor(stage1, stage2);
const eqTensor = openGameEngine.solveEquilibrium(tensorGame, [{}, {}], () => [0, 0]);
assert(eqTensor.isNash === true, 'Tensor product game must preserve Nash equilibrium');
console.log(`  ✅ OpenGameEngine Validated! Composite Nash: [${eqSeq.equilibriumProfile.s1}, ${eqSeq.equilibriumProfile.s2}], Payoff: ${eqSeq.expectedTotalPayoff}`);

// -------------------------------------------------------------
// 3. Clifford Geometric Algebra Cl(3, 0)
// -------------------------------------------------------------
console.log('\n[3/8] Testing CliffordGeometricAlgebra (Rotors, Sandwich Product & Torques)...');
const vX = Multivector.fromVector(1.0, 0.0, 0.0);
const bXY = Multivector.fromBivector(1.0, 0.0, 0.0); // Unit e12 plane

// Create rotor for 90 degree (pi/2) rotation
const r90 = CliffordGeometricAlgebra.createRotor(bXY, Math.PI * 0.5);
const vRot = CliffordGeometricAlgebra.rotateVector(r90, vX);

assert(Math.abs(vRot.e1) < 1e-6, 'Rotated vector X coordinate must be ~0');
assert(Math.abs(vRot.e2 - 1.0) < 1e-6, 'Rotated vector Y coordinate must be ~1');

// Test Rotor Slerp at t = 0.5 -> 45 degree rotation
const rIdentity = new Multivector({ s: 1.0 });
const r45 = CliffordGeometricAlgebra.rotorSlerp(rIdentity, r90, 0.5);
const v45 = CliffordGeometricAlgebra.rotateVector(r45, vX);
assert(Math.abs(v45.e1 - Math.SQRT1_2) < 1e-3, 'Slerp 45-degree X must match sqrt(0.5)');
assert(Math.abs(v45.e2 - Math.SQRT1_2) < 1e-3, 'Slerp 45-degree Y must match sqrt(0.5)');

// Bivector torque: r = [2, 0, 0], F = [0, 5, 0] -> tau = r wedge F = 10 e12
const rVec = Multivector.fromVector(2.0, 0.0, 0.0);
const fVec = Multivector.fromVector(0.0, 5.0, 0.0);
const tau = CliffordGeometricAlgebra.computeTorqueBivector(rVec, fVec);
assert(Math.abs(tau.e12 - 10.0) < 1e-6, 'Torque bivector e12 must be exactly 10');
console.log(`  ✅ CliffordGeometricAlgebra Validated! 90° Rot: [${vRot.e1.toFixed(3)}, ${vRot.e2.toFixed(3)}, ${vRot.e3.toFixed(3)}], Torque: ${tau.e12.toFixed(1)} e12`);

// -------------------------------------------------------------
// 4. Path Integral Stochastic Optimal Control (MPPI)
// -------------------------------------------------------------
console.log('\n[4/8] Testing PathIntegralControlEngine (Feynman-Kac MPPI & Evasion)...');
const mppi = new PathIntegralControlEngine({ horizon: 12, dt: 0.05, numSamples: 32, temperature: 1.0 });
const currentPos = [0.0, 0.0, 0.0, 0.0];
const targetPos = [10.0, 8.0];
const obstacles = [{ x: 5.0, y: 4.0, radius: 2.0 }];

const controlResult = mppi.computeOptimalControl(currentPos, targetPos, obstacles);
assert(controlResult.optimalControl.length === 2, 'Optimal control must yield 2D acceleration');
assert(controlResult.predictedTrajectory.length === 13, 'Trajectory horizon must include 13 states');
assert(Number.isFinite(controlResult.minCost), 'Trajectory cost must be finite');
console.log(`  ✅ PathIntegralControlEngine Validated! u*: [${controlResult.optimalControl[0].toFixed(2)}, ${controlResult.optimalControl[1].toFixed(2)}], Min Cost: ${controlResult.minCost.toFixed(2)}`);

// -------------------------------------------------------------
// 5. Multi-Compartment Dendritic Computing
// -------------------------------------------------------------
console.log('\n[5/8] Testing DendriticNeuronEngine (NMDA Spikes & Apical Coincidence)...');
const dendriticNeuron = new DendriticNeuronEngine({ basalBranches: 3, apicalBranches: 2, synapsesPerBranch: 6 });

// Feed synchronous bursts to activate NMDA plateaus
const basalBurst = [
    [1, 1, 1, 1, 1, 1],
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0]
];
const apicalContext = [
    [1, 1, 1, 1, 1, 0],
    [0, 0, 0, 0, 0, 0]
];

let firedCount = 0;
let observedBurstMode = false;

for (let step = 0; step < 40; step++) {
    const res = dendriticNeuron.step(basalBurst, apicalContext, 1.0);
    if (res.fired) firedCount++;
    if (res.burstMode) observedBurstMode = true;
}

assert(firedCount > 0, 'Neuron must fire under strong synchronized dendritic drive');
assert(observedBurstMode === true, 'Apical coincidence must trigger burst firing mode');
console.log(`  ✅ DendriticNeuronEngine Validated! Spikes: ${firedCount}, Burst Mode Active: ${observedBurstMode}`);

// -------------------------------------------------------------
// 6. Zero-Knowledge Rollup Batch Engine
// -------------------------------------------------------------
console.log('\n[6/8] Testing ZKRollupEngine (BN254 Constraints & Batch State Proofs)...');
const zkRollup = new ZKRollupEngine({ batchSize: 5, maxSpeed: 20.0, arenaRadius: 100.0 });
const initialRoot = zkRollup.computeMerkleRoot(['initial_state_hash_0']);

const batchFrames = [
    { timestamp: 100, agents: [{ id: 'hero', x: 0.0, y: 0.0, vx: 2.0, vy: 1.0, radius: 1.5 }] },
    { timestamp: 150, agents: [{ id: 'hero', x: 0.1, y: 0.05, vx: 2.0, vy: 1.0, radius: 1.5 }] },
    { timestamp: 200, agents: [{ id: 'hero', x: 0.2, y: 0.1, vx: 2.0, vy: 1.0, radius: 1.5 }] }
];

const batchProofResult = zkRollup.generateBatchRollupProof(initialRoot, batchFrames);
assert(batchProofResult.success === true, 'Proof generation must succeed on valid kinematic batch');
assert(batchProofResult.violations.length === 0, 'Must have 0 constraint violations');

const isProofValid = zkRollup.verifyRollupProof(batchProofResult.proof, initialRoot, batchProofResult.newRoot);
assert(isProofValid === true, 'ZK Rollup proof must verify against claimed initial and post state roots');
console.log(`  ✅ ZKRollupEngine Validated! Verified New Root: ${batchProofResult.newRoot.substring(0, 16)}..., Satisfied Constraints: ${batchProofResult.proof.satisfiedConstraints}`);

// -------------------------------------------------------------
// 7. Adiabatic Quantum Annealing QUBO Engine
// -------------------------------------------------------------
console.log('\n[7/8] Testing QuantumAnnealingQUBOEngine (Trotter Slices & Target Assignment)...');
const qaEngine = new QuantumAnnealingQUBOEngine({ trotterSlices: 4, annealSteps: 35, temperature: 0.15 });

// 2 weapons vs 2 targets
const weaponCosts = [2.0, 3.0];
const targetPriorities = [12.0, 8.0];
const effectiveness = [
    [0.9, 0.1], // Weapon 0 best against Target 0
    [0.1, 0.8]  // Weapon 1 best against Target 1
];

const Q = QuantumAnnealingQUBOEngine.buildTargetAssignmentQUBO(weaponCosts, targetPriorities, effectiveness);
const qaResult = qaEngine.solveQUBO(Q);

assert(qaResult.bestSolution.length === 4, 'Solution vector must have dimension 4');
assert(qaResult.bestEnergy < 0, 'Optimal allocation must yield negative (favorable) energy');
console.log(`  ✅ QuantumAnnealingQUBOEngine Validated! Best Energy: ${qaResult.bestEnergy.toFixed(2)}, Bitstring: [${qaResult.bestSolution.join(', ')}]`);

// -------------------------------------------------------------
// 8. Asynchronous Time-Warp Speculative Engine
// -------------------------------------------------------------
console.log('\n[8/8] Testing TimeWarpSpeculativeEngine (Virtual Time & Anti-Messages)...');
const timeWarp = new TimeWarpSpeculativeEngine({ nodeId: 'node_shard_1', checkpointInterval: 5 });

timeWarp.saveCheckpoint(10, { agentX: 10.0, agentY: 5.0 });
timeWarp.advanceTime(15, { agentX: 15.0, agentY: 5.0 });
timeWarp.sendMessage('node_shard_2', 17, { action: 'fire_pulse' });
timeWarp.advanceTime(20, { agentX: 20.0, agentY: 5.0 });

// Receive late straggler message arriving at timestamp 12 (< localVirtualTime 20)
const stragglerMsg = {
    id: 'straggler_event_99',
    source: 'node_shard_2',
    target: 'node_shard_1',
    timestamp: 12,
    isAntiMessage: false,
    payload: { impulse: [-2.0, 0.0] }
};

const check = timeWarp.receiveMessage(stragglerMsg);
assert(check.requiresRollback === true, 'Straggler message must trigger Time Warp rollback');

const rollback = timeWarp.executeRollback(check.rollbackTargetTick);
assert(rollback.restoredTick <= 12, 'Rollback must revert state to checkpoint at or before straggler timestamp');
assert(rollback.antiMessages.length === 1, 'Speculative message sent at tick 17 must generate an anti-message');
assert(rollback.antiMessages[0].isAntiMessage === true, 'Anti-message flag must be set');

// Test anti-message annihilation in another engine
const recipientWarp = new TimeWarpSpeculativeEngine({ nodeId: 'node_shard_2' });
recipientWarp.receiveMessage({ id: rollback.antiMessages[0].id, isAntiMessage: false, timestamp: 17 });
assert(recipientWarp.inputQueue.length === 1, 'Queue has 1 positive message');

recipientWarp.receiveMessage(rollback.antiMessages[0]);
assert(recipientWarp.inputQueue.length === 0, 'Positive message and anti-message must annihilate');
assert(recipientWarp.annihilatedAntiMessages === 1, 'Annihilation counter must increment');

console.log(`  ✅ TimeWarpSpeculativeEngine Validated! Rollbacks: ${timeWarp.rollbackCount}, Annihilated Anti-Messages: ${recipientWarp.annihilatedAntiMessages}`);

console.log('\n================================================================');
console.log('🎉 ALL 8 TDA, OPEN GAMES, CLIFFORD, CONTROL & ZK TESTS PASSED!');
console.log('================================================================\n');
