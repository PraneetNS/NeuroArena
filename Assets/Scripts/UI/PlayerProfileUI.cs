using System;
using UnityEngine;
using NeuroArena.Core;
using NeuroArena.Data;

namespace NeuroArena.UI
{
    /// <summary>
    /// Player Profile Screen UI.
    /// Displays readable stat cards (not raw JSON): Biome milestones, Grand Prix win-rates,
    /// Daily challenge streaks, total playtime, and save slot selectors.
    /// </summary>
    public class PlayerProfileUI : MonoBehaviour
    {
        public static PlayerProfileUI Instance { get; private set; }

        [SerializeField] private bool isOpen = false;

        private GUIStyle panelStyle;
        private GUIStyle headerTitleStyle;
        private GUIStyle statCardStyle;
        private GUIStyle statValueStyle;
        private GUIStyle buttonStyle;
        private GUIStyle activeSlotStyle;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
        }

        public void OpenProfile() => isOpen = true;
        public void CloseProfile() => isOpen = false;
        public void ToggleProfile() { if (isOpen) CloseProfile(); else OpenProfile(); }

        private void OnGUI()
        {
            if (!isOpen) return;

            InitStyles();
            float scale = Screen.dpi > 0 ? Screen.dpi / 160f : 1f;

            float w = Mathf.Min(680 * scale, Screen.width * 0.94f);
            float h = Mathf.Min(560 * scale, Screen.height * 0.92f);
            Rect modalRect = new Rect((Screen.width - w) * 0.5f, (Screen.height - h) * 0.5f, w, h);

            GUI.Box(modalRect, GUIContent.none, panelStyle);
            GUILayout.BeginArea(modalRect);

            // Header
            GUILayout.BeginHorizontal();
            GUILayout.Label("👤 <b>ARCHITECT PROFILE & ML LIFETIME RECORD</b>", headerTitleStyle);
            GUILayout.FlexibleSpace();
            if (GUILayout.Button("✕ Close", buttonStyle, GUILayout.Width(75 * scale), GUILayout.Height(30 * scale)))
            {
                CloseProfile();
            }
            GUILayout.EndHorizontal();

            GUILayout.Space(8 * scale);

            var profile = PlayerProfileManager.Instance?.CurrentProfile ?? new PlayerProfileData();

            // Save Slots Row
            GUILayout.BeginHorizontal();
            GUILayout.Label("<b>Save Slot:</b>", GUILayout.Width(70 * scale));
            for (int s = 0; s < 3; s++)
            {
                bool isActive = (PlayerProfileManager.Instance != null && PlayerProfileManager.Instance.ActiveSlot == s);
                string slotLabel = $"Slot {s + 1}" + (isActive ? " (Active)" : "");
                if (GUILayout.Button(slotLabel, isActive ? activeSlotStyle : buttonStyle, GUILayout.Width(110 * scale), GUILayout.Height(28 * scale)))
                {
                    PlayerProfileManager.Instance?.LoadProfile(s);
                }
                GUILayout.Space(4 * scale);
            }
            GUILayout.EndHorizontal();

            GUILayout.Space(10 * scale);

            // Profile Header Summary Box
            GUILayout.BeginVertical(statCardStyle);
            GUILayout.Label($"<b>ARCHITECT:</b> <color=#38BDF8>{profile.playerName}</color>  |  <b>AVATAR:</b> {profile.avatarId}", headerTitleStyle);
            GUILayout.Label($"⏱️ <b>Total Playtime:</b> {profile.FormattedPlaytime}  |  📅 <b>Created:</b> {profile.creationDate}", statValueStyle);
            GUILayout.EndVertical();

            GUILayout.Space(8 * scale);

            // 3-Column Stat Cards Row
            GUILayout.BeginHorizontal();

            // Card 1: Biomes Completed
            GUILayout.BeginVertical(statCardStyle, GUILayout.Width((w - 40 * scale) / 3));
            GUILayout.Label("🗺️ <b>BIOME MASTERY</b>", headerTitleStyle);
            GUILayout.Label($"<color=#4ADE80><b>{profile.biomesCompletedCount}/6</b></color> Biomes", statValueStyle);
            GUILayout.Label("<color=#94A3B8>Boss Victory Gates</color>", statValueStyle);
            GUILayout.EndVertical();

            GUILayout.Space(6 * scale);

            // Card 2: Grand Prix Win-Rate
            GUILayout.BeginVertical(statCardStyle, GUILayout.Width((w - 40 * scale) / 3));
            GUILayout.Label("🏁 <b>GRAND PRIX</b>", headerTitleStyle);
            GUILayout.Label($"<color=#FBBF24><b>{profile.GrandPrixWinRate:F1}%</b></color> Win-Rate", statValueStyle);
            GUILayout.Label($"<color=#94A3B8>{profile.grandPrixWins} Wins / {profile.grandPrixRaces} Races</color>", statValueStyle);
            GUILayout.EndVertical();

            GUILayout.Space(6 * scale);

            // Card 3: Daily Challenge Streak
            GUILayout.BeginVertical(statCardStyle, GUILayout.Width((w - 40 * scale) / 3));
            GUILayout.Label("📅 <b>DAILY STREAK</b>", headerTitleStyle);
            GUILayout.Label($"<color=#38BDF8><b>{profile.dailyChallengeStreak} Days</b></color>", statValueStyle);
            GUILayout.Label($"<color=#94A3B8>Best Streak: {profile.bestDailyStreak} Days</color>", statValueStyle);
            GUILayout.EndVertical();

            GUILayout.EndHorizontal();

            GUILayout.Space(10 * scale);

            // Detailed Biome Best Records Table
            GUILayout.Label("<b>📊 LIFETIME BEST METRICS PER BIOME:</b>", headerTitleStyle);
            for (int i = 0; i < profile.biomeRecords.Length; i++)
            {
                var r = profile.biomeRecords[i];
                string status = r.isCompleted ? "<color=#4ADE80>🏆 MASTERED</color>" : "<color=#64748B>🔒 IN PROGRESS</color>";
                string metric = (i == 0 || i == 2) ? $"Best MSE: {(r.bestMSE < 900 ? r.bestMSE.ToString("F4") : "N/A")}" : $"Best Acc: {(r.bestAccuracy > 0 ? (r.bestAccuracy.ToString("F1") + "%") : "N/A")}";
                GUILayout.Label($"• <b>{r.biomeName}</b> ➔ {metric} | {status}", statValueStyle);
            }

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

            if (headerTitleStyle == null)
            {
                headerTitleStyle = new GUIStyle(GUI.skin.label) { fontSize = (int)(11 * scale), fontStyle = FontStyle.Bold, richText = true };
                headerTitleStyle.normal.textColor = new Color(0.22f, 0.74f, 0.97f);
            }

            if (statCardStyle == null)
            {
                statCardStyle = new GUIStyle(GUI.skin.box);
                Texture2D cardBg = new Texture2D(1, 1);
                cardBg.SetPixel(0, 0, new Color(0.06f, 0.10f, 0.18f, 0.85f));
                cardBg.Apply();
                statCardStyle.normal.background = cardBg;
                statCardStyle.padding = new RectOffset((int)(8 * scale), (int)(8 * scale), (int)(8 * scale), (int)(8 * scale));
            }

            if (statValueStyle == null)
            {
                statValueStyle = new GUIStyle(GUI.skin.label) { fontSize = (int)(10 * scale), richText = true };
                statValueStyle.normal.textColor = new Color(0.88f, 0.92f, 0.96f);
            }

            if (buttonStyle == null)
            {
                buttonStyle = new GUIStyle(GUI.skin.button) { fontSize = (int)(10 * scale), fontStyle = FontStyle.Bold, richText = true };
                buttonStyle.normal.textColor = Color.white;
            }

            if (activeSlotStyle == null)
            {
                activeSlotStyle = new GUIStyle(buttonStyle);
                activeSlotStyle.normal.textColor = new Color(0.29f, 0.87f, 0.5f);
            }
        }
    }
}
