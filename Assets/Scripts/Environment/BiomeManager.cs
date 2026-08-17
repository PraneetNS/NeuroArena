using System;
using System.Collections.Generic;
using UnityEngine;
using NeuroArena.Data;

namespace NeuroArena.Environment
{
    /// <summary>
    /// Master Coordinator for all 6 Biomes in NeuroArena:
    /// Biome 1: The Linear Steppes (Linear Regression)
    /// Biome 2: The Binary Marshlands (Logistic Classification)
    /// Biome 3: The Variance Tundra (Polynomial Regression & Regularization)
    /// Biome 4: The Branching Canopy (Decision Trees & Pruning)
    /// Biome 5: The Deep Synapse Citadel (2-Layer MLP Backpropagation)
    /// Biome 6: The Semantic Expanse (Word Embeddings, Cosine Similarity & Vector Retrieval)
    /// </summary>
    public class BiomeManager : MonoBehaviour
    {
        public static BiomeManager Instance { get; private set; }

        [Header("Biome Progression")]
        [SerializeField] private int currentBiomeIndex = 0;
        [SerializeField] private bool[] unlockedBiomes = new bool[6] { true, false, false, false, false, false };

        [Header("Environment Controllers")]
        [SerializeField] private StylizedBiomeTerrain stylizedTerrain;
        [SerializeField] private BiomeFoliageScatterer foliageScatterer;
        [SerializeField] private BiomeWildlifeSpawner wildlifeSpawner;
        [SerializeField] private BiomeSkyboxController skyboxController;

        public int CurrentBiomeIndex => currentBiomeIndex;
        public bool[] UnlockedBiomes => unlockedBiomes;

        public readonly string[] BiomeNames = new string[6]
        {
            "1. The Linear Steppes",
            "2. The Binary Marshlands",
            "3. The Variance Tundra",
            "4. The Branching Canopy",
            "5. The Deep Synapse Citadel",
            "6. The Semantic Expanse"
        };

        public readonly Vector3[] BiomeOrigins = new Vector3[6]
        {
            new Vector3(0f, 0f, 0f),        // Biome 1 (Center)
            new Vector3(60f, 0f, 60f),      // Biome 2 (North-East)
            new Vector3(-60f, 0f, 60f),     // Biome 3 (North-West)
            new Vector3(-60f, 0f, -60f),    // Biome 4 (South-West)
            new Vector3(60f, 0f, -60f),     // Biome 5 (South-East)
            new Vector3(0f, 0f, 65f)        // Biome 6 (North Astral Plateau)
        };

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;

            FindEnvironmentControllers();
        }

        private void Start()
        {
            LoadBiome(currentBiomeIndex);
        }

        private void FindEnvironmentControllers()
        {
            if (stylizedTerrain == null) stylizedTerrain = FindFirstObjectByType<StylizedBiomeTerrain>();
            if (foliageScatterer == null) foliageScatterer = FindFirstObjectByType<BiomeFoliageScatterer>();
            if (wildlifeSpawner == null) wildlifeSpawner = FindFirstObjectByType<BiomeWildlifeSpawner>();
            if (skyboxController == null) skyboxController = FindFirstObjectByType<BiomeSkyboxController>();
        }

        public void LoadBiome(int biomeIndex)
        {
            currentBiomeIndex = Mathf.Clamp(biomeIndex, 0, 5);
            FindEnvironmentControllers();

            if (stylizedTerrain != null)
            {
                stylizedTerrain.GenerateBiomeTerrain(currentBiomeIndex);
            }

            if (foliageScatterer != null)
            {
                foliageScatterer.PopulateBiomeEnvironment(currentBiomeIndex, stylizedTerrain);
            }

            if (wildlifeSpawner != null)
            {
                wildlifeSpawner.SpawnBiomeWildlife(currentBiomeIndex, stylizedTerrain);
            }

            if (skyboxController != null)
            {
                skyboxController.ApplyBiomeAtmosphere(currentBiomeIndex);
            }

            Debug.Log($"[BiomeManager] Loaded Biome {currentBiomeIndex + 1}: {BiomeNames[currentBiomeIndex]} with stylized low-poly terrain, foliage, wildlife, and Stage 18 atmosphere!");
        }

        public void UnlockNextBiome()
        {
            if (currentBiomeIndex < unlockedBiomes.Length - 1)
            {
                unlockedBiomes[currentBiomeIndex + 1] = true;
                currentBiomeIndex++;
                LoadBiome(currentBiomeIndex);
                SaveManager.Instance?.SaveGame();
            }
        }
    }
}
