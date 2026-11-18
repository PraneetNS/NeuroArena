using System;
using UnityEngine;

namespace NeuroArena.UI.Theme
{
    [Serializable]
    public struct BiomePalette
    {
        public string biomeName;
        public Color primary;          // Main brand highlight / title
        public Color secondary;        // Supporting structural tone
        public Color accent;           // Interactive highlights / triggers
        public Color background;       // Glassmorphism panel base
        public Color border;           // 1px panel outline
        public Color textPrimary;      // Primary reading color
        public Color textSecondary;    // Subtitle / dim metadata
        public Color glow;             // Emission / Neon bloom
    }

    /// <summary>
    /// Master ScriptableObject Design System Theme Asset for NeuroArena.
    /// Defines 6 per-biome palettes, 8px spacing grid, typography, corner radii, and glow rules.
    /// </summary>
    [CreateAssetMenu(fileName = "NeuroArenaTheme", menuName = "NeuroArena/Design System Theme")]
    public class NeuroArenaThemeSO : ScriptableObject
    {
        [Header("Typography Settings")]
        public string displayFont = "Space Grotesk";
        public string displayMonospaceFont = "JetBrains Mono";
        public string cleanSansFont = "Outfit";

        [Header("8px Spacing Grid (Pixels / Scale Factor)")]
        public float space1 = 8f;
        public float space2 = 16f;
        public float space3 = 24f;
        public float space4 = 32f;
        public float space6 = 48f;
        public float space8 = 64f;

        [Header("Corner Radii")]
        public float radiusSmall = 4f;
        public float radiusMedium = 8f;
        public float radiusLarge = 14f;

        [Header("Glassmorphism & Border Rules")]
        public float borderWidth = 1.0f;
        public float glassAlpha = 0.92f;

        [Header("6 Per-Biome Palettes")]
        public BiomePalette steppes = new BiomePalette
        {
            biomeName = "The Linear Steppes",
            primary = new Color(0.9608f, 0.6196f, 0.0431f),      // #F59E0B Solar Gold
            secondary = new Color(0.8510f, 0.4667f, 0.0235f),    // #D97706 Vector Amber
            accent = new Color(0.9608f, 0.6196f, 0.0431f),       // #F59E0B
            background = new Color(0.0196f, 0.0314f, 0.0549f, 0.94f),
            border = new Color(0.9608f, 0.6196f, 0.0431f, 0.35f),
            textPrimary = new Color(0.9451f, 0.9608f, 0.9765f),
            textSecondary = new Color(0.5804f, 0.6392f, 0.7216f),
            glow = new Color(0.9608f, 0.6196f, 0.0431f, 0.50f)
        };

        public BiomePalette marshlands = new BiomePalette
        {
            biomeName = "The Binary Marshlands",
            primary = new Color(0.0627f, 0.7255f, 0.5059f),      // #10B981 Toxic Emerald
            secondary = new Color(0.0235f, 0.7137f, 0.8314f),    // #06B6D4 Sigmoid Cyan
            accent = new Color(0.0627f, 0.7255f, 0.5059f),       // #10B981
            background = new Color(0.0196f, 0.0314f, 0.0549f, 0.94f),
            border = new Color(0.0627f, 0.7255f, 0.5059f, 0.35f),
            textPrimary = new Color(0.9451f, 0.9608f, 0.9765f),
            textSecondary = new Color(0.5804f, 0.6392f, 0.7216f),
            glow = new Color(0.0627f, 0.7255f, 0.5059f, 0.50f)
        };

        public BiomePalette tundra = new BiomePalette
        {
            biomeName = "The Variance Tundra",
            primary = new Color(0.2196f, 0.7412f, 0.9725f),      // #38BDF8 L2 Glacial Frost
            secondary = new Color(0.3882f, 0.4000f, 0.9451f),    // #6366F1 Ridge Indigo
            accent = new Color(0.2196f, 0.7412f, 0.9725f),       // #38BDF8
            background = new Color(0.0196f, 0.0314f, 0.0549f, 0.94f),
            border = new Color(0.2196f, 0.7412f, 0.9725f, 0.35f),
            textPrimary = new Color(0.9451f, 0.9608f, 0.9765f),
            textSecondary = new Color(0.5804f, 0.6392f, 0.7216f),
            glow = new Color(0.2196f, 0.7412f, 0.9725f, 0.55f)
        };

        public BiomePalette canopy = new BiomePalette
        {
            biomeName = "The Branching Canopy",
            primary = new Color(0.5176f, 0.8000f, 0.0863f),      // #84CC16 Gini Lime
            secondary = new Color(0.9176f, 0.7020f, 0.0314f),    // #EAB308 Bagging Gold
            accent = new Color(0.5176f, 0.8000f, 0.0863f),       // #84CC16
            background = new Color(0.0196f, 0.0314f, 0.0549f, 0.94f),
            border = new Color(0.5176f, 0.8000f, 0.0863f, 0.35f),
            textPrimary = new Color(0.9451f, 0.9608f, 0.9765f),
            textSecondary = new Color(0.5804f, 0.6392f, 0.7216f),
            glow = new Color(0.5176f, 0.8000f, 0.0863f, 0.50f)
        };

        public BiomePalette citadel = new BiomePalette
        {
            biomeName = "The Deep Synapse Citadel",
            primary = new Color(0.6588f, 0.3333f, 0.9686f),      // #A855F7 Backprop Violet
            secondary = new Color(0.9255f, 0.2824f, 0.6000f),    // #EC4899 XOR Magenta
            accent = new Color(0.6588f, 0.3333f, 0.9686f),       // #A855F7
            background = new Color(0.0196f, 0.0314f, 0.0549f, 0.94f),
            border = new Color(0.6588f, 0.3333f, 0.9686f, 0.35f),
            textPrimary = new Color(0.9451f, 0.9608f, 0.9765f),
            textSecondary = new Color(0.5804f, 0.6392f, 0.7216f),
            glow = new Color(0.6588f, 0.3333f, 0.9686f, 0.55f)
        };

        public BiomePalette semanticExpanse = new BiomePalette
        {
            biomeName = "The Semantic Expanse",
            primary = new Color(0.0784f, 0.7216f, 0.6510f),      // #14B8A6 Cosine Teal
            secondary = new Color(0.9569f, 0.2471f, 0.3686f),    // #F43F5E Latent Coral
            accent = new Color(0.0784f, 0.7216f, 0.6510f),       // #14B8A6
            background = new Color(0.0196f, 0.0314f, 0.0549f, 0.94f),
            border = new Color(0.0784f, 0.7216f, 0.6510f, 0.35f),
            textPrimary = new Color(0.9451f, 0.9608f, 0.9765f),
            textSecondary = new Color(0.5804f, 0.6392f, 0.7216f),
            glow = new Color(0.0784f, 0.7216f, 0.6510f, 0.55f)
        };

        public BiomePalette GetPaletteForBiome(int biomeIndex)
        {
            switch (biomeIndex)
            {
                case 0: return steppes;
                case 1: return marshlands;
                case 2: return tundra;
                case 3: return canopy;
                case 4: return citadel;
                case 5: return semanticExpanse;
                default: return steppes;
            }
        }
    }
}
