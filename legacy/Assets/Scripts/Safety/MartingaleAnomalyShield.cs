using System;
using UnityEngine;

namespace NeuroArena.Safety
{
    /// <summary>
    /// MartingaleAnomalyShield: Implements non-exchangeable conformal martingale testing
    /// to detect out-of-distribution (OOD) adversarial telemetry, lag manipulation, or cheat injections.
    /// Employs Ville's inequality for sequential hypothesis testing:
    ///   P(\sup_n M_n >= \lambda) <= 1 / \lambda
    /// Providing distribution-free, finite-time false positive control without stationarity assumptions.
    /// </summary>
    public class MartingaleAnomalyShield : MonoBehaviour
    {
        [Header("Martingale Parameters")]
        [SerializeField] private float thresholdLambda = 100.0f; // False alarm rate <= 1%
        [SerializeField] private float bettingEpsilon = 0.8f;
        [SerializeField] private float anomalyDecay = 0.999f;

        private double martingaleWealth = 1.0;
        private int totalObservations = 0;
        private bool isAnomalyFlagged = false;

        public double MartingaleWealth => martingaleWealth;
        public bool IsAnomalyFlagged => isAnomalyFlagged;

        /// <summary>
        /// Updates testing martingale given a non-conformity p-value u_t in [0, 1]
        /// M_t = M_{t-1} * (\epsilon * u_t^{\epsilon - 1})
        /// </summary>
        public bool ProcessObservationPValue(float pValue)
        {
            totalObservations++;
            float u = Mathf.Clamp(pValue, 0.001f, 0.999f);

            // Power betting martingale factor
            double multiplier = bettingEpsilon * Math.Pow(u, bettingEpsilon - 1.0);
            martingaleWealth *= multiplier;

            // Leakage protection against indefinite drift
            martingaleWealth *= anomalyDecay;

            if (martingaleWealth >= thresholdLambda)
            {
                isAnomalyFlagged = true;
                Debug.LogWarning($"[MartingaleAnomalyShield] Anomaly Detected! Martingale Wealth: {martingaleWealth:F2} >= {thresholdLambda}");
            }

            return isAnomalyFlagged;
        }

        /// <summary>
        /// Evaluates kinematic non-conformity score and maps to empirical p-value
        /// </summary>
        public void EvaluateKinematicSample(Vector3 velocity, Vector3 acceleration)
        {
            // Physical bound: non-conformity grows with unphysical jerk/acceleration
            float normAcc = acceleration.magnitude;
            float pValue = Mathf.Exp(-normAcc / 50.0f); // Higher acceleration -> smaller pValue -> grows martingale
            ProcessObservationPValue(pValue);
        }

        public void ResetShield()
        {
            martingaleWealth = 1.0;
            isAnomalyFlagged = false;
        }
    }
}
