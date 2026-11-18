using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace NeuroArena.Environment
{
    /// <summary>
    /// Manages Universal Render Pipeline (URP) Post-Processing Volumes across all 6 biomes.
    /// Drives HDR Bloom, Color Grading / Color Adjustments, ACES Tonemapping,
    /// and Cinematic Vignette matched to each biome's Stage 18 color palette.
    /// </summary>
    [RequireComponent(typeof(Volume))]
    public class BiomePostProcessingManager : MonoBehaviour
    {
        public static BiomePostProcessingManager Instance { get; private set; }

        private Volume globalVolume;
        private VolumeProfile profile;

        private Bloom bloom;
        private ColorAdjustments colorAdjustments;
        private Vignette vignette;
        private Tonemapping tonemapping;
        private WhiteBalance whiteBalance;

        public struct BiomeColorGrading
        {
            public Color filterColor;
            public Color bloomTint;
            public float bloomIntensity;
            public float contrast;
            public float saturation;
            public float temperature;
            public float tint;
        }

        private BiomeColorGrading[] biomeGradingProfiles = new BiomeColorGrading[6]
        {
            // Biome 1: The Linear Steppes (Warm Amber / Golden Earth)
            new BiomeColorGrading {
                filterColor = new Color(1.0f, 0.94f, 0.82f),
                bloomTint = new Color(0.98f, 0.75f, 0.25f),
                bloomIntensity = 1.75f,
                contrast = 20f,
                saturation = 22f,
                temperature = 18f,
                tint = 4f
            },
            // Biome 2: The Binary Marshlands (Teal / Bioluminescent Violet)
            new BiomeColorGrading {
                filterColor = new Color(0.85f, 1.0f, 0.98f),
                bloomTint = new Color(0.18f, 0.92f, 0.85f),
                bloomIntensity = 2.1f,
                contrast = 24f,
                saturation = 26f,
                temperature = -12f,
                tint = 15f
            },
            // Biome 3: The Variance Tundra (Polar Ice-Blue / Frost)
            new BiomeColorGrading {
                filterColor = new Color(0.88f, 0.96f, 1.0f),
                bloomTint = new Color(0.38f, 0.82f, 0.98f),
                bloomIntensity = 1.9f,
                contrast = 26f,
                saturation = 18f,
                temperature = -28f,
                tint = -6f
            },
            // Biome 4: The Branching Canopy (Lush Emerald / Gold Sunshine)
            new BiomeColorGrading {
                filterColor = new Color(0.92f, 1.0f, 0.92f),
                bloomTint = new Color(0.15f, 0.95f, 0.55f),
                bloomIntensity = 1.8f,
                contrast = 22f,
                saturation = 28f,
                temperature = 8f,
                tint = -14f
            },
            // Biome 5: The Deep Synapse Citadel (Cyber Neon Purple / Electric Cyan)
            new BiomeColorGrading {
                filterColor = new Color(0.95f, 0.88f, 1.0f),
                bloomTint = new Color(0.85f, 0.35f, 1.0f),
                bloomIntensity = 2.4f, // High synthwave bloom glow
                contrast = 30f,
                saturation = 32f,
                temperature = -8f,
                tint = 25f
            },
            // Biome 6: The Semantic Expanse (Starlit Cosmic Hologram / Indigo)
            new BiomeColorGrading {
                filterColor = new Color(0.95f, 0.96f, 1.0f),
                bloomTint = new Color(0.65f, 0.72f, 1.0f),
                bloomIntensity = 2.0f,
                contrast = 28f,
                saturation = 24f,
                temperature = -15f,
                tint = 10f
            }
        };

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;

            InitializeVolumeStack();
        }

        private void InitializeVolumeStack()
        {
            globalVolume = GetComponent<Volume>();
            if (globalVolume == null)
            {
                globalVolume = gameObject.AddComponent<Volume>();
            }

            globalVolume.isGlobal = true;
            globalVolume.priority = 10.0f;

            profile = ScriptableObject.CreateInstance<VolumeProfile>();
            profile.name = "NeuroArena_BiomeVolumeProfile";
            globalVolume.profile = profile;

            // 1. Bloom Override
            if (!profile.TryGet(out bloom))
            {
                bloom = profile.Add<Bloom>(true);
            }
            bloom.threshold.Override(0.85f);
            bloom.intensity.Override(1.8f);
            bloom.scatter.Override(0.72f);

            // 2. Color Adjustments Override
            if (!profile.TryGet(out colorAdjustments))
            {
                colorAdjustments = profile.Add<ColorAdjustments>(true);
            }
            colorAdjustments.postExposure.Override(0.20f);
            colorAdjustments.contrast.Override(22f);
            colorAdjustments.saturation.Override(20f);

            // 3. Tonemapping (ACES for rich filmic gamut)
            if (!profile.TryGet(out tonemapping))
            {
                tonemapping = profile.Add<Tonemapping>(true);
            }
            tonemapping.mode.Override(TonemappingMode.ACES);

            // 4. Vignette Override
            if (!profile.TryGet(out vignette))
            {
                vignette = profile.Add<Vignette>(true);
            }
            vignette.intensity.Override(0.26f);
            vignette.smoothness.Override(0.42f);
            vignette.rounded.Override(false);

            // 5. White Balance Override
            if (!profile.TryGet(out whiteBalance))
            {
                whiteBalance = profile.Add<WhiteBalance>(true);
            }
        }

        public void ApplyBiomePostProcessing(int biomeIndex)
        {
            biomeIndex = Mathf.Clamp(biomeIndex, 0, 5);
            if (profile == null) InitializeVolumeStack();

            BiomeColorGrading grading = biomeGradingProfiles[biomeIndex];

            // Update Bloom
            if (bloom != null)
            {
                bloom.tint.Override(grading.bloomTint);
                bloom.intensity.Override(grading.bloomIntensity);
            }

            // Update Color Grading
            if (colorAdjustments != null)
            {
                colorAdjustments.colorFilter.Override(grading.filterColor);
                colorAdjustments.contrast.Override(grading.contrast);
                colorAdjustments.saturation.Override(grading.saturation);
            }

            // Update White Balance
            if (whiteBalance != null)
            {
                whiteBalance.temperature.Override(grading.temperature);
                whiteBalance.tint.Override(grading.tint);
            }
        }
    }
}
