/**
 * Spatial 3D Positional Audio DSP Manager for NeuroArena.
 * Implements Web Audio API HRTF / PannerNode 3D spatialization, distance attenuation models,
 * obstruction / occlusion lowpass filters, and synthetic impulse response reverb.
 */
export class SpatialAudioDSP {
  constructor() {
    this.ctx = null;
    this.listener = null;
    this.reverbNode = null;
    this.reverbGain = null;
    this.sources = new Map(); // id -> { panner, gain, filter, lastPos, lastTime, velocity }
    this.speedOfSound = 343.3; // m/s
  }

  /**
   * Initialize audio context and listener orientation
   */
  init(sharedCtx = null) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = sharedCtx || (AudioContext ? new AudioContext() : null);
    if (!this.ctx) return;

    this.listener = this.ctx.listener;
    this.setupReverb();
  }

  /**
   * Generates a synthetic procedural impulse response for arena convolution reverb
   */
  setupReverb() {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * 1.5; // 1.5s decay
    const impulse = this.ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const decay = Math.exp(-i / (sampleRate * 0.4));
      left[i] = (Math.random() * 2 - 1) * decay;
      right[i] = (Math.random() * 2 - 1) * decay;
    }

    this.reverbNode = this.ctx.createConvolver();
    this.reverbNode.buffer = impulse;

    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    this.reverbNode.connect(this.reverbGain);
    this.reverbGain.connect(this.ctx.destination);
  }

  /**
   * Updates camera / player listener position and orientation in 3D
   */
  updateListener(posX, posY, posZ, forwardX = 0, forwardY = 0, forwardZ = -1, upX = 0, upY = 1, upZ = 0) {
    if (!this.ctx || !this.listener) return;
    const now = this.ctx.currentTime;

    if (this.listener.positionX) {
      this.listener.positionX.setTargetAtTime(posX, now, 0.05);
      this.listener.positionY.setTargetAtTime(posY, now, 0.05);
      this.listener.positionZ.setTargetAtTime(posZ, now, 0.05);
      this.listener.forwardX.setTargetAtTime(forwardX, now, 0.05);
      this.listener.forwardY.setTargetAtTime(forwardY, now, 0.05);
      this.listener.forwardZ.setTargetAtTime(forwardZ, now, 0.05);
      this.listener.upX.setTargetAtTime(upX, now, 0.05);
      this.listener.upY.setTargetAtTime(upY, now, 0.05);
      this.listener.upZ.setTargetAtTime(upZ, now, 0.05);
    } else if (this.listener.setPosition) {
      this.listener.setPosition(posX, posY, posZ);
      this.listener.setOrientation(forwardX, forwardY, forwardZ, upX, upY, upZ);
    }
  }

  /**
   * Registers a 3D audio emitter
   */
  createEmitter(id, options = {}) {
    if (!this.ctx) return null;

    const panner = this.ctx.createPanner();
    panner.panningModel = options.panningModel || 'HRTF';
    panner.distanceModel = options.distanceModel || 'inverse';
    panner.refDistance = options.refDistance || 1.0;
    panner.maxDistance = options.maxDistance || 100.0;
    panner.rolloffFactor = options.rolloffFactor || 1.2;
    panner.coneInnerAngle = options.coneInnerAngle || 360;
    panner.coneOuterAngle = options.coneOuterAngle || 360;
    panner.coneOuterGain = options.coneOuterGain || 0;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(20000, this.ctx.currentTime); // Open filter by default

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(options.volume ?? 1.0, this.ctx.currentTime);

    // Chain: Input -> Filter -> Panner -> Gain -> Master + Reverb
    filter.connect(panner);
    panner.connect(gain);
    gain.connect(this.ctx.destination);
    if (this.reverbNode) {
      gain.connect(this.reverbNode);
    }

    const emitter = {
      id,
      panner,
      filter,
      gain,
      lastPos: { x: 0, y: 0, z: 0 },
      lastTime: this.ctx.currentTime,
      velocity: { x: 0, y: 0, z: 0 }
    };

    this.sources.set(id, emitter);
    return emitter;
  }

  /**
   * Updates emitter position and computes occlusion / doppler
   */
  updateEmitter(id, x, y, z, isOccluded = false) {
    const emitter = this.sources.get(id);
    if (!emitter || !this.ctx) return;

    const now = this.ctx.currentTime;
    const dt = Math.max(0.001, now - emitter.lastTime);

    // Compute velocity for doppler
    emitter.velocity.x = (x - emitter.lastPos.x) / dt;
    emitter.velocity.y = (y - emitter.lastPos.y) / dt;
    emitter.velocity.z = (z - emitter.lastPos.z) / dt;
    emitter.lastPos = { x, y, z };
    emitter.lastTime = now;

    if (emitter.panner.positionX) {
      emitter.panner.positionX.setTargetAtTime(x, now, 0.04);
      emitter.panner.positionY.setTargetAtTime(y, now, 0.04);
      emitter.panner.positionZ.setTargetAtTime(z, now, 0.04);
    } else if (emitter.panner.setPosition) {
      emitter.panner.setPosition(x, y, z);
    }

    // Dynamic low-pass wall occlusion filter (muffles sound through obstacles)
    const targetFreq = isOccluded ? 800 : 20000;
    emitter.filter.frequency.setTargetAtTime(targetFreq, now, 0.1);
  }

  /**
   * Plays a 3D localized sound burst (e.g. projectile impact, energy discharge)
   */
  playSpatialBurst(x, y, z, freq = 600, duration = 0.25, isOccluded = false) {
    if (!this.ctx) return;
    const tempId = 'burst_' + Math.random().toString(36).substr(2, 9);
    const emitter = this.createEmitter(tempId, { refDistance: 2.0, rolloffFactor: 1.5 });
    if (!emitter) return;

    this.updateEmitter(tempId, x, y, z, isOccluded);

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.2), this.ctx.currentTime + duration);

    osc.connect(emitter.filter);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);

    setTimeout(() => {
      this.sources.delete(tempId);
    }, (duration + 0.5) * 1000);
  }
}
