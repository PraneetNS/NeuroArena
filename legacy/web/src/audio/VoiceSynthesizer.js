/**
 * VoiceSynthesizer.js
 * Procedural formant-based vocal tract audio synthesis for AI agent speech,
 * coach narration, and dynamic match announcer cues.
 */

export const VOWEL_FORMANTS = {
  a: { f1: 800, f2: 1200, q1: 5, q2: 6 },
  e: { f1: 400, f2: 2200, q1: 6, q2: 8 },
  i: { f1: 280, f2: 2600, q1: 7, q2: 9 },
  o: { f1: 500, f2: 900,  q1: 5, q2: 5 },
  u: { f1: 320, f2: 800,  q1: 6, q2: 6 }
};

export const PHONEME_DICTIONARY = {
  "READY": [
    { vowel: 'e', duration: 0.14, pitch: 220 },
    { vowel: 'i', duration: 0.16, pitch: 200 }
  ],
  "CONVERGENCE": [
    { vowel: 'o', duration: 0.12, pitch: 200 },
    { vowel: 'e', duration: 0.15, pitch: 240 },
    { vowel: 'e', duration: 0.18, pitch: 280 }
  ],
  "OVERFITTING": [
    { vowel: 'o', duration: 0.14, pitch: 260 },
    { vowel: 'i', duration: 0.12, pitch: 220 },
    { vowel: 'i', duration: 0.18, pitch: 180 }
  ],
  "VICTORY": [
    { vowel: 'i', duration: 0.12, pitch: 240 },
    { vowel: 'o', duration: 0.15, pitch: 300 },
    { vowel: 'i', duration: 0.22, pitch: 360 }
  ]
};

export class VoiceSynthesizer {
  constructor(audioContext = null) {
    this.ctx = audioContext;
    this.isMuted = false;
    this.volume = 0.8;
  }

  setContext(ctx) {
    this.ctx = ctx;
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  synthesizePhoneme(vowelKey, duration = 0.15, pitch = 220, startTime = null) {
    if (!this.ctx || this.isMuted) return null;
    const formant = VOWEL_FORMANTS[vowelKey] || VOWEL_FORMANTS.a;
    const now = startTime !== null ? startTime : this.ctx.currentTime;

    // Carrier Glottal Pulse Generator (Sawtooth oscillator)
    const osc = this.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.92, now + duration);

    // Formant 1 Filter (Throat cavity)
    const f1Filter = this.ctx.createBiquadFilter();
    f1Filter.type = "bandpass";
    f1Filter.frequency.setValueAtTime(formant.f1, now);
    f1Filter.Q.setValueAtTime(formant.q1, now);

    // Formant 2 Filter (Mouth / Tongue cavity)
    const f2Filter = this.ctx.createBiquadFilter();
    f2Filter.type = "bandpass";
    f2Filter.frequency.setValueAtTime(formant.f2, now);
    f2Filter.Q.setValueAtTime(formant.q2, now);

    // Amplitude ADSR Envelope
    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(this.volume * 0.5, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    // Parallel formant filter summing
    osc.connect(f1Filter);
    osc.connect(f2Filter);
    f1Filter.connect(gainNode);
    f2Filter.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.05);

    return { osc, f1Filter, f2Filter, gainNode, endTime: now + duration };
  }

  speakCue(cueName) {
    if (!this.ctx || this.isMuted) return 0;
    const phonemes = PHONEME_DICTIONARY[cueName.toUpperCase()];
    if (!phonemes) return 0;

    let time = this.ctx.currentTime + 0.02;
    phonemes.forEach(p => {
      this.synthesizePhoneme(p.vowel, p.duration, p.pitch, time);
      time += p.duration + 0.04;
    });

    return time - this.ctx.currentTime;
  }
}
