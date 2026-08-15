using System;
using UnityEngine;

namespace NeuroArena.Core
{
    public enum HardwareTier
    {
        LowEnd_2GB,      // <= 2500 MB RAM (Budget Mali/Adreno, 30 FPS lock)
        MidRange_4to6GB, // 2501 - 6500 MB RAM (60 FPS standard)
        Flagship_8GBPlus // > 6500 MB RAM (60-120 FPS Ultra)
    }

    /// <summary>
    /// Multi-Tier Mobile Hardware Profiler & Low-End Optimizer:
    /// Automatically classifies hardware capabilities and enforces strict memory budgets,
    /// particle pool clamps, and zero-allocation buffer reuse on low-end devices.
    /// </summary>
    public class DeviceTierManager : MonoBehaviour
    {
        public static DeviceTierManager Instance { get; private set; }

        [Header("Active Hardware Profile")]
        [SerializeField] private HardwareTier detectedTier = HardwareTier.MidRange_4to6GB;
        [SerializeField] private int maxParticleBurstCount = 80;
        [SerializeField] private int targetFrameRate = 60;
        [SerializeField] private bool allowHighQualityPostFX = true;
        [SerializeField] private float resolutionScale = 1.0f;

        public HardwareTier DetectedTier => detectedTier;
        public int MaxParticleBurstCount => maxParticleBurstCount;
        public int TargetFrameRate => targetFrameRate;
        public bool AllowHighQualityPostFX => allowHighQualityPostFX;
        public float ResolutionScale => resolutionScale;

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
                DetectAndApplyHardwareTier();
            }
            else
            {
                Destroy(gameObject);
            }
        }

        public void DetectAndApplyHardwareTier()
        {
            int ramMB = SystemInfo.systemMemorySize;
            int gpuRamMB = SystemInfo.graphicsMemorySize;

            if (ramMB <= 2500 || gpuRamMB <= 512)
            {
                // Low-End Tier (2GB Class) - Strict Safeguards
                detectedTier = HardwareTier.LowEnd_2GB;
                maxParticleBurstCount = 25;
                targetFrameRate = 30;
                allowHighQualityPostFX = false;
                resolutionScale = 0.75f;
            }
            else if (ramMB <= 6500)
            {
                // Mid-Range Tier (4-6GB Class)
                detectedTier = HardwareTier.MidRange_4to6GB;
                maxParticleBurstCount = 80;
                targetFrameRate = 60;
                allowHighQualityPostFX = true;
                resolutionScale = 1.0f;
            }
            else
            {
                // Flagship Tier (8GB+ Class)
                detectedTier = HardwareTier.Flagship_8GBPlus;
                maxParticleBurstCount = 150;
                targetFrameRate = 60; // or 120 if display supports
                allowHighQualityPostFX = true;
                resolutionScale = 1.0f;
            }

            ApplyProfileSettings();
        }

        public void SetManualTier(HardwareTier tier)
        {
            detectedTier = tier;
            switch (tier)
            {
                case HardwareTier.LowEnd_2GB:
                    maxParticleBurstCount = 25;
                    targetFrameRate = 30;
                    allowHighQualityPostFX = false;
                    resolutionScale = 0.75f;
                    break;
                case HardwareTier.MidRange_4to6GB:
                    maxParticleBurstCount = 80;
                    targetFrameRate = 60;
                    allowHighQualityPostFX = true;
                    resolutionScale = 1.0f;
                    break;
                case HardwareTier.Flagship_8GBPlus:
                    maxParticleBurstCount = 150;
                    targetFrameRate = 60;
                    allowHighQualityPostFX = true;
                    resolutionScale = 1.0f;
                    break;
            }
            ApplyProfileSettings();
        }

        private void ApplyProfileSettings()
        {
            Application.targetFrameRate = targetFrameRate;
            QualitySettings.vSyncCount = 0;

            if (detectedTier == HardwareTier.LowEnd_2GB)
            {
                QualitySettings.masterTextureLimit = 1; // Half-res textures on 2GB devices
                QualitySettings.shadowDistance = 25f;
                QualitySettings.shadowCascades = 1;
            }
            else
            {
                QualitySettings.masterTextureLimit = 0;
                QualitySettings.shadowDistance = 50f;
                QualitySettings.shadowCascades = 2;
            }

            Debug.Log($"[DeviceTierManager] Applied {detectedTier} Profile: MaxParticles={maxParticleBurstCount}, TargetFPS={targetFrameRate}, ResolutionScale={resolutionScale:F2}");
        }
    }
}
