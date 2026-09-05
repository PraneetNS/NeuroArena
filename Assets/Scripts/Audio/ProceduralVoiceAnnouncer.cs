using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.Audio
{
    /// <summary>
    /// Procedural formant-based voice synthesis announcer for real-time match events,
    /// model convergence milestones, and coach diagnostics.
    /// </summary>
    [RequireComponent(typeof(AudioSource))]
    public class ProceduralVoiceAnnouncer : MonoBehaviour
    {
        [Header("Vocal Tract Configuration")]
        [Range(80f, 400f)] public float fundamentalFrequency = 180f;
        [Range(0.1f, 1f)] public float masterVoiceGain = 0.75f;
        public bool muteSpeech = false;

        private AudioSource _audioSource;
        private readonly Queue<string> _speechQueue = new Queue<string>();
        private bool _isSpeaking = false;

        private void Awake()
        {
            _audioSource = GetComponent<AudioSource>();
            _audioSource.spatialBlend = 0.0f; // 2D announcer UI mix
            _audioSource.playOnAwake = false;
        }

        public void Announce(string cue)
        {
            if (muteSpeech || string.IsNullOrEmpty(cue)) return;
            _speechQueue.Enqueue(cue.ToUpperInvariant());
            if (!_isSpeaking)
            {
                StartCoroutine(ProcessSpeechQueue());
            }
        }

        private IEnumerator ProcessSpeechQueue()
        {
            _isSpeaking = true;
            while (_speechQueue.Count > 0)
            {
                string cue = _speechQueue.Dequeue();
                AudioClip clip = GenerateFormantClip(cue);
                if (clip != null)
                {
                    _audioSource.PlayOneShot(clip, masterVoiceGain);
                    yield return new WaitForSeconds(clip.length + 0.15f);
                }
            }
            _isSpeaking = false;
        }

        private AudioClip GenerateFormantClip(string cue)
        {
            int sampleRate = 44100;
            float duration = 0.6f;
            int totalSamples = Mathf.FloorToInt(sampleRate * duration);
            float[] samples = new float[totalSamples];

            float f0 = fundamentalFrequency;
            float f1 = 500f; // Formant 1 (throat)
            float f2 = 1800f; // Formant 2 (mouth)

            if (cue.Contains("CONVERGE") || cue.Contains("WIN"))
            {
                f0 = 240f;
                f1 = 400f;
                f2 = 2200f;
            }
            else if (cue.Contains("OVERFIT") || cue.Contains("LOSS"))
            {
                f0 = 140f;
                f1 = 700f;
                f2 = 1100f;
            }

            float phase0 = 0f;
            for (int i = 0; i < totalSamples; i++)
            {
                float t = (float)i / sampleRate;
                float env = Mathf.Sin(t / duration * Mathf.PI); // Envelope
                
                // Glottal excitation pulse (sawtooth-like)
                phase0 += (f0 / sampleRate);
                if (phase0 > 1f) phase0 -= 1f;
                float glottal = (phase0 * 2f - 1f);

                // Formant resonance sum
                float formants = Mathf.Sin(2f * Mathf.PI * f1 * t) * 0.6f + Mathf.Sin(2f * Mathf.PI * f2 * t) * 0.4f;
                samples[i] = glottal * formants * env;
            }

            AudioClip clip = AudioClip.Create($"Speech_{cue}", totalSamples, 1, sampleRate, false);
            clip.SetData(samples, 0);
            return clip;
        }
    }
}
