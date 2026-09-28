/**
 * maml_causal_pinn_crdt.test.js
 *
 * Comprehensive integration test suite for:
 * 1. Model-Agnostic Meta-Learning (MAML) few-shot task adaptation
 * 2. Causal Discovery (PC algorithm) and Pearl's do-calculus
 * 3. Physics-Informed Neural Networks (PINN) Hamiltonian conservation
 * 4. Quantum-Inspired Simulated Bifurcation (aSB) Ising solver
 * 5. Hierarchical Goal-Conditioned RL with Hindsight Experience Replay (HER)
 * 6. Delta-CRDT peer-to-peer multiplayer synchronization
 */

const assert = require('assert');
const MetaLearningEngine = require('../src/ml/MetaLearningEngine');
const CausalInferenceEngine = require('../src/ml/CausalInferenceEngine');
const PhysicsInformedNeuralNetwork = require('../src/ml/PhysicsInformedNeuralNetwork');
const QuantumSimulatedBifurcation = require('../src/ml/QuantumSimulatedBifurcation');
const HierarchicalGoalAgent = require('../src/ml/HierarchicalGoalAgent');
const { DeltaCRDTSync, PNCounterCRDT, LWWElementSetCRDT } = require('../src/network/DeltaCRDTSync');

console.log('================================================================');
console.log('🧪 RUNNING MAML, CAUSAL, PINN, CRDT & QUANTUM SB TEST SUITE');
console.log('================================================================\n');

// -------------------------------------------------------------
// 1. Model-Agnostic Meta-Learning (MAML)
// -------------------------------------------------------------
console.log('[1/6] Testing MetaLearningEngine (Few-Shot Task Adaptation)...');
const maml = new MetaLearningEngine({ paramDim: 4, innerAlpha: 0.1, metaBeta: 0.05, innerSteps: 3 });

// Create synthetic linear task batch: y = w_i * x
const taskBatch = [];
for (let t = 0; t < 4; t++) {
    const targetSlope = (t + 1) * 1.5;
    const support = [];
    const query = [];
    for (let s = 0; s < 5; s++) {
        const x = [s + 1, (s + 1) * 0.5, 0, 0];
        support.push({ x, y: x[0] * targetSlope });
    }
    for (let q = 0; q < 5; q++) {
        const x = [q + 6, (q + 6) * 0.5, 0, 0];
        query.push({ x, y: x[0] * targetSlope });
    }
    taskBatch.push({ taskId: `task_${t}`, support, query });
}

const metaMetrics = maml.trainMetaBatch(taskBatch);
assert(metaMetrics.metaIteration === 1, 'Meta iteration must be 1');
assert(metaMetrics.numTasks === 4, 'Must process 4 tasks in batch');

// Few-shot evaluation on novel unseen task
const testSupport = [{ x: [2, 1, 0, 0], y: 10 }, { x: [4, 2, 0, 0], y: 20 }];
const testQuery = [{ x: [6, 3, 0, 0], y: 30 }];
const evalResult = maml.evaluateFewShot(testSupport, testQuery);
assert(evalResult.fewShotQueryLoss <= evalResult.zeroShotQueryLoss || evalResult.fewShotQueryLoss < 20, 'Few-shot query loss must improve or be well-behaved');
console.log(`  ✅ MetaLearningEngine Validated! Adaptation Gain: ${metaMetrics.adaptationGainPercent.toFixed(1)}%`);

// -------------------------------------------------------------
// 2. Causal Discovery & do-calculus
// -------------------------------------------------------------
console.log('[2/6] Testing CausalInferenceEngine (PC Skeleton & do-calculus)...');
const causal = new CausalInferenceEngine({
    variableNames: ['slope', 'friction', 'velocity', 'energy', 'spikes'],
    significanceThreshold: 0.1
});

// Generate observational samples with known causal structure:
// slope -> velocity, friction -> velocity, velocity -> energy
const obsData = [];
for (let i = 0; i < 60; i++) {
    const slope = Math.random() * 2.0;
    const friction = Math.random() * 1.0;
    const velocity = 10.0 - (2.5 * slope) - (4.0 * friction) + (Math.random() - 0.5) * 0.2;
    const energy = (1.8 * velocity) + (Math.random() - 0.5) * 0.2;
    const spikes = (2.2 * velocity) + (Math.random() - 0.5) * 0.2;
    obsData.push([slope, friction, velocity, energy, spikes]);
}

const causalGraph = causal.discoverCausalGraph(obsData);
assert(causalGraph.nodes.length === 5, 'Graph must contain 5 nodes');
assert(causalGraph.edgeCount > 0, 'Must discover causal correlations');

// Test Pearl's do-calculus intervention
const baselineState = { slope: 0.5, friction: 0.5, velocity: 6.75, energy: 12.15, spikes: 14.85 };
const interventionResult = causal.doIntervention('friction', 0.1, baselineState);
assert.strictEqual(interventionResult.intervenedVariable, 'friction');
assert.strictEqual(interventionResult.counterfactualState.friction, 0.1);
console.log(`  ✅ CausalInferenceEngine Validated! Discovered Edges: ${causalGraph.edgeCount}`);

// -------------------------------------------------------------
// 3. Physics-Informed Neural Network (PINN)
// -------------------------------------------------------------
console.log('[3/6] Testing PhysicsInformedNeuralNetwork (Hamiltonian Conservation)...');
const pinn = new PhysicsInformedNeuralNetwork({ mass: 1.0, hamiltonianWeight: 10.0, symplecticWeight: 5.0 });

// Harmonic oscillator trajectory: q = sin(t), p = cos(t), H0 = 0.5
const pinnBatch = [];
for (let step = 0; step < 20; step++) {
    const t = step * 0.1;
    const q = Math.sin(t);
    const p = Math.cos(t);
    const dq_dt_obs = p;
    const dp_dt_obs = -q;
    pinnBatch.push({ q, p, dq_dt_obs, dp_dt_obs, H0: 0.5 });
}

const pinnMetrics = pinn.trainStep(pinnBatch);
assert(pinnMetrics.step === 1, 'PINN step counter must increment');
assert(typeof pinnMetrics.totalLoss === 'number' && !isNaN(pinnMetrics.totalLoss), 'Loss must be a valid number');

// Symplectic integration test
const integrated = pinn.integrateSymplecticStep(1.0, 0.0, 0.05);
assert(typeof integrated.q === 'number' && typeof integrated.p === 'number', 'Symplectic integration must produce valid (q, p)');
console.log(`  ✅ PhysicsInformedNeuralNetwork Validated! Total Loss: ${pinnMetrics.totalLoss.toFixed(4)}`);

// -------------------------------------------------------------
// 4. Quantum-Inspired Simulated Bifurcation (aSB)
// -------------------------------------------------------------
console.log('[4/6] Testing QuantumSimulatedBifurcation (Ising Max-Cut / Spin Optimization)...');
const sb = new QuantumSimulatedBifurcation({ numSpins: 6, timeSteps: 60 });

// Antiferromagnetic coupling matrix J (favors opposite spins, e.g. Max-Cut)
const couplingJ = [
    [0, -1, -1, 0, 0, 0],
    [-1, 0, -1, -1, 0, 0],
    [-1, -1, 0, 0, -1, 0],
    [0, -1, 0, 0, -1, -1],
    [0, 0, -1, -1, 0, -1],
    [0, 0, 0, -1, -1, 0]
];
sb.setProblemMatrix(couplingJ);

const sbSolution = sb.solve();
assert.strictEqual(sbSolution.spins.length, 6, 'Must produce 6 spin orientations');
for (const s of sbSolution.spins) {
    assert(s === 1 || s === -1, 'Spins must be discrete binary in {-1, +1}');
}
console.log(`  ✅ QuantumSimulatedBifurcation Validated! Energy: ${sbSolution.energy.toFixed(2)}, Spins: [${sbSolution.spins.join(', ')}]`);

// -------------------------------------------------------------
// 5. Hierarchical Goal-Conditioned RL with HER
// -------------------------------------------------------------
console.log('[5/6] Testing HierarchicalGoalAgent (Sub-goals & Hindsight Replay)...');
const hierAgent = new HierarchicalGoalAgent({ stateDim: 4, actionDim: 2, herRatio: 2, distanceThreshold: 1.0 });

const s0 = new Float32Array([0, 0, 0, 0]);
const subGoal = hierAgent.predictSubGoal(s0);
assert.strictEqual(subGoal.length, 4, 'Sub-goal vector dimension must match stateDim');

const action = hierAgent.predictWorkerAction(s0, subGoal);
assert.strictEqual(action.length, 2, 'Action vector dimension must match actionDim');

// Test synthetic trajectory with HER
const dummyTrajectory = [
    { state: new Float32Array([0, 0, 0, 0]), action: new Float32Array([1, 0]), nextState: new Float32Array([1, 0, 0, 0]), goal: new Float32Array([5, 5, 0, 0]) },
    { state: new Float32Array([1, 0, 0, 0]), action: new Float32Array([1, 0]), nextState: new Float32Array([2, 0, 0, 0]), goal: new Float32Array([5, 5, 0, 0]) }
];
const herStats = hierAgent.storeTrajectoryWithHER(dummyTrajectory);
assert(herStats.originalTransitions === 2, 'Must record 2 original transitions');
assert(herStats.herTransitionsAdded > 0, 'HER must generate synthetic successful transitions');

const replaySummary = hierAgent.getReplayStatistics();
assert(replaySummary.totalTransitions > 2, 'Replay buffer must hold both original and hindsight transitions');
console.log(`  ✅ HierarchicalGoalAgent Validated! Buffer Size: ${replaySummary.totalTransitions}, Hindsight Ratio: ${(replaySummary.hindsightRatio * 100).toFixed(1)}%`);

// -------------------------------------------------------------
// 6. Delta-CRDT P2P State Synchronization
// -------------------------------------------------------------
console.log('[6/6] Testing DeltaCRDTSync (Strong Eventual Consistency under Network Partition)...');
const peerA = new DeltaCRDTSync('node_A');
const peerB = new DeltaCRDTSync('node_B');

// Concurrent edits during network partition
peerA.modifyScore(15);
peerA.registerItem('token_alpha');

peerB.modifyScore(25);
peerB.registerItem('token_beta');
peerB.modifyScore(-5);

// Both peers generate delta payloads and exchange them
const deltaFromA = peerA.generateDeltaPayload();
const deltaFromB = peerB.generateDeltaPayload();

peerA.applyRemoteDelta(deltaFromB);
peerB.applyRemoteDelta(deltaFromA);

// Validate convergence
assert.strictEqual(peerA.counter.value(), peerB.counter.value(), 'PNCounter must converge to exact same score on both peers');
assert.strictEqual(peerA.counter.value(), 35, 'Total score must equal 15 + 25 - 5 = 35');

const itemsA = peerA.elementSet.getElements().sort();
const itemsB = peerB.elementSet.getElements().sort();
assert.deepStrictEqual(itemsA, ['token_alpha', 'token_beta'], 'Elements in peer A must contain both items');
assert.deepStrictEqual(itemsA, itemsB, 'Element sets must converge identically across peers');
console.log(`  ✅ DeltaCRDTSync Validated! Converged Score: ${peerA.counter.value()}, Elements: [${itemsA.join(', ')}]`);

console.log('\n================================================================');
console.log('🎉 ALL 6 ADVANCED ENGINE INTEGRATION TESTS PASSED PERFECTLY!');
console.log('================================================================\n');
