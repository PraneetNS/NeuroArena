/**
 * v4_frontier_systems.test.js
 *
 * Comprehensive integration test suite for NeuroArena v4.0 Frontier Architecture:
 * 1. Non-Equilibrium Thermodynamic Work & Jarzynski Free Energy Engine
 * 2. Cellular Sheaf Neural Network & Laplacian Consensus Engine
 * 3. Turing Reaction-Diffusion & Bioelectric Morphogenetic Pattern Engine
 * 4. Gauge-Equivariant Icosahedral Spherical Mesh CNN Engine
 * 5. Partial Information Decomposition & Schreiber Transfer Entropy Engine
 * 6. Continuous-Variable Bosonic Fock State & Wigner Quasiprobability Engine
 * 7. Renormalization Group Active Inference & Variational Free Energy Engine
 * 8. Directed Algebraic Topology & Precubical Deadlock Engine
 * 9. Post-Quantum Module-LWE Key Encapsulation & Lattice Signature Engine
 * 10. Verifiable Random Function (VRF) & Cryptographic Sortition Engine
 * 11. Reed-Solomon Erasure Coding & Zero-Latency Packet Recovery Engine
 * 12. Tripartite Synapse & Astrocyte Gliotransmission Metaplasticity Engine
 */

const assert = require('assert');
const ThermodynamicWorkEngine = require('../src/physics/ThermodynamicWorkEngine');
const CellularSheafEngine = require('../src/ml/CellularSheafEngine');
const MorphogeneticPatternEngine = require('../src/neuromorphic/MorphogeneticPatternEngine');
const GaugeEquivariantEngine = require('../src/ml/GaugeEquivariantEngine');
const PartialInformationDecomposition = require('../src/causal/PartialInformationDecomposition');
const ContinuousVariableQuantumEngine = require('../src/ml/ContinuousVariableQuantumEngine');
const RenormalizationActiveInference = require('../src/control/RenormalizationActiveInference');
const DirectedTopologyEngine = require('../src/ml/DirectedTopologyEngine');
const PostQuantumEngine = require('../src/security/PostQuantumEngine');
const VRFConsensusEngine = require('../src/network/VRFConsensusEngine');
const ReedSolomonFEC = require('../src/network/ReedSolomonFEC');
const AstrocyteGliotransmissionEngine = require('../src/neuromorphic/AstrocyteGliotransmissionEngine');

console.log('================================================================');
console.log('🧪 RUNNING NEUROARENA v4.0 FRONTIER SYSTEMS INTEGRATION TEST SUITE');
console.log('================================================================\n');

// -------------------------------------------------------------
// 1. ThermodynamicWorkEngine
// -------------------------------------------------------------
console.log('[1/12] Testing ThermodynamicWorkEngine (Jarzynski Equality & Crooks Fluctuation)...');
const thermo = new ThermodynamicWorkEngine({ temperature: 300.0, boltzmannK: 1.0, frictionGamma: 0.2 });

const workSamples = [];
for (let i = 0; i < 25; i++) {
    const res = thermo.simulateProtocol({ x0: -1.0, lambdaStart: 0.0, lambdaEnd: 1.0, steps: 60, dt: 0.01 });
    workSamples.push(res.work);
}

const jarzynskiResult = thermo.computeJarzynskiFreeEnergy(workSamples);
assert(typeof jarzynskiResult.freeEnergyDifference === 'number', 'Free energy diff should be a number');
assert(jarzynskiResult.sampleCount === 25, 'Sample count must match');
console.log(`  ✅ ThermodynamicWorkEngine Validated! Jarzynski ΔF: ${jarzynskiResult.freeEnergyDifference.toFixed(4)}, Mean Work: ${jarzynskiResult.meanWork.toFixed(4)}`);

// -------------------------------------------------------------
// 2. CellularSheafEngine
// -------------------------------------------------------------
console.log('[2/12] Testing CellularSheafEngine (Sheaf Laplacian & Stalk Diffusion)...');
const sheaf = new CellularSheafEngine({ stalkDim: 2, diffusionStep: 0.05 });
const rot45 = CellularSheafEngine.createRotationRestriction(Math.PI / 4);

sheaf.addEdge('nodeA', 'nodeB', rot45, null);
sheaf.addEdge('nodeB', 'nodeC', null, rot45);
sheaf.addEdge('nodeC', 'nodeA', rot45, rot45);

const L = sheaf.buildSheafLaplacian();
assert(L.length === 6 && L[0].length === 6, 'Sheaf Laplacian size must be |V| * d = 6');

// Verify symmetry: L_ij == L_ji
for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
        assert(Math.abs(L[i][j] - L[j][i]) < 1e-9, 'Laplacian must be symmetric');
    }
}

const initial0Cochain = {
    nodeA: [1.0, 0.0],
    nodeB: [0.0, 1.0],
    nodeC: [0.5, 0.5]
};
const diffResult = sheaf.diffuse(initial0Cochain, 20);
assert(diffResult.energyDecreased, 'Dirichlet energy must decrease under Sheaf diffusion');
console.log(`  ✅ CellularSheafEngine Validated! Initial Energy: ${diffResult.initialEnergy.toFixed(4)} -> Final: ${diffResult.finalEnergy.toFixed(4)}`);

// -------------------------------------------------------------
// 3. MorphogeneticPatternEngine
// -------------------------------------------------------------
console.log('[3/12] Testing MorphogeneticPatternEngine (Turing Reaction-Diffusion & Bio-Electric Coupling)...');
const morpho = new MorphogeneticPatternEngine({ width: 24, height: 24, Du: 0.16, Dv: 0.08, feed: 0.035, kill: 0.065 });
morpho.setBioelectricPotential(12, 12, 15.0); // Modulate center
morpho.evolve(30);

const patternMetrics = morpho.getPatternMetrics();
assert(patternMetrics.meanU > 0.0 && patternMetrics.meanU <= 1.0, 'Morphogen U in valid range');
assert(patternMetrics.meanV >= 0.0 && patternMetrics.meanV <= 1.0, 'Morphogen V in valid range');
console.log(`  ✅ MorphogeneticPatternEngine Validated! Var(V): ${patternMetrics.varV.toFixed(6)}, Boundaries: ${patternMetrics.boundaryCount}`);

// -------------------------------------------------------------
// 4. GaugeEquivariantEngine
// -------------------------------------------------------------
console.log('[4/12] Testing GaugeEquivariantEngine (SO(2) Gauge Invariance & Parallel Transport)...');
const gaugeCNN = new GaugeEquivariantEngine({ featureDim: 2, numHarmonics: 2 });
gaugeCNN.addVertex('v1', [0, 0, 1], 0.0);
gaugeCNN.addVertex('v2', [1, 0, 0], Math.PI / 6);
gaugeCNN.addEdge('v1', 'v2', 0.1, 0.2);
gaugeCNN.addEdge('v2', 'v1', -0.1, 0.2);

const testFeatures = {
    v1: [1.2, -0.4],
    v2: [0.5, 0.9]
};

const convOut = gaugeCNN.convolve(testFeatures);
assert(convOut.v1 && convOut.v2, 'Convolved outputs exist');

const eqCheck = gaugeCNN.verifyEquivariance(testFeatures, 'v1', Math.PI / 3);
assert(eqCheck.isEquivariant, 'Kernel convolution must be gauge-equivariant');
console.log(`  ✅ GaugeEquivariantEngine Validated! Max Gauge Deviation: ${eqCheck.maxDeviation.toExponential(4)}`);

// -------------------------------------------------------------
// 5. PartialInformationDecomposition
// -------------------------------------------------------------
console.log('[5/12] Testing PartialInformationDecomposition (Williams-Beer Lattice & Synergy)...');
const pid = new PartialInformationDecomposition({ numBins: 2 });
// Construct XOR-like synergistic relationship: Y = X1 ^ X2
const x1 = [0, 0, 1, 1, 0, 0, 1, 1, 0, 1];
const x2 = [0, 1, 0, 1, 0, 1, 0, 1, 1, 0];
const y  = [0, 1, 1, 0, 0, 1, 1, 0, 1, 1];

const pidResult = pid.computePID(y, x1, x2);
assert(pidResult.redundancy >= 0, 'Redundancy non-negative');
assert(pidResult.unique1 >= 0, 'Unique1 non-negative');
assert(pidResult.unique2 >= 0, 'Unique2 non-negative');
assert(pidResult.synergy >= 0, 'Synergy non-negative');

const teResult = pid.computeTransferEntropy(x1, y, 1);
assert(teResult.transferEntropyBits >= 0, 'Transfer entropy non-negative');
console.log(`  ✅ PartialInformationDecomposition Validated! Total MI: ${pidResult.totalMutualInformation.toFixed(3)}, Synergy: ${pidResult.synergy.toFixed(3)}, TE: ${teResult.transferEntropyBits.toFixed(3)} bits`);

// -------------------------------------------------------------
// 6. ContinuousVariableQuantumEngine
// -------------------------------------------------------------
console.log('[6/12] Testing ContinuousVariableQuantumEngine (Fock States & Wigner Negativity)...');
const cvQ = new ContinuousVariableQuantumEngine({ cutoff: 6 });
cvQ.setFockState(1); // Single photon |1\rangle state exhibits negative Wigner core

const expVals = cvQ.computeExpectationValues();
assert(Math.abs(expVals.meanN - 1.0) < 1e-6, 'Fock state |1> must have mean photon number = 1.0');

// Evaluate Wigner at origin (q=0, p=0): W_1(0, 0) = -1/\pi < 0
const wOrigin = cvQ.evaluateWigner(0.0, 0.0);
assert(wOrigin < 0.0, 'Wigner function at origin of |1> state must be strictly negative');

const wNeg = cvQ.computeWignerNegativity(12, 2.5);
assert(wNeg.isNonClassical, 'Fock |1> state must exhibit quantum non-classicality');
console.log(`  ✅ ContinuousVariableQuantumEngine Validated! W(0,0): ${wOrigin.toFixed(4)}, Wigner Negativity: ${wNeg.negativity.toFixed(4)}`);

// -------------------------------------------------------------
// 7. RenormalizationActiveInference
// -------------------------------------------------------------
console.log('[7/12] Testing RenormalizationActiveInference (Wilsonian RG & Variational Free Energy)...');
const actInf = new RenormalizationActiveInference({ stateDim: 4, actionCount: 4, rgLevels: 3 });

const microSignals = [1.2, 0.4, -0.3, 0.8, 1.5, 0.1, -0.9, 0.3];
const rgPyramid = actInf.applyRenormalizationGroup(microSignals);
assert(rgPyramid.length === 3, 'RG coarse-graining pyramid must have 3 levels');

const percResult = actInf.updatePerception([1.0, 0.5, -0.2, 0.8], 0.1, 10);
assert(typeof percResult.freeEnergy === 'number', 'Variational free energy must be finite');

const policyDecision = actInf.selectAction();
assert(policyDecision.selectedAction >= 0 && policyDecision.selectedAction < 4, 'Valid action sampled');
console.log(`  ✅ RenormalizationActiveInference Validated! Free Energy F: ${percResult.freeEnergy.toFixed(4)}, Selected Policy: ${policyDecision.selectedAction}`);

// -------------------------------------------------------------
// 8. DirectedTopologyEngine
// -------------------------------------------------------------
console.log('[8/12] Testing DirectedTopologyEngine (d-Topology, Mutex Regions & Dipath Homotopy)...');
const dTop = new DirectedTopologyEngine({ dimensions: 2 });
// Mutual exclusion zone in middle: [2, 2] to [3, 3]
dTop.addForbiddenRegion([2.0, 2.0], [3.0, 3.0]);

// Valid monotonic path going around obstacle
const pathA = [[0, 0], [1, 0], [2, 0], [3.5, 0], [3.5, 2], [3.5, 4], [4, 4]];
const valA = dTop.validateDipath(pathA);
assert(valA.isValidDipath, 'Path A must be a valid dipath');

// Non-monotonic path (reversing direction)
const pathInvalid = [[0, 0], [2, 2], [1, 1]];
const valInv = dTop.validateDipath(pathInvalid);
assert(!valInv.isValidDipath, 'Non-monotonic path must be flagged');

console.log(`  ✅ DirectedTopologyEngine Validated! Validated Dipath length: ${valA.pathLength}, Collisions: ${valA.forbiddenCollisions}`);

// -------------------------------------------------------------
// 9. PostQuantumEngine
// -------------------------------------------------------------
console.log('[9/12] Testing PostQuantumEngine (Module-LWE Kyber Encapsulation & Falcon Norm)...');
const pq = new PostQuantumEngine({ n: 16, q: 3329, k: 2, eta: 2 });

const keyPair = pq.generateKeyPair('test-pqc-seed');
const msgBits = [1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 0, 1];
const ct = pq.encrypt(keyPair.publicKey, msgBits);
const recoveredBits = pq.decrypt(keyPair.secretKey, ct);

let bitErrors = 0;
for (let i = 0; i < 16; i++) {
    if (msgBits[i] !== recoveredBits[i]) bitErrors++;
}
assert(bitErrors === 0, `M-LWE decryption must be error-free (found ${bitErrors} errors)`);

const sigCheck = pq.verifyLatticeSignature([12, -4, 9, 3, -15, 0, 8, -2], 1200);
assert(sigCheck.isValid, 'Lattice signature norm must satisfy bound');
console.log(`  ✅ PostQuantumEngine Validated! Bit Errors: 0/16, Falcon Norm: ${sigCheck.euclideanNorm.toFixed(2)} <= ${sigCheck.bound}`);

// -------------------------------------------------------------
// 10. VRFConsensusEngine
// -------------------------------------------------------------
console.log('[10/12] Testing VRFConsensusEngine (RFC 9381 Fiat-Shamir ZK Proof & Sortition)...');
const vrf = new VRFConsensusEngine();
const vrfKeys = vrf.generateKeyPair();
const roundSeed = 'epoch-42-shard-alpha';

const vrfProof = vrf.prove(vrfKeys.secretKey, roundSeed);
const isVerified = vrf.verify(vrfKeys.publicKey, roundSeed, vrfProof.beta, vrfProof.proof);
assert(isVerified === true, 'VRF proof must verify successfully');

// Tamper test
const isTamperedVerified = vrf.verify(vrfKeys.publicKey, 'epoch-42-shard-beta', vrfProof.beta, vrfProof.proof);
assert(isTamperedVerified === false, 'Tampered input seed must fail verification');

console.log(`  ✅ VRFConsensusEngine Validated! VRF Beta: ${vrfProof.beta.substring(0, 16)}..., Verified: ${isVerified}`);

// -------------------------------------------------------------
// 11. ReedSolomonFEC
// -------------------------------------------------------------
console.log('[11/12] Testing ReedSolomonFEC (GF(2^8) Erasure Coding & Burst Recovery)...');
const fec = new ReedSolomonFEC(4, 2); // 4 data + 2 parity packets = 6 total

const src0 = new Uint8Array([10, 20, 30, 40]);
const src1 = new Uint8Array([50, 60, 70, 80]);
const src2 = new Uint8Array([90, 100, 110, 120]);
const src3 = new Uint8Array([130, 140, 150, 160]);

const codedPackets = fec.encode([src0, src1, src2, src3]);
assert(codedPackets.length === 6, 'Must generate 6 coded packets');

// Simulate burst packet drop: lose packets at index 0 and 2
const survivedPackets = [codedPackets[1], codedPackets[3], codedPackets[4], codedPackets[5]];
const recoveredBuffers = fec.decode(survivedPackets);

assert.deepStrictEqual(recoveredBuffers[0], src0, 'Packet 0 recovered perfectly');
assert.deepStrictEqual(recoveredBuffers[1], src1, 'Packet 1 recovered perfectly');
assert.deepStrictEqual(recoveredBuffers[2], src2, 'Packet 2 recovered perfectly');
assert.deepStrictEqual(recoveredBuffers[3], src3, 'Packet 3 recovered perfectly');
console.log(`  ✅ ReedSolomonFEC Validated! Recovered 4/4 source packets from 2 parity survivors`);

// -------------------------------------------------------------
// 12. AstrocyteGliotransmissionEngine
// -------------------------------------------------------------
console.log('[12/12] Testing AstrocyteGliotransmissionEngine (Tripartite Synapse & Calcium Waves)...');
const astro = new AstrocyteGliotransmissionEngine({ synapseCount: 4, caThreshold: 0.25 });

// Train with burst of presynaptic action potentials to elevate calcium
let astroTelemetry;
for (let t = 0; t < 40; t++) {
    astroTelemetry = astro.step([1, 1, 1, 0], [1, 0, 1, 0]);
}

assert(astroTelemetry.ip3 > 0.1, 'Astrocytic IP_3 must increase in response to glutamate');
assert(astroTelemetry.calcium > 0.08, 'Astrocytic Ca2+ must increase');
assert(astroTelemetry.astroModulationFactor >= 1.0, 'Metaplastic modulation factor >= 1.0');
console.log(`  ✅ AstrocyteGliotransmissionEngine Validated! [Ca2+]: ${astroTelemetry.calcium.toFixed(4)} μM, Gliotransmitter Modulation: x${astroTelemetry.astroModulationFactor.toFixed(3)}`);

console.log('\n================================================================');
console.log('🎉 ALL 12 NEUROARENA v4.0 FRONTIER INTEGRATION TESTS PASSED!');
console.log('================================================================\n');
