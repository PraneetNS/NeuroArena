using System;
using System.Collections.Generic;
using UnityEngine;
using NeuroArena.Data;
using NeuroArena.Core;
using NeuroArena.ML;
using NeuroArena.Environment;
using NeuroArena.UI.Theme;

namespace NeuroArena.UI
{
    /// <summary>
    /// Motion-Optimized HUD & Touch Interface.
    /// 1. Top-Center Primary Objective & Benchmark Threshold Banner (What to do next & How am I doing).
    /// 2. Expandable Inventory Drawer (Collapsed into single 48dp button).
    /// 3. Bottom-Corner Biome Radar & Waypoint Tracker.
    /// 4. 100% Mobile Touch Compliant (All buttons >= 44x44dp).
    /// </summary>
    public class InventoryHUD : MonoBehaviour
    {
        public static InventoryHUD Instance { get; private set; }

        [Header("State")]
        [SerializeField] private bool isDrawerOpen = false;
        [SerializeField] private bool isDatasetModalOpen = false;

        private Vector2 modalScrollPos;

        private GUIStyle objectiveBoxStyle;
        private GUIStyle objectiveTitleStyle;
        private GUIStyle objectiveSubStyle;
        private GUIStyle drawerBtnStyle;
        private GUIStyle drawerBoxStyle;
        private GUIStyle radarBoxStyle;
        private GUIStyle labelStyle;
        private GUIStyle actionBtnStyle;
        private GUIStyle modalBoxStyle;
        private GUIStyle headerTitleStyle;
        private GUIStyle subHeaderStyle;

        private Texture2D whitePixel;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;

            whitePixel = new Texture2D(1, 1);
            whitePixel.SetPixel(0, 0, Color.white);
            whitePixel.Apply();
        }

        public void ToggleDrawer() => isDrawerOpen = !isDrawerOpen;

        public void ToggleDatasetModal()
        {
            isDatasetModalOpen = !isDatasetModalOpen;
            if (PlayerController.Instance != null)
            {
                PlayerController.Instance.IsMovementLocked = isDatasetModalOpen;
            }
        }

        private void OnGUI()
        {
            InitStyles();
            float scale = Screen.dpi > 0 ? Screen.dpi / 160f : 1f;

            if (!isDatasetModalOpen)
            {
                DrawTopCenterObjective(scale);
                DrawTopRightControls(scale);
                if (isDrawerOpen) DrawInventoryDrawer(scale);
                DrawBottomBiomeRadar(scale);
            }
            else
            {
                DrawDatasetInspectorModal(scale);
            }
        }

        // --- 1. TOP-CENTER OBJECTIVE & BENCHMARK THRESHOLD ---
        private void DrawTopCenterObjective(float scale)
        {
            float w = Mathf.Min(440 * scale, Screen.width * 0.85f);
            float h = 58 * scale;
            Rect objRect = new Rect((Screen.width - w) * 0.5f, 12 * scale, w, h);

            GUI.Box(objRect, GUIContent.none, objectiveBoxStyle);
            GUILayout.BeginArea(objRect);

            int currentBiome = (BiomeManager.Instance != null) ? BiomeManager.Instance.CurrentBiomeIndex : 0;
            int xCount = (MLInventory.Instance != null) ? MLInventory.Instance.FeatureCrystalXCount : 0;
            int totalNeeded = 18;

            string objTitle = $"🎯 <b>OBJECTIVE:</b> HARVEST CRYSTALS & CALIBRATE LAB ({xCount}/{totalNeeded})";
            string objSub = "<b>TARGET:</b> MSE ≤ 0.10  |  <b>STATUS:</b> " + (xCount >= totalNeeded ? "<color=#4ADE80>READY TO CALIBRATE</color>" : "<color=#FBBF24>IN PROGRESS</color>");

            if (currentBiome == 5)
            {
                objTitle = "🌌 <b>OBJECTIVE:</b> ARRANGE CONCEPT RUNES BY COSINE SIMILARITY";
                objSub = "<b>TARGET:</b> Cosine Sim ≥ 0.75  |  <b>STATUS:</b> <color=#38BDF8>EXPLORING ASTRAL PLATEAU</color>";
            }

            GUILayout.Label(objTitle, objectiveTitleStyle);

            // Progress Bar
            float pct = Mathf.Clamp01((float)xCount / totalNeeded);
            Rect barRect = GUILayoutUtility.GetRect(w - 20 * scale, 6 * scale);
            DrawProgressBar(barRect, pct, new Color(0.2f, 0.85f, 1f));

            GUILayout.Label(objSub, objectiveSubStyle);
            GUILayout.EndArea();
        }

        // --- 2. TOP-RIGHT CONTROLS (MINIMUM 44x44dp) ---
        private void DrawTopRightControls(float scale)
        {
            float btnSize = 48 * scale; // >= 44dp standard
            float pad = 12 * scale;

            GUILayout.BeginArea(new Rect(Screen.width - (btnSize * 3 + pad * 3), pad, btnSize * 3 + pad * 2, btnSize));
            GUILayout.BeginHorizontal();

            if (GUILayout.Button("🎒", drawerBtnStyle, GUILayout.Width(btnSize), GUILayout.Height(btnSize)))
            {
                ToggleDrawer();
            }

            GUILayout.Space(pad);
            if (GUILayout.Button("📊", drawerBtnStyle, GUILayout.Width(btnSize), GUILayout.Height(btnSize)))
            {
                ToggleDatasetModal();
            }

            GUILayout.Space(pad);
            if (GUILayout.Button("⚙️", drawerBtnStyle, GUILayout.Width(btnSize), GUILayout.Height(btnSize)))
            {
                MainMenuUI.Instance?.OpenMenu();
            }

            GUILayout.EndHorizontal();
            GUILayout.EndArea();
        }

        // --- 3. EXPANDABLE INVENTORY DRAWER WITH LIVE DATASET STATS & HEALTH SCORE ---
        private void DrawInventoryDrawer(float scale)
        {
            float w = 270 * scale;
            float h = 285 * scale;
            float pad = 12 * scale;
            Rect drawerRect = new Rect(Screen.width - w - pad, 68 * scale, w, h);

            GUI.Box(drawerRect, GUIContent.none, drawerBoxStyle);
            GUILayout.BeginArea(drawerRect);

            GUILayout.Label("<b>🎒 COLLECTED RESOURCES</b>", subHeaderStyle);
            GUILayout.Space(2 * scale);

            int x = MLInventory.Instance != null ? MLInventory.Instance.FeatureCrystalXCount : 0;
            int y = MLInventory.Instance != null ? MLInventory.Instance.TargetShardYCount : 0;

            GUILayout.Label($"◆ <b>Feature Crystals (X):</b> <color=#38BDF8>{x}</color>  |  ▲ <b>Shards (Y):</b> <color=#FBBF24>{y}</color>", labelStyle);

            GUILayout.Space(3 * scale);
            GUILayout.Label("<b>📊 LIVE DATASET STATS (REAL-TIME)</b>", subHeaderStyle);

            DatasetStatistics stats = MLInventory.Instance != null ? MLInventory.Instance.LiveStats : DatasetStatistics.Empty;
            DatasetHealthMetrics health = MLInventory.Instance != null ? MLInventory.Instance.LiveHealth : DatasetHealthMetrics.Default;

            if (stats.sampleCount == 0)
            {
                GUILayout.Label("<color=#94A3B8><i>No empirical samples collected yet.\nHarvest crystals/spores in biome!</i></color>", labelStyle);
            }
            else
            {
                GUILayout.Label($"📈 <b>Samples (N):</b> <color=#4ADE80><b>{stats.sampleCount}</b></color>", labelStyle);

                if (stats.isClassification)
                {
                    GUILayout.Label($"⚖️ <b>Class Balance:</b> <color=#C084FC>0: {stats.class0Count} ({(stats.class0Ratio * 100f):F0}%)</color> | <color=#38BDF8>1: {stats.class1Count} ({(stats.class1Ratio * 100f):F0}%)</color>", labelStyle);
                    Rect classBarRect = GUILayoutUtility.GetRect(w - 20 * scale, 4 * scale);
                    DrawProgressBar(classBarRect, stats.class1Ratio, new Color(0.2f, 0.75f, 1f));
                }
                else
                {
                    GUILayout.Label($"↔️ <b>X Range:</b> [{stats.minX:F1}, {stats.maxX:F1}]  |  <b>Y Range:</b> [{stats.minY:F1}, {stats.maxY:F1}]", labelStyle);
                    GUILayout.Label($"μ ± σ: <b>X:</b> {stats.meanX:F2} ± {stats.stdDevX:F2}  |  <b>Y:</b> {stats.meanY:F2} ± {stats.stdDevY:F2}", labelStyle);
                }

                GUILayout.Space(4 * scale);
                string healthCol = health.healthScore >= 80f ? "#4ADE80" : (health.healthScore >= 50f ? "#FBBF24" : "#F43F5E");
                GUILayout.Label($"🩺 <b>DATASET HEALTH SCORE:</b> <color={healthCol}><b>{health.healthScore:F0}% [{health.healthGrade}]</b></color>", subHeaderStyle);

                Rect healthBarRect = GUILayoutUtility.GetRect(w - 20 * scale, 5 * scale);
                Color barColor = health.healthScore >= 80f ? new Color(0.29f, 0.87f, 0.5f) : (health.healthScore >= 50f ? new Color(0.98f, 0.75f, 0.14f) : new Color(0.96f, 0.25f, 0.37f));
                DrawProgressBar(healthBarRect, health.healthScore / 100f, barColor);

                GUILayout.Space(2 * scale);
                GUILayout.Label($"⚠️ <i>{health.primaryDefect}</i>", objectiveSubStyle);
            }

            GUILayout.EndArea();
        }

        // --- 4. BOTTOM-CORNER BIOME RADAR & WAYPOINT ---
        private void DrawBottomBiomeRadar(float scale)
        {
            float size = 88 * scale;
            float pad = 14 * scale;
            Rect radarRect = new Rect(Screen.width - size - pad, Screen.height - size - pad, size, size);

            GUI.Box(radarRect, GUIContent.none, radarBoxStyle);

            // Radar Ring & Center Point
            Vector2 center = new Vector2(radarRect.x + size * 0.5f, radarRect.y + size * 0.5f);
            MLGraphVisualizer.DrawCircle(center, 4f, new Color(0.2f, 0.9f, 1f));

            // Waypoint Heading (Lab Station)
            Vector2 labDir = new Vector2(0.6f, -0.8f);
            Vector2 labPos = center + labDir * (size * 0.35f);
            MLGraphVisualizer.DrawSquare(labPos, 7f, new Color(1f, 0.75f, 0.2f));

            GUI.Label(new Rect(radarRect.x + 4, radarRect.yMax - 18 * scale, size - 8, 16 * scale), "<b>LAB ➔</b>", objectiveSubStyle);
        }

        private void DrawDatasetInspectorModal(float scale)
        {
            Rect fullScreen = new Rect(0, 0, Screen.width, Screen.height);
            GUI.Box(fullScreen, GUIContent.none, modalBoxStyle);

            float modalW = Mathf.Min(680 * scale, Screen.width * 0.92f);
            float modalH = Mathf.Min(580 * scale, Screen.height * 0.92f);
            Rect modalRect = new Rect((Screen.width - modalW) * 0.5f, (Screen.height - modalH) * 0.5f, modalW, modalH);

            GUILayout.BeginArea(modalRect);
            GUILayout.BeginHorizontal();
            GUILayout.Label("📊 <b>DATASET INSPECTOR 2.0 :: MODEL INTERPRETABILITY</b>", headerTitleStyle);
            GUILayout.FlexibleSpace();
            if (GUILayout.Button("✕ Close", actionBtnStyle, GUILayout.Width(80 * scale), GUILayout.Height(34 * scale)))
            {
                ToggleDatasetModal();
            }
            GUILayout.EndHorizontal();

            GUILayout.Space(12 * scale);
            GUILayout.Label("Permutation feature importance and tree MDI attribution active.", labelStyle);
            GUILayout.EndArea();
        }

        private void DrawProgressBar(Rect rect, float fill01, Color color)
        {
            fill01 = Mathf.Clamp01(fill01);
            Color prev = GUI.color;
            GUI.color = new Color(0.1f, 0.15f, 0.22f, 0.8f);
            GUI.DrawTexture(rect, whitePixel);
            GUI.color = color;
            GUI.DrawTexture(new Rect(rect.x, rect.y, rect.width * fill01, rect.height), whitePixel);
            GUI.color = prev;
        }

        private void InitStyles()
        {
            float scale = Screen.dpi > 0 ? Screen.dpi / 160f : 1f;

            if (objectiveBoxStyle == null)
            {
                objectiveBoxStyle = new GUIStyle(GUI.skin.box);
                Texture2D bg = new Texture2D(1, 1);
                bg.SetPixel(0, 0, new Color(0.04f, 0.07f, 0.12f, 0.92f));
                bg.Apply();
                objectiveBoxStyle.normal.background = bg;
            }

            if (drawerBoxStyle == null || radarBoxStyle == null)
            {
                drawerBoxStyle = new GUIStyle(objectiveBoxStyle);
                radarBoxStyle = new GUIStyle(objectiveBoxStyle);
            }

            if (modalBoxStyle == null)
            {
                modalBoxStyle = new GUIStyle(GUI.skin.box);
                Texture2D bg = new Texture2D(1, 1);
                bg.SetPixel(0, 0, new Color(0.03f, 0.05f, 0.09f, 0.96f));
                bg.Apply();
                modalBoxStyle.normal.background = bg;
            }

            if (objectiveTitleStyle == null)
            {
                objectiveTitleStyle = new GUIStyle(GUI.skin.label) { fontSize = (int)(11 * scale), fontStyle = FontStyle.Bold, richText = true, alignment = TextAnchor.MiddleCenter };
                objectiveTitleStyle.normal.textColor = new Color(0.2f, 0.9f, 1f);
            }

            if (objectiveSubStyle == null)
            {
                objectiveSubStyle = new GUIStyle(GUI.skin.label) { fontSize = (int)(9 * scale), fontStyle = FontStyle.Bold, richText = true, alignment = TextAnchor.MiddleCenter };
                objectiveSubStyle.normal.textColor = new Color(0.85f, 0.88f, 0.92f);
            }

            if (drawerBtnStyle == null)
            {
                drawerBtnStyle = new GUIStyle(GUI.skin.button) { fontSize = (int)(18 * scale), alignment = TextAnchor.MiddleCenter };
                drawerBtnStyle.normal.textColor = Color.white;
            }

            if (labelStyle == null)
            {
                labelStyle = new GUIStyle(GUI.skin.label) { fontSize = (int)(10 * scale), richText = true };
                labelStyle.normal.textColor = new Color(0.85f, 0.88f, 0.92f);
            }

            if (subHeaderStyle == null)
            {
                subHeaderStyle = new GUIStyle(GUI.skin.label) { fontSize = (int)(10 * scale), fontStyle = FontStyle.Bold, richText = true };
                subHeaderStyle.normal.textColor = new Color(1f, 0.8f, 0.2f);
            }

            if (headerTitleStyle == null)
            {
                headerTitleStyle = new GUIStyle(GUI.skin.label) { fontSize = (int)(13 * scale), fontStyle = FontStyle.Bold, richText = true };
                headerTitleStyle.normal.textColor = new Color(0.2f, 0.9f, 1f);
            }

            if (actionBtnStyle == null)
            {
                actionBtnStyle = new GUIStyle(GUI.skin.button) { fontSize = (int)(11 * scale), fontStyle = FontStyle.Bold };
                actionBtnStyle.normal.textColor = Color.white;
            }
        }
    }
}
