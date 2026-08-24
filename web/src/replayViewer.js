/**
 * Deterministic Replay Player & Rollback Timeline Scrubber for NeuroArena Web.
 * Provides frame-stepping, continuous scrubbing, lerp/slerp interpolation,
 * ghost trail trajectory overlays, and desync delta indicators.
 */
export class ReplayViewer {
  constructor(replayData) {
    this.header = replayData?.header || {};
    this.frames = replayData?.frames || [];
    this.totalFrames = this.frames.length;
    this.currentFrameIndex = 0;
    this.playbackSpeed = 1.0;
    this.isPlaying = false;
    this.playbackTimer = null;
    this.onFrameUpdate = null; // callback(frame, interpolatedState)
  }

  getDurationSeconds() {
    const tickRate = this.header.tickRateHz || 20;
    return this.totalFrames / tickRate;
  }

  play() {
    if (this.isPlaying || this.totalFrames === 0) return;
    this.isPlaying = true;
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
  }

  setSpeed(speed) {
    this.playbackSpeed = Math.max(0.1, Math.min(5.0, speed));
    if (this.isPlaying) {
      this.pause();
      this.play();
    }
  }

  seekFrame(index) {
    this.currentFrameIndex = Math.max(0, Math.min(this.totalFrames - 1, Math.floor(index)));
    const frame = this.frames[this.currentFrameIndex];
    if (this.onFrameUpdate && frame) {
      this.onFrameUpdate(frame, this.getCurrentState());
    }
    return frame;
  }

  seekNormalized(ratio) {
    const targetIdx = Math.floor(ratio * (this.totalFrames - 1));
    return this.seekFrame(targetIdx);
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
        loss: s1.p1?.loss ?? 0
      },
      p2: {
        x: s2.p2 ? s1.p2.x + (s2.p2.x - s1.p2.x) * alpha : 0,
        y: s2.p2 ? s1.p2.y + (s2.p2.y - s1.p2.y) * alpha : 0,
        z: s2.p2 ? s1.p2.z + (s2.p2.z - s1.p2.z) * alpha : 0,
        loss: s1.p2?.loss ?? 0
      }
    };
  }

  getCurrentState() {
    return this.frames[this.currentFrameIndex]?.s || null;
  }

  /**
   * Generates a trajectory trail point list for ghost visualization
   */
  getTrajectoryTrail(playerId = 'p1', sampleInterval = 2) {
    const trail = [];
    for (let i = 0; i < this.totalFrames; i += sampleInterval) {
      const state = this.frames[i]?.s;
      if (state && state[playerId]) {
        trail.push({
          frame: i,
          x: state[playerId].x,
          y: state[playerId].y,
          z: state[playerId].z,
          loss: state[playerId].loss || 0
        });
      }
    }
    return trail;
  }
}
