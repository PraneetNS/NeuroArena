using System;
using UnityEngine;
using NeuroArena.Environment;

namespace NeuroArena.UI.Theme
{
    /// <summary>
    /// Global Theme Manager.
    /// Provides active biome palettes and 8px grid helpers to all UI controllers.
    /// </summary>
    public class UIThemeManager : MonoBehaviour
    {
        public static UIThemeManager Instance { get; private set; }

        [Header("Active Design System Theme Asset")]
        [SerializeField] private NeuroArenaThemeSO activeTheme;

        public NeuroArenaThemeSO ActiveTheme => activeTheme;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;

            if (activeTheme == null)
            {
                activeTheme = ScriptableObject.CreateInstance<NeuroArenaThemeSO>();
            }
        }

        public BiomePalette CurrentPalette
        {
            get
            {
                int idx = (BiomeManager.Instance != null) ? BiomeManager.Instance.CurrentBiomeIndex : 0;
                return activeTheme.GetPaletteForBiome(idx);
            }
        }
    }
}
