using System;
using UnityEngine;

namespace NeuroArena.Core
{
    /// <summary>
    /// Pure Procedural Audio Synthesizer for NeuroArena.
    /// Generates dynamic PCM waveforms on the fly without external .wav/.mp3 dependencies.
    /// Synthesizes crystal pickups, cyber terminal swooshes, epoch ticks, pass fanfare, and fail buzzes.
    /// </summary>
    public class NeuroAudioEngine : MonoBehaviour
    {
        public static NeuroAudioEngine Instance { get; private set; }

        private AudioSource audioSource;
        private const int SampleRate = 44100;

        private AudioClip pickupClip;
        private AudioClip terminalOpenClip;
        private AudioClip epochTickClip;
        private AudioClip victoryPassClip;
        private AudioClip failureBuzzClip;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;

            audioSource = GetComponent<AudioSource>();
            if (audioSource == null) audioSource = gameObject.AddComponent<AudioSource>();
            audioSource.playOnAwake = false;
            audioSource.spatialBlend = 0f; // 2D UI Audio

            SynthesizeAllClips();
        }

        private void SynthesizeAllClips()
        {
            pickupClip = CreateSineSweepClip("SFX_Pickup", 880f, 1760f, 0.14f);
            terminalOpenClip = CreateLowPassSweepClip("SFX_TerminalOpen", 120f, 520f, 0.28f);
            epochTickClip = CreateClickClip("SFX_EpochTick", 1400f, 0.035f);
            victoryPassClip = CreateFanfareChordClip("SFX_VictoryPass", 0.55f);
            failureBuzzClip = CreateSawBuzzClip("SFX_FailureBuzz", 90f, 45f, 0.40f);
        }

        public void PlayPickup() => PlayOneShot(pickupClip, 0.75f);
        public void PlayTerminalOpen() => PlayOneShot(terminalOpenClip, 0.85f);
        public void PlayEpochTick() => PlayOneShot(epochTickClip, 0.45f);
        public void PlayPassVictory() => PlayOneShot(victoryPassClip, 0.95f);
        public void PlayFailure() => PlayOneShot(failureBuzzClip, 0.90f);

        private void PlayOneShot(AudioClip clip, float volume = 1f)
        {
            if (audioSource != null && clip != null)
            {
                audioSource.PlayOneShot(clip, volume);
            }
        }

        private AudioClip CreateSineSweepClip(string name, float startFreq, float endFreq, float duration)
        {
            int totalSamples = (int)(SampleRate * duration);
            float[] samples = new float[totalSamples];

            for (int i = 0; i < totalSamples; i++)
            {
                float t = (float)i / totalSamples;
                float currentFreq = Mathf.Lerp(startFreq, endFreq, t);
                float envelope = 1f - t; // Linear decay
                samples[i] = Mathf.Sin(2f * Mathf.PI * currentFreq * ((float)i / SampleRate)) * envelope * 0.6f;
            }

            AudioClip clip = AudioClip.Create(name, totalSamples, 1, SampleRate, false);
            clip.SetData(samples, 0);
            return clip;
        }

        private AudioClip CreateLowPassSweepClip(string name, float startFreq, float endFreq, float duration)
        {
            int totalSamples = (int)(SampleRate * duration);
            float[] samples = new float[totalSamples];

            for (int i = 0; i < totalSamples; i++)
            {
                float t = (float)i / totalSamples;
                float freq = Mathf.Lerp(startFreq, endFreq, Mathf.Sin(t * Mathf.PI * 0.5f));
                float env = Mathf.Sin(t * Mathf.PI); // Bell curve envelope
                samples[i] = Mathf.Sin(2f * Mathf.PI * freq * ((float)i / SampleRate)) * env * 0.7f;
            }

            AudioClip clip = AudioClip.Create(name, totalSamples, 1, SampleRate, false);
            clip.SetData(samples, 0);
            return clip;
        }

        private AudioClip CreateClickClip(string name, float freq, float duration)
        {
            int totalSamples = (int)(SampleRate * duration);
            float[] samples = new float[totalSamples];

            for (int i = 0; i < totalSamples; i++)
            {
                float t = (float)i / totalSamples;
                float env = Mathf.Pow(1f - t, 4f); // Sharp transient
                samples[i] = (Mathf.Sin(2f * Mathf.PI * freq * ((float)i / SampleRate)) + (UnityEngine.Random.value - 0.5f) * 0.2f) * env * 0.5f;
            }

            AudioClip clip = AudioClip.Create(name, totalSamples, 1, SampleRate, false);
            clip.SetData(samples, 0);
            return clip;
        }

        private AudioClip CreateFanfareChordClip(string name, float duration)
        {
            int totalSamples = (int)(SampleRate * duration);
            float[] samples = new float[totalSamples];
            float[] notes = new float[] { 523.25f, 659.25f, 783.99f, 1046.50f }; // C Major Chord (C5, E5, G5, C6)

            for (int i = 0; i < totalSamples; i++)
            {
                float t = (float)i / totalSamples;
                float env = 1f - t;
                float mix = 0f;
                for (int n = 0; n < notes.Length; n++)
                {
                    mix += Mathf.Sin(2f * Mathf.PI * notes[n] * ((float)i / SampleRate));
                }
                samples[i] = (mix / notes.Length) * env * 0.8f;
            }

            AudioClip clip = AudioClip.Create(name, totalSamples, 1, SampleRate, false);
            clip.SetData(samples, 0);
            return clip;
        }

        private AudioClip CreateSawBuzzClip(string name, float startFreq, float endFreq, float duration)
        {
            int totalSamples = (int)(SampleRate * duration);
            float[] samples = new float[totalSamples];

            for (int i = 0; i < totalSamples; i++)
            {
                float t = (float)i / totalSamples;
                float freq = Mathf.Lerp(startFreq, endFreq, t);
                float env = Mathf.Pow(1f - t, 2f);
                float saw = (2f * ((float)(i * freq / SampleRate) % 1f)) - 1f;
                samples[i] = saw * env * 0.65f;
            }

            AudioClip clip = AudioClip.Create(name, totalSamples, 1, SampleRate, false);
            clip.SetData(samples, 0);
            return clip;
        }
    }
}
