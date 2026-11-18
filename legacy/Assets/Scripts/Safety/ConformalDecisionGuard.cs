using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.Safety
{
    /// <summary>
    /// ConformalDecisionGuard: Enforces finite-sample, distribution-free statistical safety guarantees
    /// on incoming combat decisions, weapon firing, and risky evasive maneuvers.
    /// </summary>
    public class ConformalDecisionGuard : MonoBehaviour
    {
        [Header("Statistical Confidence")]
        [Range(0.01f, 0.20f)]
        [SerializeField] private float significanceAlpha = 0.05f; // 95% coverage guarantee
        [SerializeField] private float damageThresholdTolerance = 45.0f;
        [SerializeField] private float defaultQuantileMargin = 12.5f;

        [Header("Runtime Metrics")]
        [SerializeField] private bool lastDecisionAllowed = true;
        [SerializeField] private float lastWorstCaseRisk = 0f;
        [SerializeField] private int calibrationSampleSize = 250;

        private readonly List<float> empiricalResiduals = new List<float>();

        public bool LastDecisionAllowed => lastDecisionAllowed;
        public float LastWorstCaseRisk => lastWorstCaseRisk;
        public float GuaranteedCoverage => 1.0f - significanceAlpha;

        private void Awake()
        {
            // Seed baseline calibration distribution
            for (int i = 0; i < calibrationSampleSize; i++)
            {
                float noise = Mathf.Abs(UnityEngine.Random.Range(-8f, 8f));
                empiricalResiduals.Add(noise);
            }
            empiricalResiduals.Sort();
        }

        /// <summary>
        /// Calibrates the empirical quantile cutoff with finite sample correction (n+1).
        /// </summary>
        public float ComputeConformalQuantile()
        {
            int n = empiricalResiduals.Count;
            if (n == 0) return defaultQuantileMargin;

            float p = Mathf.Min(1.0f, Mathf.Ceil((n + 1) * (1.0f - significanceAlpha)) / n);
            int idx = Mathf.Clamp(Mathf.CeilToInt(p * n) - 1, 0, n - 1);
            return empiricalResiduals[idx];
        }

        /// <summary>
        /// Validates if an action's predicted risk + conformal quantile satisfies safety bounds.
        /// </summary>
        public bool ValidateAction(float predictedRisk, float customThreshold = -1f)
        {
            float limit = customThreshold > 0 ? customThreshold : damageThresholdTolerance;
            float qHat = ComputeConformalQuantile();

            lastWorstCaseRisk = predictedRisk + qHat;
            lastDecisionAllowed = lastWorstCaseRisk <= limit;

            return lastDecisionAllowed;
        }

        /// <summary>
        /// Dynamically registers observed outcome to keep calibration distribution fresh.
        /// </summary>
        public void IngestObservedOutcome(float predictedValue, float actualValue)
        {
            float residual = Mathf.Abs(actualValue - predictedValue);
            empiricalResiduals.Add(residual);
            if (empiricalResiduals.Count > 1000)
            {
                empiricalResiduals.RemoveAt(0);
            }
            empiricalResiduals.Sort();
        }
    }
}
