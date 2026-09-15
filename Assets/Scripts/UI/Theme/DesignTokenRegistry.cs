using System;
using UnityEngine;

namespace NeuroArena.UI.Theme
{
    /// <summary>
    /// Static C# Registry for NeuroArena Unified Design Tokens.
    /// Provides direct access to colors, spacing scale, corner radii, and motion timing
    /// synchronized exactly with tokens/design-tokens.json and web/design-system.css.
    /// </summary>
    public static class DesignTokenRegistry
    {
        // ==========================================
        // BASE OBSIDIAN VOID PALETTE
        // ==========================================
        public static readonly Color ColorVoid = new Color(0.0196f, 0.0314f, 0.0549f, 1f);      // #05080E
        public static readonly Color ColorSurface = new Color(0.0431f, 0.0667f, 0.1059f, 1f);   // #0B111B
        public static readonly Color ColorElevated = new Color(0.0706f, 0.1059f, 0.1647f, 1f);  // #121B2A
        public static readonly Color ColorOverlay = new Color(0.0196f, 0.0314f, 0.0549f, 0.92f);

        public static readonly Color BorderSubtle = new Color(1f, 1f, 1f, 0.08f);
        public static readonly Color BorderStrong = new Color(1f, 1f, 1f, 0.20f);
        public static readonly Color BorderGlow = new Color(0.2196f, 0.7412f, 0.9725f, 0.35f);  // #38BDF8 @ 35%

        public static readonly Color TextPrimary = new Color(0.9451f, 0.9608f, 0.9765f, 1f);    // #F1F5F9
        public static readonly Color TextSecondary = new Color(0.5804f, 0.6392f, 0.7216f, 1f);  // #94A3B8
        public static readonly Color TextTertiary = new Color(0.3922f, 0.4549f, 0.5451f, 1f);   // #64748B

        // ==========================================
        // STATUS PALETTE
        // ==========================================
        public static readonly Color StatusAlert = new Color(1.0f, 0.1647f, 0.3333f, 1f);       // #FF2A55
        public static readonly Color StatusAlertGlow = new Color(1.0f, 0.1647f, 0.3333f, 0.45f);
        public static readonly Color StatusSuccess = new Color(0.0f, 0.9608f, 0.6078f, 1f);      // #00F59B
        public static readonly Color StatusSuccessGlow = new Color(0.0f, 0.9608f, 0.6078f, 0.45f);
        public static readonly Color StatusWarning = new Color(1.0f, 0.7216f, 0.0f, 1f);         // #FFB800
        public static readonly Color StatusWarningGlow = new Color(1.0f, 0.7216f, 0.0f, 0.40f);

        // ==========================================
        // 6 BIOME ACCENT & SECONDARY COLORS
        // ==========================================
        // 0: Linear Steppes (1D Continuous Regression)
        public static readonly Color Biome0Accent = new Color(0.9608f, 0.6196f, 0.0431f, 1f);    // #F59E0B
        public static readonly Color Biome0Secondary = new Color(0.8510f, 0.4667f, 0.0235f, 1f); // #D97706

        // 1: Binary Marshlands (2D Logistic Classification)
        public static readonly Color Biome1Accent = new Color(0.0627f, 0.7255f, 0.5059f, 1f);    // #10B981
        public static readonly Color Biome1Secondary = new Color(0.0235f, 0.7137f, 0.8314f, 1f); // #06B6D4

        // 2: Variance Tundra (Polynomial & Regularization L1/L2)
        public static readonly Color Biome2Accent = new Color(0.2196f, 0.7412f, 0.9725f, 1f);    // #38BDF8
        public static readonly Color Biome2Secondary = new Color(0.3882f, 0.4000f, 0.9451f, 1f); // #6366F1

        // 3: Branching Canopy (Tree Ensembles & Gini Impurity)
        public static readonly Color Biome3Accent = new Color(0.5176f, 0.8000f, 0.0863f, 1f);    // #84CC16
        public static readonly Color Biome3Secondary = new Color(0.9176f, 0.7020f, 0.0314f, 1f); // #EAB308

        // 4: Deep Synapse Citadel (Neural Networks & Backprop)
        public static readonly Color Biome4Accent = new Color(0.6588f, 0.3333f, 0.9686f, 1f);    // #A855F7
        public static readonly Color Biome4Secondary = new Color(0.9255f, 0.2824f, 0.6000f, 1f); // #EC4899

        // 5: Semantic Expanse (Embeddings & Cosine Singularity)
        public static readonly Color Biome5Accent = new Color(0.0784f, 0.7216f, 0.6510f, 1f);    // #14B8A6
        public static readonly Color Biome5Secondary = new Color(0.9569f, 0.2471f, 0.3686f, 1f); // #F43F5E

        // ==========================================
        // 8PX SPACING GRID (Float units)
        // ==========================================
        public const float SpaceXxs = 2f;
        public const float SpaceXs = 4f;
        public const float SpaceSm = 8f;
        public const float SpaceMd = 16f;
        public const float SpaceLg = 24f;
        public const float SpaceXl = 32f;
        public const float Space2Xl = 48f;
        public const float Space3Xl = 64f;

        // ==========================================
        // CORNER RADII (Pixels)
        // ==========================================
        public const float RadiusSharp = 2f;
        public const float RadiusSm = 4f;
        public const float RadiusMd = 8f;
        public const float RadiusLg = 14f;
        public const float RadiusPill = 9999f;

        // ==========================================
        // MOTION TIMING TOKENS (Seconds)
        // ==========================================
        public const float DurationPanelOpen = 0.24f;       // 240ms (0.16, 1.0, 0.3, 1.0)
        public const float DurationHudValueChange = 0.12f;  // 120ms (0.4, 0.0, 0.2, 1.0)
        public const float DurationAlertFlash = 0.40f;      // 400ms (0.25, 1.0, 0.5, 1.0)
        public const float DurationPageTransition = 0.32f;  // 320ms (0.7, 0.0, 0.84, 0.0)

        /// <summary>
        /// Get primary accent color for biome index 0-5
        /// </summary>
        public static Color GetBiomeAccent(int biomeIndex)
        {
            switch (biomeIndex)
            {
                case 0: return Biome0Accent;
                case 1: return Biome1Accent;
                case 2: return Biome2Accent;
                case 3: return Biome3Accent;
                case 4: return Biome4Accent;
                case 5: return Biome5Accent;
                default: return Biome0Accent;
            }
        }

        /// <summary>
        /// Get secondary accent color for biome index 0-5
        /// </summary>
        public static Color GetBiomeSecondary(int biomeIndex)
        {
            switch (biomeIndex)
            {
                case 0: return Biome0Secondary;
                case 1: return Biome1Secondary;
                case 2: return Biome2Secondary;
                case 3: return Biome3Secondary;
                case 4: return Biome4Secondary;
                case 5: return Biome5Secondary;
                default: return Biome0Secondary;
            }
        }
    }
}
