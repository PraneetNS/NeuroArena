using System;
using System.Collections.Generic;
using UnityEngine;
using NeuroArena.Data;

namespace NeuroArena.Core
{
    [System.Serializable]
    public class BiomeUnlockRequirement
    {
        public int biomeIndex;
        public string biomeName;
        public string conceptName;
        public string prerequisiteDescription;
        public float requiredMetricThreshold;
        public bool isLossMetric; // true if loss (must be <= threshold), false if accuracy/F1 (must be >= threshold)
    }

    /// <summary>
    /// Production Progression & Biome Gating Engine.
    /// Manages:
    /// - Strict mathematical gating requirements for unlocking Biomes 0 -> 5.
    /// - Player Level & Mastery XP curves.
    /// - Level-up milestone rewards and notifications.
    /// </summary>
    public class ProgressionManager : MonoBehaviour
    {
        public static ProgressionManager Instance { get; private set; }

        public event Action<int, string> OnBiomeUnlocked; // biomeIndex, biomeName
        public event Action<int, int> OnPlayerLevelUp; // newLevel, rewardComputeCredits

        [Header("Gating Criteria")]
        [SerializeField] private List<BiomeUnlockRequirement> unlockRequirements = new List<BiomeUnlockRequirement>();

        [Header("Player Mastery Stats")]
        [SerializeField] private int playerLevel = 1;
        [SerializeField] private int currentXp = 0;
        [SerializeField] private int xpToNextLevel = 500;

        public int PlayerLevel => playerLevel;
        public int CurrentXp => currentXp;
        public int XpToNextLevel => xpToNextLevel;

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
                InitializeRequirements();
            }
            else
            {
                Destroy(gameObject);
            }
        }

        private void InitializeRequirements()
        {
            unlockRequirements = new List<BiomeUnlockRequirement>
            {
                new BiomeUnlockRequirement { biomeIndex = 0, biomeName = "Linear Steppes", conceptName = "Linear Regression", prerequisiteDescription = "Initial starting zone.", requiredMetricThreshold = 0f, isLossMetric = true },
                new BiomeUnlockRequirement { biomeIndex = 1, biomeName = "Logistic Delta", conceptName = "Logistic Regression", prerequisiteDescription = "Linear Regression MSE <= 0.05", requiredMetricThreshold = 0.05f, isLossMetric = true },
                new BiomeUnlockRequirement { biomeIndex = 2, biomeName = "Forest of Splits", conceptName = "Decision Trees", prerequisiteDescription = "Logistic Accuracy >= 85%", requiredMetricThreshold = 0.85f, isLossMetric = false },
                new BiomeUnlockRequirement { biomeIndex = 3, biomeName = "Neural Archipelago", conceptName = "Neural Networks", prerequisiteDescription = "Decision Tree Gini Impurity <= 0.20", requiredMetricThreshold = 0.20f, isLossMetric = true },
                new BiomeUnlockRequirement { biomeIndex = 4, biomeName = "Hyperplane Dunes", conceptName = "SVM & Embeddings", prerequisiteDescription = "Neural Network Validation Loss <= 0.08", requiredMetricThreshold = 0.08f, isLossMetric = true },
                new BiomeUnlockRequirement { biomeIndex = 5, biomeName = "Semantic Expanse", conceptName = "Transformers & Attention", prerequisiteDescription = "Ensemble F1 Score >= 0.90", requiredMetricThreshold = 0.90f, isLossMetric = false }
            };
        }

        public BiomeUnlockRequirement GetRequirement(int biomeIndex)
        {
            if (biomeIndex >= 0 && biomeIndex < unlockRequirements.Count)
            {
                return unlockRequirements[biomeIndex];
            }
            return null;
        }

        /// <summary>
        /// Evaluates if a player's trained model performance satisfies the gating threshold to unlock a biome.
        /// </summary>
        public bool CheckAndUnlockBiome(int biomeIndex, float achievedMetric)
        {
            if (biomeIndex <= 0 || biomeIndex >= unlockRequirements.Count) return true;

            BiomeUnlockRequirement req = unlockRequirements[biomeIndex];
            bool passed = req.isLossMetric ? (achievedMetric <= req.requiredMetricThreshold) : (achievedMetric >= req.requiredMetricThreshold);

            if (passed)
            {
                if (SaveManager.Instance != null && SaveManager.Instance.CurrentSaveData != null)
                {
                    if (!SaveManager.Instance.CurrentSaveData.unlockedBiomes[biomeIndex])
                    {
                        SaveManager.Instance.CurrentSaveData.unlockedBiomes[biomeIndex] = true;
                        SaveManager.Instance.SaveGame();
                        Debug.Log($"[ProgressionManager] Unlocked Biome #{biomeIndex}: {req.biomeName}! Achieved metric: {achievedMetric}");
                        OnBiomeUnlocked?.Invoke(biomeIndex, req.biomeName);
                        AddMasteryXp(350);
                    }
                }
                return true;
            }

            Debug.Log($"[ProgressionManager] Biome #{biomeIndex} unlock failed: Metric {achievedMetric} does not meet threshold {req.requiredMetricThreshold}");
            return false;
        }

        /// <summary>
        /// Awards Mastery XP and handles level ups.
        /// </summary>
        public void AddMasteryXp(int amount)
        {
            currentXp += amount;
            while (currentXp >= xpToNextLevel)
            {
                currentXp -= xpToNextLevel;
                playerLevel++;
                xpToNextLevel = Mathf.RoundToInt(xpToNextLevel * 1.25f);
                int rewardCredits = playerLevel * 100;

                Debug.Log($"[ProgressionManager] LEVEL UP! Reached Level {playerLevel}. Awarded {rewardCredits} Compute Credits.");
                OnPlayerLevelUp?.Invoke(playerLevel, rewardCredits);
            }
        }
    }
}
