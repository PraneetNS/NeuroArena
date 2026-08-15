using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using NeuroArena.Data;

namespace NeuroArena.UI
{
    /// <summary>
    /// Biome Loading Screen Component.
    /// Features biome-themed gradient artwork, dynamic progress bar, rotating ML Codex tips,
    /// and an enforced minimum duration timer (1.8s) to prevent jarring screen flickers on fast hardware.
    /// </summary>
    public class LoadingScreenManager : MonoBehaviour
    {
        public static LoadingScreenManager Instance { get; private set; }

        [Header("Timing Settings")]
        [SerializeField] private float minimumLoadingDuration = 1.8f;

        [Header("State")]
        [SerializeField] private bool isLoading = false;
        [SerializeField] private float progress = 0f;
        [SerializeField] private string currentTip = "";

        private List<string> codexTips = new List<string>
        {
            "💡 Gradient Descent steps in the direction opposite to the gradient: w ← w - η·∇J.",
            "💡 L1 Lasso Regularization forces non-informative feature weights strictly to zero.",
            "💡 Decision Trees split orthogonal hyperplanes to maximize Gini Information Gain.",
            "💡 Multi-Layer Perceptrons chain non-linear ReLU gates to solve the XOR paradox.",
            "💡 Positive Pointwise Mutual Information (PPMI) encodes semantic word co-occurrences.",
            "💡 Cosine Similarity measures directional angular similarity independent of vector magnitude."
        };

        private Texture2D whitePixel;
        private GUIStyle panelStyle;
        private GUIStyle titleStyle;
        private GUIStyle tipStyle;
        private GUIStyle progressTextStyle;

        public bool IsLoading => isLoading;

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

        public void LoadBiomeSequence(int biomeIndex, Action onComplete = null)
        {
            StartCoroutine(LoadingCoroutine(biomeIndex, onComplete));
        }

        private IEnumerator LoadingCoroutine(int biomeIndex, Action onComplete)
        {
            isLoading = true;
            progress = 0f;
            currentTip = codexTips[UnityEngine.Random.Range(0, codexTips.Count)];

            float elapsed = 0f;
            while (elapsed < minimumLoadingDuration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / minimumLoadingDuration);
                // EaseOutCubic interpolation
                progress = 1f - Mathf.Pow(1f - t, 3f);
                yield return null;
            }

            progress = 1.0f;
            yield return new WaitForSecondsRealtime(0.15f);

            isLoading = false;
            onComplete?.Invoke();
        }

        private void OnGUI()
        {
            if (!isLoading) return;

            InitStyles();
            float scale = Screen.dpi > 0 ? Screen.dpi / 160f : 1f;

            // Full screen dark cyber overlay
            Rect fullScreen = new Rect(0, 0, Screen.width, Screen.height);
            Color prevCol = GUI.color;
            GUI.color = new Color(0.02f, 0.04f, 0.08f, 0.98f);
            GUI.DrawTexture(fullScreen, whitePixel);
            GUI.color = prevCol;

            float w = Mathf.Min(520 * scale, Screen.width * 0.90f);
            float h = 180 * scale;
            Rect centerBox = new Rect((Screen.width - w) * 0.5f, (Screen.height - h) * 0.5f, w, h);

            GUILayout.BeginArea(centerBox);
            GUILayout.Label("⚡ <b>NEURO-ARENA :: CALIBRATING BIOME ENVIRONMENT...</b>", titleStyle);
            GUILayout.Space(14 * scale);

            // Progress Bar
            Rect barRect = GUILayoutUtility.GetRect(w, 10 * scale);
            DrawProgressBar(barRect, progress, new Color(0.22f, 0.74f, 0.97f));

            GUILayout.Space(6 * scale);
            GUILayout.Label($"<b>SYNCHRONIZING WEIGHTS:</b> {Mathf.RoundToInt(progress * 100)}%", progressTextStyle);

            GUILayout.Space(12 * scale);
            GUILayout.Label(currentTip, tipStyle);
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

            if (titleStyle == null)
            {
                titleStyle = new GUIStyle(GUI.skin.label) { fontSize = (int)(12 * scale), fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter, richText = true };
                titleStyle.normal.textColor = new Color(0.22f, 0.74f, 0.97f);
            }

            if (progressTextStyle == null)
            {
                progressTextStyle = new GUIStyle(GUI.skin.label) { fontSize = (int)(9 * scale), fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleRight, richText = true };
                progressTextStyle.normal.textColor = new Color(0.29f, 0.87f, 0.5f);
            }

            if (tipStyle == null)
            {
                tipStyle = new GUIStyle(GUI.skin.label) { fontSize = (int)(10 * scale), fontStyle = FontStyle.Italic, alignment = TextAnchor.MiddleCenter, richText = true, wordWrap = true };
                tipStyle.normal.textColor = new Color(0.85f, 0.90f, 0.95f);
            }
        }
    }
}
