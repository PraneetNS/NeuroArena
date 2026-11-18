/**
 * TokenRevocationManager.js
 * Cryptographic JWT token revocation blacklist with sliding-window TTL cleanup
 * and user-level global session invalidation.
 */

class TokenRevocationManager {
  constructor(options = {}) {
    this.revokedJtis = new Map(); // jti -> expiryTimestamp
    this.userRevocationCutoffs = new Map(); // userId -> minValidIssuedAtTimestamp
    this.cleanupIntervalMs = options.cleanupIntervalMs || 60000;

    this.timer = setInterval(() => this.purgeExpired(), this.cleanupIntervalMs);
    if (this.timer.unref) this.timer.unref();
  }

  /**
   * Revoke a single token by its JTI until its natural expiration
   */
  revokeToken(jti, expiryTimestampMs) {
    if (!jti) return;
    this.revokedJtis.set(jti, expiryTimestampMs || (Date.now() + 86400000));
  }

  /**
   * Invalidate all sessions for a user issued prior to this moment
   */
  revokeAllUserSessions(userId) {
    if (!userId) return;
    this.userRevocationCutoffs.set(userId, Date.now());
  }

  /**
   * Check if a token is valid (not revoked by jti or user cutoff)
   */
  isTokenValid(jti, userId, issuedAtMs) {
    // 1. Check specific JTI blacklist
    if (jti && this.revokedJtis.has(jti)) {
      const expiry = this.revokedJtis.get(jti);
      if (Date.now() < expiry) {
        return false;
      }
      this.revokedJtis.delete(jti);
    }

    // 2. Check user-wide session invalidation cutoff
    if (userId && this.userRevocationCutoffs.has(userId)) {
      const cutoff = this.userRevocationCutoffs.get(userId);
      if (issuedAtMs && issuedAtMs < cutoff) {
        return false;
      }
    }

    return true;
  }

  /**
   * Periodic purge of expired tokens to prevent memory leak
   */
  purgeExpired() {
    const now = Date.now();
    for (const [jti, expiry] of this.revokedJtis.entries()) {
      if (now >= expiry) {
        this.revokedJtis.delete(jti);
      }
    }
  }

  dispose() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.revokedJtis.clear();
    this.userRevocationCutoffs.clear();
  }
}

module.exports = { TokenRevocationManager };
