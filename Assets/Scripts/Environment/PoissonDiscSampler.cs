using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.Environment
{
    /// <summary>
    /// Fast 2D Poisson-Disc Sampling Engine (Bridson's Algorithm).
    /// Generates organically distributed point sets with guaranteed minimum distance 'r'
    /// to eliminate uniform grid look and artificial clustering.
    /// Supports deterministic world seeding, circular/rectangular boundaries, and exclusion zones.
    /// </summary>
    public static class PoissonDiscSampler
    {
        public struct ExclusionZone
        {
            public Vector2 center;
            public float radius;

            public ExclusionZone(Vector2 center, float radius)
            {
                this.center = center;
                this.radius = radius;
            }

            public bool Contains(Vector2 point)
            {
                return (point - center).sqrMagnitude < (radius * radius);
            }
        }

        /// <summary>
        /// Generates a list of 2D coordinates within a bounding circle using Bridson's algorithm.
        /// </summary>
        /// <param name="minDistance">Minimum distance 'r' between any two points.</param>
        /// <param name="domainRadius">Max radial distance from origin (0,0).</param>
        /// <param name="seed">Deterministic seed integer.</param>
        /// <param name="exclusionZones">Zones where points cannot be placed (landmarks, spawns, etc.).</param>
        /// <param name="existingObstacles">Existing points to avoid (for hierarchical multi-layer scatter).</param>
        /// <param name="obstacleClearance">Minimum distance required from existing obstacles.</param>
        /// <param name="k">Number of candidates to generate per active sample (default 30).</param>
        /// <param name="maxPoints">Safety cap on maximum points generated.</param>
        public static List<Vector2> SampleRadial(
            float minDistance,
            float domainRadius,
            int seed,
            List<ExclusionZone> exclusionZones = null,
            List<Vector2> existingObstacles = null,
            float obstacleClearance = 0f,
            int k = 30,
            int maxPoints = 500)
        {
            if (minDistance <= 0.01f || domainRadius <= 0.01f)
                return new List<Vector2>();

            System.Random prng = new System.Random(seed);
            List<Vector2> samples = new List<Vector2>();
            List<Vector2> activeList = new List<Vector2>();

            float cellSize = minDistance / 1.41421356f; // r / sqrt(2)
            float totalWidth = domainRadius * 2f;
            int gridWidth = Mathf.CeilToInt(totalWidth / cellSize) + 1;
            int gridHeight = gridWidth;
            int[,] grid = new int[gridWidth, gridHeight];

            // Initialize grid with -1 (empty)
            for (int x = 0; x < gridWidth; x++)
            {
                for (int y = 0; y < gridHeight; y++)
                {
                    grid[x, y] = -1;
                }
            }

            Vector2 ToGridCoords(Vector2 worldPos)
            {
                float gx = (worldPos.x + domainRadius) / cellSize;
                float gy = (worldPos.y + domainRadius) / cellSize;
                return new Vector2(gx, gy);
            }

            bool IsValidCandidate(Vector2 candidate)
            {
                // 1. Radial boundary check
                if (candidate.magnitude > domainRadius)
                    return false;

                // 2. Exclusion zones check
                if (exclusionZones != null)
                {
                    for (int i = 0; i < exclusionZones.Count; i++)
                    {
                        if (exclusionZones[i].Contains(candidate))
                            return false;
                    }
                }

                // 3. Existing obstacle points check (hierarchical scatter)
                if (existingObstacles != null && obstacleClearance > 0.01f)
                {
                    float sqrObstacleDist = obstacleClearance * obstacleClearance;
                    for (int i = 0; i < existingObstacles.Count; i++)
                    {
                        if ((candidate - existingObstacles[i]).sqrMagnitude < sqrObstacleDist)
                            return false;
                    }
                }

                // 4. Neighbor check in Poisson acceleration grid
                Vector2 g = ToGridCoords(candidate);
                int cellX = Mathf.FloorToInt(g.x);
                int cellY = Mathf.FloorToInt(g.y);

                if (cellX < 0 || cellX >= gridWidth || cellY < 0 || cellY >= gridHeight)
                    return false;

                int searchStartX = Mathf.Max(0, cellX - 2);
                int searchEndX = Mathf.Min(gridWidth - 1, cellX + 2);
                int searchStartY = Mathf.Max(0, cellY - 2);
                int searchEndY = Mathf.Min(gridHeight - 1, cellY + 2);

                float sqrMinDist = minDistance * minDistance;

                for (int x = searchStartX; x <= searchEndX; x++)
                {
                    for (int y = searchStartY; y <= searchEndY; y++)
                    {
                        int sampleIndex = grid[x, y];
                        if (sampleIndex != -1)
                        {
                            Vector2 existingPt = samples[sampleIndex];
                            if ((candidate - existingPt).sqrMagnitude < sqrMinDist)
                            {
                                return false;
                            }
                        }
                    }
                }

                return true;
            }

            void AddSample(Vector2 pt)
            {
                int idx = samples.Count;
                samples.Add(pt);
                activeList.Add(pt);

                Vector2 g = ToGridCoords(pt);
                int cx = Mathf.Clamp(Mathf.FloorToInt(g.x), 0, gridWidth - 1);
                int cy = Mathf.Clamp(Mathf.FloorToInt(g.y), 0, gridHeight - 1);
                grid[cx, cy] = idx;
            }

            // Find initial seed point not in exclusion zones
            int initialAttempts = 100;
            bool initialFound = false;
            for (int a = 0; a < initialAttempts; a++)
            {
                float angle = (float)(prng.NextDouble() * Math.PI * 2.0);
                float dist = (float)(Math.Sqrt(prng.NextDouble()) * domainRadius * 0.85f);
                Vector2 initialCandidate = new Vector2(Mathf.Cos(angle) * dist, Mathf.Sin(angle) * dist);

                if (IsValidCandidate(initialCandidate))
                {
                    AddSample(initialCandidate);
                    initialFound = true;
                    break;
                }
            }

            if (!initialFound)
            {
                return samples;
            }

            // Bridson active list expansion
            while (activeList.Count > 0 && samples.Count < maxPoints)
            {
                int activeIndex = prng.Next(activeList.Count);
                Vector2 activePoint = activeList[activeIndex];
                bool candidateAccepted = false;

                for (int i = 0; i < k; i++)
                {
                    float angle = (float)(prng.NextDouble() * Math.PI * 2.0);
                    // Radius between r and 2r
                    float radius = minDistance * (1.0f + (float)prng.NextDouble());
                    Vector2 candidate = activePoint + new Vector2(Mathf.Cos(angle) * radius, Mathf.Sin(angle) * radius);

                    if (IsValidCandidate(candidate))
                    {
                        AddSample(candidate);
                        candidateAccepted = true;
                        if (samples.Count >= maxPoints) break;
                    }
                }

                if (!candidateAccepted)
                {
                    // Remove from active list
                    int last = activeList.Count - 1;
                    activeList[activeIndex] = activeList[last];
                    activeList.RemoveAt(last);
                }
            }

            return samples;
        }

        /// <summary>
        /// Converts a string playthrough seed (e.g. "NEURO-8842") and a biome salt into a deterministic integer seed.
        /// </summary>
        public static int HashSeed(string playthroughSeed, int biomeIndex, int layerOffset = 0)
        {
            if (string.IsNullOrEmpty(playthroughSeed))
            {
                playthroughSeed = "STAGE13_WORLD_SEED";
            }

            unchecked
            {
                int hash = 17;
                for (int i = 0; i < playthroughSeed.Length; i++)
                {
                    hash = hash * 31 + playthroughSeed[i];
                }
                hash = hash * 397 ^ (biomeIndex * 7919);
                hash = hash * 397 ^ (layerOffset * 104729);
                return Math.Abs(hash);
            }
        }
    }
}
