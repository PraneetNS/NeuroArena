/**
 * adaptiveWAF.js
 * Adaptive Web Application Firewall and Shannon Entropy Anomaly Defense.
 * Protects neural weight upload endpoints, websocket handshakes, and match telemetry.
 */

'use strict';

class AdaptiveWAF {
  constructor(options = {}) {
    this.rateLimitMax = options.rateLimitMax || 60; // requests per minute
    this.burstCapacity = options.burstCapacity || 20;
    this.entropyLowerBound = options.entropyLowerBound || 1.5; // low entropy = repetitive payload / flood
    this.entropyUpperBound = options.entropyUpperBound || 7.8; // high entropy = encrypted shellcode / random flood
    this.ipBucketMap = new Map(); // ip -> { tokens, lastRefill, reputationScore }
    this.nonceReplayCache = new Set(); // store seen nonces
  }

  /**
   * Calculates Shannon Entropy of an input payload string.
   */
  calculateShannonEntropy(str) {
    if (!str || str.length === 0) return 0;
    const freq = {};
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      freq[char] = (freq[char] || 0) + 1;
    }

    let entropy = 0;
    const len = str.length;
    for (const count of Object.values(freq)) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }

    return Number(entropy.toFixed(4));
  }

  /**
   * Inspects incoming request for rate-limit breaches, entropy anomalies, and nonce replays.
   * @param {{ ip: string, payload: string, nonce?: string }} req
   * @returns {{ allowed: boolean, reason?: string, entropy: number }}
   */
  inspectRequest(req) {
    const { ip, payload, nonce } = req;
    const now = Date.now();

    // 1. Nonce replay prevention
    if (nonce) {
      if (this.nonceReplayCache.has(nonce)) {
        return { allowed: false, reason: 'NONCE_REPLAY_DETECTED', entropy: 0 };
      }
      this.nonceReplayCache.add(nonce);
      if (this.nonceReplayCache.size > 10000) {
        // prune oldest half
        const arr = Array.from(this.nonceReplayCache);
        this.nonceReplayCache = new Set(arr.slice(5000));
      }
    }

    // 2. Token Bucket Rate Limiting per IP
    let bucket = this.ipBucketMap.get(ip);
    if (!bucket) {
      bucket = { tokens: this.burstCapacity, lastRefill: now, reputationScore: 100 };
      this.ipBucketMap.set(ip, bucket);
    } else {
      const elapsedSec = (now - bucket.lastRefill) / 1000;
      const refillRate = this.rateLimitMax / 60; // tokens per second
      bucket.tokens = Math.min(this.burstCapacity, bucket.tokens + elapsedSec * refillRate);
      bucket.lastRefill = now;
    }

    if (bucket.tokens < 1) {
      bucket.reputationScore = Math.max(0, bucket.reputationScore - 10);
      return { allowed: false, reason: 'RATE_LIMIT_EXCEEDED', entropy: 0 };
    }

    bucket.tokens -= 1;

    // 3. Payload Entropy Inspection
    if (payload && payload.length >= 16) {
      const entropy = this.calculateShannonEntropy(payload);
      if (entropy < this.entropyLowerBound && payload.length > 256) {
        bucket.reputationScore = Math.max(0, bucket.reputationScore - 5);
        return { allowed: false, reason: 'SUSPICIOUS_LOW_ENTROPY_FLOOD', entropy };
      }
      return { allowed: true, entropy };
    }

    return { allowed: true, entropy: 0 };
  }

  /**
   * Resets reputation or cleans stale IP records.
   */
  cleanupStaleBuckets(ttlMs = 3600000) {
    const now = Date.now();
    for (const [ip, bucket] of this.ipBucketMap.entries()) {
      if (now - bucket.lastRefill > ttlMs) {
        this.ipBucketMap.delete(ip);
      }
    }
  }
}

module.exports = AdaptiveWAF;
