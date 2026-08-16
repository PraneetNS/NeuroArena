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

testSchemaAndLifecycle();
testActivityStateEnum();
console.log("🎉 All NeuroArena Server Unit Tests Passed Cleanly!");
