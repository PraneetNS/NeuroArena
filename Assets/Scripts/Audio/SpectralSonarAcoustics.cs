using System;
using UnityEngine;

namespace NeuroArena.Audio
{
    /// <summary>
    /// Spectral Sonar Acoustics & Doppler Radar DSP in Unity C#.
    /// Synthesizes procedural ultrasonic FM chirps and echoes with realistic Doppler pitch shifts
    /// and atmospheric absorption, providing acoustic echolocation telemetry when navigating
    /// zero-visibility biomes (e.g. Gradient Fog or Cryo Chasms).
    /// </summary>
    [RequireComponent(typeof(AudioSource))]
    public class SpectralSonarAcoustics : MonoBehaviour
    {
        [Header("Sonar Chirp Characteristics")]
        [SerializeField] private float baseFrequencyHz = 880f; // A5 sonar carrier
        [SerializeField] private float sweepBandwidthHz = 440f; // Linear FM chirp sweep
        [SerializeField] private float chirpDurationSeconds = 0.08f; // 80ms pulse
        [SerializeField] private float pingIntervalSeconds = 1.2f;

        [Header("Acoustic Medium")]
        [Tooltip("Speed of sound in virtual atmosphere (m/s)")]
        [SerializeField] private float speedOfSound = 343.0f;
        [Tooltip("Atmospheric absorption coefficient (dB/meter)")]
        [SerializeField] private float absorptionDbPerMeter = 0.08f;
        [SerializeField] private float maxSonarRange = 60.0f;
        [SerializeField] private LayerMask reflectiveSurfacesMask;

        // Echo tracking
        private float _lastPingTime = -999f;
        private float _detectedEchoDistance = -1f;
        private float _detectedRelativeVelocity = 0f;
        private float _dopplerRatio = 1.0f;

        // Audio DSP buffer state
        private int _sampleRate = 48000;
        private float _chirpPhase = 0f;
        private bool _isEmittingChirp = false;
        private float _chirpProgress = 0f;

        // Echo playback
        private bool _isEchoActive = false;
        private float _echoDelayCountdown = 0f;
        private float _echoAmplitude = 0f;
        private float _echoPhase = 0f;
        private float _echoProgress = 0f;

        public float DetectedEchoDistance => _detectedEchoDistance;
        public float DopplerRatio => _dopplerRatio;
        public bool IsTargetApproaching => _detectedRelativeVelocity > 0.1f;

        private void Awake()
        {
            _sampleRate = AudioSettings.outputSampleRate;
            if (_sampleRate <= 0) _sampleRate = 48000;

            AudioSource src = GetComponent<AudioSource>();
            src.playOnAwake = true;
            src.loop = true;
            src.spatialBlend = 1.0f; // 3D spatialized
            if (!src.isPlaying) src.Play();
        }

        private void Update()
        {
            if (Time.time - _lastPingTime >= pingIntervalSeconds)
            {
                TriggerActivePing();
            }

            if (_isEchoActive && _echoDelayCountdown > 0f)
            {
                _echoDelayCountdown -= Time.deltaTime;
            }
        }

        /// <summary>
        /// Fires an acoustic sonar sweep forward and casts a ray to detect reflecting obstacle boundaries.
        /// </summary>
        public void TriggerActivePing()
        {
            _lastPingTime = Time.time;
            _isEmittingChirp = true;
            _chirpProgress = 0f;
            _chirpPhase = 0f;

            // Physics Raycast for echo distance and relative velocity
            Vector3 forward = transform.forward;
            if (Physics.Raycast(transform.position, forward, out RaycastHit hit, maxSonarRange, reflectiveSurfacesMask))
            {
                _detectedEchoDistance = hit.distance;

                // Estimate relative radial velocity
                Rigidbody targetRb = hit.collider.attachedRigidbody;
                Vector3 targetVel = targetRb != null ? targetRb.velocity : Vector3.zero;
                Rigidbody myRb = GetComponent<Rigidbody>();
                Vector3 myVel = myRb != null ? myRb.velocity : Vector3.zero;

                Vector3 relVel = myVel - targetVel;
                _detectedRelativeVelocity = Vector3.Dot(relVel, forward);

                // Doppler shift equation: f' = f * (c + v_r) / (c + v_s)
                float c = speedOfSound;
                _dopplerRatio = Mathf.Clamp((c + _detectedRelativeVelocity) / c, 0.5f, 2.0f);

                // Two-way roundtrip time
                float roundTripTime = (2.0f * _detectedEchoDistance) / speedOfSound;
                _echoDelayCountdown = roundTripTime;

                // Atmospheric absorption: Amplitude = 10^(-(alpha * d) / 20)
                float totalDistance = 2.0f * _detectedEchoDistance;
                float attenuationDb = absorptionDbPerMeter * totalDistance;
                _echoAmplitude = Mathf.Pow(10f, -attenuationDb / 20f) * 0.7f;

                _isEchoActive = true;
                _echoProgress = 0f;
                _echoPhase = 0f;
            }
            else
            {
                _detectedEchoDistance = -1f;
                _isEchoActive = false;
            }
        }

        /// <summary>
        /// Real-time audio DSP filter synthesizing ultrasonic FM chirp and Doppler-shifted echo.
        /// </summary>
        private void OnAudioFilterRead(float[] data, int channels)
        {
            float dtSample = 1.0f / _sampleRate;

            for (int i = 0; i < data.Length; i += channels)
            {
                float sample = 0f;

                // 1. Direct Ping Chirp
                if (_isEmittingChirp)
                {
                    float t = _chirpProgress;
                    float instantFreq = baseFrequencyHz + (sweepBandwidthHz * (t / chirpDurationSeconds));
                    _chirpPhase += 2.0f * Mathf.PI * instantFreq * dtSample;

                    // Hanning envelope window
                    float env = 0.5f * (1.0f - Mathf.Cos(2.0f * Mathf.PI * (t / chirpDurationSeconds)));
                    sample += Mathf.Sin(_chirpPhase) * env * 0.5f;

                    _chirpProgress += dtSample;
                    if (_chirpProgress >= chirpDurationSeconds)
                    {
                        _isEmittingChirp = false;
                    }
                }

                // 2. Delayed Doppler Echo
                if (_isEchoActive && _echoDelayCountdown <= 0f)
                {
                    float t = _echoProgress;
                    float shiftedBase = baseFrequencyHz * _dopplerRatio;
                    float shiftedBandwidth = sweepBandwidthHz * _dopplerRatio;
                    float instantFreq = shiftedBase + (shiftedBandwidth * (t / chirpDurationSeconds));

                    _echoPhase += 2.0f * Mathf.PI * instantFreq * dtSample;
                    float env = 0.5f * (1.0f - Mathf.Cos(2.0f * Mathf.PI * (t / chirpDurationSeconds)));
                    sample += Mathf.Sin(_echoPhase) * env * _echoAmplitude;

                    _echoProgress += dtSample;
                    if (_echoProgress >= chirpDurationSeconds)
                    {
                        _isEchoActive = false;
                    }
                }

                // Write to all output channels
                for (int c = 0; c < channels; c++)
                {
                    data[i + c] += sample;
                }
            }
        }
    }
}
