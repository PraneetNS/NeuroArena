/**
 * @file Loop.js
 * @description Deterministic 60 Hz fixed timestep game loop with accumulator, alpha interpolation,
 * and hit-stop timescale freeze system (unscaled clock for UI, frozen simulation for impacts).
 */

const FIXED_TIMESTEP_SEC = 1 / 60; // 60 Hz logic clock (~0.016667s)
const MAX_FRAME_TIME_CAP_SEC = 0.1; // 100ms spiral-of-death clamp

export class Loop {
  /**
   * @param {Object} callbacks
   * @param {function(number, number): void} callbacks.onFixedUpdate - (fixedDt, unscaledDt)
   * @param {function(number, number, number): void} callbacks.onRender - (alpha, unscaledDt, scaledDt)
   */
  constructor({ onFixedUpdate = null, onRender = null } = {}) {
    this.onFixedUpdate = onFixedUpdate;
    this.onRender = onRender;

    this.isRunning = false;
    this.rafId = null;

    // Timing state
    this.previousTimeMs = 0;
    this.accumulatorSec = 0;
    this.timescale = 1.0;

    // Hit-stop system
    this.hitStopRemainingMs = 0;
    this.isHitStopped = false;

    // Bound loop function for RAF
    this._tick = this._tick.bind(this);
  }

  /**
   * Starts the game loop.
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.previousTimeMs = performance.now();
    this.accumulatorSec = 0;
    this.rafId = requestAnimationFrame(this._tick);
  }

  /**
   * Stops the game loop.
   */
  stop() {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Triggers a hit-stop freeze for N milliseconds.
   * Logic simulation steps freeze while UI, camera vibrations, and unscaled rendering continue.
   * @param {number} durationMs - Freeze duration in milliseconds
   */
  hitStop(durationMs) {
    if (durationMs <= 0) return;
    this.hitStopRemainingMs = Math.max(this.hitStopRemainingMs, durationMs);
    this.isHitStopped = true;
  }

  /**
   * Sets game simulation timescale (e.g. slow-motion or fast-forward).
   * @param {number} scale - Simulation timescale multiplier (>= 0)
   */
  setTimescale(scale) {
    this.timescale = Math.max(0.0, scale);
  }

  /**
   * Internal RAF tick handler. Zero allocations per frame.
   * @private
   * @param {DOMHighResTimeStamp} currentTimeMs
   */
  _tick(currentTimeMs) {
    if (!this.isRunning) return;

    const unscaledDeltaMs = currentTimeMs - this.previousTimeMs;
    this.previousTimeMs = currentTimeMs;

    // Clamp delta time to prevent spiral of death on background tabs
    const unscaledDeltaSec = Math.min(unscaledDeltaMs * 0.001, MAX_FRAME_TIME_CAP_SEC);

    // Hit-stop countdown
    if (this.hitStopRemainingMs > 0) {
      this.hitStopRemainingMs -= unscaledDeltaMs;
      if (this.hitStopRemainingMs <= 0) {
        this.hitStopRemainingMs = 0;
        this.isHitStopped = false;
      }
    }

    // Determine simulation delta based on hit-stop and timescale
    const effectiveTimescale = this.isHitStopped ? 0.0 : this.timescale;
    const scaledDeltaSec = unscaledDeltaSec * effectiveTimescale;

    // Accumulate simulation time only if not frozen
    if (effectiveTimescale > 0.0) {
      this.accumulatorSec += scaledDeltaSec;

      while (this.accumulatorSec >= FIXED_TIMESTEP_SEC) {
        if (this.onFixedUpdate) {
          this.onFixedUpdate(FIXED_TIMESTEP_SEC, unscaledDeltaSec);
        }
        this.accumulatorSec -= FIXED_TIMESTEP_SEC;
      }
    }

    // Compute interpolation fraction alpha [0..1]
    const alpha = effectiveTimescale > 0.0 ? this.accumulatorSec / FIXED_TIMESTEP_SEC : 1.0;

    // Render step executes every RAF frame with alpha interpolation and unscaled time for UI
    if (this.onRender) {
      this.onRender(alpha, unscaledDeltaSec, scaledDeltaSec);
    }

    this.rafId = requestAnimationFrame(this._tick);
  }
}
