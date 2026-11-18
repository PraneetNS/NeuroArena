using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.ML
{
    /// <summary>
    /// TrajectoryEmbeddingSensor: Buffers real-time state observations [pos, vel]
    /// and streams normalized fixed-length temporal window vectors for contrastive representation learning.
    /// </summary>
    public class TrajectoryEmbeddingSensor : MonoBehaviour
    {
        [Header("Window Configuration")]
        [SerializeField] private int windowLength = 16;
        [SerializeField] private float sampleInterval = 0.05f;

        [Header("Latent Telemetry")]
        [SerializeField] private float currentNormalizedVelocity = 0f;
        [SerializeField] private float currentTrajectoryEnergy = 0f;

        private float sampleTimer = 0f;
        private readonly List<float> featureBuffer = new List<float>();

        public IReadOnlyList<float> FeatureBuffer => featureBuffer;

        private void Update()
        {
            sampleTimer += Time.deltaTime;
            if (sampleTimer >= sampleInterval)
            {
                sampleTimer = 0f;
                SampleObservation();
            }
        }

        private void SampleObservation()
        {
            Vector3 pos = transform.position;
            Vector3 vel = transform.forward * 5f; // Velocity estimate

            // Ingest 6D state: pos(x,y,z), vel(x,y,z)
            featureBuffer.Add(pos.x);
            featureBuffer.Add(pos.y);
            featureBuffer.Add(pos.z);
            featureBuffer.Add(vel.x);
            featureBuffer.Add(vel.y);
            featureBuffer.Add(vel.z);

            currentNormalizedVelocity = vel.magnitude;
            currentTrajectoryEnergy = 0.5f * vel.sqrMagnitude;

            // Retain windowLength * 6 features
            int targetCapacity = windowLength * 6;
            while (featureBuffer.Count > targetCapacity)
            {
                featureBuffer.RemoveRange(0, 6);
            }
        }

        public float[] GetFlattenedWindow()
        {
            return featureBuffer.ToArray();
        }
    }
}
