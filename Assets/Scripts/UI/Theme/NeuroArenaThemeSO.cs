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
        public float radiusSmall = 6f;
        public float radiusMedium = 12f;
        public float radiusLarge = 18f;

        [Header("Glassmorphism & Border Rules")]
        public float borderWidth = 1.0f;
        public float glassAlpha = 0.94f;

        [Header("6 Per-Biome Palettes")]
        public BiomePalette steppes = new BiomePalette
        {
            biomeName = "The Linear Steppes",
            primary = new Color(0.96f, 0.62f, 0.04f),      // Amber
            secondary = new Color(0.47f, 0.21f, 0.06f),    // Deep Earth
            accent = new Color(1.0f, 0.78f, 0.28f),       // Bright Amber
            background = new Color(0.08f, 0.06f, 0.04f, 0.95f),
            border = new Color(0.96f, 0.62f, 0.04f, 0.35f),
            textPrimary = new Color(0.99f, 0.95f, 0.78f),
            textSecondary = new Color(0.85f, 0.75f, 0.60f),
            glow = new Color(0.96f, 0.62f, 0.04f, 0.6f)
        };

        public BiomePalette marshlands = new BiomePalette
        {
            biomeName = "The Binary Marshlands",
            primary = new Color(0.08f, 0.72f, 0.65f),      // Teal
            secondary = new Color(0.55f, 0.36f, 0.96f),    // Violet
            accent = new Color(0.20f, 0.95f, 0.85f),       // Cyan-Teal
            background = new Color(0.02f, 0.08f, 0.08f, 0.95f),
            border = new Color(0.08f, 0.72f, 0.65f, 0.35f),
            textPrimary = new Color(0.85f, 0.98f, 0.95f),
            textSecondary = new Color(0.70f, 0.75f, 0.90f),
            glow = new Color(0.08f, 0.72f, 0.65f, 0.6f)
        };

        public BiomePalette tundra = new BiomePalette
        {
            biomeName = "The Variance Tundra",
            primary = new Color(0.22f, 0.74f, 0.97f),      // Ice Blue
            secondary = new Color(0.05f, 0.29f, 0.43f),    // Glacial Deep
            accent = new Color(0.73f, 0.90f, 0.99f),       // Frost White
            background = new Color(0.03f, 0.07f, 0.12f, 0.95f),
            border = new Color(0.22f, 0.74f, 0.97f, 0.35f),
            textPrimary = new Color(0.90f, 0.96f, 1.0f),
            textSecondary = new Color(0.65f, 0.80f, 0.92f),
            glow = new Color(0.22f, 0.74f, 0.97f, 0.6f)
        };

        public BiomePalette canopy = new BiomePalette
        {
            biomeName = "The Branching Canopy",
            primary = new Color(0.06f, 0.73f, 0.51f),      // Emerald Green
            secondary = new Color(0.98f, 0.75f, 0.14f),    // Gold
            accent = new Color(0.20f, 0.95f, 0.65f),       // Vivid Mint
            background = new Color(0.02f, 0.09f, 0.05f, 0.95f),
            border = new Color(0.06f, 0.73f, 0.51f, 0.35f),
            textPrimary = new Color(0.88f, 0.98f, 0.92f),
            textSecondary = new Color(0.75f, 0.88f, 0.70f),
            glow = new Color(0.06f, 0.73f, 0.51f, 0.6f)
        };

        public BiomePalette citadel = new BiomePalette
        {
            biomeName = "The Deep Synapse Citadel",
            primary = new Color(0.66f, 0.33f, 0.97f),      // Neon Purple
            secondary = new Color(0.02f, 0.71f, 0.83f),    // Electric Cyan
            accent = new Color(0.85f, 0.55f, 1.0f),        // Bright Violet
            background = new Color(0.06f, 0.04f, 0.11f, 0.95f),
            border = new Color(0.66f, 0.33f, 0.97f, 0.35f),
            textPrimary = new Color(0.95f, 0.90f, 1.0f),
            textSecondary = new Color(0.75f, 0.70f, 0.90f),
            glow = new Color(0.66f, 0.33f, 0.97f, 0.6f)
        };

        public BiomePalette semanticExpanse = new BiomePalette
        {
            biomeName = "The Semantic Expanse",
            primary = new Color(0.97f, 0.98f, 0.99f),      // Starlit White
            secondary = new Color(0.51f, 0.55f, 0.97f),    // Holographic Indigo
            accent = new Color(0.22f, 0.74f, 0.97f),       // Cyber Sky
            background = new Color(0.02f, 0.04f, 0.08f, 0.96f),
            border = new Color(0.97f, 0.98f, 0.99f, 0.40f),
            textPrimary = new Color(1.0f, 1.0f, 1.0f),
            textSecondary = new Color(0.80f, 0.85f, 0.95f),
            glow = new Color(0.51f, 0.55f, 0.97f, 0.7f)
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
