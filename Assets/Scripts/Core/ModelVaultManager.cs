using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using NeuroArena.Data;

namespace NeuroArena.Core
{
    /// <summary>
    /// Model Vault & Archive Manager.
    /// Automatically persists every successfully trained boss model to disk.
    /// Provides query APIs for 'My Models' gallery and Stage 29 chat interrogation.
    /// </summary>
    public class ModelVaultManager : MonoBehaviour
    {
        public static ModelVaultManager Instance { get; private set; }

        private const string VAULT_PREFS_KEY = "neuroarena_trained_models_vault";
        [SerializeField] private List<TrainedModelRecord> archivedModels = new List<TrainedModelRecord>();

        public IReadOnlyList<TrainedModelRecord> ArchivedModels => archivedModels;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            LoadVault();
        }

        public void LoadVault()
        {
            archivedModels.Clear();
            if (PlayerPrefs.HasKey(VAULT_PREFS_KEY))
            {
                try
                {
                    string json = PlayerPrefs.GetString(VAULT_PREFS_KEY);
                    var col = JsonUtility.FromJson<ModelVaultCollection>(json);
                    if (col != null && col.models != null)
                    {
                        archivedModels.AddRange(col.models);
                    }
                }
                catch (Exception ex)
                {
                    Debug.LogWarning($"[ModelVault] Failed to parse model vault: {ex.Message}");
                }
            }
        }

        public void SaveVault()
        {
            var col = new ModelVaultCollection { models = archivedModels.ToArray() };
            string json = JsonUtility.ToJson(col);
            PlayerPrefs.SetString(VAULT_PREFS_KEY, json);
            PlayerPrefs.Save();
        }

        public void ArchiveModel(
            string modelName,
            int biomeIndex,
            string biomeName,
            string architecture,
            string parameterSummary,
            float[] lossCurve,
            float finalLoss,
            float testAccuracy,
            string seed,
            string bossTitle)
        {
            var record = new TrainedModelRecord
            {
                modelName = string.IsNullOrEmpty(modelName) ? $"Model-{archivedModels.Count + 1}" : modelName,
                biomeIndex = biomeIndex,
                biomeName = biomeName,
                architecture = architecture,
                parameterSummary = parameterSummary,
                lossCurveHistory = lossCurve ?? new float[] { finalLoss },
                finalLoss = finalLoss,
                testAccuracy = testAccuracy,
                playthroughSeed = seed,
                bossDefeatedTitle = bossTitle
            };

            archivedModels.Insert(0, record); // Most recent first
            SaveVault();
            Debug.Log($"[ModelVault] Successfully archived model #{record.modelId} ({record.modelName}) for Biome {biomeIndex}!");
        }

        public TrainedModelRecord GetModelById(string id)
        {
            return archivedModels.Find(m => m.modelId == id);
        }
    }
}
