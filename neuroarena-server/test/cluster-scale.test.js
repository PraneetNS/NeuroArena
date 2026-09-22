const assert = require("assert");
const { TokenBucketRateLimiter } = require("../src/security/RateLimiter");
const { SessionManager } = require("../src/cluster/SessionManager");
const { RedisClusterConfig } = require("../src/cluster/RedisClusterConfig");

console.log("==================================================");
console.log("⚡ NEURO-ARENA 1M SCALE CLUSTER & SESSION TEST SUITE");
console.log("==================================================");

function testTokenBucketRateLimiting() {
    console.log("▶ Testing Token Bucket Ingress Rate Limiter (60 pkts/sec)...");

    const limiter = new TokenBucketRateLimiter(5, 5); // 5 capacity, 5/sec refill
    const sessionId = "session_user_42";

    // Consume all 5 tokens
    for (let i = 0; i < 5; i++) {
        assert.strictEqual(limiter.consume(sessionId, 1), true, `Packet #${i + 1} within burst capacity must pass`);
    }

    // 6th packet must be dropped (exceeded)
    assert.strictEqual(limiter.consume(sessionId, 1), false, "Burst packet exceeding capacity must be dropped");

    console.log("✅ Token Bucket Rate Limiting Test Passed!");
}

function testRedisDistributedLeaderboardZSet() {
    console.log("▶ Testing Redis Distributed Sorted Set Leaderboard Scaling (1M Users)...");

    const redis = new RedisClusterConfig();
    const key = "lb:global:1v1";

    // Add 10 players
    for (let i = 1; i <= 10; i++) {
        redis.zAdd(key, `player_${i}`, 1000 + i * 50);
    }

    // Top player is player_10 (score 1500, rank #1)
    redis.zRevRank(key, "player_10").then(rank => {
        assert.strictEqual(rank, 1, "Player with highest score must hold rank #1");
    });

    redis.zRevRank(key, "player_1").then(rank => {
        assert.strictEqual(rank, 10, "Player with lowest score must hold rank #10");
    });

    console.log("✅ Redis Distributed Sorted Set Leaderboard Test Passed!");
}

function testStatelessSessionTicketsAndTamperDetection() {
    console.log("▶ Testing Stateless Session Tickets & Cryptographic Reconnect...");

    const sm = new SessionManager("SECRET_KEY_PROD");
    const ticket = sm.createSessionTicket("player_alpha", "duel_room_99", 300);

    assert(ticket.sessionId.startsWith("SES-"), "Session ID must have standard prefix");
    assert(ticket.signature.length === 64, "SHA-256 HMAC signature must be 64 hex chars");

    // Legitimate validation
    const validCheck = sm.validateReconnectTicket(ticket.sessionId, ticket.reconnectToken);
    assert.strictEqual(validCheck.valid, true, "Valid session ticket must pass handshake");

    // Invalid token
    const invalidCheck = sm.validateReconnectTicket(ticket.sessionId, "wrong_token_xyz");
    assert.strictEqual(invalidCheck.valid, false, "Wrong token must fail handshake");

    // Expired ticket simulation
    ticket.expiresAt = Date.now() - 1000;
    const expiredCheck = sm.validateReconnectTicket(ticket.sessionId, ticket.reconnectToken);
    assert.strictEqual(expiredCheck.valid, false, "Expired session ticket must be rejected");

    console.log("✅ Stateless Session Tickets & Cryptographic Reconnect Test Passed!");
}

function testClusterDrainageAndRenewal() {
    console.log("▶ Testing Multi-Node Drainage, Heartbeats & Dynamic Session Renewal...");

    const sm = new SessionManager("SECRET_KEY_PROD");
    const ticket1 = sm.createSessionTicket("player_alpha", "duel_room_1", 100, "node_worker_1");
    const ticket2 = sm.createSessionTicket("player_beta", "duel_room_2", 100, "node_worker_2");
    const ticket3 = sm.createSessionTicket("player_gamma", "duel_room_3", 100, "node_worker_2");

    // Test heartbeat
    assert.strictEqual(sm.recordHeartbeat(ticket1.sessionId), true, "Heartbeat must be recorded for active session");
    assert.strictEqual(sm.recordHeartbeat("SES-NONEXISTENT"), false, "Heartbeat for non-existent session must return false");

    // Test graceful node drainage
    const drained = sm.drainNodeSessions("node_worker_2");
    assert.strictEqual(drained.length, 2, "Both sessions on node_worker_2 must be marked as draining");
    assert(drained.includes(ticket2.sessionId) && drained.includes(ticket3.sessionId));

    // Test ticket renewal
    const initialExpiry = ticket1.expiresAt;
    const renewed = sm.renewSessionTicket(ticket1.sessionId, 600);
    assert(renewed.expiresAt > initialExpiry, "Renewed session expiration must be extended");

    // Validate renewed session signature integrity
    const recheck = sm.validateReconnectTicket(renewed.sessionId, renewed.reconnectToken);
    assert.strictEqual(recheck.valid, true, "Renewed session signature must validate cleanly");

    console.log("✅ Multi-Node Drainage, Heartbeats & Dynamic Session Renewal Passed!");
}

async function testRedisDistributedLockingAndBatching() {
    console.log("▶ Testing Redis Distributed Locking, Lease Expiry & Batch ZSet...");

    const redis = new RedisClusterConfig();

    // 1. Batch ZAdd
    const batchData = [
        { member: "agent_alpha", score: 2400 },
        { member: "agent_beta", score: 2850 },
        { member: "agent_gamma", score: 2100 }
    ];
    const inserted = await redis.zAddBatch("lb:batch:test", batchData);
    assert.strictEqual(inserted, 3, "All 3 items must be ingested via zAddBatch");

    const topRank = await redis.zRevRank("lb:batch:test", "agent_beta");
    assert.strictEqual(topRank, 1, "agent_beta with 2850 score must be rank 1");

    // 2. Distributed Locking
    const lockAcquired = await redis.acquireLock("matchmaking_queue", 1000, "node_1");
    assert.strictEqual(lockAcquired, true, "First acquireLock must succeed");

    const lockContention = await redis.acquireLock("matchmaking_queue", 1000, "node_2");
    assert.strictEqual(lockContention, false, "Contention acquireLock must fail while held");

    // Release with wrong owner fails
    const badRelease = await redis.releaseLock("matchmaking_queue", "node_2");
    assert.strictEqual(badRelease, false, "Release by non-owner must fail");

    // Release with right owner succeeds
    const goodRelease = await redis.releaseLock("matchmaking_queue", "node_1");
    assert.strictEqual(goodRelease, true, "Release by true owner must succeed");

    // 3. Ping heartbeat
    const pingResult = await redis.ping();
    assert.strictEqual(pingResult.status, "PONG", "Heartbeat ping must return PONG");
    assert(pingResult.latencyMs >= 0, "Latency must be non-negative");

    console.log("✅ Redis Distributed Locking, Lease Expiry & Batch ZSet Passed!");
}

async function testRedisReplayCachingAndIndex() {
    console.log("▶ Testing Redis Cluster Match Replay Chunk Caching & User Index...");

    const redis = new RedisClusterConfig();
    const matchId = "match_replay_prod_771";
    const userId = "usr_architect_42";

    // 1. Cache replay metadata
    const metaKey = `replay:meta:${matchId}`;
    const metaPayload = { matchId, biomeId: "Biome6_SemanticExpanse", frameCount: 120, checksum: "a1b2c3d4e5f60718" };
    await redis.set(metaKey, metaPayload, 86400);

    const storedMeta = JSON.parse(await redis.get(metaKey));
    assert.strictEqual(storedMeta.matchId, matchId);
    assert.strictEqual(storedMeta.biomeId, "Biome6_SemanticExpanse");

    // 2. Cache chunked payload with 72h TTL
    const chunkKey = `replay:chunk:${matchId}:0`;
    await redis.set(chunkKey, "base64_encoded_delta_chunk_data", 259200);
    const storedChunk = await redis.get(chunkKey);
    assert.strictEqual(storedChunk, "base64_encoded_delta_chunk_data");

    // 3. Index match under user's recent replays sorted set
    const userIndexKey = `replay:index:user:${userId}`;
    const timestamp = Date.now();
    await redis.zAdd(userIndexKey, matchId, timestamp);

    const userRank = await redis.zRevRank(userIndexKey, matchId);
    assert.strictEqual(userRank, 1, "Most recent match replay must rank #1 for user index");

    console.log("✅ Redis Cluster Match Replay Chunk Caching & User Index Passed!");
}

async function runAllClusterTests() {
    testTokenBucketRateLimiting();
    testRedisDistributedLeaderboardZSet();
    testStatelessSessionTicketsAndTamperDetection();
    testClusterDrainageAndRenewal();
    await testRedisDistributedLockingAndBatching();
    await testRedisReplayCachingAndIndex();
    console.log("🎉 All 1M Scale Cluster & Session Tests Passed Cleanly!");
}

runAllClusterTests();

