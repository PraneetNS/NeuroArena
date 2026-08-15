using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.Core
{
    /// <summary>
    /// Mobile-Optimized Zero-Allocation Particle System Pool.
    /// Caps simultaneous active particle systems to 4 and limits max particles per burst to 150,
    /// protecting GPU fillrate, battery thermals, and eliminating runtime garbage collection hitches on Android.
    /// </summary>
    public class ParticleSystemPool : MonoBehaviour
    {
        public static ParticleSystemPool Instance { get; private set; }

        [Header("Pool Limits (Mobile Fillrate Capping)")]
        [SerializeField] private int maxPoolSize = 4;
        [SerializeField] private int maxParticlesPerEmitter = 150;

        private Queue<ParticleSystem> availableEmitters = new Queue<ParticleSystem>();
        private List<ParticleSystem> activeEmitters = new List<ParticleSystem>();

        public int ActiveEmitterCount => activeEmitters.Count;
        public int TotalPoolCount => availableEmitters.Count + activeEmitters.Count;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            InitializePool();
        }

        private void InitializePool()
        {
            for (int i = 0; i < maxPoolSize; i++)
            {
                GameObject go = new GameObject($"Pooled_ParticleEmitter_{i}");
                go.transform.SetParent(transform);

                ParticleSystem ps = go.AddComponent<ParticleSystem>();
                var main = ps.main;
                main.maxParticles = maxParticlesPerEmitter;
                main.loop = false;
                main.playOnAwake = false;
                main.startLifetime = 0.65f;
                main.startSpeed = 6.0f;
                main.startSize = 0.25f;
                main.startColor = new Color(0.22f, 0.74f, 0.97f, 0.9f);

                var emission = ps.emission;
                emission.rateOverTime = 0;
                emission.SetBursts(new ParticleSystem.Burst[] { new ParticleSystem.Burst(0f, 60) });

                var shape = ps.shape;
                shape.shapeType = ParticleSystemShapeType.Sphere;
                shape.radius = 0.4f;

                go.SetActive(false);
                availableEmitters.Enqueue(ps);
            }
        }

        public void PlayBurst(Vector3 position, Color burstColor)
        {
            ParticleSystem ps = null;
            if (availableEmitters.Count > 0)
            {
                ps = availableEmitters.Dequeue();
            }
            else if (activeEmitters.Count > 0)
            {
                // Recycle oldest active emitter
                ps = activeEmitters[0];
                activeEmitters.RemoveAt(0);
                ps.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            }

            if (ps != null)
            {
                ps.transform.position = position;
                var main = ps.main;
                main.startColor = burstColor;
                ps.gameObject.SetActive(true);
                ps.Play();
                activeEmitters.Add(ps);
            }
        }

        private void Update()
        {
            for (int i = activeEmitters.Count - 1; i >= 0; i--)
            {
                if (!activeEmitters[i].IsAlive(true))
                {
                    ParticleSystem ps = activeEmitters[i];
                    activeEmitters.RemoveAt(i);
                    ps.gameObject.SetActive(false);
                    availableEmitters.Enqueue(ps);
                }
            }
        }
    }
}
