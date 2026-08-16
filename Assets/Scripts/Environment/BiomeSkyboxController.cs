using UnityEngine;

namespace NeuroArena.Environment
{
    /// <summary>
    /// Coordinates environmental lighting, atmospheric fog, directional mixed/baked sun shadows,
    /// and skybox-driven ambient lighting for each of the 6 biomes in NeuroArena.
    /// Wires directly into BiomePostProcessingManager for HDR Bloom and Color Grading.
    /// </summary>
    public class BiomeSkyboxController : MonoBehaviour
    {
        [Header("Lighting References")]
        [SerializeField] private Light directionalSun;
        [SerializeField] private bool manageFog = true;
        [SerializeField] private BiomePostProcessingManager postProcessingManager;

        public struct BiomeAtmosphere
        {
            public Color skyTopColor;
            public Color horizonColor;
            public Color groundColor;
            public Color sunLightColor;
            public float sunIntensity;
            public Color fogColor;
            public float fogDensity;
        }

        private BiomeAtmosphere[] biomeAtmospheres = new BiomeAtmosphere[6]
        {
            // Biome 1: The Linear Steppes (Amber / Earth)
            new BiomeAtmosphere {
                skyTopColor = new Color(0.18f, 0.12f, 0.28f),
                horizonColor = new Color(0.96f, 0.62f, 0.18f),
                groundColor = new Color(0.35f, 0.20f, 0.10f),
                sunLightColor = new Color(1.0f, 0.88f, 0.70f),
                sunIntensity = 1.30f,
                fogColor = new Color(0.85f, 0.58f, 0.22f),
                fogDensity = 0.012f
            },
            // Biome 2: The Binary Marshlands (Teal / Violet)
            new BiomeAtmosphere {
                skyTopColor = new Color(0.12f, 0.06f, 0.22f),
                horizonColor = new Color(0.15f, 0.75f, 0.65f),
                groundColor = new Color(0.04f, 0.18f, 0.16f),
                sunLightColor = new Color(0.55f, 0.95f, 0.90f),
                sunIntensity = 0.95f,
                fogColor = new Color(0.08f, 0.35f, 0.35f),
                fogDensity = 0.022f
            },
            // Biome 3: The Variance Tundra (Ice-Blue / Frost)
            new BiomeAtmosphere {
                skyTopColor = new Color(0.08f, 0.22f, 0.38f),
                horizonColor = new Color(0.65f, 0.88f, 0.98f),
                groundColor = new Color(0.20f, 0.35f, 0.45f),
                sunLightColor = new Color(0.85f, 0.95f, 1.0f),
                sunIntensity = 1.35f,
                fogColor = new Color(0.60f, 0.80f, 0.95f),
                fogDensity = 0.015f
            },
            // Biome 4: The Branching Canopy (Emerald Green / Gold)
            new BiomeAtmosphere {
                skyTopColor = new Color(0.05f, 0.25f, 0.18f),
                horizonColor = new Color(0.88f, 0.85f, 0.40f),
                groundColor = new Color(0.08f, 0.35f, 0.20f),
                sunLightColor = new Color(1.0f, 0.95f, 0.75f),
                sunIntensity = 1.15f,
                fogColor = new Color(0.22f, 0.55f, 0.38f),
                fogDensity = 0.014f
            },
            // Biome 5: The Deep Synapse Citadel (Neon Purple / Cyan)
            new BiomeAtmosphere {
                skyTopColor = new Color(0.06f, 0.04f, 0.12f),
                horizonColor = new Color(0.68f, 0.25f, 0.95f),
                groundColor = new Color(0.05f, 0.08f, 0.16f),
                sunLightColor = new Color(0.45f, 0.85f, 1.0f),
                sunIntensity = 0.90f,
                fogColor = new Color(0.35f, 0.15f, 0.55f),
                fogDensity = 0.018f
            },
            // Biome 6: The Semantic Expanse (Starlit White / Holographic Indigo)
            new BiomeAtmosphere {
                skyTopColor = new Color(0.02f, 0.04f, 0.10f),
                horizonColor = new Color(0.55f, 0.58f, 0.98f),
                groundColor = new Color(0.12f, 0.14f, 0.28f),
                sunLightColor = new Color(0.95f, 0.95f, 1.0f),
                sunIntensity = 1.10f,
                fogColor = new Color(0.38f, 0.42f, 0.75f),
                fogDensity = 0.012f
            }
        };

        private void Awake()
        {
            SetupDirectionalSun();
            if (postProcessingManager == null)
            {
                postProcessingManager = FindFirstObjectByType<BiomePostProcessingManager>();
            }
        }

        private void SetupDirectionalSun()
        {
            if (directionalSun == null)
            {
                Light[] lights = FindObjectsByType<Light>(FindObjectsSortMode.None);
                foreach (var l in lights)
                {
                    if (l.type == LightType.Directional)
                    {
                        directionalSun = l;
                        break;
                    }
                }
            }

            if (directionalSun != null)
            {
                directionalSun.shadows = LightShadows.Soft;
                directionalSun.shadowStrength = 0.75f;
                directionalSun.shadowBias = 0.05f;
                directionalSun.shadowNormalBias = 0.4f;
            }
        }

        public void ApplyBiomeAtmosphere(int biomeIndex)
        {
            biomeIndex = Mathf.Clamp(biomeIndex, 0, 5);
            BiomeAtmosphere atmo = biomeAtmospheres[biomeIndex];

            // 1. Configure Lighting & Ambient
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = atmo.skyTopColor * 1.5f;
            RenderSettings.ambientEquatorColor = atmo.horizonColor;
            RenderSettings.ambientGroundColor = atmo.groundColor;

            if (directionalSun != null)
            {
                directionalSun.color = atmo.sunLightColor;
                directionalSun.intensity = atmo.sunIntensity;
            }

            // 2. Configure Atmospheric Distance Fog
            if (manageFog)
            {
                RenderSettings.fog = true;
                RenderSettings.fogMode = FogMode.ExponentialSquared;
                RenderSettings.fogColor = atmo.fogColor;
                RenderSettings.fogDensity = atmo.fogDensity;
            }

            // 3. Configure Camera Background / Skybox
            if (Camera.main != null)
            {
                Camera.main.clearFlags = CameraClearFlags.SolidColor;
                Camera.main.backgroundColor = atmo.skyTopColor;
            }

            // 4. Update URP Post Processing Volume (Bloom, Color Adjustments, ACES)
            if (postProcessingManager == null)
            {
                postProcessingManager = FindFirstObjectByType<BiomePostProcessingManager>();
            }
            if (postProcessingManager != null)
            {
                postProcessingManager.ApplyBiomePostProcessing(biomeIndex);
            }
        }
    }
}
