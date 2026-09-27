/**
 * swarm_neuromorphic_systems.test.js
 *
 * Comprehensive unit and integration test suite for:
 * 1. Graph Neural Network (GNN) Message Passing & Swarm Topology Coordinator
 * 2. Byzantine Fault-Tolerant (BFT) Raft Gradient Consensus with Multi-Krum
 * 3. Continual Elastic Weight Consolidation (EWC) & Fisher Information Regularizer
 * 4. WebTransport QUIC Multiplexed Stream & Datagram Session Manager
 */

const assert = require('assert');
const GraphNeuralSwarmEngine = require('../src/ml/GraphNeuralSwarmEngine');
const BFTGradientConsensus = require('../src/security/BFTGradientConsensus');
const ContinualElasticWeightEngine = require('../src/ml/ContinualElasticWeightEngine');
const { WebTransportSessionManager, FRAME_TYPE } = require('../src/network/WebTransportSessionManager');

console.log('================================================================');
console.log('🧪 RUNNING SWARM, NEUROMORPHIC & BFT CONSENSUS TEST SUITE');
console.log('================================================================\n');

// 1. Test GraphNeuralSwarmEngine
console.log('[1/4] Testing GraphNeuralSwarmEngine (Dynamic Topology & Message Passing)...');
const gnn = new GraphNeuralSwarmEngine({
    featureDim: 6,
    hiddenDim: 16,
    outputDim: 3,
    communicationRadius: 25.0,
    maxNeighbors: 4
});

const mockAgents = [
    { id: 'agent_1', position: [0, 0, 0], velocity: [1, 0, 0] },
    { id: 'agent_2', position: [5, 2, 0], velocity: [0.8, 0.2, 0] },
    { id: 'agent_3', position: [8, -3, 0], velocity: [0.9, -0.1, 0] },
    { id: 'agent_4', position: [100, 100, 0], velocity: [0, 0, 0] } // Out of communication radius
];

const gnnResult = gnn.forward(mockAgents);
assert.strictEqual(gnnResult.actions.length, 4, 'Must produce actions for all 4 agents');
assert.strictEqual(gnnResult.embeddings.length, 4, 'Must produce GNN hidden embeddings for all agents');
assert(gnnResult.topology.nodeCount === 4, 'Topology must register 4 nodes');
assert(gnnResult.topology.edgeCount > 0, 'Clustered agents must establish communication edges');

// Validate acceleration bounds (-5 to +5 m/s^2)
for (const act of gnnResult.actions) {
    for (let c = 0; c < 3; c++) {
        assert(Math.abs(act.acceleration[c]) <= 5.0, 'Acceleration must remain within maximum bounded threshold');
    }
}
console.log(`  ✅ GraphNeuralSwarmEngine Validated! Edges: ${gnnResult.topology.edgeCount}, Passes: ${gnn.totalPassesExecuted}`);


// 2. Test BFTGradientConsensus (Multi-Krum Byzantine Defense)
console.log('\n[2/4] Testing BFTGradientConsensus (Multi-Krum & Poisoning Defense)...');
const bft = new BFTGradientConsensus({
    maxByzantineFraction: 0.33,
    multiKrumM: 2
});

// 5 nodes: 3 benign, 2 Byzantine adversaries
const benignGradient1 = [0.12, -0.05, 0.44, 0.81];
const benignGradient2 = [0.14, -0.04, 0.42, 0.79];
const benignGradient3 = [0.11, -0.06, 0.45, 0.82];
const poisonedGradient1 = [999.0, -888.0, 777.0, -666.0]; // Obvious exploding poison
const poisonedGradient2 = [-10.5, 12.4, -15.1, -22.0];    // Subtler directional poison

bft.submitGradient('benign_node_1', benignGradient1);
bft.submitGradient('benign_node_2', benignGradient2);
bft.submitGradient('benign_node_3', benignGradient3);
bft.submitGradient('byzantine_node_1', poisonedGradient1);
bft.submitGradient('byzantine_node_2', poisonedGradient2);

const consensusCommit = bft.aggregateRound();
assert.strictEqual(consensusCommit.totalProposals, 5, 'Must evaluate all 5 proposals');
assert.strictEqual(consensusCommit.benignCount, 2, 'Multi-Krum must select m=2 benign proposals');
assert(consensusCommit.consensusHash && consensusCommit.consensusHash.length === 64, 'Must issue SHA256 consensus hash');

// Byzantine nodes must not be in selected nodes
for (const sel of consensusCommit.selectedNodes) {
    assert(!sel.startsWith('byzantine'), `Byzantine node ${sel} must be rejected by Multi-Krum`);
}

// Averaged gradient must be close to ~[0.12, -0.05, 0.43, 0.80]
const avgG = consensusCommit.aggregatedGradient;
assert(Math.abs(avgG[0] - 0.12) < 0.05, 'Aggregated gradient x0 must match benign center');
assert(Math.abs(avgG[3] - 0.80) < 0.05, 'Aggregated gradient x3 must match benign center');
console.log(`  ✅ BFTGradientConsensus Validated! Selected: [${consensusCommit.selectedNodes.join(', ')}], Hash: ${consensusCommit.consensusHash.substring(0, 16)}...`);


// 3. Test ContinualElasticWeightEngine (EWC & Fisher Information)
console.log('\n[3/4] Testing ContinualElasticWeightEngine (Fisher Information & EWC Loss)...');
const ewc = new ContinualElasticWeightEngine({
    fisherWeightLambda: 200.0
});

const task1Optima = [1.5, -0.8, 2.2, 0.4];
// Simulate 4 sample gradients from task 1 validation set
const task1SampleGradients = [
    [0.1, -0.2, 0.05, 0.1],
    [0.08, -0.18, 0.04, 0.12],
    [0.12, -0.22, 0.06, 0.09],
    [0.09, -0.21, 0.05, 0.11]
];

const consolidation = ewc.consolidateTask('biome_1_linear', task1Optima, task1SampleGradients);
assert.strictEqual(consolidation.taskId, 'biome_1_linear');
assert(consolidation.traceFIM > 0, 'Fisher Information trace must be strictly positive');

// At optimal weights, EWC penalty loss must be zero
const lossAtOptima = ewc.computeEWCLoss(task1Optima);
assert(Math.abs(lossAtOptima) < 1e-5, 'Loss at task 1 optimum must be 0');

// Perturbed weights should incur quadratic penalty
const perturbedWeights = [1.7, -0.8, 2.2, 0.4]; // delta = +0.2 on index 0
const lossPerturbed = ewc.computeEWCLoss(perturbedWeights);
assert(lossPerturbed > 0, 'Perturbed parameters must incur positive EWC penalty');

// Check analytic gradient
const grad = ewc.computeEWCGradient(perturbedWeights);
assert(grad[0] > 0, 'Gradient with respect to perturbed positive delta must be positive (restoring force)');
assert(Math.abs(grad[1]) < 1e-5, 'Unperturbed parameters must have zero EWC gradient');

const drift = ewc.evaluateTaskDrift(perturbedWeights);
assert.strictEqual(drift.length, 1);
assert(Math.abs(drift[0].euclideanDrift - 0.2) < 1e-4, 'Euclidean drift must equal perturbation');
console.log(`  ✅ ContinualElasticWeightEngine Validated! Loss: ${lossPerturbed.toFixed(4)}, Trace(FIM): ${consolidation.traceFIM.toFixed(4)}`);


// 4. Test WebTransportSessionManager
console.log('\n[4/4] Testing WebTransportSessionManager (QUIC Datagrams, Streams & Migration)...');
const wt = new WebTransportSessionManager({
    maxDatagramSize: 1200,
    sessionTimeoutMs: 5000
});

const clientToken = 'client_neural_token_abc123';
const sessionDesc = wt.createSession(clientToken, '192.168.1.100:4433');
assert(sessionDesc.sessionId.startsWith('wt_'), 'Session ID must have wt_ prefix');

// Datagram transmission and receipt
const posPayload = Buffer.from(new Float32Array([12.5, 4.2, -8.1]).buffer);
const datagram = wt.sendDatagram(sessionDesc.sessionId, FRAME_TYPE.DATAGRAM_KINEMATICS, posPayload);
assert(datagram.length === 5 + posPayload.length, 'Datagram length must match header + payload');

const decodedDatagram = wt.receiveDatagram(sessionDesc.sessionId, datagram);
assert.strictEqual(decodedDatagram.frameType, FRAME_TYPE.DATAGRAM_KINEMATICS);
const receivedCoords = new Float32Array(decodedDatagram.payload.buffer.slice(decodedDatagram.payload.byteOffset, decodedDatagram.payload.byteOffset + decodedDatagram.payload.byteLength));
assert(Math.abs(receivedCoords[0] - 12.5) < 1e-4);

// Stream multiplexing
const streamId = wt.openStream(sessionDesc.sessionId, 'BIDIRECTIONAL');
assert(streamId > 0, 'Stream ID must be positive');

const streamChunk = Buffer.from('BFT_BALLOT_PAYLOAD_COMMIT');
const framedStream = wt.writeStreamChunk(sessionDesc.sessionId, streamId, streamChunk);
assert(framedStream.length === 8 + streamChunk.length, 'Framed stream must include 8-byte header');

// Connection migration test (Wi-Fi -> Cellular 5G)
const migratedId = wt.handleConnectionMigration(clientToken, '10.0.4.55:54321');
assert.strictEqual(migratedId, sessionDesc.sessionId, 'Connection migration must retain existing session');
const sessionRecord = wt.sessions.get(migratedId);
assert.strictEqual(sessionRecord.remoteAddress, '10.0.4.55:54321', 'Session must update to new remote address');

console.log(`  ✅ WebTransportSessionManager Validated! Datagrams: ${wt.metrics.totalDatagramsSent}, Migrations: ${wt.metrics.connectionMigrations}`);

console.log('\n================================================================');
console.log('🎉 ALL 4 SWARM, NEUROMORPHIC & BFT TESTS PASSED!');
console.log('================================================================\n');
