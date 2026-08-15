using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.Data
{
    [Serializable]
    public struct BiomeSeedProfile
    {
        public string seedString;
        public int seedHash;
        public float noiseLevel;       // Gaussian sigma in [0.05, 0.55]
        public float classOverlap;      // Cluster overlap margin in [0.0, 0.40]
        public float outlierRate;       // Heavy-tailed anomalous outliers in [0%, 15%]
        public float featureScaleX;     // Anisotropy scale for X1
        public float featureScaleY;     // Anisotropy scale for X2
        public float trueW;             // True ground truth slope
        public float trueB;             // True ground truth bias

        public string GetTelemetrySummary()
        {
            return $"SEED: #{seedString} | Noise σ={noiseLevel:F2} | Outliers={outlierRate * 100f:0}% | Overlap ρ={classOverlap:F2} | Scale=({featureScaleX:F1}x, {featureScaleY:F1}x)";
        }
    }

    /// <summary>
    /// Deterministic pseudo-random number generator and procedural dataset factory.
    /// Replaces static datasets with reproducible runs parameterized by shareable seeds.
    /// </summary>
    public class ProceduralDataGenerator : MonoBehaviour
    {
        public static ProceduralDataGenerator Instance { get; private set; }

        [Header("Active Playthrough Seed")]
        [SerializeField] private string activeSeed = "NEURO-8842";
        private BiomeSeedProfile currentProfile;
        private System.Random rng;

        public BiomeSeedProfile CurrentProfile => currentProfile;
        public string ActiveSeed => activeSeed;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            InitializeWithSeed(string.IsNullOrEmpty(activeSeed) ? GenerateRandomSeedString() : activeSeed);
        }

        public static string GenerateRandomSeedString()
        {
            string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
            char[] stringChars = new char[8];
            System.Random r = new System.Random();
            for (int i = 0; i < stringChars.Length; i++)
            {
                if (i == 4) stringChars[i] = '-';
                else stringChars[i] = chars[r.Next(chars.Length)];
            }
            return new string(stringChars);
        }

        public void InitializeWithSeed(string seedStr)
        {
            activeSeed = string.IsNullOrEmpty(seedStr) ? "NEURO-8842" : seedStr.Trim().ToUpper();
            int seedHash = GetDeterministicHashCode(activeSeed);
            rng = new System.Random(seedHash);

            // Compute playthrough characteristics
            float noise = (float)NextDouble(0.08, 0.48);
            float overlap = (float)NextDouble(0.05, 0.35);
            float outliers = (float)NextDouble(0.02, 0.12);
            float scaleX = (float)NextDouble(0.8, 2.5);
            float scaleY = (float)NextDouble(0.8, 2.5);
            float trueW = (float)NextDouble(-3.5, 3.5);
            if (Mathf.Abs(trueW) < 0.8f) trueW = 2.45f;
            float trueB = (float)NextDouble(-4.0, 4.0);

            currentProfile = new BiomeSeedProfile
            {
                seedString = activeSeed,
                seedHash = seedHash,
                noiseLevel = noise,
                classOverlap = overlap,
                outlierRate = outliers,
                featureScaleX = scaleX,
                featureScaleY = scaleY,
                trueW = trueW,
                trueB = trueB
            };

            Debug.Log($"[ProceduralDataGenerator] Initialized with {currentProfile.GetTelemetrySummary()}");
        }

        public double NextDouble(double min, double max)
        {
            return min + (rng.NextDouble() * (max - min));
        }

        public float NextGaussian(float mean, float standardDeviation)
        {
            // Box-Muller transform
            double u1 = 1.0 - rng.NextDouble();
            double u2 = 1.0 - rng.NextDouble();
            double randStdNormal = Math.Sqrt(-2.0 * Math.Log(u1)) * Math.Sin(2.0 * Math.PI * u2);
            return mean + standardDeviation * (float)randStdNormal;
        }

        private int GetDeterministicHashCode(string str)
        {
            unchecked
            {
                int hash1 = (5381 << 16) + 5381;
                int hash2 = hash1;
                for (int i = 0; i < str.Length; i += 2)
                {
                    hash1 = ((hash1 << 5) + hash1) ^ str[i];
                    if (i + 1 < str.Length) hash2 = ((hash2 << 5) + hash2) ^ str[i + 1];
                }
                return hash1 + (hash2 * 1566083941);
            }
        }

        // --- BIOME 1: SEEDED LINEAR REGRESSION ---
        public List<DataPoint> GenerateLinearDataset(int count = 24)
        {
            var list = new List<DataPoint>(count);
            for (int i = 0; i < count; i++)
            {
                float x = (float)NextDouble(-5.0, 5.0) * currentProfile.featureScaleX;
                float noise = NextGaussian(0f, currentProfile.noiseLevel * 3.5f);
                float y = currentProfile.trueW * x + currentProfile.trueB + noise;

                // Outlier injection
                if (rng.NextDouble() < currentProfile.outlierRate)
                {
                    y += (rng.NextDouble() > 0.5 ? 1 : -1) * (float)NextDouble(8.0, 18.0);
                }

                list.Add(new DataPoint(x, y, 0.01f));
            }
            return list;
        }

        // --- BIOME 2: SEEDED LOGISTIC CLASSIFICATION ---
        public List<ClassificationSample> GenerateLogisticDataset(int count = 20)
        {
            var list = new List<ClassificationSample>(count);
            for (int i = 0; i < count; i++)
            {
                bool isClass1 = (i % 2 == 1);
                float centerOffset = isClass1 ? 2.5f : -2.5f;

                // Apply class overlap parameter
                float jitter = (float)NextDouble(-2.0, 2.0) * (1f + currentProfile.classOverlap * 2f);
                float x1 = (centerOffset + jitter) * currentProfile.featureScaleX;
                float x2 = (centerOffset + (float)NextDouble(-2.0, 2.0)) * currentProfile.featureScaleY;

                list.Add(new ClassificationSample(x1, x2, isClass1 ? 1f : 0f));
            }
            return list;
        }

        // --- BIOME 5: SEEDED NON-LINEAR XOR QUADRUPLETS ---
        public (float[][], int[]) GenerateXORDataset(int count = 28)
        {
            float[][] X = new float[count][];
            int[] Y = new int[count];

            for (int i = 0; i < count; i++)
            {
                int corner = i % 4;
                float bx = (corner == 0 || corner == 3) ? -2.4f : 2.4f;
                float by = (corner == 0 || corner == 1) ? -2.4f : 2.4f;
                int target = (corner == 0 || corner == 2) ? 0 : 1;

                float x1 = (bx + NextGaussian(0f, currentProfile.noiseLevel * 1.5f)) * currentProfile.featureScaleX;
                float x2 = (by + NextGaussian(0f, currentProfile.noiseLevel * 1.5f)) * currentProfile.featureScaleY;

                X[i] = new float[] { x1, x2 };
                Y[i] = target;
            }

            return (X, Y);
        }
    }
}
