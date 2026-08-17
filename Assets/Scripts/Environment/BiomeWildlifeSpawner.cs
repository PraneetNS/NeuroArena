using System.Collections.Generic;
using UnityEngine;
using NeuroArena.Data;

namespace NeuroArena.Environment
{
    /// <summary>
    /// Spawns and manages flocks of non-hostile ambient wildlife across each active biome.
    /// Uses Poisson-disc sampling to organically position creatures across terrain while avoiding structures.
    /// </summary>
    public class BiomeWildlifeSpawner : MonoBehaviour
    {
        [Header("Flock Density Settings")]
        [SerializeField] private int minCreatureCount = 8;
        [SerializeField] private int maxCreatureCount = 14;
        [SerializeField] private float creatureMinDistance = 6.5f;

        [Header("Spawn Exclusions")]
        [SerializeField] private float playerSpawnClearRadius = 8.0f;
        [SerializeField] private Vector3 labStationPos = new Vector3(14f, 0f, 14f);
        [SerializeField] private float labStationClearRadius = 6.5f;

        private GameObject currentWildlifeRoot;

        public void SpawnBiomeWildlife(int biomeIndex, StylizedBiomeTerrain terrain)
        {
            if (currentWildlifeRoot != null)
            {
                Destroy(currentWildlifeRoot);
            }

            currentWildlifeRoot = new GameObject($"BiomeWildlife_Biome_{biomeIndex + 1}");
            currentWildlifeRoot.transform.SetParent(transform, false);

            WildlifeArchetype archetype = AmbientWildlifeFactory.GetArchetypeForBiome(biomeIndex);
            float domainRadius = terrain != null ? terrain.TerrainSize * 0.42f : 38f;

            // 1. Exclusion Zones (Spawns, Lab, Landmarks)
            List<PoissonDiscSampler.ExclusionZone> exclusionZones = new List<PoissonDiscSampler.ExclusionZone>
            {
                new PoissonDiscSampler.ExclusionZone(Vector2.zero, playerSpawnClearRadius),
                new PoissonDiscSampler.ExclusionZone(new Vector2(labStationPos.x, labStationPos.z), labStationClearRadius)
            };

            List<BiomeLandmarkGenerator.LandmarkPlacement> landmarks = BiomeLandmarkGenerator.GetLandmarkPlacements(biomeIndex);
            for (int i = 0; i < landmarks.Count; i++)
            {
                exclusionZones.Add(new PoissonDiscSampler.ExclusionZone(landmarks[i].localPos2D, landmarks[i].exclusionRadius));
            }

            // 2. Poisson-Disc Sampling for Wildlife Spawn Coordinates
            string seedStr = SaveManager.Instance?.CurrentSaveData?.playthroughSeed ?? "NEURO-8842";
            int wildlifeSeed = PoissonDiscSampler.HashSeed(seedStr, biomeIndex, 404);

            List<Vector2> spawnPoints = PoissonDiscSampler.SampleRadial(
                minDistance: creatureMinDistance,
                domainRadius: domainRadius,
                seed: wildlifeSeed,
                exclusionZones: exclusionZones,
                k: 30,
                maxPoints: maxCreatureCount
            );

            GameObject playerObj = GameObject.FindWithTag("Player");
            Transform playerTransform = playerObj != null ? playerObj.transform : null;

            // 3. Instantiate Creatures & Attach Lightweight AI
            for (int i = 0; i < spawnPoints.Count; i++)
            {
                Vector2 pos2D = spawnPoints[i];
                float y = terrain != null ? terrain.GetHeightAt(pos2D.x, pos2D.y) : 0f;
                Vector3 worldPos = new Vector3(pos2D.x, y, pos2D.y);

                int creatureSeed = wildlifeSeed + i * 47;
                GameObject creature = AmbientWildlifeFactory.CreateWildlife(archetype, creatureSeed, currentWildlifeRoot.transform);
                creature.transform.position = worldPos;
                creature.transform.rotation = Quaternion.Euler(0f, creatureSeed % 360, 0f);

                AmbientCreatureAI ai = creature.AddComponent<AmbientCreatureAI>();
                ai.Initialize(archetype, terrain, playerTransform);

                // Stage 87 Spatial Culling & Pooling Registration
                if (SpatialCullingManager.Instance != null)
                {
                    SpatialCullingManager.Instance.RegisterObject(creature);
                }
            }

            Debug.Log($"[BiomeWildlifeSpawner] Spawned {spawnPoints.Count} ambient {archetype} creatures in Biome {biomeIndex + 1} with Stage 87 Spatial Culling!");
        }
    }
}
