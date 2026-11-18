/**
 * Web Audio API based procedural & layered adaptive music soundtrack engine.
 * Dynamically mixes ambient pad, rhythm, arp, and tension stems based on loss convergence and combat.
 */
export class AdaptiveAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.stemGains = {
      ambient: null,
      bass: null,
      rhythm: null,
      tension: null
    };
    this.isPlaying = false;
    this.currentCombatIntensity = 0.0;
  }

  init() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    for (const key of Object.keys(this.stemGains)) {
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(key === 'ambient' ? 0.8 : 0.0, this.ctx.currentTime);
      g.connect(this.masterGain);
      this.stemGains[key] = g;
    }
  }

  setIntensity(intensity) {
    this.currentCombatIntensity = Math.max(0, Math.min(1, intensity));
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const rampTime = 0.5;

    // Crossfade stems smoothly
    if (this.stemGains.ambient) {
      this.stemGains.ambient.gain.setTargetAtTime(1.0 - this.currentCombatIntensity * 0.4, now, rampTime);
    }
    if (this.stemGains.bass) {
      this.stemGains.bass.gain.setTargetAtTime(this.currentCombatIntensity > 0.2 ? 0.7 : 0.0, now, rampTime);
    }
    if (this.stemGains.rhythm) {
      this.stemGains.rhythm.gain.setTargetAtTime(this.currentCombatIntensity > 0.5 ? 0.8 : 0.0, now, rampTime);
    }
    if (this.stemGains.tension) {
      this.stemGains.tension.gain.setTargetAtTime(this.currentCombatIntensity > 0.8 ? 0.9 : 0.0, now, rampTime);
    }
  }

  triggerSynthesizedPulse(frequency = 440, duration = 0.2) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }
}
