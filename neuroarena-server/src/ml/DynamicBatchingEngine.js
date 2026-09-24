/**
 * DynamicBatchingEngine.js
 * Adaptive micro-batching and SLA-driven queue scheduler for neural inference.
 * Groups asynchronous forward pass queries into high-throughput tensor batches
 * while enforcing strict sub-10ms latency timeouts for real-time multiplayer gaming.
 */

'use strict';

class DynamicBatchingEngine {
  constructor(options = {}) {
    this.maxBatchSize = options.maxBatchSize || 32;
    this.maxWaitMs = options.maxWaitMs || 8; // Flush timeout to preserve 60Hz tick SLA
    this.inferenceHandler = options.inferenceHandler || this._defaultInferenceRunner;
    
    // Priority queues: 'HIGH' (Ranked/Tournament), 'NORMAL' (Casual/Co-op), 'LOW' (Background Bots)
    this.queues = {
      HIGH: [],
      NORMAL: [],
      LOW: []
    };

    this.timer = null;
    this.isFlushing = false;

    // Telemetry & metrics
    this.stats = {
      totalRequests: 0,
      totalBatches: 0,
      totalInferenceTimeMs: 0,
      p95LatencyMs: 0,
      slaViolations: 0,
      latencyHistory: []
    };
  }

  /**
   * Enqueues an inference request and returns a Promise that resolves with the output vector.
   * @param {number[]} inputVector - Input feature array
   * @param {Object} [meta={}] - Request metadata (priority, clientId, matchId)
   * @returns {Promise<number[]>}
   */
  enqueue(inputVector, meta = {}) {
    return new Promise((resolve, reject) => {
      const priority = meta.priority || 'NORMAL';
      const queue = this.queues[priority] || this.queues.NORMAL;

      const item = {
        inputVector,
        meta,
        enqueueTime: Date.now(),
        resolve,
        reject
      };

      queue.push(item);
      this.stats.totalRequests++;

      const pendingCount = this.getPendingCount();

      // If pending count reaches batch limit, flush immediately
      if (pendingCount >= this.maxBatchSize) {
        this._flush();
      } else if (!this.timer) {
        // Start SLA deadline timer for the current batch
        this.timer = setTimeout(() => {
          this._flush();
        }, this.maxWaitMs);
      }
    });
  }

  /**
   * Total number of items pending across all priority queues.
   */
  getPendingCount() {
    return this.queues.HIGH.length + this.queues.NORMAL.length + this.queues.LOW.length;
  }

  /**
   * Flushes current queued requests and executes the batched tensor forward pass.
   */
  async _flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.isFlushing) return;

    // Drain up to maxBatchSize prioritizing HIGH -> NORMAL -> LOW
    const batch = [];
    const drainQueue = (q) => {
      while (q.length > 0 && batch.length < this.maxBatchSize) {
        batch.push(q.shift());
      }
    };

    drainQueue(this.queues.HIGH);
    drainQueue(this.queues.NORMAL);
    drainQueue(this.queues.LOW);

    if (batch.length === 0) return;

    this.isFlushing = true;
    const batchStartTime = Date.now();

    try {
      const inputs = batch.map((item) => item.inputVector);
      // Run vectorized inference
      const outputs = await this.inferenceHandler(inputs);

      const batchDuration = Date.now() - batchStartTime;
      this.stats.totalBatches++;
      this.stats.totalInferenceTimeMs += batchDuration;

      // Deliver individual results and check SLA compliance
      for (let i = 0; i < batch.length; i++) {
        const item = batch[i];
        const totalLatency = Date.now() - item.enqueueTime;

        this._recordLatency(totalLatency);
        if (totalLatency > this.maxWaitMs * 2.5) {
          this.stats.slaViolations++;
        }

        item.resolve(outputs[i] || []);
      }
    } catch (err) {
      for (const item of batch) {
        item.reject(err);
      }
    } finally {
      this.isFlushing = false;
      // If remaining items accumulated during batch execution, schedule next flush
      if (this.getPendingCount() > 0) {
        if (this.getPendingCount() >= this.maxBatchSize) {
          this._flush();
        } else {
          this.timer = setTimeout(() => this._flush(), this.maxWaitMs);
        }
      }
    }
  }

  /**
   * Internal default vectorized inference runner (Simulated Dense Layer forward pass).
   */
  async _defaultInferenceRunner(batchInputs) {
    return batchInputs.map((input) => {
      // Linear dot product proxy + ReLU activation
      return input.map((val) => Math.max(0, val * 0.85 + 0.15));
    });
  }

  /**
   * Records latency and updates percentiles.
   */
  _recordLatency(latencyMs) {
    this.stats.latencyHistory.push(latencyMs);
    if (this.stats.latencyHistory.length > 200) {
      this.stats.latencyHistory.shift();
    }

    const sorted = [...this.stats.latencyHistory].sort((a, b) => a - b);
    const p95Idx = Math.floor(sorted.length * 0.95);
    this.stats.p95LatencyMs = sorted[p95Idx] || latencyMs;
  }

  /**
   * Telemetry summary of batching performance.
   */
  getTelemetry() {
    const avgBatchSize = this.stats.totalBatches > 0 
      ? parseFloat((this.stats.totalRequests / this.stats.totalBatches).toFixed(2)) 
      : 0;
    const avgBatchDuration = this.stats.totalBatches > 0 
      ? parseFloat((this.stats.totalInferenceTimeMs / this.stats.totalBatches).toFixed(2)) 
      : 0;

    return {
      totalRequests: this.stats.totalRequests,
      totalBatches: this.stats.totalBatches,
      avgBatchSize,
      avgBatchDurationMs: avgBatchDuration,
      p95LatencyMs: this.stats.p95LatencyMs,
      slaViolations: this.stats.slaViolations,
      pendingCount: this.getPendingCount()
    };
  }
}

module.exports = {
  DynamicBatchingEngine
};
