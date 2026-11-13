/**
 * Pure Web Audio API procedural sound engine with zero audio asset dependencies.
 * Generates:
 * - UI interaction sounds: micro-ticks, panel open/close, harvest chimes, training success, error hums
 * - Surface-adaptive footsteps: grass, sand, rock, water with speed-dependent cadence
 * - Dynamic procedural multi-biome ambience:
 *   - Meadow: gentle prairie wind with procedural birdsong chirps
 *   - Shoreline: rhythmic ocean surf wash and shoreline foam
 *   - Ridge / Billboard: gusting ridge wind and whistling breeze
 *   - Archive / Hollow: resonant harmonic shimmer and muffled cavern ambience
 * - Master, Ambience, and SFX volume channels with click-free mute control
 */

export type SurfaceType = 'grass' | 'sand' | 'rock' | 'water';

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMutedState = false;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;

  private masterVolume = 0.8;
  private sfxVolume = 0.85;
  private ambientVolume = 0.6;

  // Ambience generators
  private isAmbientPlaying = false;
  private windSource: AudioBufferSourceNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private waveGain: GainNode | null = null;
  private currentBiome = 'meadow_of_verse';
  private birdIntervalId: any = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();

        // 1. Master Channel
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.isMutedState ? 0 : this.masterVolume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        // 2. SFX Channel
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
        this.sfxGain.connect(this.masterGain);

        // 3. Ambience Channel
        this.ambientGain = this.ctx.createGain();
        this.ambientGain.gain.setValueAtTime(this.ambientVolume, this.ctx.currentTime);
        this.ambientGain.connect(this.masterGain);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // --- Volume & Mute Controls ---

  public setMuted(muted: boolean): void {
    this.isMutedState = muted;
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.linearRampToValueAtTime(muted ? 0.0001 : this.masterVolume, now + 0.04);
    }
  }

  public isMuted(): boolean {
    return this.isMutedState;
  }

  public setVolume(vol: number): void {
    this.setMasterVolume(vol);
  }

  public getVolume(): number {
    return this.masterVolume;
  }

  public setMasterVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && !this.isMutedState) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.linearRampToValueAtTime(this.masterVolume, now + 0.03);
    }
  }

  public setAmbienceVolume(vol: number): void {
    this.ambientVolume = Math.max(0, Math.min(1, vol));
    if (this.ambientGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.ambientGain.gain.cancelScheduledValues(now);
      this.ambientGain.gain.linearRampToValueAtTime(this.ambientVolume, now + 0.03);
    }
  }

  public getAmbienceVolume(): number {
    return this.ambientVolume;
  }

  public setSFXVolume(vol: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    if (this.sfxGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.sfxGain.gain.cancelScheduledValues(now);
      this.sfxGain.gain.linearRampToValueAtTime(this.sfxVolume, now + 0.03);
    }
  }

  public getSFXVolume(): number {
    return this.sfxVolume;
  }

  // --- UI Sound Design ---

  public playUITick(): void {
    if (this.isMutedState) return;
    const ctx = this.getContext();
    if (!ctx || !this.sfxGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(700, now + 0.025);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.025);
  }

  public playUIOpen(): void {
    if (this.isMutedState) return;
    const ctx = this.getContext();
    if (!ctx || !this.sfxGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.12);

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playUIClose(): void {
    if (this.isMutedState) return;
    const ctx = this.getContext();
    if (!ctx || !this.sfxGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(540, now);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.09);

    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playHarvestChime(): void {
    if (this.isMutedState) return;
    const ctx = this.getContext();
    if (!ctx || !this.sfxGain) return;

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
      gain.connect(this.sfxGain!);

      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 0.55);
    });
  }

  public playTrainingSuccess(): void {
    if (this.isMutedState) return;
    const ctx = this.getContext();
    if (!ctx || !this.sfxGain) return;

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
      gain.connect(this.sfxGain!);

      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.85);
    });
  }

  public playErrorHum(): void {
    if (this.isMutedState) return;
    const ctx = this.getContext();
    if (!ctx || !this.sfxGain) return;

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
      gain.connect(this.sfxGain!);

      osc.start(now);
      osc.stop(now + 0.28);
    });
  }

  // --- Surface Footsteps ---

  public playFootstep(surface: SurfaceType = 'grass'): void {
    if (this.isMutedState) return;
    const ctx = this.getContext();
    if (!ctx || !this.sfxGain) return;

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
    gain.connect(this.sfxGain);

    noise.start(now);
    noise.stop(now + 0.08);
  }

  // --- Dynamic Procedural Ambience & Biome Landscapes ---

  public startAmbientLoop(): void {
    if (this.isAmbientPlaying) return;
    const ctx = this.getContext();
    if (!ctx || !this.ambientGain) return;

    try {
      // 1. Continuous Brownian/Pink Noise Wind
      const sampleRate = ctx.sampleRate;
      const bufferLength = sampleRate * 5; // 5-second seamless buffer
      const noiseBuffer = ctx.createBuffer(1, bufferLength, sampleRate);
      const data = noiseBuffer.getChannelData(0);

      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferLength; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        data[i] = (b0 + b1 + b2) * 0.15;
      }

      this.windSource = ctx.createBufferSource();
      this.windSource.buffer = noiseBuffer;
      this.windSource.loop = true;

      // Lowpass wind filter
      this.windFilter = ctx.createBiquadFilter();
      this.windFilter.type = 'lowpass';
      this.windFilter.frequency.setValueAtTime(280, ctx.currentTime);
      this.windFilter.Q.setValueAtTime(1.2, ctx.currentTime);

      // Low-frequency oscillator for wind gusts
      const windLFO = ctx.createOscillator();
      windLFO.type = 'sine';
      windLFO.frequency.setValueAtTime(0.12, ctx.currentTime); // ~8s gust cycle

      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(140, ctx.currentTime);
      windLFO.connect(lfoGain);
      lfoGain.connect(this.windFilter.frequency);

      const windGain = ctx.createGain();
      windGain.gain.setValueAtTime(0.045, ctx.currentTime);

      this.windSource.connect(this.windFilter);
      this.windFilter.connect(windGain);
      windGain.connect(this.ambientGain);

      this.windSource.start();
      windLFO.start();

      // 2. Shoreline Wave Surf Generator (filtered resonant surf wash)
      const waveFilter = ctx.createBiquadFilter();
      waveFilter.type = 'bandpass';
      waveFilter.frequency.setValueAtTime(320, ctx.currentTime);
      waveFilter.Q.setValueAtTime(2.2, ctx.currentTime);

      this.waveGain = ctx.createGain();
      this.waveGain.gain.setValueAtTime(0.02, ctx.currentTime);

      const waveLFO = ctx.createOscillator();
      waveLFO.type = 'sine';
      waveLFO.frequency.setValueAtTime(0.22, ctx.currentTime); // ~4.5s surf cycle

      const waveLFOGain = ctx.createGain();
      waveLFOGain.gain.setValueAtTime(0.035, ctx.currentTime);
      waveLFO.connect(waveLFOGain);
      waveLFOGain.connect(this.waveGain.gain);

      this.windSource.connect(waveFilter);
      waveFilter.connect(this.waveGain);
      this.waveGain.connect(this.ambientGain);

      waveLFO.start();

      // 3. Periodic Wildlife Sweeps (birdsong / crickets)
      this.scheduleWildlifeChirps();

      this.isAmbientPlaying = true;
    } catch (e) {
      console.warn('[SoundEngine] Could not start ambient loop:', e);
    }
  }

  private scheduleWildlifeChirps(): void {
    if (this.birdIntervalId) clearInterval(this.birdIntervalId);

    this.birdIntervalId = setInterval(() => {
      if (this.isMutedState || !this.isAmbientPlaying) return;
      if (this.currentBiome !== 'meadow_of_verse' && this.currentBiome !== 'weathered_archive') return;

      const ctx = this.getContext();
      if (!ctx || !this.ambientGain) return;

      // Soft randomized melodic bird chirp
      const now = ctx.currentTime;
      const baseFreq = 2600 + Math.random() * 800;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.35, now + 0.05);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.9, now + 0.11);

      gain.gain.setValueAtTime(0.015, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.ambientGain);

      osc.start(now);
      osc.stop(now + 0.12);
    }, 6500 + Math.random() * 4000);
  }

  public setBiome(biomeId: string): void {
    this.currentBiome = biomeId;
    const ctx = this.getContext();
    if (!ctx || !this.windFilter || !this.waveGain) return;

    const now = ctx.currentTime;
    if (biomeId === 'foreign_shore') {
      this.windFilter.frequency.linearRampToValueAtTime(320, now + 1.5);
      this.waveGain.gain.linearRampToValueAtTime(0.065, now + 1.5);
    } else if (biomeId === 'meadow_of_verse') {
      this.windFilter.frequency.linearRampToValueAtTime(260, now + 1.5);
      this.waveGain.gain.linearRampToValueAtTime(0.01, now + 1.5);
    } else if (biomeId === 'billboard_flats') {
      this.windFilter.frequency.linearRampToValueAtTime(460, now + 1.5);
      this.waveGain.gain.linearRampToValueAtTime(0.0, now + 1.5);
    } else if (biomeId === 'echo_hollow') {
      this.windFilter.frequency.linearRampToValueAtTime(190, now + 1.5);
      this.waveGain.gain.linearRampToValueAtTime(0.0, now + 1.5);
    } else {
      // weathered_archive
      this.windFilter.frequency.linearRampToValueAtTime(210, now + 1.5);
      this.waveGain.gain.linearRampToValueAtTime(0.0, now + 1.5);
    }
  }

  // --- Legacy and convenience aliases ---

  public playShardCollect(): void {
    this.playHarvestChime();
  }

  public playTerminalInteract(): void {
    this.playUIOpen();
  }

  public playCompanionAwaken(): void {
    this.playTrainingSuccess();
  }

  public playTrainingStep(): void {
    if (this.isMutedState) return;
    const ctx = this.getContext();
    if (!ctx || !this.sfxGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.06);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  public playTokenTick(): void {
    this.playUITick();
  }

  public playAwakenSurge(): void {
    this.playTrainingSuccess();
  }
}
