const crypto = require('crypto');

/**
 * Deterministic match replay recorder, chunked streaming, and delta compression engine for NeuroArena.
 * Encodes match metadata, input streams, neural state checkpoints, and timeline bookmarks.
 */
class MatchReplayRecorder {
  constructor(matchId, biomeId, player1, player2, options = {}) {
    this.header = {
      version: '1.2.0',
      matchId,
      biomeId,
      timestamp: options.timestamp || Date.now(),
      players: [
        { id: player1.id, name: player1.name, initialModelParams: player1.initialModelParams || {} },
        { id: player2.id, name: player2.name, initialModelParams: player2.initialModelParams || {} }
      ],
      tickRateHz: options.tickRateHz || 20
    };
    this.frames = [];
    this.bookmarks = [];
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

    // Compute chained rolling deterministic checksum
    const prevHash = this.checksumHistory.length > 0 ? this.checksumHistory[this.checksumHistory.length - 1] : '00000000';
    const hash = crypto.createHash('sha256').update(prevHash + JSON.stringify(frame)).digest('hex').slice(0, 16);
    this.checksumHistory.push(hash);
    return frame;
  }

  addBookmark(tick, eventType, description, payload = {}) {
    const bookmark = {
      tick: Math.max(0, Math.floor(tick)),
      eventType: String(eventType).toUpperCase(),
      description: String(description),
      timestamp: Date.now(),
      payload
    };
    this.bookmarks.push(bookmark);
    this.bookmarks.sort((a, b) => a.tick - b.tick);
    return bookmark;
  }

  exportReplayBundle() {
    const data = {
      header: this.header,
      frameCount: this.frames.length,
      bookmarks: this.bookmarks,
      finalChecksum: this.checksumHistory[this.checksumHistory.length - 1] || '00000000',
      frames: this.frames
    };
    const jsonStr = JSON.stringify(data);
    const compressed = Buffer.from(jsonStr).toString('base64');
    return {
      replayId: this.header.matchId,
      sizeBytes: jsonStr.length,
      compressedBase64: compressed,
      finalChecksum: data.finalChecksum,
      bookmarksCount: this.bookmarks.length
    };
  }

  /**
   * Generates a seek lookup table for sub-millisecond timeline seeks
   */
  generateSeekTable(keyframeInterval = 25) {
    const seekTable = [];
    for (let i = 0; i < this.frames.length; i += keyframeInterval) {
      seekTable.push({
        tick: this.frames[i].t,
        frameIndex: i,
        checksum: this.checksumHistory[i] || '00000000',
        p1Loss: this.frames[i].s?.p1Loss ?? this.frames[i].s?.p1?.loss ?? 0,
        p2Loss: this.frames[i].s?.p2Loss ?? this.frames[i].s?.p2?.loss ?? 0
      });
    }
    return seekTable;
  }

  /**
   * Exports replay into chunked manifests for Redis caching and streaming over WebSockets
   */
  exportChunkedReplay(chunkSize = 50) {
    const chunks = [];
    const totalFrames = this.frames.length;
    const numChunks = Math.ceil(totalFrames / chunkSize);

    for (let c = 0; c < numChunks; c++) {
      const startIdx = c * chunkSize;
      const endIdx = Math.min(startIdx + chunkSize, totalFrames);
      const chunkFrames = this.frames.slice(startIdx, endIdx);
      const rawJson = JSON.stringify(chunkFrames);

      chunks.push({
        chunkIndex: c,
        startTick: chunkFrames[0].t,
        endTick: chunkFrames[chunkFrames.length - 1].t,
        frameCount: chunkFrames.length,
        payloadBase64: Buffer.from(rawJson).toString('base64'),
        chunkHash: crypto.createHash('sha256').update(rawJson).digest('hex').slice(0, 16)
      });
    }

    return {
      manifest: {
        matchId: this.header.matchId,
        biomeId: this.header.biomeId,
        tickRateHz: this.header.tickRateHz,
        totalFrames,
        chunkSize,
        chunkCount: chunks.length,
        finalChecksum: this.checksumHistory[this.checksumHistory.length - 1] || '00000000',
        bookmarks: this.bookmarks,
        seekTable: this.generateSeekTable(chunkSize)
      },
      chunks
    };
  }

  /**
   * Encodes frames using keyframes + delta compression for bandwidth reduction
   */
  static encodeDeltaFrames(frames, keyframeInterval = 20) {
    if (!Array.isArray(frames) || frames.length === 0) return { keyframes: [], deltas: [] };

    const encoded = {
      version: '1.2.0-delta',
      frameCount: frames.length,
      keyframeInterval,
      keyframes: [],
      deltas: []
    };

    let lastState = null;

    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      const isKeyframe = (i % keyframeInterval === 0);

      if (isKeyframe || !lastState) {
        encoded.keyframes.push({
          frameIndex: i,
          frame: f
        });
        lastState = JSON.parse(JSON.stringify(f.s || {}));
      } else {
        const delta = {
          t: f.t,
          i1: f.i1,
          i2: f.i2,
          d: MatchReplayRecorder._calculateStateDelta(lastState, f.s || {})
        };
        encoded.deltas.push(delta);
        lastState = JSON.parse(JSON.stringify(f.s || {}));
      }
    }

    return encoded;
  }

  /**
   * Decodes delta compressed bundle back to standard continuous frames
   */
  static decodeDeltaFrames(deltaBundle) {
    if (!deltaBundle || !Array.isArray(deltaBundle.keyframes)) {
      throw new Error('Invalid delta bundle format');
    }

    const { frameCount, keyframeInterval, keyframes, deltas } = deltaBundle;
    const restored = new Array(frameCount);
    let keyframePtr = 0;
    let deltaPtr = 0;
    let currentState = null;

    for (let i = 0; i < frameCount; i++) {
      if (keyframePtr < keyframes.length && keyframes[keyframePtr].frameIndex === i) {
        const kf = keyframes[keyframePtr];
        restored[i] = JSON.parse(JSON.stringify(kf.frame));
        currentState = JSON.parse(JSON.stringify(kf.frame.s || {}));
        keyframePtr++;
      } else if (deltaPtr < deltas.length) {
        const d = deltas[deltaPtr++];
        currentState = MatchReplayRecorder._applyStateDelta(currentState, d.d);
        restored[i] = {
          t: d.t,
          i1: d.i1,
          i2: d.i2,
          s: JSON.parse(JSON.stringify(currentState))
        };
      }
    }

    return restored;
  }

  static _calculateStateDelta(s1, s2) {
    const delta = {};
    for (const key of Object.keys(s2)) {
      if (typeof s2[key] === 'number') {
        const diff = Number((s2[key] - (s1[key] || 0)).toFixed(4));
        if (Math.abs(diff) > 0.0001) delta[key] = diff;
      } else if (typeof s2[key] === 'object' && s2[key] !== null) {
        delta[key] = MatchReplayRecorder._calculateStateDelta(s1[key] || {}, s2[key]);
      } else {
        delta[key] = s2[key];
      }
    }
    return delta;
  }

  static _applyStateDelta(base, delta) {
    const result = JSON.parse(JSON.stringify(base || {}));
    for (const key of Object.keys(delta)) {
      if (typeof delta[key] === 'number') {
        result[key] = Number(((result[key] || 0) + delta[key]).toFixed(4));
      } else if (typeof delta[key] === 'object' && delta[key] !== null) {
        result[key] = MatchReplayRecorder._applyStateDelta(result[key] || {}, delta[key]);
      } else {
        result[key] = delta[key];
      }
    }
    return result;
  }

  static verifyAndLoadReplay(base64Payload) {
    const jsonStr = Buffer.from(base64Payload, 'base64').toString('utf8');
    const parsed = JSON.parse(jsonStr);
    if (!parsed.header || !Array.isArray(parsed.frames)) {
      throw new Error('Invalid replay format');
    }
    return parsed;
  }

  static verifyReplayIntegrity(bundle) {
    if (!bundle || !bundle.finalChecksum || !Array.isArray(bundle.frames)) return false;
    let rollingChecksum = '00000000';
    for (const frame of bundle.frames) {
      rollingChecksum = crypto.createHash('sha256').update(rollingChecksum + JSON.stringify(frame)).digest('hex').slice(0, 16);
    }
    return rollingChecksum === bundle.finalChecksum;
  }
}

module.exports = { MatchReplayRecorder };
