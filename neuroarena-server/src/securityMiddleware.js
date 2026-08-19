const crypto = require('crypto');

/**
 * Security Middleware for NeuroArena Server.
 * Provides HMAC-SHA256 request signatures, nonce anti-replay, and sliding window rate limiting.
 */
class SecurityManager {
  constructor(secretKey = 'neuroarena-production-super-secret-key') {
    this.secretKey = secretKey;
    this.consumedNonces = new Set();
    this.rateLimits = new Map(); // ip -> [timestamps]
    this.MAX_CLOCK_SKEW_MS = 60000; // 60s
  }

  signPayload(payload) {
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return crypto.createHmac('sha256', this.secretKey).update(data).digest('hex');
  }

  verifySignature(payload, signature) {
    const expected = this.signPayload(payload);
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  }

  validateRequestSecurity(ip, nonce, timestamp, signature, payload) {
    // 1. Timestamp freshness
    const now = Date.now();
    if (Math.abs(now - timestamp) > this.MAX_CLOCK_SKEW_MS) {
      return { valid: false, reason: 'TIMESTAMP_EXPIRED' };
    }

    // 2. Nonce anti-replay
    if (this.consumedNonces.has(nonce)) {
      return { valid: false, reason: 'NONCE_REPLAYED' };
    }
    this.consumedNonces.add(nonce);
    if (this.consumedNonces.size > 50000) {
      this.consumedNonces.clear();
    }

    // 3. Signature verification
    const dataToVerify = `${nonce}:${timestamp}:${typeof payload === 'string' ? payload : JSON.stringify(payload)}`;
    const expectedSig = this.signPayload(dataToVerify);
    if (signature !== expectedSig) {
      return { valid: false, reason: 'INVALID_SIGNATURE' };
    }

    // 4. Rate limiting (max 100 reqs/sec per IP)
    let timestamps = this.rateLimits.get(ip) || [];
    timestamps = timestamps.filter(t => now - t < 1000);
    if (timestamps.length >= 100) {
      return { valid: false, reason: 'RATE_LIMIT_EXCEEDED' };
    }
    timestamps.push(now);
    this.rateLimits.set(ip, timestamps);

    return { valid: true };
  }
}

module.exports = { SecurityManager };
