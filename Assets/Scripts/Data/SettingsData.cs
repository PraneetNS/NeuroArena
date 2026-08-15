using System;
using UnityEngine;

namespace NeuroArena.Data
{
    public enum GraphicsTier
    {
        Low,
        Medium,
        High
    }

    public enum HandednessMode
    {
        LeftHanded,  // Joystick Left, Look Right
        RightHanded  // Joystick Right, Look Left
    }

    public enum TextScaleMode
    {
        Normal,  // 100%
        Large,   // 125%
        ExtraLarge // 150%
    }

    /// <summary>
    /// Comprehensive Player Settings Data Model.
    /// Serializes audio, graphics performance tiers, control handedness, accessibility options, and frame rate targets.
    /// </summary>
    [Serializable]
    public class SettingsData
    {
        [Header("Audio Settings")]
        public float masterVolume = 1.0f;
        public float musicVolume = 0.80f;
        public float sfxVolume = 0.85f;
        public bool isMuted = false;

        [Header("Graphics Quality Tiers (Stage 25 Android Scaling)")]
        public GraphicsTier graphicsTier = GraphicsTier.High;
        public int particleDensity = 150; // 30 (Low), 80 (Medium), 150 (High)
        public int shadowQuality = 2;     // 0 = Off, 1 = Low, 2 = High
        public int targetFrameRate = 60;  // 30 or 60 FPS

        [Header("Controls & Touch Ergonomics")]
        public HandednessMode handedness = HandednessMode.LeftHanded;
        public float lookSensitivity = 1.0f; // 0.5x to 2.5x
        public bool gyroscopeEnabled = true;

        [Header("Accessibility & Telemetry")]
        public bool colorblindSafePalette = false; // Blue/Orange/Yellow instead of Red/Green
        public TextScaleMode textScale = TextScaleMode.Normal;
        public bool narrationEnabled = true;
        public bool diagnosticsOptIn = false;

        private const string PREFS_KEY = "neuroarena_comprehensive_settings_v2";

        public static SettingsData LoadSettings()
        {
            if (PlayerPrefs.HasKey(PREFS_KEY))
            {
                try
                {
                    string json = PlayerPrefs.GetString(PREFS_KEY);
                    return JsonUtility.FromJson<SettingsData>(json) ?? new SettingsData();
                }
                catch
                {
                    return new SettingsData();
                }
            }
            return new SettingsData();
        }

        public void SaveSettings()
        {
            string json = JsonUtility.ToJson(this);
            PlayerPrefs.SetString(PREFS_KEY, json);
            PlayerPrefs.Save();
        }
    }
}
