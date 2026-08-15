using System;
using UnityEngine;

namespace NeuroArena.Data
{
    /// <summary>
    /// Schema Migration Pipeline.
    /// Safely upgrades legacy save files (v1 -> v2 -> v3) without corruption or data loss.
    /// </summary>
    public static class SaveMigrationManager
    {
        [Serializable]
        private class VersionProbe
        {
            public int saveVersion = 1;
        }

        public static GameSaveData MigrateJsonIfNeeded(string json)
        {
            if (string.IsNullOrEmpty(json))
            {
                return GameSaveData.CreateNew();
            }

            int detectedVersion = 1;
            try
            {
                var probe = JsonUtility.FromJson<VersionProbe>(json);
                if (probe != null) detectedVersion = probe.saveVersion;
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[SaveMigration] Error probing save version: {ex.Message}. Assuming v1.");
            }

            Debug.Log($"[SaveMigration] Detected Save Version: v{detectedVersion} (Target: v{GameSaveData.CURRENT_SAVE_VERSION})");

            GameSaveData data = GameSaveData.FromJson(json);

            // Sequential Migration Steps
            if (detectedVersion < 2)
            {
                data = MigrateV1ToV2(data);
            }
            if (detectedVersion < 3)
            {
                data = MigrateV2ToV3(data);
            }

            data.saveVersion = GameSaveData.CURRENT_SAVE_VERSION;
            return data;
        }

        private static GameSaveData MigrateV1ToV2(GameSaveData oldData)
        {
            Debug.Log("[SaveMigration] Migrating save from v1 to v2 (Expanding Biome arrays & Seeds)...");
            if (oldData.unlockedBiomes == null || oldData.unlockedBiomes.Length < 6)
            {
                bool[] newBiomes = new bool[6] { true, false, false, false, false, false };
                if (oldData.unlockedBiomes != null)
                {
                    for (int i = 0; i < Mathf.Min(oldData.unlockedBiomes.Length, 6); i++)
                    {
                        newBiomes[i] = oldData.unlockedBiomes[i];
                    }
                }
                oldData.unlockedBiomes = newBiomes;
            }

            if (string.IsNullOrEmpty(oldData.playthroughSeed))
            {
                oldData.playthroughSeed = "NEURO-8842";
            }
            return oldData;
        }

        private static GameSaveData MigrateV2ToV3(GameSaveData oldData)
        {
            Debug.Log("[SaveMigration] Migrating save from v2 to v3 (Adding Calibration status and Active Configs)...");
            if (oldData.activeModelConfig == null)
            {
                oldData.activeModelConfig = ModelConfig.DefaultLinearRegression;
            }
            if (oldData.biome1Config == null)
            {
                oldData.biome1Config = ModelConfig.DefaultLinearRegression;
            }
            return oldData;
        }
    }
}
