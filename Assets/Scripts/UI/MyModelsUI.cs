using System;
using System.Collections.Generic;
using UnityEngine;
using NeuroArena.Core;
using NeuroArena.Data;

namespace NeuroArena.UI
{
    /// <summary>
    /// 'My Models' Gallery & Read-Only Model Inspector UI.
    /// Displays all successfully trained boss models as browsable cards.
    /// Selecting one opens a read-only view of its loss curve graph, parameters, and stats.
    /// </summary>
    public class MyModelsUI : MonoBehaviour
    {
        public static MyModelsUI Instance { get; private set; }

        [SerializeField] private bool isOpen = false;
        private TrainedModelRecord selectedModel = null;
        private Vector2 scrollPos;

        private GUIStyle panelStyle;
        private GUIStyle headerTitleStyle;
        private GUIStyle cardStyle;
        private GUIStyle cardTitleStyle;
        private GUIStyle metricStyle;
        private GUIStyle buttonStyle;
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

        public void OpenGallery()
        {
            isOpen = true;
            selectedModel = null;
        }

        public void CloseGallery()
        {
            isOpen = false;
            selectedModel = null;
        }

        public void ToggleGallery() { if (isOpen) CloseGallery(); else OpenGallery(); }

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
            GUILayout.Label("💾 <b>MY MODELS :: TRAINED ARCHITECT ARCHIVE & VAULT</b>", headerTitleStyle);
            GUILayout.FlexibleSpace();
            if (GUILayout.Button("✕ Close", buttonStyle, GUILayout.Width(75 * scale), GUILayout.Height(30 * scale)))
            {
                CloseGallery();
            }
            GUILayout.EndHorizontal();

            GUILayout.Space(8 * scale);

            var models = ModelVaultManager.Instance?.ArchivedModels ?? new List<TrainedModelRecord>();

            if (selectedModel == null)
            {
                // Gallery Grid Mode
                GUILayout.Label($"<b>TOTAL TRAINED MODELS:</b> {models.Count} Models Archived", metricStyle);
                GUILayout.Space(6 * scale);

                scrollPos = GUILayout.BeginScrollView(scrollPos);
                if (models.Count == 0)
                {
                    GUILayout.Space(40 * scale);
                    GUILayout.Label("<color=#64748B>No trained boss models archived yet. Complete a training run and pass a boss threshold to save your first model!</color>", metricStyle);
                }
                else
                {
                    for (int i = 0; i < models.Count; i++)
                    {
                        var m = models[i];
                        GUILayout.BeginVertical(cardStyle);
                        GUILayout.BeginHorizontal();
                        GUILayout.Label($"🧠 <b>{m.modelName}</b> ({m.architecture})", cardTitleStyle);
                        GUILayout.FlexibleSpace();
                        GUILayout.Label($"<color=#38BDF8>{m.biomeName}</color>", metricStyle);
                        GUILayout.EndHorizontal();

                        GUILayout.Space(4 * scale);
                        GUILayout.BeginHorizontal();
                        GUILayout.Label($"<b>Accuracy:</b> <color=#4ADE80>{m.testAccuracy:F1}%</color> | <b>Loss:</b> {m.finalLoss:F4} | <b>Seed:</b> #{m.playthroughSeed}", metricStyle);
                        GUILayout.FlexibleSpace();
                        if (GUILayout.Button("🔍 Inspect Model", buttonStyle, GUILayout.Width(130 * scale), GUILayout.Height(28 * scale)))
                        {
                            selectedModel = m;
                        }
                        GUILayout.EndHorizontal();
                        GUILayout.EndVertical();
                        GUILayout.Space(6 * scale);
                    }
                }
                GUILayout.EndScrollView();
            }
            else
            {
                // Read-Only Model Inspector Mode
                GUILayout.BeginHorizontal();
                if (GUILayout.Button("⬅ Back to Gallery", buttonStyle, GUILayout.Width(130 * scale), GUILayout.Height(28 * scale)))
                {
                    selectedModel = null;
                    GUILayout.EndHorizontal();
                    GUILayout.EndArea();
                    return;
                }
                GUILayout.Space(10 * scale);
                GUILayout.Label($"<b>INSPECTING:</b> {selectedModel.modelName} ({selectedModel.architecture})", cardTitleStyle);
                GUILayout.EndHorizontal();

                GUILayout.Space(10 * scale);

                // Inspector Details
                GUILayout.BeginVertical(cardStyle);
                GUILayout.Label($"🏆 <b>BOSS CONQUERED:</b> <color=#FBBF24>{selectedModel.bossDefeatedTitle}</color>", metricStyle);
                GUILayout.Label($"📅 <b>Trained On:</b> {selectedModel.timestamp} | 🧬 <b>Seed:</b> #{selectedModel.playthroughSeed}", metricStyle);
                GUILayout.Label($"📊 <b>Held-Out Test Accuracy:</b> <color=#4ADE80><b>{selectedModel.testAccuracy:F1}%</b></color> | <b>Final Loss:</b> J = {selectedModel.finalLoss:F4}", metricStyle);
                GUILayout.Label($"⚙️ <b>Optimized Weights & Hyperparameters:</b> <color=#38BDF8>{selectedModel.parameterSummary}</color>", metricStyle);
                GUILayout.EndVertical();

                GUILayout.Space(10 * scale);

                // Read-Only Mini Loss Curve Canvas
                GUILayout.Label("📉 <b>FROZEN TRAINING LOSS OSCILLOSCOPE SNAPSHOT:</b>", headerTitleStyle);
                Rect graphRect = GUILayoutUtility.GetRect(w - 20 * scale, 150 * scale);
                DrawMiniLossGraph(graphRect, selectedModel.lossCurveHistory);
            }

            GUILayout.EndArea();
        }

        private void DrawMiniLossGraph(Rect rect, float[] lossHistory)
        {
            Color prev = GUI.color;
            GUI.color = new Color(0.04f, 0.07f, 0.12f, 0.95f);
            GUI.DrawTexture(rect, whitePixel);
            GUI.color = prev;

            if (lossHistory == null || lossHistory.Length < 2) return;

            float maxLoss = 1.0f;
            for (int i = 0; i < lossHistory.Length; i++)
            {
                if (lossHistory[i] > maxLoss) maxLoss = lossHistory[i];
            }

            for (int i = 0; i < lossHistory.Length - 1; i++)
            {
                float x1 = rect.x + 10 + (float)i / (lossHistory.Length - 1) * (rect.width - 20);
                float y1 = rect.y + rect.height - 10 - (lossHistory[i] / maxLoss) * (rect.height - 20);

                GUI.color = new Color(0.29f, 0.87f, 0.5f, 0.9f);
                GUI.DrawTexture(new Rect(x1, y1, 3, 3), whitePixel);
            }
            GUI.color = prev;
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

            if (headerTitleStyle == null)
            {
                headerTitleStyle = new GUIStyle(GUI.skin.label) { fontSize = (int)(11 * scale), fontStyle = FontStyle.Bold, richText = true };
                headerTitleStyle.normal.textColor = new Color(0.22f, 0.74f, 0.97f);
            }

            if (cardStyle == null)
            {
                cardStyle = new GUIStyle(GUI.skin.box);
                Texture2D bg = new Texture2D(1, 1);
                bg.SetPixel(0, 0, new Color(0.06f, 0.10f, 0.18f, 0.90f));
                bg.Apply();
                cardStyle.normal.background = bg;
                cardStyle.padding = new RectOffset((int)(8 * scale), (int)(8 * scale), (int)(8 * scale), (int)(8 * scale));
            }

            if (cardTitleStyle == null)
            {
                cardTitleStyle = new GUIStyle(GUI.skin.label) { fontSize = (int)(11 * scale), fontStyle = FontStyle.Bold, richText = true };
                cardTitleStyle.normal.textColor = Color.white;
            }

            if (metricStyle == null)
            {
                metricStyle = new GUIStyle(GUI.skin.label) { fontSize = (int)(10 * scale), richText = true };
                metricStyle.normal.textColor = new Color(0.85f, 0.90f, 0.95f);
            }

            if (buttonStyle == null)
            {
                buttonStyle = new GUIStyle(GUI.skin.button) { fontSize = (int)(10 * scale), fontStyle = FontStyle.Bold, richText = true };
                buttonStyle.normal.textColor = Color.white;
            }
        }
    }
}
