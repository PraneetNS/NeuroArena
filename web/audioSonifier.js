/**
 * audioSonifier.js
 * Client-side procedural audio sonification engine using the Web Audio API.
 * Converts real-time gradient descent convergence, loss spikes, and weight updates into cybernetic tone chimes.
 */

'use strict';

class AudioSonifier {
  constructor() {
    this.ctx = null;
    this.oscillator = null;
    this.gainNode = null;
    this.isMuted = false;
    this.baseFreq = 220;
  }

  /**
   * Initializes the Web Audio Context upon user interaction.
   */
  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    this.ctx = new AudioContext();
    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.setValueAtTime(0.05, this.ctx.currentTime);
    this.gainNode.connect(this.ctx.destination);
  }

  /**
   * Triggers a harmonic chime on training epoch loss update.
   * Lower loss produces higher frequency harmonic overtone.
   * @param {number} loss
   * @param {number} gradientDelta
   */
  sonifyStep(loss, gradientDelta = 0) {
    if (this.isMuted || !this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();

    // Map loss (0.01 - 2.0) to harmonic frequency
    const clampedLoss = Math.max(0.01, Math.min(loss, 2.0));
    const targetFreq = this.baseFreq * (1 + (1 / (clampedLoss + 0.2)) * 1.8);

    osc.type = gradientDelta > 0.1 ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(targetFreq, now);
    osc.frequency.exponentialRampToValueAtTime(targetFreq * 0.9, now + 0.15);

    env.gain.setValueAtTime(0.08, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    osc.connect(env);
    env.connect(this.gainNode);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }
}

if (typeof window !== 'undefined') {
  window.AudioSonifier = AudioSonifier;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioSonifier;
}
