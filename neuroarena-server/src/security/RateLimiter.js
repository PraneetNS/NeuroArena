/**
 * Token Bucket Ingress Rate Limiter & DDoS Protection
 * Enforces per-client packet rate limits (60 pkts/sec) and submission limits (5 submissions/min)
 * to safeguard backend cluster nodes under 1,000,000+ user traffic.
 */
class TokenBucketRateLimiter {
    constructor(capacity = 60, refillRatePerSec = 60) {
        this.capacity = capacity;
        this.refillRatePerSec = refillRatePerSec;
        this.buckets = new Map(); // sessionId -> { tokens, lastRefillTime }
    }

    consume(sessionId, tokens = 1) {
        const now = Date.now();
        let bucket = this.buckets.get(sessionId);

        if (!bucket) {
            bucket = { tokens: this.capacity, lastRefillTime: now };
            this.buckets.set(sessionId, bucket);
        } else {
            // Refill tokens based on elapsed time
            const elapsedSec = (now - bucket.lastRefillTime) / 1000;
            bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsedSec * this.refillRatePerSec);
            bucket.lastRefillTime = now;
        }

        if (bucket.tokens >= tokens) {
            bucket.tokens -= tokens;
            return true; // Request allowed
        }

        return false; // Rate limit exceeded (drop / throttle)
    }

    removeSession(sessionId) {
        this.buckets.delete(sessionId);
    }

    cleanupStaleSessions(maxIdleMs = 60000) {
        const now = Date.now();
        for (const [id, bucket] of this.buckets.entries()) {
            if (now - bucket.lastRefillTime > maxIdleMs) {
                this.buckets.delete(id);
            }
        }
    }
}

module.exports = { TokenBucketRateLimiter };
