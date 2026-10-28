/**
 * Procedural Web Audio Engine for The Camp.
 * 
 * Zero audio file dependencies:
 * 1. Campfire crackle: filtered pink noise + randomized impulse bursts (bursting embers).
 * 2. Night ambience: low resonant wind drone + gentle pulsed crickets.
 * 3. Soft dusk synthesizer pad: warm detuned triangle/sine oscillators through lowpass filter.
 * 4. Melodic motif: peaceful 4-note arpeggio whose pitch/scale drifts with smoothed train loss.
 * 5. Celebratory chime: layered harmonic bell tones when training completes.
 */

export class CampAudio {
  private ctx: AudioContext | null = null;
  private isMuted = false;
  private isRunning = false;

  // Audio Nodes
  private masterGain: GainNode | null = null;
  private crackleGain: GainNode | null = null;
  private ambienceGain: GainNode | null = null;
  private padGain: GainNode | null = null;
  private motifGain: GainNode | null = null;
  private activeSources: AudioScheduledSourceNode[] = [];

  // Interval timers
  private crackleTimer: number | null = null;
  private motifTimer: number | null = null;
  private cricketTimer: number | null = null;

  // State
  private currentSmoothedLoss = 4.5;

  constructor() {}

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public start(): void {
    if (this.isRunning) return;
    const ctx = this.getContext();
    if (!ctx) return;

    this.isRunning = true;
    this.activeSources = [];

    // Master bus
    this.masterGain = ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.65, ctx.currentTime);
    this.masterGain.connect(ctx.destination);

    this.startAmbience(ctx);
    this.startCrackle(ctx);
    this.startPad(ctx);
    this.startMotifLoop(ctx);
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.crackleTimer !== null) {
      window.clearInterval(this.crackleTimer);
      this.crackleTimer = null;
    }
    if (this.motifTimer !== null) {
      window.clearInterval(this.motifTimer);
      this.motifTimer = null;
    }
    if (this.cricketTimer !== null) {
      window.clearInterval(this.cricketTimer);
      this.cricketTimer = null;
    }

    for (const src of this.activeSources) {
      try {
        src.stop();
        src.disconnect();
      } catch {}
    }
    this.activeSources = [];

    if (this.ctx && this.masterGain) {
      try {
        this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
      } catch {}
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.65, this.ctx.currentTime, 0.1);
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public updateLoss(loss: number): void {
    if (Number.isFinite(loss)) {
      this.currentSmoothedLoss = loss;
    }
  }

  /**
   * Continuous gentle night wind and crickets.
   */
  private startAmbience(ctx: AudioContext): void {
    if (!this.masterGain) return;

    this.ambienceGain = ctx.createGain();
    this.ambienceGain.gain.setValueAtTime(0.22, ctx.currentTime);
    this.ambienceGain.connect(this.masterGain);

    // 1. Low wind: pink noise through gentle lowpass filter
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      data[i] = (b0 + b1 + b2) * 0.12;
    }

    const windNoise = ctx.createBufferSource();
    windNoise.buffer = noiseBuffer;
    windNoise.loop = true;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.setValueAtTime(160, ctx.currentTime);

    windNoise.connect(windFilter);
    windFilter.connect(this.ambienceGain);
    windNoise.start();
    this.activeSources.push(windNoise);

    // 2. Periodic distant crickets
    this.cricketTimer = window.setInterval(() => {
      if (!this.isRunning || this.isMuted) return;
      this.playCricketChirp(ctx);
    }, 4500);
  }

  private playCricketChirp(ctx: AudioContext): void {
    if (!this.ambienceGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(4600 + Math.random() * 200, now);

    // Fast triple-chirp envelope
    gain.gain.setValueAtTime(0, now);
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.06;
      gain.gain.setValueAtTime(0.025, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    }

    osc.connect(gain);
    gain.connect(this.ambienceGain);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  /**
   * Campfire crackling: subtle continuous flame hiss + random sharp ember pops.
   */
  private startCrackle(ctx: AudioContext): void {
    if (!this.masterGain) return;

    this.crackleGain = ctx.createGain();
    this.crackleGain.gain.setValueAtTime(0.35, ctx.currentTime);
    this.crackleGain.connect(this.masterGain);

    // Soft hiss loop
    const bufferSize = ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.08;
    }

    const hiss = ctx.createBufferSource();
    hiss.buffer = noiseBuffer;
    hiss.loop = true;

    const hissFilter = ctx.createBiquadFilter();
    hissFilter.type = 'bandpass';
    hissFilter.frequency.setValueAtTime(950, ctx.currentTime);
    hissFilter.Q.setValueAtTime(1.8, ctx.currentTime);

    hiss.connect(hissFilter);
    hissFilter.connect(this.crackleGain);
    hiss.start();

    // Random ember pops & snaps
    const scheduleNextPop = () => {
      if (!this.isRunning) return;
      this.playEmberPop(ctx);
      const nextDelay = 80 + Math.random() * 260; // 80-340ms interval
      this.crackleTimer = window.setTimeout(scheduleNextPop, nextDelay);
    };
    scheduleNextPop();
  }

  private playEmberPop(ctx: AudioContext): void {
    if (!this.crackleGain || this.isMuted) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    // High frequency micro snap
    osc.type = Math.random() > 0.4 ? 'square' : 'triangle';
    osc.frequency.setValueAtTime(1200 + Math.random() * 2800, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.025);

    filter.type = 'highpass';
    filter.frequency.setValueAtTime(800, now);

    const popVol = 0.04 + Math.random() * 0.08;
    gain.gain.setValueAtTime(popVol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.crackleGain);

    osc.start(now);
    osc.stop(now + 0.04);
  }

  /**
   * Warm dusk harmonic pad (C-minor/major based on loss).
   */
  private startPad(ctx: AudioContext): void {
    if (!this.masterGain) return;

    this.padGain = ctx.createGain();
    this.padGain.gain.setValueAtTime(0.18, ctx.currentTime);
    this.padGain.connect(this.masterGain);

    const freqs = [130.81, 164.81, 196.0, 261.63]; // C3, E3, G3, C4
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const detune = (idx - 1.5) * 4.2;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.detune.setValueAtTime(detune, ctx.currentTime);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, ctx.currentTime);

      osc.connect(filter);
      filter.connect(this.padGain!);
      osc.start();
      this.activeSources.push(osc);
    });
  }

  /**
   * Melodic motif that plays periodically.
   * Root pitch and musical scale drift peacefully with smoothed loss:
   * - Loss > 3.5: Minor / searching arpeggio
   * - Loss <= 3.286 (Bigram beaten): Lydian / hopeful
   * - Loss <= 2.834 (Trigram beaten): Major / triumphant peaceful resolution
   */
  private startMotifLoop(ctx: AudioContext): void {
    if (!this.masterGain) return;

    this.motifGain = ctx.createGain();
    this.motifGain.gain.setValueAtTime(0.28, ctx.currentTime);
    this.motifGain.connect(this.masterGain);

    const playMotif = () => {
      if (!this.isRunning || this.isMuted) return;

      const now = ctx.currentTime;
      let notes: number[];

      if (this.currentSmoothedLoss > 3.5) {
        // C-minor contemplative motif
        notes = [261.63, 311.13, 392.0, 523.25]; // C4, Eb4, G4, C5
      } else if (this.currentSmoothedLoss > 2.834) {
        // C-lydian hopeful motif
        notes = [261.63, 329.63, 369.99, 523.25]; // C4, E4, F#4, C5
      } else {
        // C-major radiant resolved motif
        notes = [261.63, 329.63, 392.0, 659.25]; // C4, E4, G4, E5
      }

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.42);

        gain.gain.setValueAtTime(0.0001, now + idx * 0.42);
        gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.42 + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.42 + 1.2);

        osc.connect(gain);
        gain.connect(this.motifGain!);

        osc.start(now + idx * 0.42);
        osc.stop(now + idx * 0.42 + 1.3);
      });
    };

    // Initial play after 3s, then every 14s
    window.setTimeout(playMotif, 3000);
    this.motifTimer = window.setInterval(playMotif, 14000);
  }

  /**
   * Celebratory chime when a run successfully finishes.
   */
  public playRunCompleteChime(): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C5, E5, G5, C6, E6

    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.07);
      gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.07 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.07 + 2.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 2.5);
    });
  }
}
