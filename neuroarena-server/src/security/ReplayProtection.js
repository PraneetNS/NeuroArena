/**
 * ReplayProtection.js
 * High-performance sliding-window packet replay filter and cryptographic nonce verifier.
 */

class SlidingWindowReplayFilter {
  constructor(windowSize = 1024) {
    this.windowSize = windowSize;
    this.maxSeq = 0;
    this.seenSet = new Set();
  }

  /**
   * Returns true if sequence number is valid (fresh and not replayed)
   */
  checkAndRecord(seq) {
    if (seq <= 0) return false;

    // Ahead of window
    if (seq > this.maxSeq) {
      this.maxSeq = seq;
      this.seenSet.add(seq);

      // Evict entries outside window
      const minValid = this.maxSeq - this.windowSize;
      for (const oldSeq of this.seenSet) {
        if (oldSeq < minValid) {
          this.seenSet.delete(oldSeq);
        }
      }
      return true;
    }

    // Too old (behind sliding window)
    if (seq < this.maxSeq - this.windowSize) {
      return false;
    }

    // Within window: check if already seen (replay attack)
    if (this.seenSet.has(seq)) {
      return false; // Replayed!
    }

    this.seenSet.add(seq);
    return true;
  }
}

class ReplayProtection {
  constructor(options = {}) {
    this.clientWindows = new Map(); // clientId -> SlidingWindowReplayFilter
    this.seenNonces = new Map(); // nonce -> timestampMs
    this.nonceTtlMs = options.nonceTtlMs || 300000; // 5 min
  }

  validatePacketSeq(clientId, seq) {
    if (!this.clientWindows.has(clientId)) {
      this.clientWindows.set(clientId, new SlidingWindowReplayFilter());
    }
    return this.clientWindows.get(clientId).checkAndRecord(seq);
  }

  validateNonce(nonce, timestampMs) {
    if (!nonce) return false;
    const now = Date.now();
    if (Math.abs(now - timestampMs) > this.nonceTtlMs) {
      return false; // Stale timestamp
    }

    if (this.seenNonces.has(nonce)) {
      return false; // Nonce replay!
    }

    this.seenNonces.set(nonce, now);

    // Evict old nonces
    if (this.seenNonces.size > 10000) {
      const cutoff = now - this.nonceTtlMs;
      for (const [n, ts] of this.seenNonces.entries()) {
        if (ts < cutoff) this.seenNonces.delete(n);
      }
    }

    return true;
  }

  removeClient(clientId) {
    this.clientWindows.delete(clientId);
  }
}

module.exports = { ReplayProtection, SlidingWindowReplayFilter };
