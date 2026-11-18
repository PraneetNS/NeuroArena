#if UNITY_EDITOR
using System.Collections.Generic;
using NUnit.Framework;
using UnityEngine;
using NeuroArena.Environment;

namespace NeuroArena.Tests
{
    [TestFixture]
    public class BiomeProceduralScatterTests
    {
        [Test]
        public void TestPoissonDiscMinimumDistanceConstraint()
        {
            float minDistance = 5.0f;
            float domainRadius = 35.0f;
            int seed = 42;

            List<Vector2> points = PoissonDiscSampler.SampleRadial(
                minDistance: minDistance,
                domainRadius: domainRadius,
                seed: seed,
                maxPoints: 100
            );

            Assert.Greater(points.Count, 5, "Poisson sampler must generate a reasonable number of points.");

            // Verify minimum distance constraint between all generated point pairs
            float sqrMinDist = (minDistance - 0.001f) * (minDistance - 0.001f);
            for (int i = 0; i < points.Count; i++)
            {
                for (int j = i + 1; j < points.Count; j++)
                {
                    float sqrDist = (points[i] - points[j]).sqrMagnitude;
                    Assert.GreaterOrEqual(sqrDist, sqrMinDist,
                        $"Points {i} and {j} violate Poisson min distance constraint: dist={Mathf.Sqrt(sqrDist):F3} < min={minDistance:F3}");
                }
            }
        }

        [Test]
        public void TestPoissonDiscSeededDeterminism()
        {
            string worldSeed = "NEURO-8842";
            int seed1 = PoissonDiscSampler.HashSeed(worldSeed, biomeIndex: 0, layerOffset: 101);
            int seed2 = PoissonDiscSampler.HashSeed(worldSeed, biomeIndex: 0, layerOffset: 101);

            List<Vector2> run1 = PoissonDiscSampler.SampleRadial(6.0f, 40.0f, seed1);
            List<Vector2> run2 = PoissonDiscSampler.SampleRadial(6.0f, 40.0f, seed2);

            Assert.AreEqual(run1.Count, run2.Count, "Identical seeds must produce identical point counts.");

            for (int i = 0; i < run1.Count; i++)
            {
                Assert.AreEqual(run1[i].x, run2[i].x, 0.0001f, $"Sample {i}.x must match deterministically across runs.");
                Assert.AreEqual(run1[i].y, run2[i].y, 0.0001f, $"Sample {i}.y must match deterministically across runs.");
            }

            // Different seed produces different distribution
            int differentSeed = PoissonDiscSampler.HashSeed("DIFFERENT_SEED_99", biomeIndex: 0, layerOffset: 101);
            List<Vector2> runDifferent = PoissonDiscSampler.SampleRadial(6.0f, 40.0f, differentSeed);

            bool hasVariation = false;
            int checkCount = Mathf.Min(run1.Count, runDifferent.Count);
            for (int i = 0; i < checkCount; i++)
            {
                if ((run1[i] - runDifferent[i]).sqrMagnitude > 0.01f)
                {
                    hasVariation = true;
                    break;
                }
            }
            Assert.IsTrue(hasVariation, "Different seeds must produce different sample distributions.");
        }

        [Test]
        public void TestPoissonDiscExclusionZones()
        {
            float domainRadius = 40.0f;
            Vector2 playerSpawn = Vector2.zero;
            float spawnRadius = 8.0f;

            Vector2 labStation = new Vector2(14f, 14f);
            float labRadius = 6.5f;

            Vector2 landmarkPos = new Vector2(-20f, 20f);
            float landmarkRadius = 7.0f;

            List<PoissonDiscSampler.ExclusionZone> exclusions = new List<PoissonDiscSampler.ExclusionZone>
            {
                new PoissonDiscSampler.ExclusionZone(playerSpawn, spawnRadius),
                new PoissonDiscSampler.ExclusionZone(labStation, labRadius),
                new PoissonDiscSampler.ExclusionZone(landmarkPos, landmarkRadius)
            };

            List<Vector2> samples = PoissonDiscSampler.SampleRadial(
                minDistance: 4.0f,
                domainRadius: domainRadius,
                seed: 12345,
                exclusionZones: exclusions,
                maxPoints: 150
            );

            Assert.Greater(samples.Count, 10, "Should generate points outside exclusion zones.");

            for (int i = 0; i < samples.Count; i++)
            {
                Vector2 pt = samples[i];
                Assert.GreaterOrEqual((pt - playerSpawn).magnitude, spawnRadius,
                    $"Sample {i} at {pt} is inside player spawn exclusion zone!");
                Assert.GreaterOrEqual((pt - labStation).magnitude, labRadius,
                    $"Sample {i} at {pt} is inside lab station exclusion zone!");
                Assert.GreaterOrEqual((pt - landmarkPos).magnitude, landmarkRadius,
                    $"Sample {i} at {pt} is inside landmark exclusion zone!");
            }
        }

        [Test]
        public void TestHierarchicalObstacleAvoidance()
        {
            float domainRadius = 35.0f;
            int treeSeed = 777;
            List<Vector2> trees = PoissonDiscSampler.SampleRadial(minDistance: 7.0f, domainRadius: domainRadius, seed: treeSeed, maxPoints: 20);

            float clearance = 2.5f;
            int rockSeed = 888;
            List<Vector2> rocks = PoissonDiscSampler.SampleRadial(
                minDistance: 4.5f,
                domainRadius: domainRadius,
                seed: rockSeed,
                existingObstacles: trees,
                obstacleClearance: clearance,
                maxPoints: 30
            );

            Assert.Greater(rocks.Count, 5, "Secondary layer must successfully generate samples.");

            float sqrClearance = (clearance - 0.001f) * (clearance - 0.001f);
            for (int r = 0; r < rocks.Count; r++)
            {
                for (int t = 0; t < trees.Count; t++)
                {
                    float sqrDist = (rocks[r] - trees[t]).sqrMagnitude;
                    Assert.GreaterOrEqual(sqrDist, sqrClearance,
                        $"Rock {r} at {rocks[r]} is too close to Tree {t} at {trees[t]} (dist={Mathf.Sqrt(sqrDist):F3} < {clearance:F3})");
                }
            }
        }

        [Test]
        public void TestBiomeScatterConfigPresetsForAllSixBiomes()
        {
            for (int biomeIdx = 0; biomeIdx < 6; biomeIdx++)
            {
                BiomeScatterConfig config = BiomeScatterConfig.GetPreset(biomeIdx);
                Assert.IsNotNull(config, $"Biome {biomeIdx} preset must not be null.");
                Assert.IsFalse(string.IsNullOrEmpty(config.biomeName), $"Biome {biomeIdx} must have a valid name.");

                // Validate layer constraints
                Assert.Greater(config.treeLayer.minDistance, 2.0f, $"Biome {biomeIdx} tree minDistance must be > 2.0");
                Assert.Greater(config.treeLayer.maxCount, 10, $"Biome {biomeIdx} tree maxCount must be > 10");

                Assert.Greater(config.rockLayer.minDistance, 1.5f, $"Biome {biomeIdx} rock minDistance must be > 1.5");
                Assert.Greater(config.rockLayer.maxCount, 10, $"Biome {biomeIdx} rock maxCount must be > 10");

                Assert.Greater(config.clutterLayer.minDistance, 1.0f, $"Biome {biomeIdx} clutter minDistance must be > 1.0");
                Assert.Greater(config.clutterLayer.maxCount, 20, $"Biome {biomeIdx} clutter maxCount must be > 20");

                // Validate distinct palettes
                Assert.AreNotEqual(Color.clear, config.foliageColor, $"Biome {biomeIdx} foliage color must not be clear.");
                Assert.AreNotEqual(Color.clear, config.rockColor, $"Biome {biomeIdx} rock color must not be clear.");
            }
        }

        [Test]
        public void TestBiomeLandmarkPlacementsForAllSixBiomes()
        {
            for (int biomeIdx = 0; biomeIdx < 6; biomeIdx++)
            {
                List<BiomeLandmarkGenerator.LandmarkPlacement> landmarks = 
                    BiomeLandmarkGenerator.GetLandmarkPlacements(biomeIdx);

                Assert.AreEqual(3, landmarks.Count, $"Biome {biomeIdx + 1} must feature exactly 3 landmark templates (Ruin, Monolith, Outpost).");

                for (int i = 0; i < landmarks.Count; i++)
                {
                    BiomeLandmarkGenerator.LandmarkPlacement lm = landmarks[i];
                    Assert.IsFalse(string.IsNullOrEmpty(lm.name), $"Landmark {i} in biome {biomeIdx} must have a name.");
                    Assert.Greater(lm.exclusionRadius, 3.0f, $"Landmark {lm.name} must have a valid exclusion radius > 3.0m.");
                    Assert.Less(lm.localPos2D.magnitude, 45.0f, $"Landmark {lm.name} position must be within terrain bounds.");
                    Assert.IsNotNull(lm.buildAction, $"Landmark {lm.name} must have a valid build action.");
                }
            }
        }

        [Test]
        public void TestHashSeedUniquenessAcrossBiomesAndLayers()
        {
            string worldSeed = "NEURO-8842";
            HashSet<int> seenHashes = new HashSet<int>();

            for (int biome = 0; biome < 6; biome++)
            {
                for (int layer = 1; layer <= 3; layer++)
                {
                    int hash = PoissonDiscSampler.HashSeed(worldSeed, biome, layer * 100);
                    Assert.IsFalse(seenHashes.Contains(hash),
                        $"Hash collision detected for seed={worldSeed}, biome={biome}, layer={layer} (hash={hash})");
                    seenHashes.Add(hash);
                }
            }
        }
    }
}
#endif
