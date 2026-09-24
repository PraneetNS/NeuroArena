using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.ML
{
    /// <summary>
    /// Freezing policy for progressive transfer learning across biomes.
    /// </summary>
    public enum LayerFreezePolicy
    {
        None,               // All layers trained with full learning rate
        FeatureExtractor,   // Early layers frozen; middle fine-tuned; head trained
        HeadOnly,           // All hidden layers frozen; only output classifier trained
        ProgressiveUnfreeze // Gradually unfreezes layers as validation loss plateau is reached
    }

    /// <summary>
    /// Metadata describing cross-biome transfer compatibility and domain adaptation.
    /// </summary>
    [Serializable]
    public struct BiomeTransferProfile
    {
        public int SourceBiomeId;
        public int TargetBiomeId;
        public float DomainSimilarityScore; // 0.0 to 1.0 (MMD / Wasserstein affinity)
        public float RecommendedLRScaling;
        public int FrozenLayerCount;
        public string SourceBiomeName;
        public string TargetBiomeName;
    }

    /// <summary>
    /// Cross-Biome Transfer Learning and Progressive Layer Freezing Engine.
    /// Enables pre-trained agents from introductory biomes (e.g. Linear Steppes)
    /// to adapt rapidly to complex environments (Binary Marshlands, Deep Citadel)
    /// with reduced sample complexity and negative transfer mitigation.
    /// </summary>
    public class BiomeTransferLearningEngine : MonoBehaviour
    {
        [Header("Curriculum Configuration")]
        [SerializeField] private int currentBiomeId = 0;
        [SerializeField] private LayerFreezePolicy freezePolicy = LayerFreezePolicy.FeatureExtractor;
        [SerializeField] private float baseLearningRate = 0.01f;
        [SerializeField] private float fineTuningDecayFactor = 0.2f;
        [SerializeField] private float mmdRegularizationWeight = 0.05f;

        // Biome transfer affinity matrix [source, target] -> similarity score (0.0 to 1.0)
        private static readonly float[,] BiomeTransferMatrix = new float[6, 6]
        {
            // 0: Linear Steppes, 1: Binary Marsh, 2: Variance Tundra, 3: Branching Canopy, 4: Synapse Citadel, 5: Semantic Expanse
            { 1.00f, 0.78f, 0.65f, 0.52f, 0.40f, 0.35f }, // From Steppes
            { 0.72f, 1.00f, 0.81f, 0.64f, 0.49f, 0.42f }, // From Marshlands
            { 0.60f, 0.79f, 1.00f, 0.75f, 0.58f, 0.50f }, // From Tundra
            { 0.48f, 0.62f, 0.74f, 1.00f, 0.82f, 0.68f }, // From Canopy
            { 0.38f, 0.46f, 0.55f, 0.80f, 1.00f, 0.85f }, // From Citadel
            { 0.32f, 0.39f, 0.47f, 0.65f, 0.84f, 1.00f }  // From Semantic Expanse
        };

        private static readonly string[] BiomeNames = new string[6]
        {
            "Linear Steppes",
            "Binary Marshlands",
            "Variance Tundra",
            "Branching Canopy",
            "Deep Synapse Citadel",
            "Semantic Expanse"
        };

        // Layer mask: true = layer parameters are frozen (gradients zeroed)
        private bool[] layerFreezeMask = new bool[0];
        private float[] layerLearningRates = new float[0];
        private int totalLayers = 0;

        public event Action<BiomeTransferProfile> OnTransferConfigured;
        public event Action<int, bool> OnLayerFreezeStateChanged;

        public int CurrentBiomeId => currentBiomeId;
        public LayerFreezePolicy FreezePolicy => freezePolicy;

        /// <summary>
        /// Initializes layer masks and learning rates based on network topology.
        /// </summary>
        public void InitializeTopology(int numLayers)
        {
            totalLayers = Mathf.Max(1, numLayers);
            layerFreezeMask = new bool[totalLayers];
            layerLearningRates = new float[totalLayers];
            ApplyFreezingPolicy();
        }

        /// <summary>
        /// Configures transfer learning from a source biome into the current target biome.
        /// </summary>
        public BiomeTransferProfile ConfigureTransfer(int sourceBiomeId, int targetBiomeId)
        {
            sourceBiomeId = Mathf.Clamp(sourceBiomeId, 0, 5);
            targetBiomeId = Mathf.Clamp(targetBiomeId, 0, 5);
            currentBiomeId = targetBiomeId;

            float similarity = BiomeTransferMatrix[sourceBiomeId, targetBiomeId];
            float lrScaling = Mathf.Lerp(0.1f, 1.0f, similarity);

            // Compute number of early layers to freeze depending on domain similarity
            int layersToFreeze = 0;
            if (freezePolicy == LayerFreezePolicy.FeatureExtractor && totalLayers > 2)
            {
                // Higher similarity allows freezing more early feature extractors
                layersToFreeze = Mathf.Clamp(Mathf.RoundToInt((totalLayers - 1) * similarity * 0.7f), 1, totalLayers - 1);
            }
            else if (freezePolicy == LayerFreezePolicy.HeadOnly && totalLayers > 1)
            {
                layersToFreeze = totalLayers - 1;
            }

            // Apply masks
            if (layerFreezeMask.Length == totalLayers)
            {
                for (int i = 0; i < totalLayers; i++)
                {
                    layerFreezeMask[i] = (i < layersToFreeze);
                    // Fine-tuning decay for intermediate unfrozen layers
                    float depthRatio = (float)i / Mathf.Max(1, totalLayers - 1);
                    float layerLr = baseLearningRate * lrScaling * Mathf.Lerp(fineTuningDecayFactor, 1.0f, depthRatio);
                    layerLearningRates[i] = layerFreezeMask[i] ? 0.0f : layerLr;
                    OnLayerFreezeStateChanged?.Invoke(i, layerFreezeMask[i]);
                }
            }

            var profile = new BiomeTransferProfile
            {
                SourceBiomeId = sourceBiomeId,
                TargetBiomeId = targetBiomeId,
                DomainSimilarityScore = similarity,
                RecommendedLRScaling = lrScaling,
                FrozenLayerCount = layersToFreeze,
                SourceBiomeName = BiomeNames[sourceBiomeId],
                TargetBiomeName = BiomeNames[targetBiomeId]
            };

            OnTransferConfigured?.Invoke(profile);
            return profile;
        }

        /// <summary>
        /// Calculates Maximum Mean Discrepancy (MMD) domain distance penalty between source and target representations.
        /// </summary>
        public float ComputeDomainDiscrepancy(float[] sourceFeatures, float[] targetFeatures)
        {
            if (sourceFeatures == null || targetFeatures == null || sourceFeatures.Length == 0 || targetFeatures.Length == 0)
                return 0f;

            int n = Mathf.Min(sourceFeatures.Length, targetFeatures.Length);
            float sumSource = 0f;
            float sumTarget = 0f;

            for (int i = 0; i < n; i++)
            {
                sumSource += sourceFeatures[i];
                sumTarget += targetFeatures[i];
            }

            float meanSource = sumSource / n;
            float meanTarget = sumTarget / n;
            float meanDiff = meanSource - meanTarget;

            // RBF / Linear kernel discrepancy proxy
            return mmdRegularizationWeight * (meanDiff * meanDiff);
        }

        /// <summary>
        /// Checks if a specific layer is currently frozen.
        /// </summary>
        public bool IsLayerFrozen(int layerIndex)
        {
            if (layerIndex >= 0 && layerIndex < layerFreezeMask.Length)
            {
                return layerFreezeMask[layerIndex];
            }
            return false;
        }

        /// <summary>
        /// Gets the effective learning rate for a specific layer under the transfer schedule.
        /// </summary>
        public float GetLayerLearningRate(int layerIndex)
        {
            if (layerIndex >= 0 && layerIndex < layerLearningRates.Length)
            {
                return layerLearningRates[layerIndex];
            }
            return baseLearningRate;
        }

        /// <summary>
        /// Unfreezes a specific layer during progressive unfreezing.
        /// </summary>
        public void UnfreezeLayer(int layerIndex, float learningRate)
        {
            if (layerIndex >= 0 && layerIndex < layerFreezeMask.Length)
            {
                layerFreezeMask[layerIndex] = false;
                layerLearningRates[layerIndex] = learningRate;
                OnLayerFreezeStateChanged?.Invoke(layerIndex, false);
            }
        }

        private void ApplyFreezingPolicy()
        {
            for (int i = 0; i < totalLayers; i++)
            {
                switch (freezePolicy)
                {
                    case LayerFreezePolicy.None:
                        layerFreezeMask[i] = false;
                        layerLearningRates[i] = baseLearningRate;
                        break;
                    case LayerFreezePolicy.HeadOnly:
                        layerFreezeMask[i] = (i < totalLayers - 1);
                        layerLearningRates[i] = layerFreezeMask[i] ? 0f : baseLearningRate;
                        break;
                    case LayerFreezePolicy.FeatureExtractor:
                        layerFreezeMask[i] = (i < totalLayers / 2);
                        layerLearningRates[i] = layerFreezeMask[i] ? 0f : baseLearningRate * fineTuningDecayFactor;
                        break;
                    default:
                        layerFreezeMask[i] = false;
                        layerLearningRates[i] = baseLearningRate;
                        break;
                }
            }
        }
    }
}
