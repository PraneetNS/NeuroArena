using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.Audio
{
    /// <summary>
    /// Stage 25/Audio Optimization Voice Pool Manager.
    /// Caps simultaneous active 3D spatial audio emitters, dynamically prioritizing by distance and beacon status.
    /// Prevents CPU spikes and Android hardware audio track limit exhaustion in crowded biomes.
    /// </summary>
    public class SpatialAudioVoicePool : MonoBehaviour
    {
        public static SpatialAudioVoicePool Instance { get; private set; }

        [Header("Voice Pool Budget")]
        [Range(2, 32)]
        [SerializeField] private int maxActiveVoices = 8; // Default 8 (Balanced); 4 (Mobile Low), 16 (Desktop High)
        [SerializeField] private float updateIntervalSec = 0.08f; // ~12.5 Hz priority recalculation

        public class TrackedEmitter
        {
            public AudioSource source;
            public Transform transform;
            public float baseVolume;
            public float maxDistance;
            public bool isHighPriority;
            public float currentDistance;
            public float priorityScore;
        }

        private readonly List<TrackedEmitter> registeredEmitters = new List<TrackedEmitter>();
        private float nextUpdateTime = 0f;
        private Transform listenerTransform;

        public int MaxActiveVoices
        {
            get => maxActiveVoices;
            set => maxActiveVoices = Mathf.Clamp(value, 2, 32);
        }

        private void Awake()
        {
            if (Instance == null) Instance = this;
            else { Destroy(gameObject); return; }
        }

        private void Start()
        {
            if (Camera.main != null)
            {
                listenerTransform = Camera.main.transform;
            }
        }

        public void RegisterEmitter(AudioSource source, float maxDistance = 20f, bool isHighPriority = false)
        {
            if (source == null) return;
            registeredEmitters.Add(new TrackedEmitter
            {
                source = source,
                transform = source.transform,
                baseVolume = source.volume > 0 ? source.volume : 0.1f,
                maxDistance = maxDistance,
                isHighPriority = isHighPriority
            });
        }

        public void UnregisterEmitter(AudioSource source)
        {
            if (source == null) return;
            registeredEmitters.RemoveAll(e => e.source == source);
        }

        private void Update()
        {
            if (Time.time < nextUpdateTime) return;
            nextUpdateTime = Time.time + updateIntervalSec;

            if (listenerTransform == null && Camera.main != null)
            {
                listenerTransform = Camera.main.transform;
            }
            if (listenerTransform == null) return;

            Vector3 listenerPos = listenerTransform.position;

            // 1. Calculate distance and priority score for each emitter
            for (int i = registeredEmitters.Count - 1; i >= 0; i--)
            {
                var emitter = registeredEmitters[i];
                if (emitter.source == null || emitter.transform == null)
                {
                    registeredEmitters.RemoveAt(i);
                    continue;
                }

                emitter.currentDistance = Vector3.Distance(listenerPos, emitter.transform.position);
                // Priority bonus for critical beacon audio (e.g. Lab Station)
                emitter.priorityScore = emitter.currentDistance / (emitter.isHighPriority ? 3.5f : 1.0f);
            }

            // 2. Sort emitters by priority (lowest score = highest priority)
            registeredEmitters.Sort((a, b) => a.priorityScore.CompareTo(b.priorityScore));

            // 3. Enable top K voices within range; mute/cull remaining
            for (int i = 0; i < registeredEmitters.Count; i++)
            {
                var emitter = registeredEmitters[i];
                bool isAudible = (i < maxActiveVoices) && (emitter.currentDistance < emitter.maxDistance);

                if (isAudible)
                {
                    if (!emitter.source.isPlaying) emitter.source.Play();
                    emitter.source.volume = emitter.baseVolume;
                }
                else
                {
                    emitter.source.volume = 0f;
                }
            }
        }
    }
}
