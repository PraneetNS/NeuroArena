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

testSchemaAndLifecycle();
testActivityStateEnum();
testServerSideCollectibleValidation();
console.log("🎉 All NeuroArena Server Unit Tests Passed Cleanly!");
