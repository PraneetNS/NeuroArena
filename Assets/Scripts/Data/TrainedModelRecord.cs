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

        // --- STAGE 29 CONSULT/INTERROGATE & EMPIRICAL DISTRIBUTION STATS ---
        public float minX = -4.5f;
        public float maxX = 4.5f;
        public float minY = -10.0f;
        public float maxY = 12.0f;
        public float meanX = 0.0f;
        public float stdDevX = 2.5f;
        public float meanY = 1.15f;
        public float stdDevY = 6.2f;

        // Model weights for genuine mathematical inference
        public float weightW = 2.45f;
        public float weightB = 1.15f;
        public float[] polyWeights = new float[] { 1.15f, 2.45f, 0.5f };
        public float[][] layerW1;
        public float[] layerB1;
        public float[] layerW2;
        public float layerB2;

        // Stored sample points for nearest-neighbor distance calculation
        public float[] trainingX = new float[0];
        public float[] trainingY = new float[0];
        public int[] trainingClass = new int[0];

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
