/**
 * Real-Time Telemetry & Cheat Detection Engine for NeuroArena Server.
 * Analyzes kinematic telemetry streams, training loss trajectories, and input timing
 * to detect speedhacks, teleportation, spinbots, and loss fabrication.
 */
class CheatDetectionEngine {
  constructor(config = {}) {
    this.maxVelocity = config.maxVelocity || 25.0; // max units per second
    this.maxAngularAcc = config.maxAngularAcc || 720.0; // max deg/s
    this.minTrainingLossStepMs = config.minTrainingLossStepMs || 10; // minimum ms required for realistic forward+backprop pass
    this.quarantineThreshold = config.quarantineThreshold || 100;

    // Track per-player state history: id -> { lastPos, lastTime, lastYaw, score, flags }
    this.playerProfiles = new Map();
  }

  getProfile(playerId) {
    if (!this.playerProfiles.has(playerId)) {
      this.playerProfiles.set(playerId, {
        id: playerId,
        suspicionScore: 0,
        flags: [],
        lastPos: null,
        lastTime: 0,
        lastYaw: 0,
        lossHistory: []
      });
    }
    return this.playerProfiles.get(playerId);
  }

  /**
   * Evaluates movement telemetry packet
   * @param {string} playerId
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} yawDeg
   * @param {number} timestampMs
   * @returns {{ suspicious: boolean, reason?: string, score: number }}
   */
  evaluateMovement(playerId, x, y, z, yawDeg, timestampMs) {
    const profile = this.getProfile(playerId);

    if (!profile.lastPos || profile.lastTime === 0) {
      profile.lastPos = { x, y, z };
      profile.lastTime = timestampMs;
      profile.lastYaw = yawDeg;
      return { suspicious: false, score: profile.suspicionScore };
    }

    const dt = (timestampMs - profile.lastTime) / 1000;
    if (dt <= 0) {
      profile.suspicionScore += 15;
      profile.flags.push('ZERO_OR_NEGATIVE_DT');
      return { suspicious: true, reason: 'TIMESTAMP_TAMPERING', score: profile.suspicionScore };
    }

    // Calculate displacement & speed
    const dx = x - profile.lastPos.x;
    const dy = y - profile.lastPos.y;
    const dz = z - profile.lastPos.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const speed = distance / dt;

    if (speed > this.maxVelocity * 1.5) {
      profile.suspicionScore += 30;
      profile.flags.push(`SPEED_HACK_EXCESSIVE_VELOCITY_${speed.toFixed(1)}`);
      profile.lastPos = { x, y, z };
      profile.lastTime = timestampMs;
      return { suspicious: true, reason: 'EXCESSIVE_VELOCITY', score: profile.suspicionScore };
    }

    // Angular rate check
    let dYaw = Math.abs(yawDeg - profile.lastYaw);
    if (dYaw > 180) dYaw = 360 - dYaw;
    const angularSpeed = dYaw / dt;

    if (angularSpeed > this.maxAngularAcc * 2) {
      profile.suspicionScore += 20;
      profile.flags.push(`SNAP_AIM_SPINBOT_${angularSpeed.toFixed(0)}`);
      profile.lastYaw = yawDeg;
      profile.lastPos = { x, y, z };
      profile.lastTime = timestampMs;
      return { suspicious: true, reason: 'INSTANT_SNAP_SPINBOT', score: profile.suspicionScore };
    }

    // Slowly decay score over clean updates
    profile.suspicionScore = Math.max(0, profile.suspicionScore - 0.1);
    profile.lastPos = { x, y, z };
    profile.lastTime = timestampMs;
    profile.lastYaw = yawDeg;

    return { suspicious: false, score: profile.suspicionScore };
  }

  /**
   * Evaluates neural network training convergence telemetry
   */
  evaluateTrainingStep(playerId, initialLoss, finalLoss, epochsCount, durationMs) {
    const profile = this.getProfile(playerId);

    if (epochsCount > 1 && durationMs < this.minTrainingLossStepMs * epochsCount) {
      profile.suspicionScore += 50;
      profile.flags.push('IMPOSSIBLE_TRAINING_BURST');
      return { suspicious: true, reason: 'IMPOSSIBLE_EPOCH_COMPUTATION_SPEED', score: profile.suspicionScore };
    }

    // Check for impossible instant loss drops (e.g. 100.0 to 0.00001 in 1 epoch without data)
    if (initialLoss > 5.0 && finalLoss < 0.0001 && epochsCount === 1) {
      profile.suspicionScore += 40;
      profile.flags.push('FABRICATED_PERFECT_LOSS');
      return { suspicious: true, reason: 'FABRICATED_LOSS_CONVERGENCE', score: profile.suspicionScore };
    }

    return { suspicious: false, score: profile.suspicionScore };
  }

  isQuarantined(playerId) {
    const profile = this.getProfile(playerId);
    return profile.suspicionScore >= this.quarantineThreshold;
  }
}

module.exports = { CheatDetectionEngine };
