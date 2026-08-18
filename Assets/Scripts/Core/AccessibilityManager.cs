using System;
using UnityEngine;

namespace NeuroArena.Core
{
    public enum ColorblindMode
    {
        Normal,
        Protanopia,   // Red-Blind
        Deuteranopia, // Green-Blind
        Tritanopia,   // Blue-Blind
        HighContrast
    }

    /// <summary>
    /// Production Accessibility (a11y) Manager.
    /// Manages:
    /// - Colorblind correction matrices applied to decision boundaries and dataset points.
    /// - Dynamic UI text scaling (100% to 150%).
    /// - Subtitle display toggles for voice and tutorial narration.
    /// - Virtual input control scale and sensitivity adjustments.
    /// </summary>
    public class AccessibilityManager : MonoBehaviour
    {
        public static AccessibilityManager Instance { get; private set; }

        public event Action<ColorblindMode> OnColorblindModeChanged;
        public event Action<float> OnTextScaleChanged;
        public event Action<bool> OnSubtitlesToggled;

        [Header("Accessibility Settings")]
        [SerializeField] private ColorblindMode currentColorblindMode = ColorblindMode.Normal;
        [Range(1.0f, 1.5f)] [SerializeField] private float uiTextScale = 1.0f;
        [SerializeField] private bool showSubtitles = true;
        [Range(0.8f, 1.4f)] [SerializeField] private float virtualControlScale = 1.0f;

        public ColorblindMode CurrentColorblindMode => currentColorblindMode;
        public float UiTextScale => uiTextScale;
        public bool ShowSubtitles => showSubtitles;
        public float VirtualControlScale => virtualControlScale;

        private const string PREF_COLORBLIND = "neuroarena_a11y_colorblind";
        private const string PREF_TEXT_SCALE = "neuroarena_a11y_text_scale";
        private const string PREF_SUBTITLES = "neuroarena_a11y_subtitles";

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
                LoadSettings();
            }
            else
            {
                Destroy(gameObject);
            }
        }

        private void LoadSettings()
        {
            currentColorblindMode = (ColorblindMode)PlayerPrefs.GetInt(PREF_COLORBLIND, (int)ColorblindMode.Normal);
            uiTextScale = PlayerPrefs.GetFloat(PREF_TEXT_SCALE, 1.0f);
            showSubtitles = PlayerPrefs.GetInt(PREF_SUBTITLES, 1) == 1;
        }

        public void SetColorblindMode(ColorblindMode mode)
        {
            currentColorblindMode = mode;
            PlayerPrefs.SetInt(PREF_COLORBLIND, (int)mode);
            PlayerPrefs.Save();
            Debug.Log($"[Accessibility] Colorblind mode set to: {mode}");
            OnColorblindModeChanged?.Invoke(mode);
        }

        public void SetTextScale(float scale)
        {
            uiTextScale = Mathf.Clamp(scale, 1.0f, 1.5f);
            PlayerPrefs.SetFloat(PREF_TEXT_SCALE, uiTextScale);
            PlayerPrefs.Save();
            Debug.Log($"[Accessibility] UI text scale set to: {uiTextScale:F2}x");
            OnTextScaleChanged?.Invoke(uiTextScale);
        }

        public void SetSubtitlesEnabled(bool enabled)
        {
            showSubtitles = enabled;
            PlayerPrefs.SetInt(PREF_SUBTITLES, enabled ? 1 : 0);
            PlayerPrefs.Save();
            Debug.Log($"[Accessibility] Subtitles set to: {enabled}");
            OnSubtitlesToggled?.Invoke(enabled);
        }

        /// <summary>
        /// Transforms a standard color to accessibility colorblind corrected space.
        /// </summary>
        public Color TransformColor(Color original)
        {
            return currentColorblindMode switch
            {
                ColorblindMode.Protanopia => new Color(0.56667f * original.r + 0.43333f * original.g, 0.55833f * original.r + 0.44167f * original.g, original.b, original.a),
                ColorblindMode.Deuteranopia => new Color(0.625f * original.r + 0.375f * original.g, 0.70f * original.r + 0.30f * original.g, original.b, original.a),
                ColorblindMode.Tritanopia => new Color(0.95f * original.r + 0.05f * original.g, original.g, 0.43333f * original.g + 0.56667f * original.b, original.a),
                ColorblindMode.HighContrast => (original.grayscale > 0.5f) ? Color.white : Color.black,
                _ => original
            };
        }
    }
}
