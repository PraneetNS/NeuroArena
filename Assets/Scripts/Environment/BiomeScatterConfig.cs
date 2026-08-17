using System;
using UnityEngine;

namespace NeuroArena.Environment
{
    public enum GroundClutterType
    {
        // Biome 1: Linear Steppes
        DesertSageBush,
        GoldenGrassTuft,
        DataQuartzShard,

        // Biome 2: Binary Marshlands
        BioluminescentMiniSpore,
        SwampFernCluster,
        MoistureNodule,

        // Biome 3: Variance Tundra
        GlacialFrostNeedle,
        SnowLichenTuft,
        RegularizationCrystal,

        // Biome 4: Branching Canopy
        LushForestFern,
        GoldenSapNodule,
        CanopyBush,

        // Biome 5: Deep Synapse Citadel
        CyberMicroNode,
        SynapticConduitBundle,
        ObsidianLogicSpike,

        // Biome 6: Semantic Expanse
        ConstellationStarSpire,
        LevitatingHoloRune,
        PrismaticCluster
    }

    /// <summary>
    /// Per-layer density and asset tuning parameters for Poisson-disc scattering.
    /// </summary>
    [Serializable]
    public class ScatterLayerConfig
    {
        public float minDistance = 6.0f;
        public int maxCount = 40;
        public Vector2 scaleRange = new Vector2(0.85f, 1.35f);
        public float obstacleClearance = 2.0f;
    }

    /// <summary>
    /// Defines tuned scatter themes, density, and asset palettes per biome scene.
    /// </summary>
    [Serializable]
    public class BiomeScatterConfig
    {
        public string biomeName;
        public StylizedLowPolyMeshes.TreeStyle treeStyle;
        
        // Colors: Trunk/Base, Foliage/Cap, Accent/Glow
        public Color trunkColor;
        public Color foliageColor;
        public Color accentColor;
        public Color rockColor;
        public Color groundClutterColor;
        public Color groundClutterAccent;

        public ScatterLayerConfig treeLayer = new ScatterLayerConfig();
        public ScatterLayerConfig rockLayer = new ScatterLayerConfig();
        public ScatterLayerConfig clutterLayer = new ScatterLayerConfig();
        public GroundClutterType primaryClutterType;
        public GroundClutterType secondaryClutterType;

        /// <summary>
        /// Retrieves the handcrafted, finely tuned scatter preset for the specified biome index (0-5).
        /// </summary>
        public static BiomeScatterConfig GetPreset(int biomeIndex)
        {
            switch (biomeIndex)
            {
                case 0: // Biome 1: The Linear Steppes (Linear Regression / Amber & Warm Earth)
                    return new BiomeScatterConfig
                    {
                        biomeName = "The Linear Steppes",
                        treeStyle = StylizedLowPolyMeshes.TreeStyle.ConiferPine,
                        trunkColor = new Color(0.42f, 0.24f, 0.12f),
                        foliageColor = new Color(0.85f, 0.58f, 0.12f), // Amber needles
                        accentColor = new Color(0.98f, 0.75f, 0.14f),
                        rockColor = new Color(0.55f, 0.42f, 0.30f),   // Sandstone
                        groundClutterColor = new Color(0.78f, 0.62f, 0.22f), // Golden brush
                        groundClutterAccent = new Color(0.95f, 0.80f, 0.25f),
                        treeLayer = new ScatterLayerConfig { minDistance = 6.5f, maxCount = 32, scaleRange = new Vector2(0.85f, 1.4f), obstacleClearance = 2.5f },
                        rockLayer = new ScatterLayerConfig { minDistance = 4.8f, maxCount = 38, scaleRange = new Vector2(1.0f, 2.5f), obstacleClearance = 2.0f },
                        clutterLayer = new ScatterLayerConfig { minDistance = 2.4f, maxCount = 65, scaleRange = new Vector2(0.5f, 1.1f), obstacleClearance = 1.0f },
                        primaryClutterType = GroundClutterType.DesertSageBush,
                        secondaryClutterType = GroundClutterType.DataQuartzShard
                    };

                case 1: // Biome 2: The Binary Marshlands (Logistic Classification / Teal & Deep Violet)
                    return new BiomeScatterConfig
                    {
                        biomeName = "The Binary Marshlands",
                        treeStyle = StylizedLowPolyMeshes.TreeStyle.SporeMushroom,
                        trunkColor = new Color(0.18f, 0.12f, 0.28f), // Deep Violet Stem
                        foliageColor = new Color(0.08f, 0.65f, 0.58f), // Teal Spore Cap
                        accentColor = new Color(0.55f, 0.36f, 0.96f),  // Glowing Purple
                        rockColor = new Color(0.20f, 0.24f, 0.28f),   // Dark Wetland Slate
                        groundClutterColor = new Color(0.12f, 0.60f, 0.52f),
                        groundClutterAccent = new Color(0.65f, 0.25f, 0.95f),
                        treeLayer = new ScatterLayerConfig { minDistance = 5.5f, maxCount = 42, scaleRange = new Vector2(0.8f, 1.5f), obstacleClearance = 2.2f },
                        rockLayer = new ScatterLayerConfig { minDistance = 4.2f, maxCount = 34, scaleRange = new Vector2(0.8f, 2.2f), obstacleClearance = 1.8f },
                        clutterLayer = new ScatterLayerConfig { minDistance = 2.0f, maxCount = 80, scaleRange = new Vector2(0.4f, 1.0f), obstacleClearance = 0.8f },
                        primaryClutterType = GroundClutterType.BioluminescentMiniSpore,
                        secondaryClutterType = GroundClutterType.SwampFernCluster
                    };

                case 2: // Biome 3: The Variance Tundra (Polynomial / Glacial Frost & Ice-Blue)
                    return new BiomeScatterConfig
                    {
                        biomeName = "The Variance Tundra",
                        treeStyle = StylizedLowPolyMeshes.TreeStyle.ConiferPine,
                        trunkColor = new Color(0.18f, 0.26f, 0.35f), // Slate Frost
                        foliageColor = new Color(0.38f, 0.75f, 0.95f), // Ice-Blue
                        accentColor = new Color(0.72f, 0.90f, 0.98f),  // Glaze
                        rockColor = new Color(0.35f, 0.48f, 0.62f),   // Glacial Ice Granite
                        groundClutterColor = new Color(0.45f, 0.72f, 0.88f),
                        groundClutterAccent = new Color(0.82f, 0.95f, 1.0f),
                        treeLayer = new ScatterLayerConfig { minDistance = 7.0f, maxCount = 28, scaleRange = new Vector2(0.75f, 1.3f), obstacleClearance = 2.8f },
                        rockLayer = new ScatterLayerConfig { minDistance = 4.0f, maxCount = 45, scaleRange = new Vector2(1.2f, 3.0f), obstacleClearance = 2.2f },
                        clutterLayer = new ScatterLayerConfig { minDistance = 2.2f, maxCount = 70, scaleRange = new Vector2(0.5f, 1.2f), obstacleClearance = 0.9f },
                        primaryClutterType = GroundClutterType.GlacialFrostNeedle,
                        secondaryClutterType = GroundClutterType.RegularizationCrystal
                    };

                case 3: // Biome 4: The Branching Canopy (Decision Trees / Emerald & Golden Sap)
                    return new BiomeScatterConfig
                    {
                        biomeName = "The Branching Canopy",
                        treeStyle = StylizedLowPolyMeshes.TreeStyle.LushDeciduous,
                        trunkColor = new Color(0.28f, 0.18f, 0.08f), // Rich Bark
                        foliageColor = new Color(0.06f, 0.72f, 0.45f), // Emerald
                        accentColor = new Color(0.98f, 0.75f, 0.14f),  // Golden Sap
                        rockColor = new Color(0.24f, 0.35f, 0.26f),   // Mossy Rock
                        groundClutterColor = new Color(0.15f, 0.65f, 0.35f),
                        groundClutterAccent = new Color(0.95f, 0.85f, 0.20f),
                        treeLayer = new ScatterLayerConfig { minDistance = 5.2f, maxCount = 48, scaleRange = new Vector2(0.9f, 1.5f), obstacleClearance = 2.4f },
                        rockLayer = new ScatterLayerConfig { minDistance = 4.5f, maxCount = 30, scaleRange = new Vector2(0.9f, 2.0f), obstacleClearance = 1.8f },
                        clutterLayer = new ScatterLayerConfig { minDistance = 1.8f, maxCount = 90, scaleRange = new Vector2(0.5f, 1.1f), obstacleClearance = 0.8f },
                        primaryClutterType = GroundClutterType.CanopyBush,
                        secondaryClutterType = GroundClutterType.GoldenSapNodule
                    };

                case 4: // Biome 5: The Deep Synapse Citadel (2-Layer MLP / Obsidian & Cyber Purple/Cyan)
                    return new BiomeScatterConfig
                    {
                        biomeName = "The Deep Synapse Citadel",
                        treeStyle = StylizedLowPolyMeshes.TreeStyle.CyberPillarTree,
                        trunkColor = new Color(0.10f, 0.08f, 0.16f), // Obsidian Basalt
                        foliageColor = new Color(0.66f, 0.33f, 0.97f), // Neon Purple
                        accentColor = new Color(0.13f, 0.83f, 0.93f),  // Cyber Cyan
                        rockColor = new Color(0.12f, 0.10f, 0.18f),   // Basalt Monolith
                        groundClutterColor = new Color(0.20f, 0.14f, 0.30f),
                        groundClutterAccent = new Color(0.15f, 0.90f, 0.95f),
                        treeLayer = new ScatterLayerConfig { minDistance = 6.0f, maxCount = 35, scaleRange = new Vector2(0.85f, 1.4f), obstacleClearance = 2.5f },
                        rockLayer = new ScatterLayerConfig { minDistance = 5.0f, maxCount = 36, scaleRange = new Vector2(1.0f, 2.6f), obstacleClearance = 2.0f },
                        clutterLayer = new ScatterLayerConfig { minDistance = 2.5f, maxCount = 55, scaleRange = new Vector2(0.6f, 1.3f), obstacleClearance = 1.0f },
                        primaryClutterType = GroundClutterType.CyberMicroNode,
                        secondaryClutterType = GroundClutterType.ObsidianLogicSpike
                    };

                case 5: // Biome 6: The Semantic Expanse (Word Embeddings / Astral White & Prismatic Indigo)
                    return new BiomeScatterConfig
                    {
                        biomeName = "The Semantic Expanse",
                        treeStyle = StylizedLowPolyMeshes.TreeStyle.AstralPrismPillar,
                        trunkColor = new Color(0.92f, 0.94f, 0.98f), // Starlight White
                        foliageColor = new Color(0.51f, 0.55f, 0.97f), // Holographic Indigo
                        accentColor = new Color(0.22f, 0.74f, 0.97f),  // Prismatic Azure
                        rockColor = new Color(0.65f, 0.68f, 0.85f),   // Starlit Slate
                        groundClutterColor = new Color(0.60f, 0.65f, 0.95f),
                        groundClutterAccent = new Color(0.35f, 0.85f, 1.0f),
                        treeLayer = new ScatterLayerConfig { minDistance = 6.8f, maxCount = 26, scaleRange = new Vector2(0.8f, 1.35f), obstacleClearance = 2.6f },
                        rockLayer = new ScatterLayerConfig { minDistance = 5.5f, maxCount = 24, scaleRange = new Vector2(1.0f, 2.4f), obstacleClearance = 2.2f },
                        clutterLayer = new ScatterLayerConfig { minDistance = 2.6f, maxCount = 50, scaleRange = new Vector2(0.5f, 1.2f), obstacleClearance = 1.0f },
                        primaryClutterType = GroundClutterType.ConstellationStarSpire,
                        secondaryClutterType = GroundClutterType.LevitatingHoloRune
                    };

                default:
                    return GetPreset(0);
            }
        }
    }
}
