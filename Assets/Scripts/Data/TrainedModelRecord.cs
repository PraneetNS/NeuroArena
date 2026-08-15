using System;
using UnityEngine;

namespace NeuroArena.Data
{
    /// <summary>
    /// Persistent Trained Model Record.
    /// Stores the architecture, final weights, loss curve snapshot, accuracy, and seed of every model that passed a boss.
    /// Foundation for the 'My Models' gallery and Stage 29 Model Chat/Interrogate system.
    /// </summary>
    [Serializable]
    public class TrainedModelRecord
    {
        public string modelId;
        public string modelName;
        public int biomeIndex;
        public string biomeName;
        public string architecture;
        public string parameterSummary;
        public float[] lossCurveHistory;
        public float finalLoss;
        public float testAccuracy;
        public string playthroughSeed;
        public string timestamp;
        public string bossDefeatedTitle;

        public TrainedModelRecord()
        {
            modelId = Guid.NewGuid().ToString().Substring(0, 8);
            timestamp = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");
        }
    }

    [Serializable]
    public class ModelVaultCollection
    {
        public TrainedModelRecord[] models = new TrainedModelRecord[0];
    }
}
