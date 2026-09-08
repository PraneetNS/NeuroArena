using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.Core
{
    [Serializable]
    public class BossMoveSetVariant
    {
        public string variantId;
        public string variantName;
        public string description;
        public string specialMove;
        public float hazardRadius;
    }

    [Serializable]
    public class BossStatVariant
    {
        public string bossId;
        public string bossName;
        public int maxHp;
        public int attackDamage;
        public int enrageTimerSec;
        public BossMoveSetVariant selectedMoveSet;
    }

    [Serializable]
    public class TerrainLayoutVariant
    {
        public float domainRadius = 40.0f;
        public float densityMultiplier = 1.0f;
        public float minScatterDistance = 5.0f;
        public int poissonSeed = 1337;
        public int landmarkRotationDegrees = 0;
    }

    [Serializable]
    public class LinearDatasetVariant
    {
        public float trueSlopeW;
        public float trueInterceptB;
        public float noiseSigma;
        public float outlierRate;
        public float targetMseThreshold;
        public bool isCertifiedSolvable;
    }

    [Serializable]
    public class BiomeVariantResult
    {
        public string seed;
        public int biomeIndex;
        public string biomeName;
        public BossStatVariant bossVariant;
        public TerrainLayoutVariant terrainVariant;
        public LinearDatasetVariant linearDataset;
    }

    /// <summary>
    /// Deterministic Procedural Biome Variant Generator for Unity C#.
    /// Matches the backend Mulberry32 PRNG and difficulty envelopes bit-for-bit.
    /// </summary>
    public static class ProceduralBiomeVariantGenerator
    {
        public class FastMulberryPRNG
        {
            private uint state;

            public FastMulberryPRNG(string seedStr)
            {
                int hash = 0;
                string s = (seedStr ?? "NEURO-8842").ToUpper().Trim();
                for (int i = 0; i < s.Length; i++)
                {
                    hash = ((hash << 5) - hash) + s[i];
                }
                state = (uint)(Math.Abs(hash) == 0 ? 1337 : Math.Abs(hash));
            }

            public float Next()
            {
                state += 0x6D2B79F5;
                uint z = state;
                z = (z ^ (z >> 15)) * (z | 1U);
                z ^= z + (z ^ (z >> 7)) * (z | 61U);
                return (float)((z ^ (z >> 14)) / 4294967296.0);
            }

            public float Range(float min, float max)
            {
                return min + Next() * (max - min);
            }

            public int Int(int min, int max)
            {
                return Mathf.FloorToInt(Range(min, max + 1));
            }
        }

        public static string GetDailySeed(DateTime utcNow)
        {
            return $"DAILY-{utcNow.Year:D4}{utcNow.Month:D2}{utcNow.Day:D2}";
        }

        public static BiomeVariantResult Generate(int biomeIndex, string seedStr)
        {
            int safeBiome = Mathf.Clamp(biomeIndex, 0, 5);
            FastMulberryPRNG prng = new FastMulberryPRNG($"{seedStr}_B{safeBiome}");

            // 1. Dataset parameters
            float sign = prng.Next() > 0.4f ? 1.0f : -1.0f;
            float slopeW = sign * prng.Range(1.2f, 3.5f);
            float interceptB = prng.Range(-2.5f, 2.5f);
            float noise = prng.Range(0.06f, 0.18f);
            float outlier = prng.Range(0.02f, 0.06f);

            var linearData = new LinearDatasetVariant
            {
                trueSlopeW = slopeW,
                trueInterceptB = interceptB,
                noiseSigma = noise,
                outlierRate = outlier,
                targetMseThreshold = 0.08f,
                isCertifiedSolvable = true
            };

            // 2. Boss variants
            var boss = GenerateBossVariant(safeBiome, prng);

            // 3. Terrain layout
            var terrain = new TerrainLayoutVariant
            {
                domainRadius = 40.0f,
                densityMultiplier = prng.Range(0.85f, 1.25f),
                minScatterDistance = prng.Range(4.8f, 6.2f),
                poissonSeed = prng.Int(1000, 999999),
                landmarkRotationDegrees = prng.Int(0, 359)
            };

            return new BiomeVariantResult
            {
                seed = seedStr,
                biomeIndex = safeBiome,
                biomeName = GetBiomeName(safeBiome),
                bossVariant = boss,
                terrainVariant = terrain,
                linearDataset = linearData
            };
        }

        private static string GetBiomeName(int biomeIndex)
        {
            switch (biomeIndex)
            {
                case 0: return "The Linear Steppes";
                case 1: return "The Binary Marshlands";
                case 2: return "The Variance Tundra";
                case 3: return "The Branching Canopy";
                case 4: return "The Deep Synapse Citadel";
                case 5: default: return "The Semantic Expanse";
            }
        }

        private static BossStatVariant GenerateBossVariant(int biomeIndex, FastMulberryPRNG prng)
        {
            string[] names = { "The Outlier Titan", "The Hyperplane Hydra", "The Overfit Colossus", "The Dendrogram Dragon", "The Non-Linear Overlord", "The High-Dimensional Void" };
            string[] ids = { "outlier_titan", "hyperplane_hydra", "overfit_colossus", "dendrogram_dragon", "nonlinear_overlord", "high_dim_void" };
            int[] baseHps = { 500, 850, 1500, 1800, 2500, 3200 };
            int[] baseDamages = { 25, 40, 65, 75, 90, 110 };

            int moveIdx = prng.Int(0, 2);
            var moveSet = new BossMoveSetVariant
            {
                variantId = $"PATTERN_{moveIdx + 1}",
                variantName = $"Attack Pattern {moveIdx + 1}",
                description = "Procedurally modulated boss attack pattern",
                specialMove = $"Special Signature Move {moveIdx + 1}",
                hazardRadius = 4.0f + moveIdx * 1.0f
            };

            float hpDelta = prng.Range(-0.10f, 0.15f);
            float dmgDelta = prng.Range(-0.10f, 0.10f);

            return new BossStatVariant
            {
                bossId = ids[biomeIndex],
                bossName = names[biomeIndex],
                maxHp = Mathf.RoundToInt(baseHps[biomeIndex] * (1.0f + hpDelta)),
                attackDamage = Mathf.RoundToInt(baseDamages[biomeIndex] * (1.0f + dmgDelta)),
                enrageTimerSec = 90 + biomeIndex * 20,
                selectedMoveSet = moveSet
            };
        }
    }
}
