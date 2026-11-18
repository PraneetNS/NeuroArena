const assert = require('assert');
const { CheatDetectionEngine } = require('../src/cheatDetection');

console.log('▶ Testing CheatDetectionEngine telemetry & exploit flags...');

const detector = new CheatDetectionEngine({
  maxVelocity: 20.0,
  maxAngularAcc: 360.0,
  quarantineThreshold: 65
});

// Normal movement test
const r1 = detector.evaluateMovement('player_legit', 0, 0, 0, 0, 1000);
assert.strictEqual(r1.suspicious, false);

const r2 = detector.evaluateMovement('player_legit', 5, 0, 0, 10, 2000); // 5 units in 1s = 5m/s (ok)
assert.strictEqual(r2.suspicious, false);
assert.strictEqual(detector.isQuarantined('player_legit'), false);

// Teleport / Speedhack test
const r3 = detector.evaluateMovement('player_hacker', 0, 0, 0, 0, 1000);
const r4 = detector.evaluateMovement('player_hacker', 500, 0, 0, 0, 1050); // 500 units in 50ms = 10000m/s!
assert.strictEqual(r4.suspicious, true);
assert.strictEqual(r4.reason, 'EXCESSIVE_VELOCITY');

// Spinbot test
const r5 = detector.evaluateMovement('player_spinbot', 0, 0, 0, 0, 1000);
const r6 = detector.evaluateMovement('player_spinbot', 0, 0, 0, 179, 1020); // 179 deg in 20ms = ~8950 deg/s!
assert.strictEqual(r6.suspicious, true);
assert.strictEqual(r6.reason, 'INSTANT_SNAP_SPINBOT');

// Fake training loss check
const r7 = detector.evaluateTrainingStep('player_hacker', 10.0, 0.000001, 1, 2);
assert.strictEqual(r7.suspicious, true);

// Quarantine check
assert.strictEqual(detector.isQuarantined('player_hacker'), true);

console.log('✅ CheatDetectionEngine Telemetry & Flagging Test Passed Cleanly!');
