using System;
using System.Collections.Generic;
using UnityEngine;
using NeuroArena.ML;
using NeuroArena.Core;

namespace NeuroArena.UI
{
    /// <summary>
    /// In-Fiction Diegetic/Spatial Holographic Instrument emitted from the Architect's ADA Companion Drone (∇θ).
    /// Projects a live loss sparkline, active parameter rings (θ = [w, b]), and convergence status beam.
    /// Classified under Marcus Andrews' UI framework as Spatial (Diegetic Projection).
    /// </summary>
    public class ArchitectHolographicHUD : MonoBehaviour
    {
        public static ArchitectHolographicHUD Instance { get; private set; }

        public enum LossTrend
        {
            Converging,  // Downward slope, Emerald (#10B981)
            Plateau,     // Flat slope, Amber (#F59E0B)
            Diverging    // Upward slope or NaN spike, Crimson (#F43F5E)
        }

        [Header("Telemetry State")]
        [SerializeField] private float playerHp = 100f;
        [SerializeField] private float maxPlayerHp = 100f;
        [SerializeField] private float playerEnergy = 100f;
        [SerializeField] private float maxPlayerEnergy = 100f;
        [SerializeField] private float currentW = 1.42f;
        [SerializeField] private float currentB = -0.35f;
        [SerializeField] private float currentLoss = 0.042f;
        [SerializeField] private LossTrend currentTrend = LossTrend.Converging;

        [Header("Boss State")]
        [SerializeField] private bool isBossActive = false;
        [SerializeField] private int bossPhase = 1; // 1: Normal Cyan, 2: Enrage Amber, 3: Overclock Violet
        [SerializeField] private float bossHp = 1000f;
        [SerializeField] private float bossMaxHp = 1000f;

        private List<float> lossHistory = new List<float> { 0.45f, 0.38f, 0.29f, 0.22f, 0.18f, 0.12f, 0.09f, 0.065f, 0.051f, 0.042f };
        private Texture2D whitePixel;
        private GUIStyle holoBoxStyle;
        private GUIStyle labelStyle;
        private GUIStyle valueStyle;

        public float PlayerHp => playerHp;
        public LossTrend CurrentTrend => currentTrend;
        public int BossPhase => bossPhase;

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

        public void RecordLoss(float newLoss, float? newW = null, float? newB = null)
        {
            currentLoss = newLoss;
            if (newW.HasValue) currentW = newW.Value;
            if (newB.HasValue) currentB = newB.Value;

            lossHistory.Add(newLoss);
            if (lossHistory.Count > 20) lossHistory.RemoveAt(0);

            // Calculate trend for 200ms glance test
            if (float.IsNaN(newLoss) || newLoss > 5.0f)
            {
                currentTrend = LossTrend.Diverging;
                JuiceFeedbackManager.Instance?.OnBossHitTaken(transform.position);
            }
            else if (lossHistory.Count >= 3)
            {
                float delta = lossHistory[lossHistory.Count - 1] - lossHistory[lossHistory.Count - 3];
                if (delta > 0.008f) currentTrend = LossTrend.Diverging;
                else if (Mathf.Abs(delta) <= 0.002f) currentTrend = LossTrend.Plateau;
                else currentTrend = LossTrend.Converging;
            }
        }

        public void TakeDamage(float amount)
        {
            playerHp = Mathf.Max(0f, playerHp - amount);
            JuiceFeedbackManager.Instance?.OnBossHitTaken(transform.position);
        }

        public void UpdateBoss(float current, float max = 1000f)
        {
            isBossActive = true;
            bossHp = current;
            bossMaxHp = max;

            float pct = current / max;
            if (pct > 0.66f) bossPhase = 1;
            else if (pct > 0.33f) bossPhase = 2;
            else bossPhase = 3;
        }

        private void InitStyles()
        {
            if (holoBoxStyle != null) return;

            holoBoxStyle = new GUIStyle(GUI.skin.box)
            {
                normal = { background = whitePixel }
            };

            labelStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = 11,
                fontStyle = FontStyle.Bold,
                normal = { textColor = new Color(0.22f, 0.74f, 0.97f) }
            };

            valueStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = 10,
                normal = { textColor = Color.white }
            };
        }

        private void OnGUI()
        {
            InitStyles();
            float scale = Screen.dpi > 0 ? Screen.dpi / 160f : 1f;

            DrawDroneHolographicHUD(scale);
            DrawVitalityHUD(scale);
            if (isBossActive) DrawBossPhaseCrown(scale);
        }

        private void DrawDroneHolographicHUD(float scale)
        {
            float w = 210 * scale;
            float h = 100 * scale;
            Rect rect = new Rect(20 * scale, 80 * scale, w, h);

            Color prev = GUI.color;
            GUI.color = new Color(0.02f, 0.06f, 0.12f, 0.88f);
            GUI.Box(rect, GUIContent.none, holoBoxStyle);
            GUI.color = prev;

            GUILayout.BeginArea(rect);
            GUILayout.BeginHorizontal();
            GUILayout.Label("∇θ <b>ADA HOLOGRAM</b>", labelStyle);

            string trendStr = currentTrend == LossTrend.Converging ? "<color=#10B981>↓ CONV</color>" :
                             (currentTrend == LossTrend.Diverging ? "<color=#F43F5E>↑ DIV</color>" : "<color=#F59E0B>→ PLAT</color>");
            GUILayout.Label(trendStr, labelStyle);
            GUILayout.EndHorizontal();

            // Sparkline area
            Rect sparkRect = GUILayoutUtility.GetRect(w - 16 * scale, 40 * scale);
            DrawSparkline(sparkRect);

            // Parameter values
            GUILayout.Label($"w: {currentW:+0.00;-0.00}  |  b: {currentB:+0.00;-0.00}  |  Loss: {currentLoss:F3}", valueStyle);
            GUILayout.EndArea();
        }

        private void DrawSparkline(Rect r)
        {
            if (lossHistory.Count < 2) return;
            Color stroke = currentTrend == LossTrend.Converging ? new Color(0.06f, 0.73f, 0.51f) :
                          (currentTrend == LossTrend.Diverging ? new Color(0.96f, 0.25f, 0.37f) : new Color(0.96f, 0.62f, 0.04f));

            float max = 0.5f;
            for (int i = 0; i < lossHistory.Count; i++) if (lossHistory[i] > max) max = lossHistory[i];

            Vector2 prev = Vector2.zero;
            for (int i = 0; i < lossHistory.Count; i++)
            {
                float tX = (float)i / (lossHistory.Count - 1);
                float val = Mathf.Clamp(lossHistory[i], 0f, max);
                float tY = val / max;
                Vector2 cur = new Vector2(r.x + tX * r.width, r.yMax - tY * r.height);
                if (i > 0) MLGraphVisualizer.DrawLine(prev, cur, stroke, 2f);
                prev = cur;
            }
        }

        private void DrawVitalityHUD(float scale)
        {
            float w = 180 * scale;
            float h = 46 * scale;
            Rect rect = new Rect(20 * scale, Screen.height - 110 * scale, w, h);

            Color prev = GUI.color;
            GUI.color = new Color(0.04f, 0.08f, 0.14f, 0.85f);
            GUI.Box(rect, GUIContent.none, holoBoxStyle);
            GUI.color = prev;

            GUILayout.BeginArea(rect);
            // Health Bar
            float hpPct = Mathf.Clamp01(playerHp / maxPlayerHp);
            Color hpCol = hpPct > 0.5f ? new Color(0.13f, 0.77f, 0.37f) : (hpPct > 0.25f ? new Color(0.96f, 0.62f, 0.04f) : new Color(0.94f, 0.27f, 0.27f));
            GUILayout.BeginHorizontal();
            GUILayout.Label("❤️", labelStyle, GUILayout.Width(22 * scale));
            Rect hpRect = GUILayoutUtility.GetRect(w - 38 * scale, 12 * scale);
            DrawBar(hpRect, hpPct, hpCol);
            GUILayout.EndHorizontal();

            // Energy Bar
            float epPct = Mathf.Clamp01(playerEnergy / maxPlayerEnergy);
            GUILayout.BeginHorizontal();
            GUILayout.Label("⚡", labelStyle, GUILayout.Width(22 * scale));
            Rect epRect = GUILayoutUtility.GetRect(w - 38 * scale, 10 * scale);
            DrawBar(epRect, epPct, new Color(0.01f, 0.52f, 0.78f));
            GUILayout.EndHorizontal();
            GUILayout.EndArea();
        }

        private void DrawBossPhaseCrown(float scale)
        {
            float w = Mathf.Min(420 * scale, Screen.width * 0.85f);
            float h = 48 * scale;
            Rect rect = new Rect((Screen.width - w) * 0.5f, 10 * scale, w, h);

            Color prev = GUI.color;
            GUI.color = new Color(0.05f, 0.07f, 0.14f, 0.9f);
            GUI.Box(rect, GUIContent.none, holoBoxStyle);
            GUI.color = prev;

            GUILayout.BeginArea(rect);
            GUILayout.BeginHorizontal();
            GUILayout.Label("⚔️ <b>BOSS PHANTOM</b>", labelStyle);

            string p1 = bossPhase == 1 ? "<color=#00F0FF><b>[PHASE I]</b></color>" : "<color=#64748B>[I]</color>";
            string p2 = bossPhase == 2 ? "<color=#F59E0B><b>[PHASE II: ENRAGE]</b></color>" : "<color=#64748B>[II]</color>";
            string p3 = bossPhase == 3 ? "<color=#C084FC><b>[PHASE III: OVERCLOCK]</b></color>" : "<color=#64748B>[III]</color>";
            GUILayout.Label($"{p1} {p2} {p3}", labelStyle);
            GUILayout.EndHorizontal();

            float hpPct = Mathf.Clamp01(bossHp / bossMaxHp);
            Rect barRect = GUILayoutUtility.GetRect(w - 20 * scale, 8 * scale);
            DrawBar(barRect, hpPct, new Color(0.96f, 0.25f, 0.37f));
            GUILayout.EndArea();
        }

        private void DrawBar(Rect rect, float pct, Color fillCol)
        {
            Color prev = GUI.color;
            GUI.color = new Color(0.08f, 0.12f, 0.2f);
            GUI.DrawTexture(rect, whitePixel);
            GUI.color = fillCol;
            GUI.DrawTexture(new Rect(rect.x, rect.y, rect.width * pct, rect.height), whitePixel);
            GUI.color = prev;
        }
    }
}
