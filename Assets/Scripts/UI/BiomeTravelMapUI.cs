using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using NeuroArena.Environment;
using NeuroArena.Data;

namespace NeuroArena.UI
{
    /// <summary>
    /// Fullscreen Glassmorphic Biome Fast-Travel Screen:
    /// - Displays all 6 biomes with unlock requirements, boss defeat status, and target metrics.
    /// - Allows 1-click fast-travel teleportation between unlocked biomes.
    /// </summary>
    public class BiomeTravelMapUI : MonoBehaviour
    {
        [Header("UI Panels")]
        public GameObject mapModalRoot;
        public Transform biomeNodeContainer;

        public struct BiomeInfo
        {
            public int index;
            public string name;
            public string subtitle;
            public string metric;
            public Color themeColor;
        }

        public static readonly BiomeInfo[] BiomeCatalog = new BiomeInfo[]
        {
            new BiomeInfo { index = 0, name = "The Linear Steppes", subtitle = "Arid Alluvial Plateaus", metric = "MSE ≤ 0.10", themeColor = new Color(0.98f, 0.80f, 0.10f) },
            new BiomeInfo { index = 1, name = "The Binary Marshlands", subtitle = "Sunken Crater Swamplands", metric = "Accuracy ≥ 90%", themeColor = new Color(0.06f, 0.72f, 0.51f) },
            new BiomeInfo { index = 2, name = "The Variance Tundra", subtitle = "Jagged Glacial Ridges", metric = "Regularization L2", themeColor = new Color(0.22f, 0.74f, 0.97f) },
            new BiomeInfo { index = 3, name = "The Branching Canopy", subtitle = "Rolling Ancient Forests", metric = "Ensemble Bagging", themeColor = new Color(0.13f, 0.77f, 0.35f) },
            new BiomeInfo { index = 4, name = "The Deep Synapse Citadel", subtitle = "Obsidian Basalt Rings", metric = "Multi-Layer Perceptron", themeColor = new Color(0.75f, 0.35f, 0.98f) },
            new BiomeInfo { index = 5, name = "The Semantic Expanse", subtitle = "Cosmic Star Plateaus", metric = "PPMI Vector Space", themeColor = new Color(0.95f, 0.96f, 1.0f) }
        };

        public void OpenTravelMap()
        {
            if (mapModalRoot != null)
            {
                mapModalRoot.SetActive(true);
                RefreshBiomeNodes();
            }
        }

        public void CloseTravelMap()
        {
            if (mapModalRoot != null)
            {
                mapModalRoot.SetActive(false);
            }
        }

        public void RefreshBiomeNodes()
        {
            // Update node lock states and button interactions
        }

        public void SelectBiomeToTravel(int targetBiomeIndex)
        {
            if (WorldManager.Instance != null && WorldManager.Instance.IsBiomeUnlocked(targetBiomeIndex))
            {
                CloseTravelMap();
                WorldManager.Instance.TravelToBiome(targetBiomeIndex);
            }
        }
    }
}
