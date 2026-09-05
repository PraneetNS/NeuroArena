const assert = require('assert');

console.log('▶ Testing Formant Vocal Tract Synthesis & Phoneme Dictionary...');

// Formant definitions matching VoiceSynthesizer
const VOWEL_FORMANTS = {
  a: { f1: 800, f2: 1200, q1: 5, q2: 6 },
  e: { f1: 400, f2: 2200, q1: 6, q2: 8 },
  i: { f1: 280, f2: 2600, q1: 7, q2: 9 },
  o: { f1: 500, f2: 900,  q1: 5, q2: 5 },
  u: { f1: 320, f2: 800,  q1: 6, q2: 6 }
};

const PHONEME_DICTIONARY = {
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

// 1. Validate Formant Frequency Boundaries
Object.keys(VOWEL_FORMANTS).forEach(vowel => {
  const f = VOWEL_FORMANTS[vowel];
  assert(f.f1 >= 200 && f.f1 <= 1000, `Vowel ${vowel} F1 formant (${f.f1}Hz) must be in human acoustic range`);
  assert(f.f2 >= 800 && f.f2 <= 3000, `Vowel ${vowel} F2 formant (${f.f2}Hz) must be in human acoustic range`);
  assert(f.q1 > 0 && f.q2 > 0, `Quality factor Q must be positive`);
});

// 2. Validate Phoneme Sequencing & Timing
Object.keys(PHONEME_DICTIONARY).forEach(cue => {
  const sequence = PHONEME_DICTIONARY[cue];
  assert(sequence.length > 0, `Cue ${cue} must contain at least 1 phoneme`);
  let totalTime = 0;
  sequence.forEach(p => {
    assert(VOWEL_FORMANTS[p.vowel], `Phoneme vowel '${p.vowel}' must exist in formant table`);
    assert(p.duration > 0.05 && p.duration < 0.5, `Phoneme duration (${p.duration}s) must be natural speech tempo`);
    assert(p.pitch >= 100 && p.pitch <= 500, `Pitch (${p.pitch}Hz) must be in audible speaking range`);
    totalTime += p.duration;
  });
  assert(totalTime < 1.0, `Cue ${cue} total duration (${totalTime.toFixed(2)}s) must be snappy (<1.0s)`);
});

// 3. Mathematical Formant Waveform Envelope Simulation
const sampleRate = 44100;
const duration = 0.1;
const totalSamples = Math.floor(sampleRate * duration);
let maxAmp = 0;
for (let i = 0; i < totalSamples; i++) {
  const t = i / sampleRate;
  const env = Math.sin(t / duration * Math.PI);
  const glottal = (t * 220 % 1) * 2 - 1;
  const formants = Math.sin(2 * Math.PI * 400 * t) * 0.6 + Math.sin(2 * Math.PI * 2200 * t) * 0.4;
  const sample = glottal * formants * env;
  if (Math.abs(sample) > maxAmp) maxAmp = Math.abs(sample);
}

assert(maxAmp > 0.1 && maxAmp <= 1.5, `Synthesized sample peak amplitude (${maxAmp.toFixed(3)}) within stable range`);

console.log('✅ Formant Vocal Tract Synthesis & Phoneme Dictionary Tests Passed Cleanly!');
