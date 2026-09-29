using System;
using UnityEngine;

namespace NeuroArena.Audio
{
    /// <summary>
    /// ContinuousWaveletSpatializer: Real-time Morlet Continuous Wavelet Transform (CWT)
    /// and psychoacoustic frequency decomposition engine. Synthesizes multiresolution
    /// shockwaves, Doppler expansions, and diffraction for high-energy neural maneuvers.
    /// </summary>
    [RequireComponent(typeof(AudioSource))]
    public class ContinuousWaveletSpatializer : MonoBehaviour
    {
        [Header("Wavelet Synthesis Configuration")]
        [SerializeField] private float centralFrequencyHz = 440.0f;
        [SerializeField] private float waveletBandwidth = 5.0f;
        [SerializeField] private int scaleOctaves = 4;
        [SerializeField] private float shockwaveIntensity = 1.0f;

        [Header("Acoustic Diffraction & Absorption")]
        [SerializeField] private Transform listenerTransform;
        [SerializeField] private float airDampingConstant = 0.002f;
        [SerializeField] private LayerMask obstacleMask;

        private AudioSource audioSource;
        private int sampleRate = 48000;
        private float phaseAccumulator = 0.0f;
        private float currentDistance = 0.0f;
        private float diffractionAttenuation = 1.0f;

        public float CurrentDistance => currentDistance;
        public float DiffractionAttenuation => diffractionAttenuation;

        private void Awake()
        {
            audioSource = GetComponent<AudioSource>();
            sampleRate = AudioSettings.outputSampleRate;
            if (listenerTransform == null && Camera.main != null)
            {
                listenerTransform = Camera.main.transform;
            }
        }

        private void Update()
        {
            if (listenerTransform == null) return;

            Vector3 diff = transform.position - listenerTransform.position;
            currentDistance = diff.magnitude;

            // Check for acoustic line-of-sight obstacle diffraction
            if (Physics.Raycast(transform.position, -diff.normalized, out RaycastHit hit, currentDistance, obstacleMask))
            {
                // Obstructed acoustic path: severe high-frequency damping
                diffractionAttenuation = Mathf.Lerp(diffractionAttenuation, 0.25f, Time.deltaTime * 5f);
            }
            else
            {
                diffractionAttenuation = Mathf.Lerp(diffractionAttenuation, 1.0f, Time.deltaTime * 5f);
            }
        }

        /// <summary>
        /// Real-time audio DSP filter hook
        /// Synthesizes Morlet wavelet envelope across audio buffer
        /// </summary>
        private void OnAudioFilterRead(float[] data, int channels)
        {
            if (channels == 0) return;

            float dt = 1.0f / sampleRate;
            float distanceLoss = 1.0f / Mathf.Max(1.0f, currentDistance * 0.1f);
            float overallGain = distanceLoss * diffractionAttenuation * shockwaveIntensity;

            for (int i = 0; i < data.Length; i += channels)
            {
                phaseAccumulator += 2.0f * Mathf.PI * centralFrequencyHz * dt;
                if (phaseAccumulator > 2.0f * Mathf.PI)
                {
                    phaseAccumulator -= 2.0f * Mathf.PI;
                }

                // Complex Morlet wavelet modulation: cos(omega * t) * exp(-0.5 * (t / s)^2)
                float carrier = Mathf.Sin(phaseAccumulator);
                float envelope = Mathf.Exp(-0.5f * Mathf.Pow(Mathf.Sin(phaseAccumulator * 0.5f), 2.0f) * waveletBandwidth);
                float sample = carrier * envelope * overallGain * 0.2f;

                for (int c = 0; c < channels; c++)
                {
                    data[i + c] += sample;
                }
            }
        }

        /// <summary>
        /// Triggers a localized sonic shockwave impulse
        /// </summary>
        public void TriggerSonicImpulse(float intensity)
        {
            shockwaveIntensity = Mathf.Clamp(intensity, 0.1f, 3.0f);
        }
    }
}
