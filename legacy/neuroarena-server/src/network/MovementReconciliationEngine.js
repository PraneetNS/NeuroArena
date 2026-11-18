/**
 * MovementReconciliationEngine.js
 * High-Performance Client-Side Prediction & Server Authoritative Reconciliation Engine.
 * 
 * Hides 20Hz tick latency (50ms) on high-latency connections (>80ms RTT)
 * using client prediction buffers and authoritative server rollback-replay reconciliation.
 */

class MovementReconciliationEngine {
  constructor(options = {}) {
    this.maxVelocity = options.maxVelocity || 15.0; // max units per second
    this.errorThreshold = options.errorThreshold || 0.05; // 5cm position discrepancy threshold
    this.bufferSize = options.bufferSize || 120; // 2 seconds of inputs at 60fps
    this.unacknowledgedInputs = []; // [{ seq, dt, input: { dx, dz, rotY }, predictedPos: { x, z } }]
  }

  /**
   * Client-side: records local input, applies prediction immediately, and stores in ring buffer.
   */
  predictMovement(currentPos, input, dt, seq) {
    const dx = (input.dx || 0) * this.maxVelocity * dt;
    const dz = (input.dz || 0) * this.maxVelocity * dt;

    const newX = currentPos.x + dx;
    const newZ = currentPos.z + dz;
    const newRotY = input.rotY !== undefined ? input.rotY : currentPos.rotationY;

    const frame = {
      seq,
      dt,
      input: { dx: input.dx || 0, dz: input.dz || 0, rotY: newRotY },
      predictedPos: { x: newX, z: newZ, rotationY: newRotY },
      timestamp: Date.now()
    };

    this.unacknowledgedInputs.push(frame);
    if (this.unacknowledgedInputs.length > this.bufferSize) {
      this.unacknowledgedInputs.shift();
    }

    return frame.predictedPos;
  }

  /**
   * Server-side: validates incoming client input, simulates authoritative position,
   * clamps velocities to prevent speed hacks, and tags with last processed sequence ID.
   */
  serverSimulateStep(authoritativePos, input, dt, seq) {
    const clampedDx = Math.max(-1, Math.min(1, input.dx || 0));
    const clampedDz = Math.max(-1, Math.min(1, input.dz || 0));
    const speed = Math.min(this.maxVelocity, input.speed || this.maxVelocity);

    const deltaX = clampedDx * speed * dt;
    const deltaZ = clampedDz * speed * dt;

    const updatedX = authoritativePos.x + deltaX;
    const updatedZ = authoritativePos.z + deltaZ;
    const updatedRotY = typeof input.rotY === 'number' ? input.rotY : authoritativePos.rotationY;

    return {
      lastProcessedSeq: seq,
      x: parseFloat(updatedX.toFixed(4)),
      z: parseFloat(updatedZ.toFixed(4)),
      rotationY: parseFloat(updatedRotY.toFixed(2)),
      timestamp: Date.now()
    };
  }

  /**
   * Client-side: Reconciles incoming authoritative server update against local prediction history.
   * If error exceeds threshold, snaps to authoritative state and replays all subsequent unacknowledged inputs.
   */
  reconcileServerState(authoritativeUpdate, currentPredictedPos) {
    const { lastProcessedSeq, x: authX, z: authZ, rotationY: authRotY } = authoritativeUpdate;

    // 1. Find the recorded prediction corresponding to this sequence number
    const ackIndex = this.unacknowledgedInputs.findIndex(item => item.seq === lastProcessedSeq);

    if (ackIndex === -1) {
      // Sequence too old or not in buffer, discard older
      return {
        reconciledPos: currentPredictedPos,
        corrected: false,
        errorDelta: 0
      };
    }

    const ackFrame = this.unacknowledgedInputs[ackIndex];
    const dx = authX - ackFrame.predictedPos.x;
    const dz = authZ - ackFrame.predictedPos.z;
    const errorDelta = Math.sqrt(dx * dx + dz * dz);

    // Remove acknowledged inputs up to this sequence
    this.unacknowledgedInputs = this.unacknowledgedInputs.slice(ackIndex + 1);

    if (errorDelta <= this.errorThreshold) {
      // Error is within acceptable tolerance (no visual correction needed)
      return {
        reconciledPos: currentPredictedPos,
        corrected: false,
        errorDelta
      };
    }

    // 2. Error exceeded threshold: Replay all remaining unacknowledged inputs starting from authoritative position
    let replayX = authX;
    let replayZ = authZ;
    let replayRotY = authRotY;

    for (const frame of this.unacknowledgedInputs) {
      const stepDx = frame.input.dx * this.maxVelocity * frame.dt;
      const stepDz = frame.input.dz * this.maxVelocity * frame.dt;
      replayX += stepDx;
      replayZ += stepDz;
      replayRotY = frame.input.rotY !== undefined ? frame.input.rotY : replayRotY;
      frame.predictedPos = { x: replayX, z: replayZ, rotationY: replayRotY };
    }

    return {
      reconciledPos: { x: replayX, z: replayZ, rotationY: replayRotY },
      corrected: true,
      errorDelta,
      replayedInputCount: this.unacknowledgedInputs.length
    };
  }
}

module.exports = { MovementReconciliationEngine };
