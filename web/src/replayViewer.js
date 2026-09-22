/**
 * Deterministic Replay Player & Rollback Timeline Scrubber for NeuroArena Web.
 * Provides frame-stepping, continuous scrubbing, lerp/slerp interpolation,
 * ghost trail trajectory overlays, desync delta indicators, and keyframe bookmarks.
 */
export class ReplayViewer {
  constructor(replayData) {
    this.header = replayData?.header || {};
    this.frames = replayData?.frames || [];
    this.bookmarks = replayData?.bookmarks || [];
    this.totalFrames = this.frames.length;
    this.currentFrameIndex = 0;
    this.playbackSpeed = 1.0;
    this.isPlaying = false;
    this.playbackTimer = null;
    this.onFrameUpdate = null; // callback(frame, interpolatedState)
    this.onBookmark = null; // callback(bookmark)
    this.onPlaybackStateChange = null; // callback(isPlaying)
  }

  getDurationSeconds() {
    const tickRate = this.header.tickRateHz || 20;
    return this.totalFrames / tickRate;
  }

  play() {
    if (this.isPlaying || this.totalFrames === 0) return;
    this.isPlaying = true;
    if (this.onPlaybackStateChange) this.onPlaybackStateChange(true);

    const intervalMs = (1000 / (this.header.tickRateHz || 20)) / this.playbackSpeed;

    this.playbackTimer = setInterval(() => {
      if (this.currentFrameIndex < this.totalFrames - 1) {
        this.seekFrame(this.currentFrameIndex + 1);
      } else {
        this.pause();
      }
    }, intervalMs);
  }

  pause() {
    this.isPlaying = false;
    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
      this.playbackTimer = null;
    }
    if (this.onPlaybackStateChange) this.onPlaybackStateChange(false);
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
    return this.isPlaying;
  }

  setSpeed(speed) {
    this.playbackSpeed = Math.max(0.1, Math.min(8.0, speed));
    if (this.isPlaying) {
      this.pause();
      this.play();
    }
  }

  seekFrame(index) {
    this.currentFrameIndex = Math.max(0, Math.min(this.totalFrames - 1, Math.floor(index)));
    const frame = this.frames[this.currentFrameIndex];
    if (frame) {
      this._checkBookmarks(frame.t);
      if (this.onFrameUpdate) {
        this.onFrameUpdate(frame, this.getCurrentState());
      }
    }
    return frame;
  }

  seekNormalized(ratio) {
    if (this.totalFrames === 0) return null;
    const targetIdx = Math.floor(Math.max(0, Math.min(1, ratio)) * (this.totalFrames - 1));
    return this.seekFrame(targetIdx);
  }

  seekTick(targetTick) {
    if (this.totalFrames === 0) return null;
    for (let i = 0; i < this.totalFrames; i++) {
      if (this.frames[i].t >= targetTick) {
        return this.seekFrame(i);
      }
    }
    return this.seekFrame(this.totalFrames - 1);
  }

  step(delta = 1) {
    return this.seekFrame(this.currentFrameIndex + delta);
  }

  seekToBookmark(index) {
    if (!this.bookmarks || index < 0 || index >= this.bookmarks.length) return null;
    const bm = this.bookmarks[index];
    return this.seekTick(bm.tick);
  }

  getBookmarks() {
    return this.bookmarks;
  }

  getBookmarkAtTick(tick) {
    return this.bookmarks.find(b => b.tick === tick) || null;
  }

  _checkBookmarks(tick) {
    if (!this.onBookmark || !this.bookmarks) return;
    const bm = this.getBookmarkAtTick(tick);
    if (bm) {
      this.onBookmark(bm);
    }
  }

  getProgress() {
    if (this.totalFrames === 0) return { frame: 0, total: 0, ratio: 0, tick: 0 };
    return {
      frame: this.currentFrameIndex,
      total: this.totalFrames,
      ratio: this.currentFrameIndex / (this.totalFrames - 1),
      tick: this.frames[this.currentFrameIndex]?.t ?? 0
    };
  }

  /**
   * Computes smooth interpolated state between current and next tick
   * @param {number} alpha [0..1]
   */
  getInterpolatedState(alpha = 0.5) {
    if (this.totalFrames === 0) return null;
    const f1 = this.frames[this.currentFrameIndex];
    const nextIdx = Math.min(this.totalFrames - 1, this.currentFrameIndex + 1);
    const f2 = this.frames[nextIdx];

    if (!f1?.s || !f2?.s) return f1?.s || null;

    const s1 = f1.s;
    const s2 = f2.s;

    return {
      tick: f1.t,
      alpha,
      p1: {
        x: s1.p1 ? s1.p1.x + (s2.p1.x - s1.p1.x) * alpha : 0,
        y: s1.p1 ? s1.p1.y + (s2.p1.y - s1.p1.y) * alpha : 0,
        z: s1.p1 ? s1.p1.z + (s2.p1.z - s1.p1.z) * alpha : 0,
        loss: s1.p1 ? s1.p1.loss + ((s2.p1?.loss ?? s1.p1.loss) - s1.p1.loss) * alpha : (s1.p1Loss ?? 0)
      },
      p2: {
        x: s1.p2 ? s1.p2.x + (s2.p2.x - s1.p2.x) * alpha : 0,
        y: s1.p2 ? s1.p2.y + (s2.p2.y - s1.p2.y) * alpha : 0,
        z: s1.p2 ? s1.p2.z + (s2.p2.z - s1.p2.z) * alpha : 0,
        loss: s1.p2 ? s1.p2.loss + ((s2.p2?.loss ?? s1.p2.loss) - s1.p2.loss) * alpha : (s1.p2Loss ?? 0)
      }
    };
  }

  getCurrentState() {
    return this.frames[this.currentFrameIndex]?.s || null;
  }

  getDesyncDivergence(frameIndex = null) {
    const idx = frameIndex !== null ? frameIndex : this.currentFrameIndex;
    const state = this.frames[idx]?.s;
    if (!state) return 0;
    const l1 = state.p1?.loss ?? state.p1Loss ?? 0;
    const l2 = state.p2?.loss ?? state.p2Loss ?? 0;
    return Math.abs(l1 - l2);
  }

  /**
   * Generates a trajectory trail point list for ghost visualization with loss-weighted alpha
   */
  getTrajectoryTrail(playerId = 'p1', sampleInterval = 2) {
    const trail = [];
    for (let i = 0; i < this.totalFrames; i += sampleInterval) {
      const state = this.frames[i]?.s;
      if (state && state[playerId]) {
        trail.push({
          frame: i,
          tick: this.frames[i].t,
          x: state[playerId].x,
          y: state[playerId].y,
          z: state[playerId].z,
          loss: state[playerId].loss ?? 0,
          isKeyframe: (i % 20 === 0)
        });
      }
    }
    return trail;
  }

  /**
   * Decodes delta compressed bundle
   */
  static decodeDeltaFrames(deltaBundle) {
    if (!deltaBundle || !Array.isArray(deltaBundle.keyframes)) {
      throw new Error('Invalid delta bundle format');
    }

    const { frameCount, keyframes, deltas } = deltaBundle;
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
        currentState = ReplayViewer._applyStateDelta(currentState, d.d);
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

  static _applyStateDelta(base, delta) {
    const result = JSON.parse(JSON.stringify(base || {}));
    for (const key of Object.keys(delta)) {
      if (typeof delta[key] === 'number') {
        result[key] = Number(((result[key] || 0) + delta[key]).toFixed(4));
      } else if (typeof delta[key] === 'object' && delta[key] !== null) {
        result[key] = ReplayViewer._applyStateDelta(result[key] || {}, delta[key]);
      } else {
        result[key] = delta[key];
      }
    }
    return result;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ReplayViewer };
}
