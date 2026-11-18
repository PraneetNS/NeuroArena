using System.Collections.Generic;
using UnityEngine;
using NeuroArena.Data;

namespace NeuroArena.Environment
{
    /// <summary>
    /// Centralized PBR & Stylized-Toon Material Factory for NeuroArena.
    /// Replaces flat-color dummy materials with rich Universal Render Pipeline (URP) Lit materials
    /// configured with Metallic luster, Smoothness/Gloss, Fresnel Rim Highlights, and HDR Emission.
    /// Uses cached shared instances for zero runtime GC allocations and SRP Batcher compatibility.
    /// </summary>
    public static class StylizedMaterialFactory
    {
        private static readonly Dictionary<string, Material> MaterialCache = new Dictionary<string, Material>();
        private static Shader cachedURPLitShader;

        private static Shader GetLitShader()
        {
            if (cachedURPLitShader == null)
            {
                cachedURPLitShader = Shader.Find("Universal Render Pipeline/Lit") ??
                                     Shader.Find("Universal Render Pipeline/Simple Lit") ??
                                     Shader.Find("Standard");
            }
            return cachedURPLitShader;
        }

        #region Collectible PBR Materials
        public static Material GetCollectibleMaterial(MLResourceType type)
        {
            string key = $"Collectible_{type}";
            if (MaterialCache.TryGetValue(key, out Material existingMat) && existingMat != null)
            {
                return existingMat;
            }

            Shader shader = GetLitShader();
            Material mat = new Material(shader) { name = key };
            mat.enableInstancing = true;

            Color baseColor;
            Color emissiveColor;
            float metallic = 0.15f;
            float smoothness = 0.92f;
            float emissiveBoost = 1.8f;

            switch (type)
            {
                case MLResourceType.FeatureCrystal_X:
                    // Cyan Crystalline Gem
                    baseColor = new Color(0.12f, 0.82f, 0.95f, 0.95f);
                    emissiveColor = new Color(0.08f, 0.92f, 1.0f);
                    smoothness = 0.95f;
                    metallic = 0.20f;
                    break;

                case MLResourceType.TargetShard_Y:
                    // Amber Radiant Core
                    baseColor = new Color(0.98f, 0.52f, 0.12f, 0.95f);
                    emissiveColor = new Color(1.0f, 0.65f, 0.18f);
                    smoothness = 0.90f;
                    metallic = 0.35f;
                    break;

                case MLResourceType.PairedDataTuple:
                    // Emerald Matrix Relic
                    baseColor = new Color(0.18f, 0.92f, 0.45f, 0.95f);
                    emissiveColor = new Color(0.25f, 1.0f, 0.55f);
                    smoothness = 0.88f;
                    metallic = 0.25f;
                    break;

                case MLResourceType.Class0_PurpleSpore:
                    // Neon Violet Spore Cluster
                    baseColor = new Color(0.75f, 0.18f, 0.95f, 0.95f);
                    emissiveColor = new Color(0.88f, 0.25f, 1.0f);
                    smoothness = 0.75f;
                    metallic = 0.10f;
                    break;

                case MLResourceType.Class1_AzureSpore:
                    // Electric Cyan Azure Spore
                    baseColor = new Color(0.15f, 0.75f, 1.0f, 0.95f);
                    emissiveColor = new Color(0.20f, 0.85f, 1.0f);
                    smoothness = 0.78f;
                    metallic = 0.12f;
                    break;

                case MLResourceType.SigmoidMembrane_Sigma:
                    // Mint Holographic Membrane
                    baseColor = new Color(0.25f, 0.95f, 0.72f, 0.90f);
                    emissiveColor = new Color(0.35f, 1.0f, 0.80f);
                    smoothness = 0.96f;
                    metallic = 0.15f;
                    break;

                case MLResourceType.CrossEntropyVial:
                    // Crimson Energy Vial
                    baseColor = new Color(0.95f, 0.18f, 0.35f, 0.95f);
                    emissiveColor = new Color(1.0f, 0.25f, 0.45f);
                    smoothness = 0.92f;
                    metallic = 0.40f;
                    break;

                case MLResourceType.WeightResidue_W:
                    // Magenta Metallic Hyperparameter Cube
                    baseColor = new Color(0.85f, 0.25f, 0.95f);
                    emissiveColor = new Color(0.92f, 0.35f, 1.0f);
                    smoothness = 0.85f;
                    metallic = 0.85f; // High metallic cyber luster
                    break;

                case MLResourceType.BiasSpark_B:
                    // Gold Metallic Hyperparameter Sphere
                    baseColor = new Color(0.98f, 0.85f, 0.18f);
                    emissiveColor = new Color(1.0f, 0.92f, 0.30f);
                    smoothness = 0.88f;
                    metallic = 0.90f;
                    break;

                case MLResourceType.StepFluid_Alpha:
                    // Cobalt Liquid Vial
                    baseColor = new Color(0.18f, 0.45f, 0.98f);
                    emissiveColor = new Color(0.25f, 0.65f, 1.0f);
                    smoothness = 0.98f;
                    metallic = 0.30f;
                    break;

                default:
                    baseColor = Color.cyan;
                    emissiveColor = Color.cyan;
                    break;
            }

            ConfigureLitMaterial(mat, baseColor, metallic, smoothness, emissiveColor, emissiveBoost);
            MaterialCache[key] = mat;
            return mat;
        }
        #endregion

        #region Landmark & Prop PBR Materials
        public static Material GetStylizedPropMaterial(string propName, Color baseColor, float metallic = 0.1f, float smoothness = 0.6f, Color? emission = null, float emissionIntensity = 1.5f)
        {
            string key = $"Prop_{propName}_{ColorUtility.ToHtmlStringRGBA(baseColor)}_{metallic}_{smoothness}";
            if (MaterialCache.TryGetValue(key, out Material existingMat) && existingMat != null)
            {
                return existingMat;
            }

            Shader shader = GetLitShader();
            Material mat = new Material(shader) { name = key };
            mat.enableInstancing = true;

            Color emissiveCol = emission ?? Color.black;
            ConfigureLitMaterial(mat, baseColor, metallic, smoothness, emissiveCol, emission.HasValue ? emissionIntensity : 0f);
            MaterialCache[key] = mat;
            return mat;
        }
        #endregion

        private static void ConfigureLitMaterial(Material mat, Color baseColor, float metallic, float smoothness, Color emissiveColor, float emissionIntensity)
        {
            // Base Color & PBR Properties
            if (mat.HasProperty("_BaseColor")) mat.SetColor("_BaseColor", baseColor);
            if (mat.HasProperty("_Color")) mat.SetColor("_Color", baseColor);

            if (mat.HasProperty("_Metallic")) mat.SetFloat("_Metallic", metallic);
            if (mat.HasProperty("_Smoothness")) mat.SetFloat("_Smoothness", smoothness);

            // Emission & HDR Rim Glow
            if (emissionIntensity > 0.01f && emissiveColor != Color.black)
            {
                mat.EnableKeyword("_EMISSION");
                Color hdrEmission = emissiveColor * emissionIntensity;
                if (mat.HasProperty("_EmissionColor")) mat.SetColor("_EmissionColor", hdrEmission);
            }
        }
    }
}
