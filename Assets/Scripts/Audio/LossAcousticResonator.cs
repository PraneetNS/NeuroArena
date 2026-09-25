using System;
using UnityEngine;

namespace NeuroArena.Audio
{
    /// <summary>
    /// Real-time audio sonifier that transforms neural loss curves and gradient variance
    /// into dynamic acoustic resonance, harmonic overtone spectra, and dissonance modulations.
    /// High loss -> dissonant tritones and turbulent noise bursts.
    /// Converged loss -> pure crystalline harmonic chords and resonant shimmer.
    /// </summary>
    [RequireComponent(typeof(AudioSource))]
    public class LossAcousticResonator : MonoBehaviour
    {
        [Header("Sonification Parameters")]
        [Range(20f, 2000f)] [SerializeField] private float fundamentalFrequency = 110f; // A2
        [Range(0f, 1f)] [SerializeField] private float sonificationGain = 0.3f;
        [SerializeField] private bool autoSonifyGlobalLoss = true;

        private AudioSource audioSource;
        private int sampleRate = 44100;
        private double phaseFundamental = 0;
        private double phaseHarmonic2 = 0;
        private double phaseHarmonic3 = 0;
        private double phaseDissonant = 0;

        private float targetLoss = 1.0f;
        private float smoothedLoss = 1.0f;
        private float gradientVariance = 0.1f;
        private float smoothedVariance = 0.1f;

        private void Awake()
        {
            audioSource = GetComponent<AudioSource>();
            audioSource.playOnAwake = true;
            audioSource.loop = true;
            sampleRate = AudioSettings.outputSampleRate;
        }

        private void Start()
        {
            if (!audioSource.isPlaying)
            {
                audioSource.Play();
            }
        }

        /// <summary>
        /// Updates the acoustic resonator with live loss and gradient variance metrics.
        /// </summary>
        /// <param name="currentLoss">Empirical loss (MSE / Cross-Entropy).</param>
        /// <param name="gradVar">Variance of stochastic gradient components.</param>
        public void FeedTrainingMetrics(float currentLoss, float gradVar = 0.05f)
        {
            targetLoss = Mathf.Max(0.0001f, currentLoss);
            gradientVariance = Mathf.Clamp(gradVar, 0f, 2f);
        }

        private void Update()
        {
            smoothedLoss = Mathf.Lerp(smoothedLoss, targetLoss, Time.deltaTime * 3.5f);
            smoothedVariance = Mathf.Lerp(smoothedVariance, gradientVariance, Time.deltaTime * 4.0f);
        }

        private void OnAudioFilterRead(float[] data, int channels)
        {
            float lossNormalized = Mathf.Clamp01(smoothedLoss);
            // Dissonance factor: 0 when loss is near zero, 1 when loss is high
            float dissonance = Mathf.Pow(lossNormalized, 0.75f);
            // Harmonic purity: increases as loss converges
            float purity = 1.0f - dissonance;

            double f0 = fundamentalFrequency * (1.0f + 0.15f * Mathf.Sin((float)phaseFundamental * 0.01f));
            double f2 = f0 * 2.0; // Octave
            double f3 = f0 * 3.0; // Perfect fifth
            // Dissonant microtonal overtone (tritone + detune)
            double fDiss = f0 * (1.4142 + 0.12 * dissonance);

            double dt = 1.0 / sampleRate;

            for (int i = 0; i < data.Length; i += channels)
            {
                phaseFundamental += 2.0 * Math.PI * f0 * dt;
                phaseHarmonic2 += 2.0 * Math.PI * f2 * dt;
                phaseHarmonic3 += 2.0 * Math.PI * f3 * dt;
                phaseDissonant += 2.0 * Math.PI * fDiss * dt;

                if (phaseFundamental > 2.0 * Math.PI) phaseFundamental -= 2.0 * Math.PI;
                if (phaseHarmonic2 > 2.0 * Math.PI) phaseHarmonic2 -= 2.0 * Math.PI;
                if (phaseHarmonic3 > 2.0 * Math.PI) phaseHarmonic3 -= 2.0 * Math.PI;
                if (phaseDissonant > 2.0 * Math.PI) phaseDissonant -= 2.0 * Math.PI;

                // Harmonic synthesis
                float s0 = (float)Math.Sin(phaseFundamental);
                float s2 = (float)Math.Sin(phaseHarmonic2) * 0.5f;
                float s3 = (float)Math.Sin(phaseHarmonic3) * 0.25f;
                float harmonicChord = (s0 + s2 + s3) * purity;

                // Dissonant component
                float sDiss = (float)Math.Sin(phaseDissonant) * dissonance * 0.6f;

                // Stochastic turbulence based on gradient variance
                float noise = (UnityEngine.Random.value * 2f - 1f) * smoothedVariance * 0.15f;

                float sample = (harmonicChord + sDiss + noise) * sonificationGain;

                for (int c = 0; c < channels; c++)
                {
                    data[i + c] += sample;
                }
            }
        }
    }
}
