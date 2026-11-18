/**
 * TieredModelCache.js
 * Multi-tier model caching engine (L1 In-Memory LRU-2 + L2 Distributed Redis Tier).
 * Uses LRU-2 (Two-Queue) eviction to prevent cache pollution during large sequential tournament sweeps.
 * Tracks hit/miss ratios, promotion thresholds, and memory footprints.
 */

class TieredModelCache {
    constructor(options = {}) {
        this.l1Capacity = options.l1Capacity || 50; // Max models in hot memory
        this.l2Capacity = options.l2Capacity || 500; // Max models in L2 store
        this.l2TtlMs = options.l2TtlMs || 3600000; // 1 hour TTL for L2

        // L1 Storage: Map<modelId, { value, accessCount, lastAccess, byteSize }>
        this.l1Store = new Map();
        // L1 Access History for LRU-2 (tracking penultimate access): Map<modelId, number[]>
        this.accessHistory = new Map();

        // L2 Storage (in-memory mock / Redis client abstraction): Map<modelId, { serialized, expiresAt, byteSize }>
        this.l2Store = new Map();

        // Metrics
        this.stats = {
            l1Hits: 0,
            l2Hits: 0,
            misses: 0,
            l1Evictions: 0,
            l2Evictions: 0,
            promotions: 0
        };
    }

    _estimateSize(value) {
        if (!value) return 0;
        try {
            return Buffer.byteLength(JSON.stringify(value), 'utf8');
        } catch {
            return 1024;
        }
    }

    _recordAccess(key) {
        const now = Date.now();
        if (!this.accessHistory.has(key)) {
            this.accessHistory.set(key, [now]);
        } else {
            const hist = this.accessHistory.get(key);
            hist.push(now);
            if (hist.length > 2) hist.shift(); // Keep last 2 accesses
        }
    }

    _evictL1() {
        if (this.l1Store.size === 0) return;

        let oldestKthTime = Infinity;
        let candidateKey = null;

        for (const [key] of this.l1Store) {
            const hist = this.accessHistory.get(key) || [];
            // If only accessed once, penultimate time is treated as 0 (evicted first)
            const kTime = hist.length >= 2 ? hist[0] : 0;
            if (kTime < oldestKthTime) {
                oldestKthTime = kTime;
                candidateKey = key;
            }
        }

        if (candidateKey) {
            const evicted = this.l1Store.get(candidateKey);
            this.l1Store.delete(candidateKey);
            this.stats.l1Evictions++;

            // Demote to L2 instead of discarding outright
            this._setL2(candidateKey, evicted.value, evicted.byteSize);
        }
    }

    _setL2(key, value, byteSize) {
        if (this.l2Store.size >= this.l2Capacity) {
            // Evict oldest from L2
            const oldestKey = this.l2Store.keys().next().value;
            if (oldestKey) {
                this.l2Store.delete(oldestKey);
                this.stats.l2Evictions++;
            }
        }

        this.l2Store.set(key, {
            serialized: JSON.stringify(value),
            expiresAt: Date.now() + this.l2TtlMs,
            byteSize: byteSize || this._estimateSize(value)
        });
    }

    get(modelId) {
        // 1. Check L1 Cache (Hot Memory)
        if (this.l1Store.has(modelId)) {
            const entry = this.l1Store.get(modelId);
            entry.accessCount++;
            entry.lastAccess = Date.now();
            this._recordAccess(modelId);
            this.stats.l1Hits++;
            return { found: true, tier: 'L1', value: entry.value };
        }

        // 2. Check L2 Cache (Distributed / Cold Tier)
        if (this.l2Store.has(modelId)) {
            const entry = this.l2Store.get(modelId);
            if (Date.now() > entry.expiresAt) {
                this.l2Store.delete(modelId);
                this.stats.misses++;
                return { found: false, tier: null, value: null };
            }

            this.stats.l2Hits++;
            this._recordAccess(modelId);
            const parsed = JSON.parse(entry.serialized);

            // Check if accessed frequently enough to promote to L1
            const hist = this.accessHistory.get(modelId) || [];
            if (hist.length >= 2) {
                this.set(modelId, parsed);
                this.stats.promotions++;
                this.l2Store.delete(modelId);
            }

            return { found: true, tier: 'L2', value: parsed };
        }

        this.stats.misses++;
        return { found: false, tier: null, value: null };
    }

    set(modelId, value) {
        const byteSize = this._estimateSize(value);
        if (this.l1Store.size >= this.l1Capacity) {
            this._evictL1();
        }

        this._recordAccess(modelId);
        this.l1Store.set(modelId, {
            value,
            accessCount: 1,
            lastAccess: Date.now(),
            byteSize
        });
    }

    has(modelId) {
        if (this.l1Store.has(modelId)) return true;
        if (this.l2Store.has(modelId)) {
            const entry = this.l2Store.get(modelId);
            return Date.now() <= entry.expiresAt;
        }
        return false;
    }

    clear() {
        this.l1Store.clear();
        this.l2Store.clear();
        this.accessHistory.clear();
    }

    getMetrics() {
        const totalRequests = this.stats.l1Hits + this.stats.l2Hits + this.stats.misses;
        const totalHits = this.stats.l1Hits + this.stats.l2Hits;
        const hitRatio = totalRequests > 0 ? totalHits / totalRequests : 0;
        const l1HitRatio = totalRequests > 0 ? this.stats.l1Hits / totalRequests : 0;

        let l1Bytes = 0;
        for (const entry of this.l1Store.values()) l1Bytes += entry.byteSize;

        return {
            totalRequests,
            totalHits,
            hitRatio: Number(hitRatio.toFixed(4)),
            l1HitRatio: Number(l1HitRatio.toFixed(4)),
            l1Hits: this.stats.l1Hits,
            l2Hits: this.stats.l2Hits,
            misses: this.stats.misses,
            l1Size: this.l1Store.size,
            l2Size: this.l2Store.size,
            l1BytesEstimated: l1Bytes,
            l1Evictions: this.stats.l1Evictions,
            l2Evictions: this.stats.l2Evictions,
            promotions: this.stats.promotions
        };
    }
}

module.exports = TieredModelCache;
