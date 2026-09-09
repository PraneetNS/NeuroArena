const assert = require("assert");
const { CoopRoom } = require("../src/rooms/CoopRoom");
const { CoopRoomState } = require("../src/schema/CoopRoomState");
const { ProceduralVariantEngine } = require("../src/ml/ProceduralVariantEngine");

console.log("▶ Testing 2-4 Player Co-op Room Architecture, Difficulty Envelopes & ML Collaboration...");

// Mock Client class for Colyseus simulation
class MockClient {
    constructor(sessionId = "sess_" + Math.random().toString(36).substring(2, 6)) {
        this.sessionId = sessionId;
        this.messages = [];
    }

    send(type, payload) {
        this.messages.push({ type, payload });
    }

    getLastMessage(type) {
        for (let i = this.messages.length - 1; i >= 0; i--) {
            if (this.messages[i].type === type) return this.messages[i].payload;
        }
        return null;
    }
}

// 1. Test Distinct Party Scaling & Difficulty Envelope (Party of 2 vs Party of 4)
function testPartyDifficultyCurve() {
    console.log("  1. Testing distinct party-scaled difficulty envelopes (Party of 2 vs 4)...");
    const engine = new ProceduralVariantEngine();

    const env2 = engine.getPartyDifficultyEnvelope(2, 0);
    const env4 = engine.getPartyDifficultyEnvelope(4, 0);

    // Verify distinct difficulty curve parameters
    assert.strictEqual(env2.partySize, 2);
    assert.strictEqual(env4.partySize, 4);

    assert.strictEqual(env2.bossHpMultiplier, 1.65, "Party of 2 must have 1.65x boss HP envelope");
    assert.strictEqual(env4.bossHpMultiplier, 2.80, "Party of 4 must have 2.80x boss HP envelope (sub-linear)");

    assert.strictEqual(env2.domainSpan.totalSpan, 9.0, "Party of 2 span must be 9.0 ([-4.5, 4.5])");
    assert.strictEqual(env4.domainSpan.totalSpan, 13.0, "Party of 4 span must be 13.0 ([-6.5, 6.5])");

    assert.strictEqual(env2.partitions.length, 2, "Party of 2 has 2 partitions");
    assert.strictEqual(env4.partitions.length, 4, "Party of 4 has 4 distinct quadrant partitions");

    assert.ok(env4.noiseScaleMultiplier > env2.noiseScaleMultiplier, "4-player noise scale must be higher");
    assert.ok(env4.outlierScaleMultiplier > env2.outlierScaleMultiplier, "4-player outlier scale must be higher");
    assert.ok(env4.scaledBossHp > env2.scaledBossHp, "4-player boss HP must exceed 2-player boss HP");

    console.log(`  ✅ Distinct Difficulty Curve Validated! (2P HP: ${env2.scaledBossHp} vs 4P HP: ${env4.scaledBossHp})`);
}

// 2. Test Collaborative Blind Spot Coverage & Shared Dataset Health Mechanic
function testSharedDatasetHealthScoreCollaboration() {
    console.log("  2. Testing collaborative blind spot coverage & shared dataset health scoring...");

    const room = new CoopRoom();
    room.roomId = "coop_test_room_4p";
    room.onCreate({ partySize: 4, biome: 0 });

    const c1 = new MockClient("client_1");
    const c2 = new MockClient("client_2");
    const c3 = new MockClient("client_3");
    const c4 = new MockClient("client_4");

    room.onJoin(c1, { name: "Architect-1" });
    room.onJoin(c2, { name: "Architect-2" });
    room.onJoin(c3, { name: "Architect-3" });
    room.onJoin(c4, { name: "Architect-4" });

    assert.strictEqual(room.state.players.size, 4);

    // Verify role assignments
    const role1 = c1.getLastMessage("assigned_role");
    const role4 = c4.getLastMessage("assigned_role");
    assert.strictEqual(role1.partitionIndex, 0);
    assert.strictEqual(role4.partitionIndex, 3);

    // Case A: Only Client 1 harvests (local narrow domain: x in [-6.5, -4.0])
    room.state.status = "active";
    const narrowSamples = [
        { id: 1, x: -6.0, y: -13.55 },
        { id: 2, x: -5.5, y: -12.32 },
        { id: 3, x: -5.0, y: -11.10 },
        { id: 4, x: -4.5, y: -9.87 }
    ];

    // Simulate message contribution from Client 1
    room.onMessageHandlers["contribute_samples"](c1, { samples: narrowSamples });

    const healthA = room.state.datasetMetrics.overallHealthScore;
    const coverageA = room.state.datasetMetrics.coverageScore;
    const blindSpotsA = room.state.datasetMetrics.blindSpotsCount;

    assert.ok(blindSpotsA >= 3, `Expected at least 3 blind spots when only P1 harvests (got ${blindSpotsA})`);
    assert.ok(coverageA <= 45, `Expected low coverage score under narrow domain (got ${coverageA})`);
    assert.strictEqual(room.state.datasetMetrics.healthGrade, "CRITICAL", "Health grade must be CRITICAL when uncoordinated");
    console.log(`  ✅ Uncoordinated Single-Player Harvesting flagged: Health=${healthA}%, Coverage=${coverageA}%, BlindSpots=${blindSpotsA}`);

    // Case B: All 4 players coordinate across their assigned partitions
    const p2Samples = [
        { id: 5, x: -3.0, y: -6.20 },
        { id: 6, x: -2.0, y: -3.75 },
        { id: 7, x: -1.0, y: -1.30 }
    ];
    const p3Samples = [
        { id: 8, x: 0.5, y: 2.37 },
        { id: 9, x: 1.5, y: 4.82 },
        { id: 10, x: 2.5, y: 7.27 }
    ];
    const p4Samples = [
        { id: 11, x: 3.5, y: 9.72 },
        { id: 12, x: 4.5, y: 12.17 },
        { id: 13, x: 5.5, y: 14.62 },
        { id: 14, x: 6.2, y: 16.34 }
    ];

    room.onMessageHandlers["contribute_samples"](c2, { samples: p2Samples });
    room.onMessageHandlers["contribute_samples"](c3, { samples: p3Samples });
    room.onMessageHandlers["contribute_samples"](c4, { samples: p4Samples });

    const healthB = room.state.datasetMetrics.overallHealthScore;
    const coverageB = room.state.datasetMetrics.coverageScore;
    const blindSpotsB = room.state.datasetMetrics.blindSpotsCount;

    assert.strictEqual(blindSpotsB, 0, "All 4 blind spots must be covered");
    assert.ok(coverageB >= 85, `Coverage score must be high when all sectors covered (got ${coverageB})`);
    assert.ok(healthB >= 85, `Overall health score must reach EXCELLENT (got ${healthB})`);
    assert.strictEqual(room.state.datasetMetrics.healthGrade, "EXCELLENT");
    console.log(`  ✅ 4-Player Coordinated Dataset Health Verified: Health=${healthB}%, Coverage=${coverageB}%, BlindSpots=0!`);
}

// 3. Test Non-Verbal Ping System & Haptic Pulse Integration
function testNonVerbalPingSystem() {
    console.log("  3. Testing non-verbal ping system with haptic pulse metadata...");

    const room = new CoopRoom();
    room.roomId = "coop_ping_test";
    room.onCreate({ partySize: 2, biome: 0 });

    const c1 = new MockClient("pinger_1");
    const c2 = new MockClient("listener_2");

    let lastBroadcastEvent = null;
    let lastBroadcastPayload = null;
    room.broadcast = (event, payload) => {
        lastBroadcastEvent = event;
        lastBroadcastPayload = payload;
    };

    room.onJoin(c1, { name: "Pinger" });
    room.onJoin(c2, { name: "Listener" });

    // Send COVERAGE_GAP ping
    room.onMessageHandlers["ping"](c1, {
        type: "COVERAGE_GAP",
        x: 12.5,
        z: -8.2,
        domainX: 3.5,
        targetPartition: 1
    });

    assert.strictEqual(lastBroadcastEvent, "player_ping");
    assert.strictEqual(lastBroadcastPayload.type, "COVERAGE_GAP");
    assert.strictEqual(lastBroadcastPayload.hapticPulse, "MediumImpact");
    assert.strictEqual(lastBroadcastPayload.domainX, 3.5);
    assert.strictEqual(lastBroadcastPayload.targetPartition, 1);

    // Send BOSS_HAZARD ping
    room.onMessageHandlers["ping"](c2, {
        type: "BOSS_HAZARD",
        x: 35.0,
        z: 0.0
    });

    assert.strictEqual(lastBroadcastPayload.type, "BOSS_HAZARD");
    assert.strictEqual(lastBroadcastPayload.hapticPulse, "HeavyRumble");
    console.log("  ✅ Non-Verbal Ping System & Haptic Metadata Verified!");
}

// 4. Test 4-Player Hidden Test Set Evaluation, Boss Defeat & Authoritative Equal Rewards
function testCoopHiddenTestEvaluationAndEqualRewards() {
    console.log("  4. Testing 4-player hidden test set evaluation & server-authoritative equal reward split...");

    const room = new CoopRoom();
    room.roomId = "coop_eval_test";
    room.onCreate({ partySize: 4, biome: 0 });

    const clients = [
        new MockClient("c1"),
        new MockClient("c2"),
        new MockClient("c3"),
        new MockClient("c4")
    ];

    clients.forEach((c, idx) => room.onJoin(c, { name: `Architect-${idx + 1}` }));

    let lastBroadcastEvent = null;
    let lastBroadcastPayload = null;
    room.broadcast = (event, payload) => {
        lastBroadcastEvent = event;
        lastBroadcastPayload = payload;
    };

    room.state.status = "active";
    room.matchStartTime = Date.now() - 10000; // 10s elapsed

    // Pool balanced dataset across all 4 partitions
    const samples = [
        { id: 1, x: -6.0, y: -13.55 },
        { id: 2, x: -4.0, y: -8.65 },
        { id: 3, x: -2.0, y: -3.75 },
        { id: 4, x: 0.0, y: 1.15 },
        { id: 5, x: 2.0, y: 6.05 },
        { id: 6, x: 4.0, y: 10.95 },
        { id: 7, x: 6.0, y: 15.85 }
    ];
    room.onMessageHandlers["contribute_samples"](clients[0], { samples });

    // Submit honest weights (Ground truth: w=2.45, b=1.15)
    clients.forEach(c => {
        room.onMessageHandlers["submit_weights"](c, {
            weightW: 2.45,
            weightB: 1.15
        });
    });

    assert.strictEqual(lastBroadcastEvent, "coop_results");
    const res = lastBroadcastPayload;

    assert.strictEqual(res.partySize, 4);
    assert.strictEqual(res.hiddenTestSampleSize, 50, "Must evaluate against 50 hidden test samples");
    assert.ok(res.evaluation.teamAccuracy >= 95.0, `Team accuracy should be >= 95% (got ${res.evaluation.teamAccuracy}%)`);
    assert.strictEqual(res.bossOutcome.isDefeated, true, "Boss must be defeated with high accuracy team fit");

    // Verify Server-Authoritative Equal Reward Distribution
    assert.strictEqual(res.rewards.distributionMode, "SERVER_AUTHORITATIVE_EQUAL_SPLIT");
    assert.ok(res.rewards.equalShareTokens > 0, "Equal share tokens must be positive");
    assert.ok(res.rewards.equalShareExp > 0, "Equal share EXP must be positive");
    assert.strictEqual(res.rewards.allocations.length, 4, "Must allocate rewards to all 4 players");

    const tokens1 = res.rewards.allocations[0].tokensAwarded;
    const tokens2 = res.rewards.allocations[1].tokensAwarded;
    const tokens3 = res.rewards.allocations[2].tokensAwarded;
    const tokens4 = res.rewards.allocations[3].tokensAwarded;

    assert.strictEqual(tokens1, tokens2, "Player 1 and 2 must receive equal loot");
    assert.strictEqual(tokens2, tokens3, "Player 2 and 3 must receive equal loot");
    assert.strictEqual(tokens3, tokens4, "Player 3 and 4 must receive equal loot (No Ninja-Looting!)");

    console.log(`  ✅ 4-Player Hidden Test Set Evaluation Passed! Accuracy: ${res.evaluation.teamAccuracy}%, Boss Defeated: ${res.bossOutcome.isDefeated}, Equal Share: ${tokens1} Tokens / ${res.rewards.allocations[0].expAwarded} EXP.`);
}

// 5. Test Anti-Cheat Flagging & Zero Reward on Anomaly
function testAntiCheatIntegrityPenalty() {
    console.log("  5. Testing anti-cheat integrity enforcement during co-op reward settlement...");

    const room = new CoopRoom();
    room.roomId = "coop_cheat_test";
    room.onCreate({ partySize: 2, biome: 0 });

    const c1 = new MockClient("honest_p1");
    const c2 = new MockClient("cheater_p2");

    room.onJoin(c1, { name: "HonestArchitect" });
    room.onJoin(c2, { name: "CheaterArchitect" });

    let lastBroadcastPayload = null;
    room.broadcast = (event, payload) => {
        if (event === "coop_results") lastBroadcastPayload = payload;
    };

    room.state.status = "active";
    room.matchStartTime = Date.now() - 5000; // 5000ms elapsed (valid for honest player)

    // Honest player submits valid weights after 5s
    room.onMessageHandlers["submit_weights"](c1, { weightW: 2.45, weightB: 1.15 });

    // Cheater submits malformed / out-of-bounds weights
    room.onMessageHandlers["submit_weights"](c2, { weightW: 99999.0, weightB: -88888.0 });

    const res = lastBroadcastPayload;
    assert.strictEqual(res.rewards.allocations[1].isFlagged, true, "Cheater must be flagged");
    assert.strictEqual(res.rewards.allocations[1].tokensAwarded, 0, "Flagged player receives 0 tokens");
    assert.strictEqual(res.rewards.allocations[0].isFlagged, false, "Honest player must not be flagged");
    assert.ok(res.rewards.allocations[0].tokensAwarded > 0, "Honest player still receives valid share");
    room.onDispose();
    console.log("  ✅ Anti-Cheat Flagging & Zero-Reward Penalty Verified!");
}

// Run all test suites
testPartyDifficultyCurve();
testSharedDatasetHealthScoreCollaboration();
testNonVerbalPingSystem();
testCoopHiddenTestEvaluationAndEqualRewards();
testAntiCheatIntegrityPenalty();

console.log("🎉 All 2-4 Player Co-op Room Architecture & ML Collaboration Tests Passed Cleanly!\n");
process.exit(0);
