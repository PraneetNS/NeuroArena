/**
 * ReplayAttestationEngine.js
 * Cryptographic replay verification and deterministic state tree attestation engine.
 * Computes Merkle state root across replay frames, validates kinematic consistency,
 * and signs match verification certificates to guard against state tampering.
 */

'use strict';

const crypto = require('crypto');

class ReplayAttestationEngine {
  constructor(options = {}) {
    this.signingSecret = options.signingSecret || process.env.ATTESTATION_SECRET || 'neuroarena_authoritative_cert_secret_key_2026';
    this.maxVelocityDelta = options.maxVelocityDelta || 65.0; // Max allowed units/sec^2 between consecutive frames
    this.maxTickGapMs = options.maxTickGapMs || 250;          // Max allowed gap between frames
  }

  /**
   * Hashes a single frame state payload.
   * @param {Object} frame
   * @returns {string} SHA-256 hex string
   */
  hashFrame(frame) {
    const canonical = JSON.stringify({
      tick: frame.tick,
      timestamp: frame.timestamp,
      position: frame.position,
      velocity: frame.velocity,
      action: frame.action,
      weightsChecksum: frame.weightsChecksum || null
    });
    return crypto.createHash('sha256').update(canonical).digest('hex');
  }

  /**
   * Computes a Merkle Root hash from a list of frame hashes.
   * @param {string[]} hashes
   * @returns {string}
   */
  computeMerkleRoot(hashes) {
    if (!hashes || hashes.length === 0) {
      return crypto.createHash('sha256').update('empty_replay').digest('hex');
    }

    let currentLevel = [...hashes];

    while (currentLevel.length > 1) {
      const nextLevel = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        if (i + 1 < currentLevel.length) {
          const combined = currentLevel[i] + currentLevel[i + 1];
          nextLevel.push(crypto.createHash('sha256').update(combined).digest('hex'));
        } else {
          // Odd leaf: pair with itself
          const combined = currentLevel[i] + currentLevel[i];
          nextLevel.push(crypto.createHash('sha256').update(combined).digest('hex'));
        }
      }
      currentLevel = nextLevel;
    }

    return currentLevel[0];
  }

  /**
   * Verifies physics kinematics and temporal continuity across sequential replay frames.
   * @param {Object[]} frames
   * @returns {{ valid: boolean, violationIndex: number|null, reason: string|null }}
   */
  validateKinematicContinuity(frames) {
    if (!frames || frames.length < 2) {
      return { valid: true, violationIndex: null, reason: null };
    }

    for (let i = 1; i < frames.length; i++) {
      const prev = frames[i - 1];
      const curr = frames[i];

      const dt = (curr.timestamp - prev.timestamp) / 1000.0;
      if (dt <= 0 || (curr.timestamp - prev.timestamp) > this.maxTickGapMs) {
        return {
          valid: false,
          violationIndex: i,
          reason: `ILLEGAL_TIMESTAMP_DELTA (dt: ${curr.timestamp - prev.timestamp}ms)`
        };
      }

      // Check velocity continuity
      if (prev.velocity && curr.velocity) {
        const dvx = curr.velocity.x - prev.velocity.x;
        const dvy = curr.velocity.y - prev.velocity.y;
        const acceleration = Math.sqrt(dvx * dvx + dvy * dvy) / Math.max(0.001, dt);

        if (acceleration > this.maxVelocityDelta) {
          return {
            valid: false,
            violationIndex: i,
            reason: `PHYSICS_ANOMALY_EXCESSIVE_ACCELERATION (acc: ${acceleration.toFixed(2)})`
          };
        }
      }
    }

    return { valid: true, violationIndex: null, reason: null };
  }

  /**
   * Generates a signed match attestation certificate for a completed match replay.
   * @param {string} matchId
   * @param {string} playerId
   * @param {Object[]} frames
   * @returns {{
   *   matchId: string,
   *   playerId: string,
   *   frameCount: number,
   *   merkleRoot: string,
   *   signature: string,
   *   verified: boolean,
   *   rejectionReason: string|null,
   *   issuedAt: string
   * }}
   */
  attestReplay(matchId, playerId, frames) {
    const kinematicCheck = this.validateKinematicContinuity(frames);

    if (!kinematicCheck.valid) {
      return {
        matchId,
        playerId,
        frameCount: frames ? frames.length : 0,
        merkleRoot: null,
        signature: null,
        verified: false,
        rejectionReason: kinematicCheck.reason,
        issuedAt: new Date().toISOString()
      };
    }

    const frameHashes = frames.map((f) => this.hashFrame(f));
    const merkleRoot = this.computeMerkleRoot(frameHashes);

    const certificatePayload = `${matchId}:${playerId}:${frames.length}:${merkleRoot}`;
    const signature = crypto
      .createHmac('sha256', this.signingSecret)
      .update(certificatePayload)
      .digest('hex');

    return {
      matchId,
      playerId,
      frameCount: frames.length,
      merkleRoot,
      signature,
      verified: true,
      rejectionReason: null,
      issuedAt: new Date().toISOString()
    };
  }

  /**
   * Verifies the authenticity of a previously issued attestation certificate.
   * @param {Object} certificate
   * @returns {boolean}
   */
  verifyCertificate(certificate) {
    if (!certificate || !certificate.signature || !certificate.merkleRoot) {
      return false;
    }

    const expectedPayload = `${certificate.matchId}:${certificate.playerId}:${certificate.frameCount}:${certificate.merkleRoot}`;
    const expectedSig = crypto
      .createHmac('sha256', this.signingSecret)
      .update(expectedPayload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(certificate.signature, 'utf8'),
      Buffer.from(expectedSig, 'utf8')
    );
  }
}

module.exports = {
  ReplayAttestationEngine
};
