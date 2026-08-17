using System.Collections.Generic;
using UnityEngine;
using NeuroArena.Data;
using NeuroArena.Core;

namespace NeuroArena.Environment
{
    /// <summary>
    /// Master Procedural Biome Scatter System.
    /// Uses Bridson's 2D Poisson-disc sampling seeded by the Stage 13 / playthrough world seed
    /// to scatter stylized low-poly trees, boulders, and micro ground clutter across 2-4 km² biomes.
    /// Spawns iconic hand-crafted landmark structures (Ruins, Monolith Clusters, Research Outposts).
    /// Integrates Stage 86 Spatial Culling & Object Pooling with Stage 45 Device-Tier density scaling.
    /// </summary>
    public class BiomeFoliageScatterer : MonoBehaviour
    {
        [Header("World Seed Settings")]
        [SerializeField] private string defaultWorldSeed = "NEURO-8842";
        [SerializeField] private bool useSaveDataSeed = true;

        [Header("Exclusion Zones")]
        [SerializeField] private float playerSpawnClearRadius = 10.0f;
        [SerializeField] private Vector3 labStationPos = new Vector3(14f, 0f, 14f);
        [SerializeField] private float labStationClearRadius = 8.5f;

        [Header("Landmark Spawning")]
        [SerializeField] private bool spawnLandmarks = true;

        private GameObject currentFoliageRoot;
        private string activeSeed;

        public string ActiveSeed => activeSeed;

        /// <summary>
        /// Populates the complete biome environment (Landmarks, Trees, Rocks, Ground Clutter)
        /// across the expansive 2-4 km² terrain using Poisson-disc sampling and spatial culling.
        /// </summary>
        public void PopulateBiomeEnvironment(int biomeIndex, StylizedBiomeTerrain terrain)
        {
            if (currentFoliageRoot != null)
            {
                Destroy(currentFoliageRoot);
            }

            currentFoliageRoot = new GameObject($"BiomeEnvironment_Biome_{biomeIndex + 1}");
            currentFoliageRoot.transform.SetParent(transform, false);

            // Ensure Spatial Culling Manager is initialized and cleared
            SpatialCullingManager culling = SpatialCullingManager.Instance;
            if (culling == null)
            {
                culling = gameObject.AddComponent<SpatialCullingManager>();
            }
            culling.Clear();
            culling.ApplyDeviceTierSettings();

            activeSeed = ResolveWorldSeed();
            BiomeScatterConfig config = BiomeScatterConfig.GetPreset(biomeIndex);
            float domainRadius = terrain != null ? terrain.TerrainSize * 0.44f : 350f;

            // Stage 45 Device-Tier Density & Distance Scaling
            float densityMultiplier = GetDeviceTierDensityMultiplier();

            // 1. Setup Base Exclusion Zones (Player Spawn & Lab Station)
            List<PoissonDiscSampler.ExclusionZone> exclusionZones = new List<PoissonDiscSampler.ExclusionZone>
            {
                new PoissonDiscSampler.ExclusionZone(Vector2.zero, playerSpawnClearRadius),
                new PoissonDiscSampler.ExclusionZone(new Vector2(labStationPos.x, labStationPos.z), labStationClearRadius)
            };

            // 2. Spawn Landmark Structures & Register Landmark Footprint Exclusions
            if (spawnLandmarks)
            {
                Transform landmarkRoot = new GameObject("Landmarks").transform;
                landmarkRoot.SetParent(currentFoliageRoot.transform, false);

                List<PoissonDiscSampler.ExclusionZone> landmarkExclusions = 
                    BiomeLandmarkGenerator.SpawnBiomeLandmarks(biomeIndex, landmarkRoot, terrain);
                
                exclusionZones.AddRange(landmarkExclusions);
            }

            // 3. Layer 1: Scatter Stylized Trees / Primary Flora via Poisson-Disc Sampling
            int treeCountCap = Mathf.RoundToInt(config.treeLayer.maxCount * densityMultiplier * 2.8f);
            int treeSeed = PoissonDiscSampler.HashSeed(activeSeed, biomeIndex, 101);
            List<Vector2> treePositions = PoissonDiscSampler.SampleRadial(
                config.treeLayer.minDistance,
                domainRadius,
                treeSeed,
                exclusionZones,
                k: 30,
                maxPoints: treeCountCap
            );

            Transform treesRoot = new GameObject("Flora_Trees").transform;
            treesRoot.SetParent(currentFoliageRoot.transform, false);

            for (int i = 0; i < treePositions.Count; i++)
            {
                Vector2 pos2D = treePositions[i];
                float y = terrain != null ? terrain.GetHeightAt(pos2D.x, pos2D.y) : 0f;
                Vector3 worldPos = new Vector3(pos2D.x, y, pos2D.y);

                int itemSeed = treeSeed + i * 37;
                GameObject tree = StylizedLowPolyMeshes.CreateLowPolyTree(
                    config.treeStyle,
                    itemSeed,
                    config.trunkColor,
                    config.foliageColor,
                    config.accentColor
                );

                tree.transform.SetParent(treesRoot, false);
                tree.transform.position = worldPos;

                float yaw = (itemSeed % 360);
                tree.transform.rotation = Quaternion.Euler(0f, yaw, 0f);

                float scaleLerp = ((itemSeed % 100) / 100f);
                float s = Mathf.Lerp(config.treeLayer.scaleRange.x, config.treeLayer.scaleRange.y, scaleLerp);
                tree.transform.localScale = new Vector3(s, s, s);

                // Register with Stage 86 Spatial Culling
                culling.RegisterObject(tree);
            }

            // 4. Layer 2: Scatter Low-Poly Boulders & Rocks (Avoiding Trees)
            int rockCountCap = Mathf.RoundToInt(config.rockLayer.maxCount * densityMultiplier * 2.8f);
            int rockSeed = PoissonDiscSampler.HashSeed(activeSeed, biomeIndex, 202);
            List<Vector2> rockPositions = PoissonDiscSampler.SampleRadial(
                config.rockLayer.minDistance,
                domainRadius,
                rockSeed,
                exclusionZones,
                existingObstacles: treePositions,
                obstacleClearance: config.rockLayer.obstacleClearance,
                k: 30,
                maxPoints: rockCountCap
            );

            Transform rocksRoot = new GameObject("Geology_Rocks").transform;
            rocksRoot.SetParent(currentFoliageRoot.transform, false);

            for (int i = 0; i < rockPositions.Count; i++)
            {
                Vector2 pos2D = rockPositions[i];
                float y = terrain != null ? terrain.GetHeightAt(pos2D.x, pos2D.y) : 0f;
                Vector3 worldPos = new Vector3(pos2D.x, y, pos2D.y);

                int itemSeed = rockSeed + i * 53;
                GameObject rock = CreateLowPolyRockObject(i + 1, itemSeed, config.rockColor, config.rockLayer.scaleRange);
                rock.transform.SetParent(rocksRoot, false);
                rock.transform.position = worldPos;

                // Register with Stage 86 Spatial Culling
                culling.RegisterObject(rock);
            }

            // 5. Layer 3: Scatter Micro Ground Clutter (Shrubs, Crystals, Spore Tufts, Ice Spikes)
            List<Vector2> combinedObstacles = new List<Vector2>(treePositions);
            combinedObstacles.AddRange(rockPositions);

            int clutterCountCap = Mathf.RoundToInt(config.clutterLayer.maxCount * densityMultiplier * 3.2f);
            int clutterSeed = PoissonDiscSampler.HashSeed(activeSeed, biomeIndex, 303);
            List<Vector2> clutterPositions = PoissonDiscSampler.SampleRadial(
                config.clutterLayer.minDistance,
                domainRadius,
                clutterSeed,
                exclusionZones,
                existingObstacles: combinedObstacles,
                obstacleClearance: config.clutterLayer.obstacleClearance,
                k: 30,
                maxPoints: clutterCountCap
            );

            Transform clutterRoot = new GameObject("Ground_Clutter").transform;
            clutterRoot.SetParent(currentFoliageRoot.transform, false);

            for (int i = 0; i < clutterPositions.Count; i++)
            {
                Vector2 pos2D = clutterPositions[i];
                float y = terrain != null ? terrain.GetHeightAt(pos2D.x, pos2D.y) : 0f;
                Vector3 worldPos = new Vector3(pos2D.x, y, pos2D.y);

                int itemSeed = clutterSeed + i * 19;
                GroundClutterType clutterType = (i % 2 == 0) ? config.primaryClutterType : config.secondaryClutterType;

                GameObject clutter = CreateGroundClutterObject(clutterType, itemSeed, config);
                clutter.transform.SetParent(clutterRoot, false);
                clutter.transform.position = worldPos;

                float scaleLerp = ((itemSeed % 100) / 100f);
                float s = Mathf.Lerp(config.clutterLayer.scaleRange.x, config.clutterLayer.scaleRange.y, scaleLerp);
                clutter.transform.localScale = Vector3.one * s;

                // Register with Stage 86 Spatial Culling
                culling.RegisterObject(clutter);
            }

            culling.ForceRefreshCulling();

            Debug.Log($"[BiomeFoliageScatterer] Generated Biome {biomeIndex + 1} ({config.biomeName}) on {terrain?.PlayableAreaKm2:F2} km² Expanse (Tier: {DeviceTierManager.Instance?.DetectedTier}): {treePositions.Count} Trees, {rockPositions.Count} Rocks, {clutterPositions.Count} Clutter items (Total Cullable: {culling.TotalRegisteredObjects})!");
        }

        private float GetDeviceTierDensityMultiplier()
        {
            if (DeviceTierManager.Instance != null)
            {
                switch (DeviceTierManager.Instance.DetectedTier)
                {
                    case HardwareTier.LowEnd_2GB:
                        return 0.50f; // Stage 45: 50% density on low-end
                    case HardwareTier.MidRange_4to6GB:
                        return 1.00f;
                    case HardwareTier.Flagship_8GBPlus:
                        return 1.35f;
                }
            }
            return 1.0f;
        }

        private string ResolveWorldSeed()
        {
            if (useSaveDataSeed && SaveManager.Instance != null && SaveManager.Instance.CurrentSaveData != null)
            {
                if (!string.IsNullOrEmpty(SaveManager.Instance.CurrentSaveData.playthroughSeed))
                {
                    return SaveManager.Instance.CurrentSaveData.playthroughSeed;
                }
            }
            return string.IsNullOrEmpty(defaultWorldSeed) ? "NEURO-8842" : defaultWorldSeed;
        }

        private GameObject CreateLowPolyRockObject(int index, int seed, Color baseColor, Vector2 scaleRange)
        {
            GameObject rock = new GameObject($"LowPolyBoulder_{index}");
            
            float sx = Mathf.Lerp(scaleRange.x, scaleRange.y, ((seed * 7) % 100) / 100f);
            float sy = Mathf.Lerp(scaleRange.x, scaleRange.y, ((seed * 13) % 100) / 100f) * 0.85f;
            float sz = Mathf.Lerp(scaleRange.x, scaleRange.y, ((seed * 19) % 100) / 100f);
            Vector3 rockScale = new Vector3(sx, sy, sz);

            MeshFilter mf = rock.AddComponent<MeshFilter>();
            MeshRenderer mr = rock.AddComponent<MeshRenderer>();
            MeshCollider mc = rock.AddComponent<MeshCollider>();

            Mesh rockMesh = StylizedLowPolyMeshes.CreateLowPolyRockMesh(seed, rockScale);
            mf.sharedMesh = rockMesh;
            mc.sharedMesh = rockMesh;

            float colorJitter = 0.9f + (((seed * 23) % 20) / 100f);
            Color rockCol = baseColor * colorJitter;
            mr.sharedMaterial = StylizedMaterialFactory.GetStylizedPropMaterial(
                $"Rock_{index}", rockCol, metallic: 0.12f, smoothness: 0.35f);

            float yaw = (seed % 360);
            float pitch = ((seed % 20) - 10f);
            float roll = (((seed * 3) % 20) - 10f);
            rock.transform.rotation = Quaternion.Euler(pitch, yaw, roll);

            return rock;
        }

        private GameObject CreateGroundClutterObject(GroundClutterType type, int seed, BiomeScatterConfig config)
        {
            GameObject clutter = new GameObject($"Clutter_{type}_{seed}");

            switch (type)
            {
                case GroundClutterType.DesertSageBush:
                case GroundClutterType.CanopyBush:
                    {
                        // Low-poly faceted bush clump
                        MeshFilter mf = clutter.AddComponent<MeshFilter>();
                        MeshRenderer mr = clutter.AddComponent<MeshRenderer>();
                        mf.sharedMesh = StylizedLowPolyMeshes.CreateLowPolyRockMesh(seed, new Vector3(1.2f, 0.7f, 1.2f));
                        mr.sharedMaterial = StylizedMaterialFactory.GetStylizedPropMaterial(
                            $"Bush_{type}", config.groundClutterColor, metallic: 0.05f, smoothness: 0.25f);
                        clutter.transform.rotation = Quaternion.Euler(0f, seed % 360, 0f);
                    }
                    break;

                case GroundClutterType.DataQuartzShard:
                case GroundClutterType.RegularizationCrystal:
                case GroundClutterType.PrismaticCluster:
                    {
                        // Angular crystal spike
                        MeshFilter mf = clutter.AddComponent<MeshFilter>();
                        MeshRenderer mr = clutter.AddComponent<MeshRenderer>();
                        mf.sharedMesh = StylizedLowPolyMeshes.CreateCrystalMesh(radius: 0.35f, height: 1.2f);
                        mr.sharedMaterial = StylizedMaterialFactory.GetStylizedPropMaterial(
                            $"Crystal_{type}", config.groundClutterAccent, metallic: 0.3f, smoothness: 0.92f,
                            emission: config.groundClutterAccent, emissionIntensity: 1.6f);
                        clutter.transform.rotation = Quaternion.Euler(15f, seed % 360, 10f);
                    }
                    break;

                case GroundClutterType.BioluminescentMiniSpore:
                case GroundClutterType.GoldenSapNodule:
                    {
                        // Small glowing spore bulb
                        GameObject bulb = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                        bulb.name = "SporeBulb";
                        bulb.transform.SetParent(clutter.transform, false);
                        bulb.transform.localPosition = new Vector3(0f, 0.4f, 0f);
                        bulb.transform.localScale = new Vector3(0.7f, 0.85f, 0.7f);

                        Renderer r = bulb.GetComponent<Renderer>();
                        if (r != null)
                        {
                            r.sharedMaterial = StylizedMaterialFactory.GetStylizedPropMaterial(
                                $"SporeBulb_{type}", config.groundClutterAccent, metallic: 0.1f, smoothness: 0.9f,
                                emission: config.groundClutterAccent, emissionIntensity: 2.0f);
                        }
                    }
                    break;

                case GroundClutterType.GlacialFrostNeedle:
                case GroundClutterType.ObsidianLogicSpike:
                    {
                        // Shard wedge spike
                        MeshFilter mf = clutter.AddComponent<MeshFilter>();
                        MeshRenderer mr = clutter.AddComponent<MeshRenderer>();
                        mf.sharedMesh = StylizedLowPolyMeshes.CreateShardMesh(0.4f, 1.4f, 0.3f);
                        mr.sharedMaterial = StylizedMaterialFactory.GetStylizedPropMaterial(
                            $"Spike_{type}", config.groundClutterAccent, metallic: 0.4f, smoothness: 0.85f,
                            emission: config.groundClutterAccent, emissionIntensity: 1.4f);
                        clutter.transform.rotation = Quaternion.Euler(20f, seed % 360, 5f);
                    }
                    break;

                case GroundClutterType.CyberMicroNode:
                    {
                        // Cylindrical cyber terminal node
                        GameObject cyl = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                        cyl.name = "MicroNodeBody";
                        cyl.transform.SetParent(clutter.transform, false);
                        cyl.transform.localPosition = new Vector3(0f, 0.3f, 0f);
                        cyl.transform.localScale = new Vector3(0.5f, 0.3f, 0.5f);

                        Renderer rend = cyl.GetComponent<Renderer>();
                        if (rend != null)
                        {
                            rend.sharedMaterial = StylizedMaterialFactory.GetStylizedPropMaterial(
                                "MicroNodeMat", config.rockColor, metallic: 0.8f, smoothness: 0.85f);
                        }

                        GameObject lightPuck = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                        lightPuck.name = "NodeLight";
                        lightPuck.transform.SetParent(clutter.transform, false);
                        lightPuck.transform.localPosition = new Vector3(0f, 0.62f, 0f);
                        lightPuck.transform.localScale = new Vector3(0.3f, 0.15f, 0.3f);

                        Renderer lightRend = lightPuck.GetComponent<Renderer>();
                        if (lightRend != null)
                        {
                            lightRend.sharedMaterial = StylizedMaterialFactory.GetStylizedPropMaterial(
                                "NodeLightMat", config.groundClutterAccent, metallic: 0.1f, smoothness: 0.95f,
                                emission: config.groundClutterAccent, emissionIntensity: 2.2f);
                        }
                    }
                    break;

                case GroundClutterType.ConstellationStarSpire:
                case GroundClutterType.LevitatingHoloRune:
                    {
                        // Levitating rune tablet hovering slightly above ground
                        MeshFilter mf = clutter.AddComponent<MeshFilter>();
                        MeshRenderer mr = clutter.AddComponent<MeshRenderer>();
                        mf.sharedMesh = StylizedLowPolyMeshes.CreateRuneTabletMesh(0.5f, 0.7f, 0.18f);
                        mr.sharedMaterial = StylizedMaterialFactory.GetStylizedPropMaterial(
                            $"Rune_{type}", config.groundClutterAccent, metallic: 0.2f, smoothness: 0.95f,
                            emission: config.groundClutterAccent, emissionIntensity: 2.0f);
                        clutter.transform.localPosition = new Vector3(0f, 0.45f, 0f);
                        clutter.transform.rotation = Quaternion.Euler(0f, seed % 360, 25f);
                    }
                    break;

                default:
                    {
                        // Fallback simple low poly clump
                        MeshFilter mf = clutter.AddComponent<MeshFilter>();
                        MeshRenderer mr = clutter.AddComponent<MeshRenderer>();
                        mf.sharedMesh = StylizedLowPolyMeshes.CreateLowPolyRockMesh(seed, Vector3.one * 0.6f);
                        mr.sharedMaterial = StylizedMaterialFactory.GetStylizedPropMaterial(
                            "ClutterDefault", config.groundClutterColor, metallic: 0.1f, smoothness: 0.4f);
                    }
                    break;
            }

            return clutter;
        }
    }
}
