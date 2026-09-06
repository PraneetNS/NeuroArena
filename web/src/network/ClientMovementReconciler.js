/**
 * ClientMovementReconciler.js (Web Client)
 * Client-Side Prediction and Server Authoritative Reconciliation for NeuroArena.
 * Hides 20Hz tick latency on connections with >80ms RTT.
 */

export class ClientMovementReconciler {
  constructor(options = {}) {
    this.maxSpeed = options.maxSpeed || 15.0;
    this.errorThreshold = options.errorThreshold || 0.05;
    this.inputSequence = 0;
    this.unacknowledgedInputs = [];
    this.currentPosition = { x: 0, z: 0, rotationY: 0 };
  }

  setPosition(pos) {
    this.currentPosition = { ...pos };
  }

  getPosition() {
    return { ...this.currentPosition };
  }

  /**
   * Generates input payload, applies local prediction immediately, and returns packet to send to server.
   */
  processLocalInput(dx, dz, dt, rotY = 0) {
    this.inputSequence++;
    const stepDx = dx * this.maxSpeed * dt;
    const stepDz = dz * this.maxSpeed * dt;

    this.currentPosition.x += stepDx;
    this.currentPosition.z += stepDz;
    this.currentPosition.rotationY = rotY;

    const frame = {
      seq: this.inputSequence,
      dt,
      input: { dx, dz, rotY },
      predictedPos: { ...this.currentPosition },
      timestamp: Date.now()
    };

    this.unacknowledgedInputs.push(frame);
    if (this.unacknowledgedInputs.length > 120) {
      this.unacknowledgedInputs.shift();
    }

    return {
      seq: frame.seq,
      dt: frame.dt,
      input: frame.input,
      predictedPos: frame.predictedPos,
      timestamp: frame.timestamp
    };
  }

  /**
   * Reconciles authoritative server position acknowledgment against prediction history.
   */
  onServerAck(ack) {
    const { lastProcessedSeq, x: authX, z: authZ, rotationY: authRotY } = ack;

    const ackIndex = this.unacknowledgedInputs.findIndex(f => f.seq === lastProcessedSeq);
    if (ackIndex === -1) return { corrected: false, errorDelta: 0 };

    const ackFrame = this.unacknowledgedInputs[ackIndex];
    const dx = authX - ackFrame.predictedPos.x;
    const dz = authZ - ackFrame.predictedPos.z;
    const errorDelta = Math.sqrt(dx * dx + dz * dz);

    this.unacknowledgedInputs = this.unacknowledgedInputs.slice(ackIndex + 1);

    if (errorDelta <= this.errorThreshold) {
      return { corrected: false, errorDelta };
    }

    // Replay remaining unacknowledged inputs from authoritative coordinates
    let replayX = authX;
    let replayZ = authZ;
    let replayRotY = authRotY;

    for (const frame of this.unacknowledgedInputs) {
      replayX += frame.input.dx * this.maxSpeed * frame.dt;
      replayZ += frame.input.dz * this.maxSpeed * frame.dt;
      replayRotY = frame.input.rotY !== undefined ? frame.input.rotY : replayRotY;
      frame.predictedPos = { x: replayX, z: replayZ, rotationY: replayRotY };
    }

    this.currentPosition = { x: replayX, z: replayZ, rotationY: replayRotY };

    return {
      corrected: true,
      errorDelta,
      replayedInputCount: this.unacknowledgedInputs.length,
      reconciledPosition: { ...this.currentPosition }
    };
  }
}
