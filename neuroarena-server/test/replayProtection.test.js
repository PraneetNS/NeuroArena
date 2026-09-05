const assert = require('assert');
const { ReplayProtection, SlidingWindowReplayFilter } = require('../src/security/ReplayProtection');
const { TokenRevocationManager } = require('../src/security/TokenRevocationManager');

console.log('▶ Testing Anti-Replay Sliding Window & Token Revocation Security...');

// 1. Test Sliding Window Sequence Filter
const filter = new SlidingWindowReplayFilter(64);

assert.strictEqual(filter.checkAndRecord(1), true, 'Seq 1 is valid');
assert.strictEqual(filter.checkAndRecord(2), true, 'Seq 2 is valid');
assert.strictEqual(filter.checkAndRecord(1), false, 'Replayed Seq 1 must be rejected');
assert.strictEqual(filter.checkAndRecord(5), true, 'Seq 5 (out-of-order forward) is valid');
assert.strictEqual(filter.checkAndRecord(3), true, 'Seq 3 (arrived late within window) is valid');
assert.strictEqual(filter.checkAndRecord(3), false, 'Replayed Seq 3 must be rejected');

// Advance window far ahead
assert.strictEqual(filter.checkAndRecord(200), true, 'Seq 200 is valid');
assert.strictEqual(filter.checkAndRecord(2), false, 'Seq 2 is now outside sliding window (64) and must be rejected');

// 2. Test Nonce Verification
const rp = new ReplayProtection({ nonceTtlMs: 10000 });
const now = Date.now();
const nonce = 'unique_nonce_abc_123';

assert.strictEqual(rp.validateNonce(nonce, now), true, 'Fresh nonce must be accepted');
assert.strictEqual(rp.validateNonce(nonce, now), false, 'Replayed nonce must be rejected');
assert.strictEqual(rp.validateNonce('expired_nonce', now - 20000), false, 'Stale timestamp nonce must be rejected');

// 3. Test Token Revocation Manager
const tokenManager = new TokenRevocationManager();
const jti1 = 'jti_session_user1';
const jti2 = 'jti_session_user2';

assert.strictEqual(tokenManager.isTokenValid(jti1, 'user1', now), true, 'Active token must be valid');

// Revoke specific token
tokenManager.revokeToken(jti1, now + 50000);
assert.strictEqual(tokenManager.isTokenValid(jti1, 'user1', now), false, 'Revoked token must be rejected');
assert.strictEqual(tokenManager.isTokenValid(jti2, 'user2', now), true, 'Unrevoked token remains valid');

// Revoke all sessions for user2
tokenManager.revokeAllUserSessions('user2');
assert.strictEqual(tokenManager.isTokenValid(jti2, 'user2', now - 1000), false, 'Past token for user2 must be invalid after mass revocation');
assert.strictEqual(tokenManager.isTokenValid('future_jti', 'user2', now + 10000), true, 'Future re-authenticated token must be valid');

tokenManager.dispose();

console.log('✅ Anti-Replay Sliding Window & Token Revocation Security Tests Passed Cleanly!');
