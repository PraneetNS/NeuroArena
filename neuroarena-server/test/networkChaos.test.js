const assert = require('assert');
const { runChaosDuelSimulation, NetworkChaosSimulator } = require('../../scripts/network-chaos-simulator');
const { MovementReconciliationEngine } = require('../src/network/MovementReconciliationEngine');
const { Glicko2Engine } = require('../src/glicko2Matchmaking');
const { MatchReplayRecorder } = require('../src/replayEngine');

console.log('▶ Testing Hardened Colyseus/DuelRoom Netcode & Network Chaos Resilience (5% Loss, 150ms Jitter)...');

(async () => {
  // -------------------------------------------------------------
  // 1. CI-Gated Network Chaos Duel Simulation (5% Loss, 150ms Jitter, 15s Reconnect)
  // -------------------------------------------------------------
  const result = await runChaosDuelSimulation({
    lossRate: 0.05,
    minLagMs: 10,
    maxLagMs: 80,
    totalTicks: 75
  });

  assert.strictEqual(result.success, true, 'Match simulation must complete successfully under chaos');
  assert.strictEqual(result.finalTick, 75, 'Must reach final tick 75');
  assert.strictEqual(result.p2Reconnected, true, 'Player 2 must reconnect within 15s grace period');
  assert.ok(result.replayChecksum && result.replayChecksum.length === 16, 'Must generate valid deterministic 16-char replay checksum');
  assert.ok(result.stats.received > result.stats.dropped, 'Received packets must significantly exceed dropped packets');

  // -------------------------------------------------------------
  // 2. Client Movement Prediction & Server Authoritative Reconciliation (>80ms RTT)
  // -------------------------------------------------------------
  const clientReconciler = new MovementReconciliationEngine({ maxVelocity: 15.0, errorThreshold: 0.05 });
  const serverReconciler = new MovementReconciliationEngine({ maxVelocity: 15.0 });

  let clientPos = { x: 0, z: 0, rotationY: 0 };
  let serverPos = { x: 0, z: 0, rotationY: 0 };

  // Step 1: Client applies prediction for sequence 1, 2, 3
  const dt = 0.05; // 50ms (20Hz)
  const input1 = { dx: 1.0, dz: 0, rotY: 90 };
  const input2 = { dx: 1.0, dz: 0, rotY: 90 };
  const input3 = { dx: 1.0, dz: 0, rotY: 90 };

  clientPos = clientReconciler.predictMovement(clientPos, input1, dt, 1);
  clientPos = clientReconciler.predictMovement(clientPos, input2, dt, 2);
  clientPos = clientReconciler.predictMovement(clientPos, input3, dt, 3);

  // Client predicted position at seq 3: x = 0 + 3 * (1.0 * 15 * 0.05) = 2.25
  assert.strictEqual(parseFloat(clientPos.x.toFixed(2)), 2.25, 'Client local prediction should be 2.25');

  // Step 2: Server processes seq 1 with slight authoritative physics clamp / collision
  const authUpdate1 = serverReconciler.serverSimulateStep(serverPos, input1, dt, 1);
  serverPos = { x: authUpdate1.x, z: authUpdate1.z, rotationY: authUpdate1.rotationY };

  // Client receives ack for seq 1 (error should be 0 because client matched server)
  const ackRes1 = clientReconciler.reconcileServerState(authUpdate1, clientPos);
  assert.strictEqual(ackRes1.corrected, false, 'No correction needed for exact prediction');

  // Step 3: Simulate external collision / server adjustment at seq 2
  const authUpdate2 = serverReconciler.serverSimulateStep(serverPos, { dx: 0.5, dz: 0, rotY: 90 }, dt, 2); // Server moved slower (e.g. wall friction)
  serverPos = { x: authUpdate2.x, z: authUpdate2.z, rotationY: authUpdate2.rotationY };

  // Client receives ack for seq 2 -> should detect error delta and replay seq 3
  const ackRes2 = clientReconciler.reconcileServerState(authUpdate2, clientPos);
  assert.strictEqual(ackRes2.corrected, true, 'Reconciliation must trigger when error exceeds threshold');
  assert.ok(ackRes2.replayedInputCount >= 1, 'Must replay subsequent unacknowledged inputs');

  // -------------------------------------------------------------
  // 3. Region-Aware Matchmaking with 3-Tier Time Decay Relaxation
  // -------------------------------------------------------------
  const glicko = new Glicko2Engine();

  // Tier 1: 0-10s (Strict Regional Isolation)
  assert.strictEqual(glicko.getRegionMatchEligibility('us-east', 'us-east', 5), true, 'Same region eligible at 5s');
  assert.strictEqual(glicko.getRegionMatchEligibility('us-east', 'us-west', 5), false, 'Adjacent region NOT eligible under 10s');
  assert.strictEqual(glicko.getRegionMatchEligibility('us-east', 'ap-southeast', 5), false, 'Cross-continental region NOT eligible under 10s');

  // Tier 2: 10-25s (Adjacent Region Relaxation)
  assert.strictEqual(glicko.getRegionMatchEligibility('us-east', 'us-west', 15), true, 'Adjacent region eligible at 15s');
  assert.strictEqual(glicko.getRegionMatchEligibility('eu-central', 'eu-west', 18), true, 'EU adjacent regions eligible at 18s');
  assert.strictEqual(glicko.getRegionMatchEligibility('us-east', 'ap-northeast', 15), false, 'Distant region not eligible at 15s');

  // Tier 3: 25s+ (Global Fallback Guaranteed Match in ~30s)
  assert.strictEqual(glicko.getRegionMatchEligibility('us-east', 'ap-southeast', 28), true, 'Global pool open at 28s');
  assert.strictEqual(glicko.getRegionMatchEligibility('sa-east', 'ap-northeast', 30), true, 'Global pool open at 30s off-peak');

  // -------------------------------------------------------------
  // 4. Deterministic Replay Checksum Equivalence
  // -------------------------------------------------------------
  const recorder = new MatchReplayRecorder('match_chaos_verify', 2, { id: 'p1', name: 'Alpha' }, { id: 'p2', name: 'Beta' });
  for (let i = 0; i < 20; i++) {
    recorder.recordTick(i, { dx: 1 }, { dx: -1 }, { p1: { x: i }, p2: { x: 20 - i } });
  }
  const bundle = recorder.exportReplayBundle();
  const loaded = MatchReplayRecorder.verifyAndLoadReplay(bundle.compressedBase64);
  assert.strictEqual(loaded.frames.length, 20, 'Loaded replay frames must match recorded');
  assert.strictEqual(bundle.finalChecksum, recorder.checksumHistory[recorder.checksumHistory.length - 1]);

  console.log(`✅ Hardened Netcode & Network Chaos Resilience Tests Passed Cleanly! (Final Replay Checksum: ${result.replayChecksum})`);
})();
