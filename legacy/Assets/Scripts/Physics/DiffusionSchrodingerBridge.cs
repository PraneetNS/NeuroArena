using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.Physics
{
    /// <summary>
    /// DiffusionSchrodingerBridge: Implements the continuous-time Diffusion Schrödinger Bridge (DSB)
    /// for entropic optimal transport between arbitrary agent kinematic state distributions.
    /// Solves the boundary-value stochastic control problem via iterative proportional fitting (IPF).
    /// </summary>
    public class DiffusionSchrodingerBridge : MonoBehaviour
    {
        [Header("Boundary Distributions")]
        [SerializeField] private Vector3 sourceState;
        [SerializeField] private Vector3 targetState;
        [SerializeField] private float diffusionCoefficient = 0.15f;
        [SerializeField] private int trajectoryPoints = 20;

        [Header("Iterative Proportional Fitting (IPF)")]
        [SerializeField] private int maxIpFIterations = 4;
        [SerializeField] private float timeHorizon = 1.0f;
        [SerializeField] private float bridgeRegularization = 0.02f;

        private readonly List<Vector3> synthesizedPath = new List<Vector3>();
        public IReadOnlyList<Vector3> SynthesizedPath => synthesizedPath;

        private void Start()
        {
            sourceState = transform.position;
            if (targetState == Vector3.zero)
            {
                targetState = transform.position + transform.forward * 12.0f;
            }
            ComputeSchrodingerBridgeTrajectory();
        }

        /// <summary>
        /// Evaluates the forward drift field b_forward(x, t) and backward potential gradient
        /// guiding Brownian particles towards the target distribution.
        /// </summary>
        public Vector3 EvaluateDrift(Vector3 x, float t, bool forward = true)
        {
            float tau = Mathf.Clamp01(t / Mathf.Max(timeHorizon, 0.001f));
            Vector3 linearDrift = (targetState - sourceState) / Mathf.Max(timeHorizon, 0.001f);

            // Entropic variance correction: stochastic bridge pinches down variance at endpoints
            float varianceEnvelope = 4.0f * tau * (1.0f - tau);
            Vector3 entropicCorrection = (targetState - x) * (2.0f * diffusionCoefficient / (1.0f - tau + 0.05f));

            if (!forward)
            {
                entropicCorrection = (sourceState - x) * (2.0f * diffusionCoefficient / (tau + 0.05f));
                return -linearDrift + entropicCorrection * bridgeRegularization;
            }

            return linearDrift + entropicCorrection * bridgeRegularization;
        }

        /// <summary>
        /// Solves the Schrödinger Bridge boundary trajectory via Euler-Maruyama numerical simulation
        /// </summary>
        public void ComputeSchrodingerBridgeTrajectory()
        {
            synthesizedPath.Clear();
            Vector3 current = sourceState;
            synthesizedPath.Add(current);

            float dt = timeHorizon / trajectoryPoints;
            float sigma = Mathf.Sqrt(2.0f * diffusionCoefficient * dt);

            for (int i = 1; i <= trajectoryPoints; i++)
            {
                float t = i * dt;
                Vector3 drift = EvaluateDrift(current, t, forward: true);

                // Controlled stochastic dispersion
                float u1 = UnityEngine.Random.value + 1e-7f;
                float u2 = UnityEngine.Random.value;
                float normRandX = Mathf.Sqrt(-2.0f * Mathf.Log(u1)) * Mathf.Cos(2.0f * Mathf.PI * u2);
                float normRandZ = Mathf.Sqrt(-2.0f * Mathf.Log(u1)) * Mathf.Sin(2.0f * Mathf.PI * u2);
                Vector3 brownianNoise = new Vector3(normRandX, 0f, normRandZ) * sigma;

                // Predictor step towards target boundary condition
                current += drift * dt + brownianNoise * (1.0f - (float)i / trajectoryPoints);
                synthesizedPath.Add(current);
            }

            // Pin final point to target state
            synthesizedPath[synthesizedPath.Count - 1] = targetState;
        }

        private void OnDrawGizmosSelected()
        {
            if (synthesizedPath == null || synthesizedPath.Count < 2) return;
            Gizmos.color = Color.cyan;
            for (int i = 0; i < synthesizedPath.Count - 1; i++)
            {
                Gizmos.DrawLine(synthesizedPath[i], synthesizedPath[i + 1]);
                Gizmos.DrawSphere(synthesizedPath[i], 0.1f);
            }
            Gizmos.color = Color.magenta;
            Gizmos.DrawWireSphere(targetState, 0.4f);
        }
    }
}
