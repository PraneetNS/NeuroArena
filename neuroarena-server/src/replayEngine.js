const crypto = require('crypto');

/**
 * Deterministic match replay recorder and serialization engine for NeuroArena.
 * Encodes match metadata, input streams, and neural state checkpoints.
 */
class MatchReplayRecorder {
  constructor(matchId, biomeId, player1, player2) {
    this.header = {
      version: '1.0.0',
      matchId,
      biomeId,
      timestamp: Date.now(),
      players: [
        { id: player1.id, name: player1.name, initialModelParams: player1.initialModelParams || {} },
        { id: player2.id, name: player2.name, initialModelParams: player2.initialModelParams || {} }
      ],
      tickRateHz: 20
    };
    this.frames = [];
    this.checksumHistory = [];
  }

  recordTick(tickIndex, p1Input, p2Input, gameStateSnapshot) {
    const frame = {
      t: tickIndex,
      i1: p1Input,
      i2: p2Input,
      s: gameStateSnapshot
    };
    this.frames.push(frame);

    // Compute rolling deterministic checksum
    const hash = crypto.createHash('sha256').update(JSON.stringify(frame)).digest('hex').slice(0, 16);
    this.checksumHistory.push(hash);
  }

  exportReplayBundle() {
    const data = {
      header: this.header,
      frameCount: this.frames.length,
      finalChecksum: this.checksumHistory[this.checksumHistory.length - 1] || '00000000',
      frames: this.frames
    };
    const jsonStr = JSON.stringify(data);
    const compressed = Buffer.from(jsonStr).toString('base64');
    return {
      replayId: this.header.matchId,
      sizeBytes: jsonStr.length,
      compressedBase64: compressed,
      finalChecksum: data.finalChecksum
    };
  }

  static verifyAndLoadReplay(base64Payload) {
    const jsonStr = Buffer.from(base64Payload, 'base64').toString('utf8');
    const parsed = JSON.parse(jsonStr);
    if (!parsed.header || !Array.isArray(parsed.frames)) {
      throw new Error('Invalid replay format');
    }
    return parsed;
  }
}

module.exports = { MatchReplayRecorder };
