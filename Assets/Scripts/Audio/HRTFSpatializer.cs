using System;
using UnityEngine;

namespace NeuroArena.Audio
{
    /// <summary>
    /// Binaural Head-Related Transfer Function (HRTF) DSP filter module.
    /// Approximates interaural time difference (ITD), interaural level difference (ILD),
    /// and pinna frequency shadowing for 3D positional machine learning audio emitters.
    /// </summary>
    public class HRTFSpatializer
    {
        private const float SpeedOfSound = 343.0f; // m/s
        private const float HeadRadius = 0.0875f;  // ~17.5cm head diameter
        private readonly int sampleRate;

        // Circular delay buffers for Interaural Time Difference (ITD)
        private readonly float[] delayBufferLeft;
        private readonly float[] delayBufferRight;
        private int writeIndex = 0;
        private const int MaxDelaySamples = 512;

        // Biquad head-shadow low-pass filter states
        private float shadowLpLeft = 0f;
        private float shadowLpRight = 0f;

        public HRTFSpatializer(int sampleRate = 44100)
        {
            this.sampleRate = Mathf.Max(22050, sampleRate);
            this.delayBufferLeft = new float[MaxDelaySamples];
            this.delayBufferRight = new float[MaxDelaySamples];
        }

        /// <summary>
        /// Processes a mono sample into binaural stereo (left, right) given emitter relative vector.
        /// </summary>
        /// <param name="monoInput">Input audio sample.</param>
        /// <param name="relativePos">Emitter position relative to listener head.</param>
        /// <param name="leftOut">Processed left ear sample.</param>
        /// <param name="rightOut">Processed right ear sample.</param>
        public void ProcessBinaural(float monoInput, Vector3 relativePos, out float leftOut, out float rightOut)
        {
            float distance = relativePos.magnitude;
            if (distance < 0.001f)
            {
                leftOut = monoInput * 0.5f;
                rightOut = monoInput * 0.5f;
                return;
            }

            Vector3 direction = relativePos / distance;
            // Azimuth angle theta relative to head forward (X=Right, Y=Up, Z=Forward)
            float azimuth = Mathf.Atan2(direction.x, direction.z); // -pi to +pi
            float sinAzimuth = Mathf.Sin(azimuth);

            // Woodworth-Schlosberg model for ITD
            // delta_t = (r / c) * (sin(theta) + theta)
            float itdSeconds = (HeadRadius / SpeedOfSound) * (sinAzimuth + azimuth * 0.5f);
            float delaySamples = itdSeconds * sampleRate;

            int delayL = 0;
            int delayR = 0;
            if (delaySamples > 0)
            {
                // Source is on the right -> right ear hears first, left ear delayed
                delayL = Mathf.Clamp((int)delaySamples, 0, MaxDelaySamples - 1);
            }
            else
            {
                // Source is on the left -> left ear hears first, right ear delayed
                delayR = Mathf.Clamp((int)(-delaySamples), 0, MaxDelaySamples - 1);
            }

            // Write to circular buffers
            delayBufferLeft[writeIndex] = monoInput;
            delayBufferRight[writeIndex] = monoInput;

            int readIndexL = (writeIndex - delayL + MaxDelaySamples) % MaxDelaySamples;
            int readIndexR = (writeIndex - delayR + MaxDelaySamples) % MaxDelaySamples;
            writeIndex = (writeIndex + 1) % MaxDelaySamples;

            float sampleL = delayBufferLeft[readIndexL];
            float sampleR = delayBufferRight[readIndexR];

            // Interaural Level Difference (ILD) and head shadowing filter
            // Contralateral ear experiences high-frequency attenuation
            float panFactor = Mathf.Clamp(sinAzimuth, -1f, 1f);
            float gainL = Mathf.Clamp01(0.707f * (1f - panFactor * 0.45f));
            float gainR = Mathf.Clamp01(0.707f * (1f + panFactor * 0.45f));

            // Low-pass filter coefficient for head shadowing
            float shadowCoeffL = panFactor > 0f ? Mathf.Lerp(0.95f, 0.45f, panFactor) : 0.95f;
            float shadowCoeffR = panFactor < 0f ? Mathf.Lerp(0.95f, 0.45f, -panFactor) : 0.95f;

            shadowLpLeft = shadowLpLeft * (1f - shadowCoeffL) + sampleL * shadowCoeffL;
            shadowLpRight = shadowLpRight * (1f - shadowCoeffR) + sampleR * shadowCoeffR;

            // Distance inverse square attenuation with soft knee
            float distAtten = 1.0f / (1.0f + 0.35f * distance + 0.05f * distance * distance);

            leftOut = shadowLpLeft * gainL * distAtten;
            rightOut = shadowLpRight * gainR * distAtten;
        }

        public void Reset()
        {
            Array.Clear(delayBufferLeft, 0, delayBufferLeft.Length);
            Array.Clear(delayBufferRight, 0, delayBufferRight.Length);
            shadowLpLeft = 0f;
            shadowLpRight = 0f;
            writeIndex = 0;
        }
    }
}
