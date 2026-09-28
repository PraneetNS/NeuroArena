using System;
using UnityEngine;

namespace NeuroArena.Physics
{
    /// <summary>
    /// HamiltonianConservationVerifier: Real-time physics monitor that calculates kinetic
    /// and potential energy along agent trajectories to detect non-physical numerical drift.
    /// </summary>
    public class HamiltonianConservationVerifier : MonoBehaviour
    {
        [Header("System Dynamics")]
        [SerializeField] private float mass = 1.0f;
        [SerializeField] private float gravity = 9.81f;
        [SerializeField] private Rigidbody targetBody;

        [Header("Conservation Telemetry")]
        [SerializeField] private float initialHamiltonianEnergy;
        [SerializeField] private float currentHamiltonianEnergy;
        [SerializeField] private float energyDriftPercent;
        [SerializeField] private bool isEnergyConserved = true;

        [Header("Safety Thresholds")]
        [SerializeField] private float maxAllowedDriftPercent = 5.0f;

        public event Action<float, float> OnEnergyDriftExceeded;

        private void Start()
        {
            if (targetBody == null) targetBody = GetComponent<Rigidbody>();
            if (targetBody != null) mass = targetBody.mass;

            initialHamiltonianEnergy = SampleTotalEnergy();
            currentHamiltonianEnergy = initialHamiltonianEnergy;
        }

        private void FixedUpdate()
        {
            if (targetBody == null) return;

            currentHamiltonianEnergy = SampleTotalEnergy();
            if (initialHamiltonianEnergy > 1e-4f)
            {
                energyDriftPercent = Mathf.Abs(currentHamiltonianEnergy - initialHamiltonianEnergy) / initialHamiltonianEnergy * 100f;
            }
            else
            {
                energyDriftPercent = 0f;
            }

            isEnergyConserved = energyDriftPercent <= maxAllowedDriftPercent;
            if (!isEnergyConserved)
            {
                OnEnergyDriftExceeded?.Invoke(currentHamiltonianEnergy, energyDriftPercent);
            }
        }

        public float SampleTotalEnergy()
        {
            if (targetBody == null) return 0f;

            // Kinetic energy T = 0.5 * m * v^2
            float vSq = targetBody.velocity.sqrMagnitude;
            float kinetic = 0.5f * mass * vSq;

            // Potential energy V = m * g * h
            float height = transform.position.y;
            float potential = mass * gravity * Mathf.Max(0f, height);

            return kinetic + potential;
        }

        public void CalibrateBaseEnergy()
        {
            initialHamiltonianEnergy = SampleTotalEnergy();
            currentHamiltonianEnergy = initialHamiltonianEnergy;
            energyDriftPercent = 0f;
            isEnergyConserved = true;
        }
    }
}
