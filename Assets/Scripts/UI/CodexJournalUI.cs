using System;
using System.Collections.Generic;
using UnityEngine;
using NeuroArena.Data;
using NeuroArena.Environment;

namespace NeuroArena.UI
{
    /// <summary>
    /// Interactive Codex / Journal UI.
    /// Displays unlocked ML concept cards, mathematical equations, and plain-English summaries.
    /// </summary>
    public class CodexJournalUI : MonoBehaviour
    {
        public static CodexJournalUI Instance { get; private set; }

        [SerializeField] private bool isOpen = false;
        private List<CodexEntry> entries;
        private int selectedEntryIndex = 0;
        private Vector2 scrollPos;

        private GUIStyle panelStyle;
        private GUIStyle titleStyle;
        private GUIStyle mathFormulaStyle;
        private GUIStyle plainTextStyle;
        private GUIStyle buttonStyle;
        private GUIStyle skinBadgeStyle;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            entries = CodexCurriculumDatabase.GetCurriculumEntries();
        }

        public void OpenCodex()
        {
            isOpen = true;
            UpdateUnlocks();
        }

        public void CloseCodex() => isOpen = false;
        public void ToggleCodex() { if (isOpen) CloseCodex(); else OpenCodex(); }

        private void UpdateUnlocks()
        {
            int maxUnlocked = (BiomeManager.Instance != null) ? BiomeManager.Instance.CurrentBiomeIndex : 0;
            for (int i = 0; i < entries.Count; i++)
            {
                entries[i].isUnlocked = (i <= maxUnlocked);
            }
        }

        private void OnGUI()
        {
            if (!isOpen) return;

            InitStyles();
            float scale = Screen.dpi > 0 ? Screen.dpi / 160f : 1f;

            float w = Mathf.Min(780 * scale, Screen.width * 0.94f);
            float h = Mathf.Min(600 * scale, Screen.height * 0.92f);
            Rect modalRect = new Rect((Screen.width - w) * 0.5f, (Screen.height - h) * 0.5f, w, h);

            GUI.Box(modalRect, GUIContent.none, panelStyle);
            GUILayout.BeginArea(modalRect);

            // Header
            GUILayout.BeginHorizontal();
            GUILayout.Label("📖 <b>NEURO-ARENA CODEX & MACHINE LEARNING JOURNAL</b>", titleStyle);
            GUILayout.FlexibleSpace();
            if (GUILayout.Button("✕ Close", buttonStyle, GUILayout.Width(80 * scale), GUILayout.Height(32 * scale)))
            {
                CloseCodex();
            }
            GUILayout.EndHorizontal();

            GUILayout.Space(8 * scale);

            // Split View: Left Tabs, Right Detail
            GUILayout.BeginHorizontal();

            // Left List
            GUILayout.BeginVertical(GUILayout.Width(240 * scale));
            for (int i = 0; i < entries.Count; i++)
            {
                var e = entries[i];
                string prefix = e.isUnlocked ? "🟢" : "🔒";
                string label = $"{prefix} {e.title}";
                if (GUILayout.Button(label, buttonStyle, GUILayout.Height(38 * scale)))
                {
                    if (e.isUnlocked) selectedEntryIndex = i;
                }
            }
            GUILayout.EndVertical();

            GUILayout.Space(12 * scale);

            // Right Detail Area
            GUILayout.BeginVertical();
            scrollPos = GUILayout.BeginScrollView(scrollPos);

            if (selectedEntryIndex >= 0 && selectedEntryIndex < entries.Count)
            {
                var cur = entries[selectedEntryIndex];
                GUILayout.Label($"<b>{cur.title}</b>", titleStyle);
                GUILayout.Label($"<color=#38BDF8>{cur.subtitle}</color>", plainTextStyle);
                GUILayout.Space(6 * scale);

                GUILayout.Label("<b>1. EXACT MATHEMATICAL FORMULATION:</b>", titleStyle);
                GUILayout.TextArea(cur.mathematicalFormulation, mathFormulaStyle);

                GUILayout.Space(8 * scale);
                GUILayout.Label("<b>2. INTUITIVE PLAIN-ENGLISH CONCEPT:</b>", titleStyle);
                GUILayout.Label(cur.plainEnglishExplanation, plainTextStyle);

                GUILayout.Space(8 * scale);
                GUILayout.Label("<b>3. REAL-WORLD AI APPLICATIONS:</b>", titleStyle);
                GUILayout.Label(cur.practicalApplications, plainTextStyle);

                GUILayout.Space(8 * scale);
                GUILayout.Label($"🎨 <b>MASTERY COSMETIC UNLOCK:</b> <color=#FBBF24>{cur.masterySkinName} Terminal Skin</color>", skinBadgeStyle);
            }

            GUILayout.EndScrollView();
            GUILayout.EndVertical();

            GUILayout.EndHorizontal();
            GUILayout.EndArea();
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

            if (mathFormulaStyle == null)
            {
                mathFormulaStyle = new GUIStyle(GUI.skin.textArea) { fontSize = (int)(11 * scale), fontStyle = FontStyle.Bold };
                mathFormulaStyle.normal.textColor = new Color(0.29f, 0.87f, 0.5f);
            }

            if (plainTextStyle == null)
            {
                plainTextStyle = new GUIStyle(GUI.skin.label) { fontSize = (int)(10 * scale), richText = true, wordWrap = true };
                plainTextStyle.normal.textColor = new Color(0.88f, 0.92f, 0.96f);
            }

            if (buttonStyle == null)
            {
                buttonStyle = new GUIStyle(GUI.skin.button) { fontSize = (int)(10 * scale), fontStyle = FontStyle.Bold, richText = true };
                buttonStyle.normal.textColor = Color.white;
            }

            if (skinBadgeStyle == null)
            {
                skinBadgeStyle = new GUIStyle(GUI.skin.label) { fontSize = (int)(10 * scale), fontStyle = FontStyle.Bold, richText = true };
                skinBadgeStyle.normal.textColor = new Color(1f, 0.78f, 0.28f);
            }
        }
    }
}
