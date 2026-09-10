/**
 * ⚡ NeuroArena: Automated Test Suite for Client Contracts & Autonomous Bot Policy Arena
 */

const assert = require("assert");
const { ClientContractEngine, ContractClientTier } = require("../src/ml/ClientContractEngine");
const { BotArenaPolicyEngine } = require("../src/ml/BotArenaPolicyEngine");
const { BotArenaRoom } = require("../src/rooms/BotArenaRoom");

console.log("▶ Testing Client Contracts, SLA Verification & Bot Policy Arena...");

// --- 1. ClientContractEngine Tier Unlocking & Catalog ---
console.log("  1. Testing corporate tier catalogs and reputation gating...");
const contractEngine = new ClientContractEngine();

const rep0Contracts = contractEngine.getAvailableContracts(0);
assert.strictEqual(rep0Contracts.length, 6, "Total corporate contracts catalog should have 6 entries");
const unlockedRep0 = rep0Contracts.filter(c => c.isUnlocked);
assert.strictEqual(unlockedRep0.length, 2, "At 0 reputation, exactly 2 Tier 1 contracts should be unlocked");

const rep1000Contracts = contractEngine.getAvailableContracts(1000);
const unlockedRep1000 = rep1000Contracts.filter(c => c.isUnlocked);
assert.strictEqual(unlockedRep1000.length, 5, "At 1000 reputation, Tiers 1-4 (5 contracts) should be unlocked");

const rep2500Contracts = contractEngine.getAvailableContracts(2500);
const unlockedRep2500 = rep2500Contracts.filter(c => c.isUnlocked);
assert.strictEqual(unlockedRep2500.length, 6, "At 2500 reputation, all 6 contracts should be unlocked");
console.log("  ✅ Corporate Tier Progression & Unlocks Verified!");

// --- 2. SLA Verification & Bonus Multipliers ---
console.log("  2. Testing SLA validation, latency headroom, and error rejections...");

// 2a. Passing submission with latency bonus
const passResult = contractEngine.evaluateSubmission("contract_startup_01", {
    achievedMetric: 0.95,
    measuredLatencyMs: 6.0,
    architecture: "LogisticClassifier"
});
assert.strictEqual(passResult.passed, true, "High accuracy and low latency submission must pass");
assert.strictEqual(passResult.reputationAwarded, 25);
assert(passResult.creditsAwarded >= 300, "Should receive at least base 300 credits");
assert(parseFloat(passResult.bonuses.latencyMultiplier) > 1.0, "Sub-SLA latency should earn bonus credits");

// 2b. Failing accuracy SLA
const failAccResult = contractEngine.evaluateSubmission("contract_startup_01", {
    achievedMetric: 0.82, // Required: 0.88
    measuredLatencyMs: 10.0,
    architecture: "LogisticClassifier"
});
assert.strictEqual(failAccResult.passed, false);
assert.strictEqual(failAccResult.reason, "ACCURACY_OR_LOSS_SLA_BREACH");

// 2c. Failing latency SLA
const failLatencyResult = contractEngine.evaluateSubmission("contract_startup_01", {
    achievedMetric: 0.96,
    measuredLatencyMs: 22.5, // Limit: 18.0
    architecture: "LogisticClassifier"
});
assert.strictEqual(failLatencyResult.passed, false);
assert.strictEqual(failLatencyResult.reason, "LATENCY_SLA_BREACH");

// 2d. Failing architecture check
const failArchResult = contractEngine.evaluateSubmission("contract_startup_01", {
    achievedMetric: 0.96,
    measuredLatencyMs: 10.0,
    architecture: "DecisionTree" // Required: LogisticClassifier
});
assert.strictEqual(failArchResult.passed, false);
assert.strictEqual(failArchResult.reason, "ARCHITECTURE_MISMATCH");

// 2e. Loss metric contract verification (must be <= threshold)
const passLossResult = contractEngine.evaluateSubmission("contract_startup_02", {
    achievedMetric: 0.045, // Required: <= 0.08
    measuredLatencyMs: 8.0,
    architecture: "LinearRegression"
});
assert.strictEqual(passLossResult.passed, true, "Loss below required threshold must pass");

const failLossResult = contractEngine.evaluateSubmission("contract_startup_02", {
    achievedMetric: 0.125, // Exceeds 0.08
    measuredLatencyMs: 8.0,
    architecture: "LinearRegression"
});
assert.strictEqual(failLossResult.passed, false);
assert.strictEqual(failLossResult.reason, "ACCURACY_OR_LOSS_SLA_BREACH");
console.log("  ✅ SLA Validation, Headroom Bonuses & Failure Modes Verified!");

// --- 3. BotArenaPolicyEngine Kinematics & Forward Passes ---
console.log("  3. Testing neural policy evaluation and vehicle kinematics...");
const weights = BotArenaPolicyEngine.createDefaultWeights();
const observation = {
    targetDeltaX: 12.0,
    targetDeltaZ: 8.0,
    obstacleProximity: 5.0,
    currentSpeed: 4.0
};

const neuralAction = BotArenaPolicyEngine.evaluateNeuralPolicy(observation, weights);
assert(neuralAction.steerAngle >= -45 && neuralAction.steerAngle <= 45, "Steer angle must be bounded within [-45, 45]");
assert(neuralAction.throttle >= 0 && neuralAction.throttle <= 1, "Throttle must be bounded within [0, 1]");
assert(typeof neuralAction.isBraking === "boolean", "isBraking must be boolean");

// Test obstacle reflex
const emergencyObs = {
    targetDeltaX: 5.0,
    targetDeltaZ: 5.0,
    obstacleProximity: 1.0, // Critical proximity
    currentSpeed: 4.0
};
const reflexAction = BotArenaPolicyEngine.evaluateHeuristicPolicy(emergencyObs);
assert.strictEqual(reflexAction.isBraking, true, "Proximity < 1.5 must trigger emergency braking");

// Test kinematics step
const engine = new BotArenaPolicyEngine(35);
const mockBot = { x: 0, z: 0, rotationY: 0, speed: 2.0, steerAngle: 0 };
engine.stepKinematics(mockBot, { steerAngle: 10, throttle: 1.0, isBraking: false }, 0.1);
assert(mockBot.z > 0, "Bot facing north (rotationY=0) must move in positive Z");
assert(mockBot.rotationY > 0, "SteerAngle 10 must increase rotationY");

// Test arena perimeter clamping
mockBot.x = 40;
mockBot.z = 40;
engine.stepKinematics(mockBot, { steerAngle: 0, throttle: 1.0, isBraking: false }, 0.1);
const clampedDist = Math.hypot(mockBot.x, mockBot.z);
assert(clampedDist <= 35.01, "Bot position must be clamped within arena radius of 35");
console.log("  ✅ Neural Policy Forward Passes, Kinematics & Boundary Clamping Verified!");

// --- 4. BotArenaRoom Multi-Agent Simulation Lifecycle ---
console.log("  4. Testing BotArenaRoom simulation loop, crystal harvesting, and match conclusion...");
const room = new BotArenaRoom();
room.onCreate({});

assert.strictEqual(room.state.obstacles.size, 6, "Room must seed 6 obstacles");
assert.strictEqual(room.state.crystals.size, 16, "Room must seed 16 crystals");

const mockClient1 = { sessionId: "sess_p1", send: () => {} };
const mockClient2 = { sessionId: "sess_p2", send: () => {} };

room.onJoin(mockClient1, { name: "AgentAlpha" });
room.onJoin(mockClient2, { name: "AgentBeta" });

assert.strictEqual(room.state.bots.size, 2, "Room must have 2 active bots");
assert.strictEqual(room.state.status, "active", "Joining 2 players activates room");

// Step simulation
room.updateSimulation(0.5);
assert(room.state.timeRemainingSec < 60, "Timer should decrement during active simulation");

// Conclude match
room.state.timeRemainingSec = 0;
let matchResultsReceived = false;
room.broadcast = (msgType, data) => {
    if (msgType === "match_results") {
        matchResultsReceived = true;
        assert(Array.isArray(data.leaderboard), "Leaderboard must be an array");
        assert.strictEqual(data.leaderboard.length, 2, "Leaderboard should rank 2 bots");
    }
};
room.updateSimulation(0.1);
assert.strictEqual(room.state.status, "completed", "Simulation should transition to completed");
assert.strictEqual(matchResultsReceived, true, "Should broadcast match results with leaderboard");
console.log("  ✅ BotArenaRoom Multi-Agent Lifecycle & Match Conclusion Verified!");

console.log("🎉 All Client Contracts & Bot Policy Arena Tests Passed Cleanly!\n");
process.exit(0);
