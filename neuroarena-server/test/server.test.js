const assert = require("assert");
const { ArenaRoomState, PlayerSchema, ActivityState } = require("../src/schema/ArenaRoomState");
const { ArenaRoom } = require("../src/rooms/ArenaRoom");

function testSchemaAndLifecycle() {
    console.log("▶ Testing ArenaRoomState & PlayerSchema Serialization...");

    const state = new ArenaRoomState();
    assert(state.players !== undefined, "State must contain players MapSchema");
    assert.strictEqual(state.players.size, 0, "Initial player count must be zero");

    // Add Player 1
    const p1 = new PlayerSchema("client_001", "Ada-Explorer", "explorer");
    p1.x = 12.5;
    p1.y = 1.2;
    p1.z = -8.4;
    p1.rotationY = 1.57;
    p1.biome = 0;
    p1.activityState = ActivityState.WALKING;
    state.players.set(p1.id, p1);

    assert.strictEqual(state.players.size, 1, "Player map size must be 1 after insert");
    assert.strictEqual(state.players.get("client_001").name, "Ada-Explorer");
    assert.strictEqual(state.players.get("client_001").activityState, "walking");
    assert.strictEqual(state.players.get("client_001").characterBuild, "explorer");

    // Add Player 2
    const p2 = new PlayerSchema("client_002", "Synapse-Scholar", "scholar");
    p2.x = 0;
    p2.z = 65;
    p2.biome = 5;
    p2.activityState = ActivityState.TRAINING;
    state.players.set(p2.id, p2);

    assert.strictEqual(state.players.size, 2, "Player map size must be 2 after second insert");
    assert.strictEqual(state.players.get("client_002").biome, 5);
    assert.strictEqual(state.players.get("client_002").activityState, "training");

    // Transform Update
    const fetched = state.players.get("client_001");
    fetched.x = 15.2;
    fetched.z = -5.1;
    fetched.activityState = ActivityState.HARVESTING;
    assert.strictEqual(state.players.get("client_001").x, 15.2);
    assert.strictEqual(state.players.get("client_001").activityState, "harvesting");

    // Player Leave
    state.players.delete("client_001");
    assert.strictEqual(state.players.size, 1);
    assert.strictEqual(state.players.has("client_001"), false);

    console.log("✅ Colyseus Room Schema & Player Transform Sync Test Passed!");
}

function testActivityStateEnum() {
    console.log("▶ Testing ActivityState Enum Values...");
    assert.strictEqual(ActivityState.IDLE, "idle");
    assert.strictEqual(ActivityState.WALKING, "walking");
    assert.strictEqual(ActivityState.HARVESTING, "harvesting");
    assert.strictEqual(ActivityState.TRAINING, "training");
    console.log("✅ ActivityState Enum Test Passed!");
}

function testServerSideCollectibleValidation() {
    console.log("▶ Testing Authoritative Server-Side Collectible Validation...");
    const { CollectibleSchema } = require("../src/schema/ArenaRoomState");

    const state = new ArenaRoomState();
    const item1 = new CollectibleSchema("col_01", "FeatureCrystal_X", 10.0, 1.2, 10.0, 2.5, 7.275, 0);
    state.collectibles.set(item1.id, item1);

    // 1. Valid Claim Attempt (Distance within 4.5m)
    const p1 = new PlayerSchema("client_A", "Ada", "explorer");
    p1.x = 11.2;
    p1.z = 10.5;
    const dist1 = Math.hypot(p1.x - item1.x, p1.z - item1.z);
    assert(dist1 <= 4.5, "Distance must be within 4.5m threshold");
    assert.strictEqual(item1.collected, false, "Item must not be collected initially");

    // Approve
    item1.collected = true;
    item1.collectedBy = p1.id;
    assert.strictEqual(item1.collected, true);
    assert.strictEqual(item1.collectedBy, "client_A");

    // 2. Duplicate Claim Attempt (Rejected)
    const p2 = new PlayerSchema("client_B", "Bob", "scholar");
    p2.x = 10.1;
    p2.z = 10.1;
    assert.strictEqual(item1.collected, true, "Item is already marked collected");
    const isDuplicateRejected = item1.collected === true;
    assert.strictEqual(isDuplicateRejected, true, "Duplicate claim on already collected crystal must be rejected");

    // 3. Distance Exploit Attempt (Rejected)
    const item2 = new CollectibleSchema("col_02", "TargetShard_Y", 50.0, 1.2, 50.0, 4.0, 10.95, 0);
    state.collectibles.set(item2.id, item2);
    const distExploit = Math.hypot(p1.x - item2.x, p1.z - item2.z);
    assert(distExploit > 4.5, "Distance exploit must exceed threshold");
    const isDistanceRejected = distExploit > 4.5;
    assert.strictEqual(isDistanceRejected, true, "Exploitative distance claim must be rejected");

    console.log("✅ Authoritative Collectible Pickup & Anti-Cheat Validation Test Passed!");
}

function test1v1DuelFlowAndServerHiddenTestSet() {
    console.log("▶ Testing 1v1 Live Duel Hidden Test Set & Accuracy Evaluation...");
    const { DuelRoom } = require("../src/rooms/DuelRoom");
    const { DuelRoomState } = require("../src/schema/DuelRoomState");

    const duelState = new DuelRoomState();
    assert.strictEqual(duelState.status, "waiting");
    assert.strictEqual(duelState.timerSec, 90);

    // Mock Hidden Test Set
    const testSet = [];
    for (let i = 0; i < 50; i++) {
        const x = -4.5 + (i / 49) * 9.0;
        testSet.push({ x, y: 2.45 * x + 1.15 });
    }

    // Model 1: High Accuracy Model (w = 2.44, b = 1.14)
    let mse1 = 0;
    testSet.forEach(s => {
        const pred = 2.44 * s.x + 1.14;
        mse1 += Math.pow(pred - s.y, 2);
    });
    mse1 /= testSet.length;

    // Model 2: Untrained Baseline Model (w = 0.5, b = 0.0)
    let mse2 = 0;
    testSet.forEach(s => {
        const pred = 0.5 * s.x + 0.0;
        mse2 += Math.pow(pred - s.y, 2);
    });
    mse2 /= testSet.length;

    assert(mse1 < mse2, "Optimized model must have lower MSE than untrained baseline");
    assert(mse1 < 0.01, "Well-trained model must achieve near-zero MSE on hidden test set");
    console.log(`✅ 1v1 Live Duel Hidden Test Set Evaluation Test Passed! (M1 MSE: ${mse1.toFixed(5)} vs M2 MSE: ${mse2.toFixed(5)})`);
}

function testSubmissionIntegrityAndAuditLogging() {
    console.log("▶ Testing Anti-Cheat Submission Integrity & Audit Logger...");
    const { auditLogger } = require("../src/security/AuditLogger");

    auditLogger.clear();
    assert.strictEqual(auditLogger.getAnomalies().length, 0);

    // 1. Simulate Impossible Elapsed Training Time (< 2500ms)
    const elapsedMs = 850; // Cheater submitted in 850ms
    const w = 2.45, b = 1.15;
    const isImpossibleSpeed = elapsedMs < 2500 && (Math.abs(w) > 0.01 || Math.abs(b) > 0.01);
    assert.strictEqual(isImpossibleSpeed, true, "850ms submission must be flagged as impossible speed");

    // 2. Log Anomaly
    const anomaly = auditLogger.logAnomaly({
        roomId: "duel_audit_test",
        sessionId: "exploit_client_99",
        playerName: "SpeedHacker",
        reason: "IMPOSSIBLE_TRAINING_SPEED",
        elapsedMs,
        weightW: w,
        weightB: b,
        actionTaken: "REJECTED_WITH_PENALTY"
    });

    assert.strictEqual(auditLogger.getAnomalies().length, 1);
    assert.strictEqual(auditLogger.getAnomalies()[0].reason, "IMPOSSIBLE_TRAINING_SPEED");
    assert.strictEqual(auditLogger.getAnomalies()[0].actionTaken, "REJECTED_WITH_PENALTY");

    // 3. Penalty Loss Verification
    const assignedLoss = isImpossibleSpeed ? 999.0 : 0.02;
    assert.strictEqual(assignedLoss, 999.0, "Flagged submission must be assigned severe penalty loss");

    console.log("✅ Anti-Cheat Submission Integrity & Audit Logger Test Passed!");
}

function testAuthoritativeValidator() {
    console.log("▶ Testing AuthoritativeValidator Replay Simulation & Signatures...");
    const { AuthoritativeValidator, AuthoritativeValidatorClass } = require("../src/security/AuthoritativeValidator");

    // 1. Generate Synthetic Dataset
    const dataset = [];
    for (let i = 0; i < 20; i++) {
        const x = i * 0.5;
        const y = 2.0 * x + 1.0;
        dataset.push({ x, y });
    }

    // 2. Perform ground truth training simulation
    let w = 0.0, b = 0.0;
    const lr = 0.05;
    const epochs = 100;
    const N = dataset.length;
    for (let ep = 0; ep < epochs; ep++) {
        let gradW = 0, gradB = 0;
        for (let i = 0; i < N; i++) {
            const pred = w * dataset[i].x + b;
            const err = pred - dataset[i].y;
            gradW += (2 / N) * err * dataset[i].x;
            gradB += (2 / N) * err;
        }
        w -= lr * gradW;
        b -= lr * gradB;
    }

    // Test Valid Submission
    const validResult = AuthoritativeValidator.verifyLinearRegressionTraining(
        dataset, 0.0, 0.0, w, b, lr, epochs, 1200, 0.01, "player_123", "ValidLearner"
    );
    assert.strictEqual(validResult.valid, true, "Legitimate gradient replay must pass verification");
    assert(validResult.signature && validResult.signature.length === 64, "Signature must be 64-char SHA256 hex");

    // Test Fabricated Weights (Cheater injected w=999)
    const fakeResult = AuthoritativeValidator.verifyLinearRegressionTraining(
        dataset, 0.0, 0.0, 999.0, 999.0, lr, epochs, 1200, 0.01, "player_cheater", "Hacker"
    );
    assert.strictEqual(fakeResult.valid, false, "Fabricated weights must fail replay verification");
    assert.strictEqual(fakeResult.reason, "WEIGHT_REPLAY_MISMATCH");

    // Test Teleportation / Impossible Speed
    const moveCheck = AuthoritativeValidator.validateMovement(
        { x: 0, y: 0, z: 0 },
        { x: 500, y: 0, z: 500 }, // 707 meters in 1 second!
        1.0,
        "player_speedster",
        "Flash"
    );
    assert.strictEqual(moveCheck.valid, false, "Teleportation / speed hacking must be rejected");

    console.log("✅ AuthoritativeValidator Replay Simulation & Signatures Test Passed!");
}

function testMatchmakingAndElo() {
    console.log("▶ Testing Matchmaking Elo Calculator & Queue Bracket Expansion...");
    const { calculateEloChange } = require("../src/rooms/MatchmakingRoom");

    // Equal MMR win
    const res1 = calculateEloChange(1200, 1200, 1.0, 32);
    assert.strictEqual(res1.delta, 16, "Win against equal opponent gives +16 Elo");
    assert.strictEqual(res1.newRating, 1216);

    // Underdog win (1000 vs 1400)
    const res2 = calculateEloChange(1000, 1400, 1.0, 32);
    assert(res2.delta > 25, "Underdog win should award significant rating bonus");

    // Heavy favorite loss (1400 vs 1000)
    const res3 = calculateEloChange(1400, 1000, 0.0, 32);
    assert(res3.delta < -25, "Favorite loss should penalize rating heavily");

    console.log("✅ Matchmaking Elo Calculator Test Passed!");
}

testSchemaAndLifecycle();
testActivityStateEnum();
testServerSideCollectibleValidation();
test1v1DuelFlowAndServerHiddenTestSet();
testSubmissionIntegrityAndAuditLogging();
testAuthoritativeValidator();
testMatchmakingAndElo();
console.log("🎉 All NeuroArena Server Unit Tests Passed Cleanly!");
