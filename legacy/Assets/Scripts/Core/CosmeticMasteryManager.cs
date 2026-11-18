using System;
using System.Collections.Generic;
using UnityEngine;
using NeuroArena.Data;

namespace NeuroArena.Core
{
    [Serializable]
    public class TerminalSkin
    {
        public string skinId;
        public string displayName;
        public Color primaryGlow;
        public Color frameTint;
        public bool isUnlocked;
    }

    /// <summary>
    /// Mastery Cosmetic Manager.
    /// Manages purely earned terminal skins (zero pay-to-win) tied to biome mastery.
    /// </summary>
    public class CosmeticMasteryManager : MonoBehaviour
    {
        public static CosmeticMasteryManager Instance { get; private set; }

        [SerializeField] private List<TerminalSkin> skins = new List<TerminalSkin>();
        [SerializeField] private int activeSkinIndex = 0;

        public TerminalSkin ActiveSkin => (activeSkinIndex >= 0 && activeSkinIndex < skins.Count) ? skins[activeSkinIndex] : null;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            InitializeSkins();
        }

        private void InitializeSkins()
        {
            skins.Clear();
            skins.Add(new TerminalSkin { skinId = "obsidian", displayName = "Obsidian Gradient", primaryGlow = new Color(0.96f, 0.62f, 0.04f), frameTint = new Color(0.1f, 0.08f, 0.06f), isUnlocked = true });
            skins.Add(new TerminalSkin { skinId = "biolum", displayName = "Bioluminescent Neon", primaryGlow = new Color(0.08f, 0.72f, 0.65f), frameTint = new Color(0.02f, 0.1f, 0.1f), isUnlocked = false });
            skins.Add(new TerminalSkin { skinId = "glacial", displayName = "Glacial Crystalline", primaryGlow = new Color(0.22f, 0.74f, 0.97f), frameTint = new Color(0.04f, 0.1f, 0.16f), isUnlocked = false });
            skins.Add(new TerminalSkin { skinId = "canopy", displayName = "Verdant Living Canopy", primaryGlow = new Color(0.06f, 0.73f, 0.51f), frameTint = new Color(0.02f, 0.12f, 0.06f), isUnlocked = false });
            skins.Add(new TerminalSkin { skinId = "citadel", displayName = "Cyber-Citadel Matrix", primaryGlow = new Color(0.66f, 0.33f, 0.97f), frameTint = new Color(0.08f, 0.04f, 0.14f), isUnlocked = false });
            skins.Add(new TerminalSkin { skinId = "astral", displayName = "Astral Hologram", primaryGlow = new Color(0.51f, 0.55f, 0.97f), frameTint = new Color(0.02f, 0.05f, 0.12f), isUnlocked = false });
        }

        public void UnlockSkin(int biomeIndex)
        {
            if (biomeIndex >= 0 && biomeIndex < skins.Count)
            {
                skins[biomeIndex].isUnlocked = true;
            }
        }

        public void EquipSkin(int index)
        {
            if (index >= 0 && index < skins.Count && skins[index].isUnlocked)
            {
                activeSkinIndex = index;
            }
        }
    }
}
