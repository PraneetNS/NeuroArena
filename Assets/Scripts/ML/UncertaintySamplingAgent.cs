using System;
using UnityEngine;

namespace NeuroArena.ML
{
    /// <summary>
    /// Active Learning Uncertainty Sampler component for Unity agents.
    /// Analyzes prediction entropy across arena coordinates and signals boundary exploration beacons.
    /// </summary>
    public class UncertaintySamplingAgent : MonoBehaviour
    {
        [Header("Uncertainty Thresholds")]
        [Range(0f, 1f)] [SerializeField] private float entropyBeaconThreshold = 0.65f;
        [Range(0f, 1f)] [SerializeField] private float marginBeaconThreshold = 0.80f;
        [SerializeField] private float bonusTokenMultiplier = 1.5f;

        [Header("Diagnostics")]
        [SerializeField] private float currentEntropy = 0f;
        [SerializeField] private float currentMargin = 0f;
        [SerializeField] private bool isExploringBoundary = false;

        public event Action<Vector3, float> OnHighUncertaintyDiscovered;

        public float CurrentEntropy => currentEntropy;
        public float CurrentMargin => currentMargin;
        public bool IsExploringBoundary => isExploringBoundary;

        /// <summary>
        /// Evaluates output softmax probabilities from the agent's forward pass.
        /// </summary>
        public float EvaluateProbabilities(Vector3 worldPosition, float[] probabilities)
        {
            if (probabilities == null || probabilities.Length < 2)
            {
                currentEntropy = 0f;
                currentMargin = 0f;
                isExploringBoundary = false;
                return 0f;
            }

            int k = probabilities.Length;
            float entropySum = 0f;

            float pMax1 = -1f;
            float pMax2 = -1f;

            for (int i = 0; i < k; i++)
            {
                float p = Mathf.Clamp(probabilities[i], 1e-12f, 1.0f);
                entropySum -= p * Mathf.Log(p);

                if (p > pMax1)
                {
                    pMax2 = pMax1;
                    pMax1 = p;
                }
                else if (p > pMax2)
                {
                    pMax2 = p;
                }
            }

            float maxEntropy = Mathf.Log(k);
            currentEntropy = Mathf.Clamp01(entropySum / maxEntropy);
            currentMargin = Mathf.Clamp01(1.0f - (pMax1 - pMax2));

            isExploringBoundary = (currentEntropy >= entropyBeaconThreshold) || (currentMargin >= marginBeaconThreshold);

            if (isExploringBoundary)
            {
                OnHighUncertaintyDiscovered?.Invoke(worldPosition, currentEntropy);
            }

            return currentEntropy;
        }

        /// <summary>
        /// Calculates reward bonus for collecting a crystal near an ambiguous boundary.
        /// </summary>
        public int CalculateCollectionReward(int baseReward)
        {
            if (isExploringBoundary)
            {
                return Mathf.RoundToInt(baseReward * bonusTokenMultiplier);
            }
            return baseReward;
        }
    }
}
