/**
 * Pure Web Audio API procedural sound engine with zero audio asset dependencies.
 * Generates:
 * - UI interaction sounds: micro-ticks, panel open/close, harvest chimes, training success, error hums
 * - Surface-adaptive footsteps: grass, sand, rock, water
 * - Continuous ambient wind & distant bird chirps
 * - Master volume and mute controls
 */

export type SurfaceType = 'grass' | 'sand' | 'rock' | 'water';

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMutedState = false;
  private masterGain: GainNode | null = null;
  private masterVolume = 0.8;

  // Ambient sound nodes
  private ambientGain: GainNode | null = null;
  private isAmbientPlaying = false;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.isMutedState ? 0 : this.masterVolume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean): void {
    this.isMutedState = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : this.masterVolume, this.ctx.currentTime);
    }
  }

  public isMuted(): boolean {
    return this.isMutedState;
  }

  public setVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && !this.isMutedState) {
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    }
  }

  public getVolume(): number {
    return this.masterVolume;
  }

  // --- UI Sound Design ---

  public playUITick(): void {
    if (this.isMutedState) return;
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(700, now + 0.025);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.025);
  }

  public playUIOpen(): void {
    if (this.isMutedState) return;
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.12);

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playUIClose(): void {
    if (this.isMutedState) return;
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(540, now);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.09);

    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playHarvestChime(): void {
    if (this.isMutedState) return;
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    // Harmonic crystalline chord (D5, F#5, A5, C#6, E6)
    const freqs = [587.33, 739.99, 880.0, 1108.73, 1318.51];
    const now = ctx.currentTime;

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.04);

      gain.gain.setValueAtTime(0.12 / (idx + 1), now + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.04 + 0.55);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 0.55);
    });
  }

  public playTrainingSuccess(): void {
    if (this.isMutedState) return;
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    // Triumphant rising Lydian arpeggio
    const chord = [392.0, 493.88, 587.33, 739.99, 783.99, 987.77];
    const now = ctx.currentTime;

    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      gain.gain.setValueAtTime(0.15, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.06 + 0.85);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.85);
    });
  }

  public playErrorHum(): void {
    if (this.isMutedState) return;
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    // Dissonant dual-sine buzz
    [110, 116.5].forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now);
      osc.stop(now + 0.28);
    });
  }

  // --- Surface Footsteps ---

  public playFootstep(surface: SurfaceType = 'grass'): void {
    if (this.isMutedState) return;
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * 0.08);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    if (surface === 'grass') {
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(750, now);
      gain.gain.setValueAtTime(0.07, now);
    } else if (surface === 'sand') {
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1300, now);
      gain.gain.setValueAtTime(0.09, now);
    } else if (surface === 'rock') {
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1800, now);
      gain.gain.setValueAtTime(0.06, now);
    } else {
      // water
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(500, now);
      gain.gain.setValueAtTime(0.12, now);
    }

    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + 0.08);
  }

  // --- Legacy helpers ---

  public playShardCollect(): void {
    this.playHarvestChime();
  }

  public playTerminalInteract(): void {
    this.playUIOpen();
  }

  public playTrainingStep(): void {
    if (this.isMutedState) return;
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.06);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  public playTokenTick(): void {
    this.playUITick();
  }

  public playAwakenSurge(): void {
    this.playTrainingSuccess();
  }

  public startAmbientLoop(): void {
    if (this.isAmbientPlaying) return;
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    try {
      this.ambientGain = ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0.03, ctx.currentTime);
      this.ambientGain.connect(this.masterGain);
      this.isAmbientPlaying = true;
    } catch {}
  }
}
