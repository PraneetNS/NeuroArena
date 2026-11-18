using System;
using UnityEngine;

namespace NeuroArena.Physics
{
    /// <summary>
    /// SymplecticIntegrator: Implements phase-space volume-preserving symplectic integration
    /// (Velocity Verlet and Störmer-Verlet) for non-dissipative Hamiltonian mechanics.
    /// Guarantees long-term energy conservation and exact preservation of Poincaré invariants
    /// for orbital gravitational fields and particle physics in Biome 6 (Semantic Expanse).
    /// </summary>
    public class SymplecticIntegrator : MonoBehaviour
    {
        [Header("Phase Space State")]
        [SerializeField] private Vector3 position;
        [SerializeField] private Vector3 momentum;
        [SerializeField] private float mass = 1.0f;

        [Header("Hamiltonian Potential Configuration")]
        [SerializeField] private Vector3 gravitationalCenter = Vector3.zero;
        [SerializeField] private float gravitationalConstant = 25.0f;
        [SerializeField] private float softeningLength = 0.5f;

        public Vector3 Position => position;
        public Vector3 Momentum => momentum;

        private void Start()
        {
            position = transform.position;
            if (momentum == Vector3.zero)
            {
                // Circular orbital initial momentum
                Vector3 r = position - gravitationalCenter;
                float speed = Mathf.Sqrt(gravitationalConstant / Mathf.Max(r.magnitude, 0.1f));
                Vector3 normal = Vector3.up;
                momentum = Vector3.Cross(r.normalized, normal) * (speed * mass);
            }
        }

        /// <summary>
        /// Computes force F(q) = -\nabla V(q) from potential V(q) = -G * M * m / sqrt(|q|^2 + \epsilon^2)
        /// </summary>
        public Vector3 ComputeForce(Vector3 q)
        {
            Vector3 diff = gravitationalCenter - q;
            float r2 = diff.sqrMagnitude + softeningLength * softeningLength;
            float invR3 = 1.0f / (r2 * Mathf.Sqrt(r2));
            return diff * (gravitationalConstant * mass * invR3);
        }

        /// <summary>
        /// Symplectic Velocity-Verlet Integration Step:
        /// 1. p(t + dt/2) = p(t) + 0.5 * dt * F(q(t))
        /// 2. q(t + dt)   = q(t) + dt * p(t + dt/2) / m
        /// 3. p(t + dt)   = p(t + dt/2) + 0.5 * dt * F(q(t + dt))
        /// </summary>
        public void StepSymplectic(float dt)
        {
            Vector3 force0 = ComputeForce(position);
            Vector3 halfMomentum = momentum + 0.5f * dt * force0;

            position += dt * (halfMomentum / mass);

            Vector3 force1 = ComputeForce(position);
            momentum = halfMomentum + 0.5f * dt * force1;

            transform.position = position;
        }

        private void FixedUpdate()
        {
            StepSymplectic(Time.fixedDeltaTime);
        }

        /// <summary>
        /// Total Hamiltonian Energy H(q, p) = T(p) + V(q)
        /// </summary>
        public float EvaluateTotalEnergy()
        {
            float kinetic = momentum.sqrMagnitude / (2.0f * mass);
            float dist = Mathf.Sqrt((position - gravitationalCenter).sqrMagnitude + softeningLength * softeningLength);
            float potential = -gravitationalConstant * mass / dist;
            return kinetic + potential;
        }
    }
}
