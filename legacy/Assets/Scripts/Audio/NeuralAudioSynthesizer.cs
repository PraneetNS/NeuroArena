using System;
using UnityEngine;

namespace NeuroArena.Audio
{
    /// <summary>
    /// Procedural audio sonification engine for neural network gradient descent,
    /// loss spikes, learning rate resonance, and boss hyperparameter phase changes.
    /// </summary>
    [RequireComponent(typeof(AudioSource))]
    public class NeuralAudioSynthesizer : MonoBehaviour
    {
        [Header("Synthesizer Parameters")]
        [Range(40f, 2000f)] public float BaseFrequency = 220f;
        [Range(0f, 1f)] public float MasterVolume = 0.25f;
        public bool SonificationEnabled = true;

        private float _phase;
        private float _targetFrequency = 220f;
        private float _currentLoss = 1.0f;
        private float _gradientVelocity = 0.0f;
        private float _sampleRate;

        private void Awake()
        {
            _sampleRate = AudioSettings.outputSampleRate;
        }

        public void UpdateTelemetry(float loss, float gradientNorm, float learningRate)
        {
            _currentLoss = Mathf.Max(0.001f, loss);
            _gradientVelocity = gradientNorm;

            // Map lower loss to higher harmonic frequencies (crystal chime effect upon convergence)
            float freqMultiplier = 1.0f + Mathf.Clamp01(1.0f / _currentLoss) * 2.5f;
            _targetFrequency = Mathf.Clamp(BaseFrequency * freqMultiplier, 60f, 1800f);
        }

        private void OnAudioFilterRead(float[] data, int channels)
        {
            if (!SonificationEnabled || MasterVolume <= 0f) return;

            float freqStep = (_targetFrequency * 2f * Mathf.PI) / _sampleRate;
            float pulseMod = 1.0f + Mathf.Sin(_phase * 0.1f) * 0.15f;

            for (int i = 0; i < data.Length; i += channels)
            {
                _phase += freqStep;
                if (_phase > Mathf.PI * 2f) _phase -= Mathf.PI * 2f;

                // FM synthesis combined with harmonic sine
                float sample = Mathf.Sin(_phase) * 0.6f + Mathf.Sin(_phase * 2f) * 0.3f + Mathf.Sin(_phase * 3f) * 0.1f;
                sample *= MasterVolume * pulseMod;

                for (int c = 0; c < channels; c++)
                {
                    data[i + c] = sample;
                }
            }
        }
    }
}
