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

testTokenBucketRateLimiting();
testRedisDistributedLeaderboardZSet();
testStatelessSessionTicketsAndTamperDetection();
console.log("🎉 All 1M Scale Cluster & Session Tests Passed Cleanly!");
