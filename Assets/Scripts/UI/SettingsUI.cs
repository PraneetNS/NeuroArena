using System;
using UnityEngine;
using NeuroArena.Data;
using NeuroArena.Core;

namespace NeuroArena.UI
{
    public enum SettingsTab
    {
        Audio,
        Graphics,
        Controls,
        Accessibility,
        DangerZone
    }

    /// <summary>
    /// Comprehensive Settings Screen UI.
    /// Manages audio volume/mute, graphics scalability tiers (particles, shadows, FPS),
    /// control handedness & sensitivity, colorblind accessibility, and confirm-twice progress reset.
    /// </summary>
    public class SettingsUI : MonoBehaviour
    {
        public static SettingsUI Instance { get; private set; }

        [SerializeField] private bool isOpen = false;
        private SettingsData settings;
        private SettingsTab currentTab = SettingsTab.Audio;

        private int resetConfirmStep = 0; // 0 = idle, 1 = first click warning, 2 = confirmed reset
        private float resetWarningTimer = 0f;

        private GUIStyle panelStyle;
        private GUIStyle titleStyle;
        private GUIStyle sectionHeaderStyle;
        private GUIStyle labelStyle;
        private GUIStyle buttonStyle;
        private GUIStyle activeTabStyle;
        private GUIStyle dangerButtonStyle;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            settings = SettingsData.LoadSettings();
            ApplySettings();
        }

        private void Update()
        {
            if (resetConfirmStep == 1)
            {
                resetWarningTimer += Time.unscaledDeltaTime;
                if (resetWarningTimer > 5.0f)
                {
                    resetConfirmStep = 0; // Reset confirmation timeout
                }
            }
        }

        public void OpenSettings()
        {
            isOpen = true;
            resetConfirmStep = 0;
        }

        public void CloseSettings()
        {
            isOpen = false;
            resetConfirmStep = 0;
            settings.SaveSettings();
            ApplySettings();
        }

        public void ToggleSettings() { if (isOpen) CloseSettings(); else OpenSettings(); }

        public void ApplySettings()
        {
            // Audio
            AudioListener.volume = settings.isMuted ? 0f : settings.masterVolume;

            // Graphics Tiers
            Application.targetFrameRate = settings.targetFrameRate;
            QualitySettings.vSyncCount = 0;
            QualitySettings.shadows = (settings.shadowQuality == 0) ? ShadowQuality.Disable : ((settings.shadowQuality == 1) ? ShadowQuality.HardOnly : ShadowQuality.All);

            // Controls Handedness
            if (VirtualJoystick.Instance != null)
            {
                VirtualJoystick.Instance.SetHandedness(settings.handedness == HandednessMode.LeftHanded);
            }
        }

        private void OnGUI()
        {
            if (!isOpen) return;

            InitStyles();
            float scale = Screen.dpi > 0 ? Screen.dpi / 160f : 1f;

            float w = Mathf.Min(640 * scale, Screen.width * 0.94f);
            float h = Mathf.Min(520 * scale, Screen.height * 0.92f);
            Rect modalRect = new Rect((Screen.width - w) * 0.5f, (Screen.height - h) * 0.5f, w, h);

            GUI.Box(modalRect, GUIContent.none, panelStyle);
            GUILayout.BeginArea(modalRect);

            // Header
            GUILayout.BeginHorizontal();
            GUILayout.Label("⚙️ <b>GAME SETTINGS & ACCESSIBILITY</b>", titleStyle);
            GUILayout.FlexibleSpace();
            if (GUILayout.Button("✕ Close", buttonStyle, GUILayout.Width(75 * scale), GUILayout.Height(28 * scale)))
            {
                CloseSettings();
            }
            GUILayout.EndHorizontal();

            GUILayout.Space(8 * scale);

            // Tab Buttons
            GUILayout.BeginHorizontal();
            if (GUILayout.Button("🔊 Audio", currentTab == SettingsTab.Audio ? activeTabStyle : buttonStyle, GUILayout.Height(30 * scale))) currentTab = SettingsTab.Audio;
            if (GUILayout.Button("📱 Graphics", currentTab == SettingsTab.Graphics ? activeTabStyle : buttonStyle, GUILayout.Height(30 * scale))) currentTab = SettingsTab.Graphics;
            if (GUILayout.Button("🎮 Controls", currentTab == SettingsTab.Controls ? activeTabStyle : buttonStyle, GUILayout.Height(30 * scale))) currentTab = SettingsTab.Controls;
            if (GUILayout.Button("👁️ Access", currentTab == SettingsTab.Accessibility ? activeTabStyle : buttonStyle, GUILayout.Height(30 * scale))) currentTab = SettingsTab.Accessibility;
            if (GUILayout.Button("⚠️ Reset", currentTab == SettingsTab.DangerZone ? activeTabStyle : buttonStyle, GUILayout.Height(30 * scale))) currentTab = SettingsTab.DangerZone;
            GUILayout.EndHorizontal();

            GUILayout.Space(12 * scale);

            // Tab Content
            switch (currentTab)
            {
                case SettingsTab.Audio:
                    DrawAudioTab(scale);
                    break;
                case SettingsTab.Graphics:
                    DrawGraphicsTab(scale);
                    break;
                case SettingsTab.Controls:
                    DrawControlsTab(scale);
                    break;
                case SettingsTab.Accessibility:
                    DrawAccessibilityTab(scale);
                    break;
                case SettingsTab.DangerZone:
                    DrawDangerZoneTab(scale);
                    break;
            }

            GUILayout.FlexibleSpace();
            if (GUILayout.Button("💾 <b>APPLY & SAVE PREFERENCES</b>", buttonStyle, GUILayout.Height(36 * scale)))
            {
                CloseSettings();
            }

            GUILayout.EndArea();
        }

        private void DrawAudioTab(float scale)
        {
            GUILayout.Label("<b>AUDIO CHANNELS & SYNTHESIS:</b>", sectionHeaderStyle);

            GUILayout.Label($"🔊 <b>Master Volume:</b> {Mathf.RoundToInt(settings.masterVolume * 100)}%", labelStyle);
            settings.masterVolume = GUILayout.HorizontalSlider(settings.masterVolume, 0f, 1f);
            GUILayout.Space(6 * scale);

            GUILayout.Label($"🎵 <b>Music Volume:</b> {Mathf.RoundToInt(settings.musicVolume * 100)}%", labelStyle);
            settings.musicVolume = GUILayout.HorizontalSlider(settings.musicVolume, 0f, 1f);
            GUILayout.Space(6 * scale);

            GUILayout.Label($"⚡ <b>SFX Synthesis Volume:</b> {Mathf.RoundToInt(settings.sfxVolume * 100)}%", labelStyle);
            settings.sfxVolume = GUILayout.HorizontalSlider(settings.sfxVolume, 0f, 1f);
            GUILayout.Space(10 * scale);

            GUILayout.BeginHorizontal();
            GUILayout.Label("🔇 <b>Master Audio Mute:</b>", labelStyle);
            string muteLabel = settings.isMuted ? "<color=#F87171>MUTED</color>" : "<color=#4ADE80>UNMUTED</color>";
            if (GUILayout.Button(muteLabel, buttonStyle, GUILayout.Width(110 * scale), GUILayout.Height(28 * scale)))
            {
                settings.isMuted = !settings.isMuted;
                ApplySettings();
            }
            GUILayout.EndHorizontal();
        }

        private void DrawGraphicsTab(float scale)
        {
            GUILayout.Label("<b>GRAPHICS TIERS & ANDROID PERFORMANCE:</b>", sectionHeaderStyle);

            // Presets
            GUILayout.BeginHorizontal();
            GUILayout.Label("<b>Quality Tier:</b>", labelStyle, GUILayout.Width(120 * scale));
            if (GUILayout.Button("Low", settings.graphicsTier == GraphicsTier.Low ? activeTabStyle : buttonStyle, GUILayout.Width(70 * scale)))
            {
                settings.graphicsTier = GraphicsTier.Low;
                settings.particleDensity = 30;
                settings.shadowQuality = 0;
                settings.targetFrameRate = 30;
            }
            if (GUILayout.Button("Medium", settings.graphicsTier == GraphicsTier.Medium ? activeTabStyle : buttonStyle, GUILayout.Width(75 * scale)))
            {
                settings.graphicsTier = GraphicsTier.Medium;
                settings.particleDensity = 80;
                settings.shadowQuality = 1;
                settings.targetFrameRate = 60;
            }
            if (GUILayout.Button("High", settings.graphicsTier == GraphicsTier.High ? activeTabStyle : buttonStyle, GUILayout.Width(70 * scale)))
            {
                settings.graphicsTier = GraphicsTier.High;
                settings.particleDensity = 150;
                settings.shadowQuality = 2;
                settings.targetFrameRate = 60;
            }
            GUILayout.EndHorizontal();

            GUILayout.Space(8 * scale);
            GUILayout.Label($"🎆 <b>Particle Density Limit:</b> {settings.particleDensity} Particles / Burst", labelStyle);
            GUILayout.Label($"🌑 <b>Shadows:</b> {(settings.shadowQuality == 0 ? "Disabled" : (settings.shadowQuality == 1 ? "Hard Low" : "Soft High"))}", labelStyle);
            GUILayout.Label($"⚡ <b>Target FPS:</b> {settings.targetFrameRate} FPS (Locked)", labelStyle);
        }

        private void DrawControlsTab(float scale)
        {
            GUILayout.Label("<b>TOUCH SCHEME, SENSORS & ERGONOMICS:</b>", sectionHeaderStyle);

            GUILayout.BeginHorizontal();
            GUILayout.Label("🕹️ <b>Handedness:</b>", labelStyle, GUILayout.Width(130 * scale));
            if (GUILayout.Button("Left-Handed (Default)", settings.handedness == HandednessMode.LeftHanded ? activeTabStyle : buttonStyle, GUILayout.Width(140 * scale)))
            {
                settings.handedness = HandednessMode.LeftHanded;
            }
            if (GUILayout.Button("Right-Handed", settings.handedness == HandednessMode.RightHanded ? activeTabStyle : buttonStyle, GUILayout.Width(120 * scale)))
            {
                settings.handedness = HandednessMode.RightHanded;
            }
            GUILayout.EndHorizontal();

            GUILayout.Space(6 * scale);
            GUILayout.Label($"👁️ <b>Touch Look Sensitivity:</b> {settings.lookSensitivity:F1}x", labelStyle);
            settings.lookSensitivity = GUILayout.HorizontalSlider(settings.lookSensitivity, 0.5f, 2.5f);

            GUILayout.Space(10 * scale);
            GUILayout.Label("<b>🧭 GYROSCOPE & MOTION ORIENTATION (ANDROID):</b>", subHeaderStyle);

            bool hasGyro = CameraController.Instance != null && CameraController.Instance.HasGyroHardware;
            bool isGyroOn = CameraController.Instance != null && CameraController.Instance.IsGyroEnabled;

            GUILayout.BeginHorizontal();
            GUILayout.Label("🧭 <b>Gyro Look:</b>", labelStyle, GUILayout.Width(130 * scale));
            string gyroBtnLabel = isGyroOn ? "<color=#4ADE80>ENABLED (Blended Look)</color>" : (hasGyro ? "<color=#94A3B8>DISABLED (Touch Only)</color>" : "<color=#F87171>NO SENSOR (Touch Fallback)</color>");
            if (GUILayout.Button(gyroBtnLabel, buttonStyle, GUILayout.Height(28 * scale)))
            {
                if (CameraController.Instance != null)
                {
                    CameraController.Instance.SetGyroEnabled(!isGyroOn);
                }
            }
            GUILayout.EndHorizontal();

            GUILayout.Space(8 * scale);
            GUI.color = new Color(0.2f, 0.85f, 1f);
            if (GUILayout.Button("🎯 <b>RECENTER / CALIBRATE CAMERA</b>", buttonStyle, GUILayout.Height(34 * scale)))
            {
                if (CameraController.Instance != null)
                {
                    CameraController.Instance.RecenterCamera();
                }
            }
            GUI.color = Color.white;
            GUILayout.Label("<color=#94A3B8><i>Gyro handles broad physical orientation; touch swipe provides fine-tuning.</i></color>", labelStyle);
        }

        private void DrawAccessibilityTab(float scale)
        {
            GUILayout.Label("<b>ACCESSIBILITY & VISION ENHANCEMENT:</b>", sectionHeaderStyle);

            GUILayout.BeginHorizontal();
            GUILayout.Label("🎨 <b>Colorblind-Safe Palette:</b>", labelStyle);
            string cbLabel = settings.colorblindSafePalette ? "<color=#4ADE80>ENABLED (Blue/Orange)</color>" : "<color=#94A3B8>STANDARD (Red/Green)</color>";
            if (GUILayout.Button(cbLabel, buttonStyle, GUILayout.Width(180 * scale), GUILayout.Height(28 * scale)))
            {
                settings.colorblindSafePalette = !settings.colorblindSafePalette;
            }
            GUILayout.EndHorizontal();

            GUILayout.Space(8 * scale);
            GUILayout.BeginHorizontal();
            GUILayout.Label("🔤 <b>UI Text Scale:</b>", labelStyle, GUILayout.Width(120 * scale));
            if (GUILayout.Button("100%", settings.textScale == TextScaleMode.Normal ? activeTabStyle : buttonStyle, GUILayout.Width(60 * scale))) settings.textScale = TextScaleMode.Normal;
            if (GUILayout.Button("125%", settings.textScale == TextScaleMode.Large ? activeTabStyle : buttonStyle, GUILayout.Width(60 * scale))) settings.textScale = TextScaleMode.Large;
            if (GUILayout.Button("150%", settings.textScale == TextScaleMode.ExtraLarge ? activeTabStyle : buttonStyle, GUILayout.Width(60 * scale))) settings.textScale = TextScaleMode.ExtraLarge;
            GUILayout.EndHorizontal();
        }

        private void DrawDangerZoneTab(float scale)
        {
            GUILayout.Label("<b>DESTRUCTIVE ACTIONS & DATA RESET:</b>", sectionHeaderStyle);
            GUILayout.Label("<color=#F87171>Warning: Resetting progress will permanently erase all profile statistics, model vaults, and saved biome records.</color>", labelStyle);

            GUILayout.Space(14 * scale);

            if (resetConfirmStep == 0)
            {
                if (GUILayout.Button("🗑️ <b>RESET ALL PROGRESS & PROFILES</b>", dangerButtonStyle, GUILayout.Height(36 * scale)))
                {
                    resetConfirmStep = 1;
                    resetWarningTimer = 0f;
                }
            }
            else if (resetConfirmStep == 1)
            {
                string btnText = $"⚠️ <b>CONFIRM PERMANENT RESET? ({Mathf.CeilToInt(5.0f - resetWarningTimer)}s)</b>";
                if (GUILayout.Button(btnText, dangerButtonStyle, GUILayout.Height(36 * scale)))
                {
                    PlayerPrefs.DeleteAll();
                    PlayerPrefs.Save();
                    resetConfirmStep = 2;
                    Debug.Log("[Settings] All local progress and profile data wiped successfully.");
                }
            }
            else
            {
                GUILayout.Label("<color=#4ADE80>✅ Progress successfully reset to factory defaults!</color>", labelStyle);
            }
        }

        private void InitStyles()
        {
            float scale = Screen.dpi > 0 ? Screen.dpi / 160f : 1f;

            if (panelStyle == null)
            {
                panelStyle = new GUIStyle(GUI.skin.box);
                Texture2D bg = new Texture2D(1, 1);
                bg.SetPixel(0, 0, new Color(0.03f, 0.06f, 0.11f, 0.96f));
                bg.Apply();
                panelStyle.normal.background = bg;
            }

            if (titleStyle == null)
            {
                titleStyle = new GUIStyle(GUI.skin.label) { fontSize = (int)(12 * scale), fontStyle = FontStyle.Bold, richText = true };
                titleStyle.normal.textColor = new Color(0.22f, 0.74f, 0.97f);
            }

            if (sectionHeaderStyle == null)
            {
                sectionHeaderStyle = new GUIStyle(GUI.skin.label) { fontSize = (int)(11 * scale), fontStyle = FontStyle.Bold, richText = true };
                sectionHeaderStyle.normal.textColor = new Color(0.96f, 0.62f, 0.04f);
            }

            if (labelStyle == null)
            {
                labelStyle = new GUIStyle(GUI.skin.label) { fontSize = (int)(10 * scale), richText = true, wordWrap = true };
                labelStyle.normal.textColor = new Color(0.88f, 0.92f, 0.96f);
            }

            if (buttonStyle == null)
            {
                buttonStyle = new GUIStyle(GUI.skin.button) { fontSize = (int)(10 * scale), fontStyle = FontStyle.Bold, richText = true };
                buttonStyle.normal.textColor = Color.white;
            }

            if (activeTabStyle == null)
            {
                activeTabStyle = new GUIStyle(buttonStyle);
                activeTabStyle.normal.textColor = new Color(0.22f, 0.74f, 0.97f);
            }

            if (dangerButtonStyle == null)
            {
                dangerButtonStyle = new GUIStyle(buttonStyle);
                dangerButtonStyle.normal.textColor = new Color(0.97f, 0.44f, 0.44f);
            }
        }
    }
}
