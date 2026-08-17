using System;
using UnityEngine;

namespace NeuroArena.Audio
{
    /// <summary>
    /// Stage 21 Zero-External-Asset Procedural Ambient Audio Synthesizer.
    /// Synthesizes biome-specific atmospheric layers via direct mathematical oscillator synthesis and noise filtering,
    /// with smooth real-time crossfading between biomes.
    /// </summary>
    [RequireComponent(typeof(AudioSource))]
    public class BiomeAmbientSynthesizer : MonoBehaviour
    {
        public static BiomeAmbientSynthesizer Instance { get; private set; }

        [Header("Biome State")]
        [Range(0, 5)]
        [SerializeField] private int activeBiomeIndex = 0;
        [SerializeField] private float crossfadeDuration = 2.0f;
        [SerializeField] private float masterVolume = 0.25f;

        private AudioSource audioSource;
        private int sampleRate = 44100;
        private double phase0, phase1, phase2, lfoPhase;
        private float noiseFilterState = 0f;
        private float currentBiomeWeight = 1f;
        private float previousBiomeWeight = 0f;
        private int previousBiomeIndex = 0;
        private bool isCrossfading = false;
        private float crossfadeTimer = 0f;

        // Chime synthesizer state (Tundra)
        private double chimePhase = 0;
        private float chimeEnvelope = 0f;
        private float chimeFreq = 1760f;
        private float chimeIntervalTimer = 0f;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);

            audioSource = GetComponent<AudioSource>();
            audioSource.playOnAwake = true;
            audioSource.loop = true;
            audioSource.spatialBlend = 0f; // 2D ambient
            sampleRate = AudioSettings.outputSampleRate;
        }

        private void Start()
        {
            if (!audioSource.isPlaying)
            {
                audioSource.Play();
            }
        }

        private void Update()
        {
            if (isCrossfading)
            {
                crossfadeTimer += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(crossfadeTimer / crossfadeDuration);
                currentBiomeWeight = t;
                previousBiomeWeight = 1f - t;

                if (t >= 1f)
                {
                    isCrossfading = false;
                    previousBiomeWeight = 0f;
                }
            }

            // Chime triggers for Tundra
            if (activeBiomeIndex == 2 || previousBiomeIndex == 2)
            {
                chimeIntervalTimer += Time.unscaledDeltaTime;
                if (chimeIntervalTimer > 2.8f)
                {
                    chimeIntervalTimer = 0f;
                    TriggerCrystallineChime();
                }
            }
        }

        public void CrossfadeToBiome(int newBiomeIndex, float duration = 2.0f)
        {
            if (newBiomeIndex == activeBiomeIndex && !isCrossfading) return;

            previousBiomeIndex = activeBiomeIndex;
            activeBiomeIndex = Mathf.Clamp(newBiomeIndex, 0, 5);
            crossfadeDuration = Mathf.Max(0.1f, duration);
            crossfadeTimer = 0f;
            isCrossfading = true;
        }

        public void SetMasterVolume(float vol)
        {
            masterVolume = Mathf.Clamp01(vol);
        }

        private void TriggerCrystallineChime()
        {
            float[] pentatonic = new float[] { 1760.0f, 2093.0f, 2637.0f, 3135.9f };
            chimeFreq = pentatonic[UnityEngine.Random.Range(0, pentatonic.Length)];
            chimeEnvelope = 0.08f;
        }

        private void OnAudioFilterRead(float[] data, int channels)
        {
            double dt = 1.0 / sampleRate;

            for (int i = 0; i < data.Length; i += channels)
            {
                // Advance LFO
                lfoPhase += dt * 0.15;
                if (lfoPhase > 1.0) lfoPhase -= 1.0;
                float lfoVal = Mathf.Sin((float)(lfoPhase * Math.PI * 2));

                float sample = 0f;

                if (isCrossfading)
                {
                    float sOld = SynthesizeBiomeSample(previousBiomeIndex, dt, lfoVal);
                    float sNew = SynthesizeBiomeSample(activeBiomeIndex, dt, lfoVal);
                    sample = sOld * previousBiomeWeight + sNew * currentBiomeWeight;
                }
                else
                {
                    sample = SynthesizeBiomeSample(activeBiomeIndex, dt, lfoVal);
                }

                // Add chime if active
                if (chimeEnvelope > 0.0001f)
                {
                    chimePhase += dt * chimeFreq;
                    if (chimePhase > 1.0) chimePhase -= 1.0;
                    sample += Mathf.Sin((float)(chimePhase * Math.PI * 2)) * chimeEnvelope * currentBiomeWeight;
                    chimeEnvelope *= 0.9997f; // Exponential decay
                }

                sample *= masterVolume;

                for (int c = 0; c < channels; c++)
                {
                    data[i + c] = sample;
                }
            }
        }

        private float SynthesizeBiomeSample(int biome, double dt, float lfo)
        {
            switch (biome)
            {
                case 0: // Steppes: low sine drones (55 + 110 Hz) + filtered wind noise
                    phase0 += dt * (55.0 + lfo * 1.5);
                    phase1 += dt * (110.0 + lfo * 2.0);
                    if (phase0 > 1.0) phase0 -= 1.0;
                    if (phase1 > 1.0) phase1 -= 1.0;

                    float whiteNoise = (UnityEngine.Random.value * 2f - 1f) * 0.035f;
                    noiseFilterState += (whiteNoise - noiseFilterState) * 0.05f; // Lowpass filter

                    return (Mathf.Sin((float)(phase0 * Math.PI * 2)) * 0.08f +
                            Mathf.Sin((float)(phase1 * Math.PI * 2)) * 0.04f +
                            noiseFilterState);

                case 1: // Binary Marshlands: Sub-bass triangle + resonant bubbling
                    phase0 += dt * 65.4;
                    if (phase0 > 1.0) phase0 -= 1.0;
                    float tri = (float)(2.0 * Math.Abs(2.0 * (phase0 - Math.Floor(phase0 + 0.5))) - 1.0) * 0.09f;
                    return tri;

                case 2: // Variance Tundra: Filtered cold wind gusts
                    float tundraNoise = (UnityEngine.Random.value * 2f - 1f) * 0.06f;
                    noiseFilterState += (tundraNoise - noiseFilterState) * 0.08f;
                    return noiseFilterState;

                case 3: // Branching Canopy: Warm harmonic triangle drones
                    phase0 += dt * 82.4;
                    phase1 += dt * 164.8;
                    if (phase0 > 1.0) phase0 -= 1.0;
                    if (phase1 > 1.0) phase1 -= 1.0;
                    return (Mathf.Sin((float)(phase0 * Math.PI * 2)) * 0.06f +
                            Mathf.Sin((float)(phase1 * Math.PI * 2)) * 0.03f);

                case 4: // Deep Synapse Citadel: Detuned saw chord pad (C minor)
                    phase0 += dt * 130.81;
                    phase1 += dt * 155.56;
                    phase2 += dt * 196.00;
                    if (phase0 > 1.0) phase0 -= 1.0;
                    if (phase1 > 1.0) phase1 -= 1.0;
                    if (phase2 > 1.0) phase2 -= 1.0;
                    float saw0 = (float)(2.0 * (phase0 - Math.Floor(phase0 + 0.5))) * 0.03f;
                    float saw1 = (float)(2.0 * (phase1 - Math.Floor(phase1 + 0.5))) * 0.03f;
                    float saw2 = (float)(2.0 * (phase2 - Math.Floor(phase2 + 0.5))) * 0.03f;
                    return saw0 + saw1 + saw2;

                case 5: // Semantic Expanse: Cosmic space drone with detuned overtone resonance
                default:
                    phase0 += dt * 65.41;
                    phase1 += dt * 130.81;
                    phase2 += dt * 196.00;
                    if (phase0 > 1.0) phase0 -= 1.0;
                    if (phase1 > 1.0) phase1 -= 1.0;
                    if (phase2 > 1.0) phase2 -= 1.0;
                    return (Mathf.Sin((float)(phase0 * Math.PI * 2)) * 0.06f +
                            Mathf.Sin((float)(phase1 * Math.PI * 2)) * 0.035f +
                            Mathf.Sin((float)(phase2 * Math.PI * 2)) * 0.02f);
            }
        }
    }
}
