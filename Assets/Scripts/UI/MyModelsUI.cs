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

                GUILayout.Space(6 * scale);

                // Tab Switcher: Loss Curve vs Stage 29 Consult Chat
                GUILayout.BeginHorizontal();
                GUI.color = inspectorTabIndex == 0 ? new Color(0.2f, 0.85f, 1f) : Color.white;
                if (GUILayout.Button("📉 Loss Oscilloscope", buttonStyle, GUILayout.Width(160 * scale), GUILayout.Height(30 * scale))) inspectorTabIndex = 0;
                GUILayout.Space(6 * scale);
                GUI.color = inspectorTabIndex == 1 ? new Color(0.95f, 0.6f, 0.2f) : Color.white;
                if (GUILayout.Button("💬 Consult / Interrogate (Chat)", buttonStyle, GUILayout.Width(220 * scale), GUILayout.Height(30 * scale))) inspectorTabIndex = 1;
                GUI.color = Color.white;
                GUILayout.EndHorizontal();

                GUILayout.Space(8 * scale);

                if (inspectorTabIndex == 0)
                {
                    // Read-Only Mini Loss Curve Canvas
                    GUILayout.Label("📉 <b>FROZEN TRAINING LOSS OSCILLOSCOPE SNAPSHOT:</b>", headerTitleStyle);
                    Rect graphRect = GUILayoutUtility.GetRect(w - 20 * scale, 150 * scale);
                    DrawMiniLossGraph(graphRect, selectedModel.lossCurveHistory);
                }
                else
                {
                    // Stage 29 Model Consult / Interrogate Mode
                    DrawConsultInterrogateView(scale, w);
                }
            }

            GUILayout.EndArea();
        }

        private int inspectorTabIndex = 0;
        private string queryInputText = "2.0";
        private List<ConsultInferenceResult> chatHistory = new List<ConsultInferenceResult>();
        private GUIStyle glitchCardStyle;
        private GUIStyle promptBtnStyle;

        private void DrawConsultInterrogateView(float scale, float w)
        {
            GUILayout.BeginVertical(cardStyle);
            GUILayout.Label("💬 <b>STAGE 29 & 76 :: MODEL CONSULT / INTERROGATE (INFERENCE REPL)</b>", headerTitleStyle);
            GUILayout.Label($"<b>Empirical Training Domain:</b> X ∈ [{selectedModel.minX:F1}, {selectedModel.maxX:F1}] | μ={selectedModel.meanX:F1} | σ={selectedModel.stdDevX:F2}", metricStyle);

            // Quick scenario test buttons (Numeric Domain Tests)
            GUILayout.BeginHorizontal();
            if (GUILayout.Button("🎯 In-Domain (X=1.8)", promptBtnStyle, GUILayout.Height(24 * scale))) RunQuery(1.8f);
            if (GUILayout.Button("⚠️ Boundary (X=4.4)", promptBtnStyle, GUILayout.Height(24 * scale))) RunQuery(4.4f);
            if (GUILayout.Button("⚡ Extrapolation (X=14.5)", promptBtnStyle, GUILayout.Height(24 * scale))) RunQuery(14.5f);
            GUILayout.EndHorizontal();

            GUILayout.Space(2 * scale);

            // Quick concept vocabulary tests (Attention & Out-of-Vocabulary Tests)
            GUILayout.BeginHorizontal();
            if (GUILayout.Button("🔥 fire", promptBtnStyle, GUILayout.Height(22 * scale))) RunSemanticQuery("fire");
            if (GUILayout.Button("❄️ frost", promptBtnStyle, GUILayout.Height(22 * scale))) RunSemanticQuery("frost");
            if (GUILayout.Button("⚡ neural", promptBtnStyle, GUILayout.Height(22 * scale))) RunSemanticQuery("neural");
            if (GUILayout.Button("❓ <UNK> token", promptBtnStyle, GUILayout.Height(22 * scale))) RunSemanticQuery("quantum_hyperdrive");
            GUILayout.EndHorizontal();

            // Query Input Bar
            GUILayout.Space(4 * scale);
            GUILayout.BeginHorizontal();
            GUILayout.Label("<b>Query Input:</b>", metricStyle, GUILayout.Width(90 * scale));
            queryInputText = GUILayout.TextField(queryInputText, GUILayout.Width(110 * scale), GUILayout.Height(26 * scale));
            GUILayout.Space(6 * scale);
            GUI.color = new Color(0.2f, 0.85f, 1f);
            if (GUILayout.Button("⚡ Send Query (Inference / Attention)", buttonStyle, GUILayout.Height(26 * scale)))
            {
                if (float.TryParse(queryInputText, out float val))
                {
                    RunQuery(val);
                }
                else
                {
                    RunSemanticQuery(queryInputText);
                }
            }
            GUI.color = Color.white;
            GUILayout.EndHorizontal();
            GUILayout.EndVertical();

            GUILayout.Space(6 * scale);

            // 2D Extended Decision Boundary Canvas
            Rect graphRect = GUILayoutUtility.GetRect(w - 20 * scale, 120 * scale);
            DrawConsultDecisionGraph(graphRect, selectedModel, chatHistory.Count > 0 ? chatHistory[chatHistory.Count - 1] : (ConsultInferenceResult?)null);

            GUILayout.Space(6 * scale);

            // Chat Message Stream & Attention Distribution
            if (chatHistory.Count > 0)
            {
                var latest = chatHistory[chatHistory.Count - 1];
                if (latest.isOutOfVocabulary)
                {
                    GUI.color = new Color(1f, 0.3f, 0.35f, 1f);
                    GUILayout.BeginVertical(glitchCardStyle);
                    GUILayout.Label($"❌ <b>[HONEST REFUSAL :: OUT-OF-VOCABULARY TOKEN]</b>", cardTitleStyle);
                    GUILayout.Label($"<b>Model Response:</b> {latest.mathEquationUsed}", cardTitleStyle);
                    GUILayout.Label(latest.explanationText, metricStyle);
                    GUILayout.EndVertical();
                    GUI.color = Color.white;
                }
                else if (latest.isExtrapolation)
                {
                    GUI.color = new Color(1f, 0.35f, 0.45f, 1f);
                    GUILayout.BeginVertical(glitchCardStyle);
                    GUILayout.Label($"⚠️ <b>[LOW CONFIDENCE :: EXTRAPOLATION ERROR]</b>", cardTitleStyle);
                    GUILayout.Label($"<b>Model Output (Genuine Inference):</b> {latest.mathEquationUsed}", cardTitleStyle);
                    GUILayout.Label(latest.explanationText, metricStyle);
                    GUILayout.EndVertical();
                    GUI.color = Color.white;
                }
                else
                {
                    GUI.color = new Color(0.3f, 0.9f, 0.5f, 1f);
                    GUILayout.BeginVertical(cardStyle);
                    GUILayout.Label($"✓ <b>[HIGH CONFIDENCE :: IN-DOMAIN INFERENCE]</b>", cardTitleStyle);
                    GUILayout.Label($"<b>Model Output:</b> {latest.mathEquationUsed}", cardTitleStyle);
                    GUILayout.Label(latest.explanationText, metricStyle);

                    // Render Attention Distribution if present
                    if (latest.attentionWeights != null && latest.attentionWeights.Count > 0)
                    {
                        GUILayout.Space(6 * scale);
                        GUILayout.Label("<b>💡 SIMPLIFIED ATTENTION DISTRIBUTION (Top-4 Softmax Weights):</b>", subHeaderStyle ?? cardTitleStyle);
                        int topN = Mathf.Min(4, latest.attentionWeights.Count);
                        for (int i = 0; i < topN; i++)
                        {
                            var a = latest.attentionWeights[i];
                            GUILayout.BeginHorizontal();
                            GUILayout.Label($"<b>{a.word.ToUpper()}:</b> α = <b>{(a.attentionWeight * 100f):F1}%</b> (sim = {a.rawSimilarity:F2})", metricStyle, GUILayout.Width(170 * scale));
                            Rect barRect = GUILayoutUtility.GetRect(w - 210 * scale, 6 * scale);
                            DrawAttentionBar(barRect, a.attentionWeight, i == 0 ? new Color(1f, 0.75f, 0.2f) : new Color(0.2f, 0.8f, 1f));
                            GUILayout.EndHorizontal();
                        }
                    }

                    GUILayout.EndVertical();
                    GUI.color = Color.white;
                }
            }
        }

        private void DrawAttentionBar(Rect rect, float fill01, Color color)
        {
            Color prev = GUI.color;
            GUI.color = new Color(0.1f, 0.15f, 0.22f, 0.8f);
            GUI.DrawTexture(rect, whitePixel);
            GUI.color = color;
            GUI.DrawTexture(new Rect(rect.x, rect.y, rect.width * Mathf.Clamp01(fill01), rect.height), whitePixel);
            GUI.color = prev;
        }

        private void RunQuery(float qX)
        {
            queryInputText = qX.ToString("F1");
            var res = NeuroArena.ML.ModelConsultEngine.ConsultModel(selectedModel, qX);
            chatHistory.Add(res);
        }

        private void RunSemanticQuery(string token)
        {
            queryInputText = token;
            var res = NeuroArena.ML.ModelConsultEngine.ConsultSemanticToken(token);
            chatHistory.Add(res);

            if (res.attentionWeights != null)
            {
                NeuroArena.Environment.EmbeddingConstellationVisualizer.Instance?.HighlightAttentionWeights(res.attentionWeights);
            }
        }

        private void DrawConsultDecisionGraph(Rect rect, TrainedModelRecord model, ConsultInferenceResult? latestQuery)
        {
            Color prev = GUI.color;
            GUI.color = new Color(0.04f, 0.06f, 0.10f, 0.95f);
            GUI.DrawTexture(rect, whitePixel);

            // Draw Uncharted Territory Shading
            float cx = rect.x + rect.width * 0.5f;
            float cy = rect.y + rect.height * 0.5f;
            float scaleX = rect.width / 32f;
            float scaleY = rect.height / 32f;

            // Domain Bounding Box (In-Domain Territory)
            float domX1 = cx + model.minX * scaleX;
            float domX2 = cx + model.maxX * scaleX;
            Rect inDomainRect = new Rect(domX1, rect.y + 4, Mathf.Max(20, domX2 - domX1), rect.height - 8);

            GUI.color = new Color(0.12f, 0.28f, 0.45f, 0.25f);
            GUI.DrawTexture(inDomainRect, whitePixel);

            // Labels: In-Domain vs Uncharted Space
            GUI.color = new Color(0.4f, 0.8f, 1f, 0.7f);
            GUI.Label(new Rect(domX1 + 4, rect.y + 4, 120, 16), "<b>[TRAINING DOMAIN]</b>", metricStyle);
            GUI.color = new Color(0.9f, 0.4f, 0.4f, 0.7f);
            GUI.Label(new Rect(rect.x + 6, rect.y + 4, 140, 16), "<b>[UNCHARTED TERRITORY]</b>", metricStyle);

            // Draw Extended Straight Decision Line Slicing Blindly Through Space
            GUI.color = new Color(0.95f, 0.75f, 0.25f, 0.85f);
            for (float gx = -15f; gx <= 15f; gx += 0.4f)
            {
                float gy = model.weightW * gx + model.weightB;
                float px = cx + gx * scaleX;
                float py = cy - gy * scaleY;
                if (px >= rect.x && px <= rect.xMax && py >= rect.y && py <= rect.yMax)
                {
                    GUI.DrawTexture(new Rect(px, py, 2, 2), whitePixel);
                }
            }

            // Draw Query Point with Radar Indicator
            if (latestQuery.HasValue)
            {
                var q = latestQuery.Value;
                float qpx = cx + q.queryX * scaleX;
                float qpy = cy - q.predictedValue * scaleY;
                GUI.color = q.isExtrapolation ? new Color(1f, 0.25f, 0.4f) : new Color(0.2f, 1f, 0.5f);
                GUI.DrawTexture(new Rect(qpx - 4, qpy - 4, 8, 8), whitePixel);
            }

            GUI.color = prev;
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

            if (glitchCardStyle == null)
            {
                glitchCardStyle = new GUIStyle(GUI.skin.box);
                Texture2D bg = new Texture2D(1, 1);
                bg.SetPixel(0, 0, new Color(0.24f, 0.06f, 0.10f, 0.95f));
                bg.Apply();
                glitchCardStyle.normal.background = bg;
                glitchCardStyle.padding = new RectOffset((int)(8 * scale), (int)(8 * scale), (int)(8 * scale), (int)(8 * scale));
            }

            if (promptBtnStyle == null)
            {
                promptBtnStyle = new GUIStyle(GUI.skin.button) { fontSize = (int)(9 * scale), fontStyle = FontStyle.Bold, richText = true };
                promptBtnStyle.normal.textColor = new Color(0.9f, 0.95f, 1f);
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
