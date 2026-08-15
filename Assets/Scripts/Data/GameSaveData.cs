using System;
using UnityEngine;

namespace NeuroArena.Data
{
    /// <summary>
    /// Root offline serializable game state container (Version 3 Schema).
    /// Stores unlocked biomes, player inventory, model hyperparameters,
    /// and the playthrough seed for procedural dataset reproducibility.
    /// </summary>
    [Serializable]
    public class GameSaveData
    {
        public const int CURRENT_SAVE_VERSION = 3;

        public int saveVersion = CURRENT_SAVE_VERSION;
        public string saveTimestamp;
        public string playthroughSeed = "NEURO-8842";

        // Biome Progression (6 Biomes)
        public int currentBiomeIndex = 0;
        public bool[] unlockedBiomes = new bool[6] { true, false, false, false, false, false };

        // Player Position & Calibration
        public float playerPosX = 0f;
        public float playerPosY = 1.2f;
        public float playerPosZ = 0f;
        public float playerRotY = 0f;
        public bool isBiomeCalibrated = false;

        // Resource Counts
        public int featureCrystalXCount = 0;
        public int targetShardYCount = 0;
        public int pairedDataPointCount = 0;
        public int weightWCount = 0;
        public int biasBCount = 0;
        public int learningRateAlphaCount = 0;
        public int class0SporeCount = 0;
        public int class1SporeCount = 0;

        // Model Configurations per Biome
        public ModelConfig biome1Config = ModelConfig.DefaultLinearRegression;
        public ModelConfig activeModelConfig = ModelConfig.DefaultLinearRegression;

        public GameSaveData()
        {
            saveTimestamp = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");
        }

        public static GameSaveData CreateNew()
        {
            return new GameSaveData();
        }

        public string ToJson()
        {
            return JsonUtility.ToJson(this, true);
        }

        public static GameSaveData FromJson(string json)
        {
            if (string.IsNullOrEmpty(json)) return CreateNew();
            return JsonUtility.FromJson<GameSaveData>(json) ?? CreateNew();
        }
    }
}
