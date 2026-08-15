using System;
using UnityEngine;
using UnityEngine.SceneManagement;
using NeuroArena.Data;
using NeuroArena.Environment;

namespace NeuroArena.UI
{
    /// <summary>
    /// Title Screen & Main Menu with Continue, New Game, Shareable Seed Input, and Biome Progression Map.
    /// </summary>
    public class MainMenuUI : MonoBehaviour
    {
        public static MainMenuUI Instance { get; private set; }

        public bool IsMenuOpen { get; private set; } = true;

        [Header("Seed Input")]
        [SerializeField] private string seedInput = "NEURO-8842";

        private bool hasSaveData = false;
        private GameSaveData loadedSavePreview;
        private bool showBiomeMap = false;

        private GUIStyle titleStyle;
        private GUIStyle subtitleStyle;
        private GUIStyle menuBtnStyle;
        private GUIStyle cardBoxStyle;
        private GUIStyle labelStyle;
        private GUIStyle seedInputStyle;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            CheckExistingSave();
        }

        private void Start()
        {
            if (SaveManager.Instance != null && SaveManager.Instance.HasSaveFile())
            {
                seedInput = SaveManager.Instance.CurrentSaveData.playthroughSeed;
            }
            else
            {
                seedInput = ProceduralDataGenerator.GenerateRandomSeedString();
            }
        }

        private void CheckExistingSave()
        {
            hasSaveData = SaveManager.Instance != null && SaveManager.Instance.HasSaveFile();
            if (hasSaveData)
            {
                loadedSavePreview = SaveManager.Instance.CurrentSaveData;
            }
        }

        public void OpenMenu()
        {
            IsMenuOpen = true;
            CheckExistingSave();
            Time.timeScale = 0f;
        }

        public void CloseMenu()
        {
            IsMenuOpen = false;
            Time.timeScale = 1f;
        }

        private void OnGUI()
        {
            if (!IsMenuOpen) return;

            InitStyles();
            float scale = Screen.dpi > 0 ? Screen.dpi / 160f : 1f;

            // Fullscreen backdrop
            Rect fullScreen = new Rect(0, 0, Screen.width, Screen.height);
            GUI.Box(fullScreen, GUIContent.none, cardBoxStyle);

            float menuW = Mathf.Min(480 * scale, Screen.width * 0.9f);
            float menuH = Mathf.Min(560 * scale, Screen.height * 0.95f);
            Rect menuRect = new Rect((Screen.width - menuW) * 0.5f, (Screen.height - menuH) * 0.5f, menuW, menuH);

            GUILayout.BeginArea(menuRect);

            // Title
            GUILayout.Space(10 * scale);
            GUILayout.Label("⚡ NEURO-ARENA", titleStyle);
            GUILayout.Label("GRADIENTS OF THE WILD  |  3D ML SIMULATOR", subtitleStyle);
            GUILayout.Space(14 * scale);

            if (!showBiomeMap)
            {
                // Playthrough Seed Input Row
                GUILayout.BeginHorizontal();
                GUILayout.Label("<b>PLAYTHROUGH SEED:</b>", labelStyle, GUILayout.Width(140 * scale));
                seedInput = GUILayout.TextField(seedInput.ToUpper(), seedInputStyle, GUILayout.Height(30 * scale));
                if (GUILayout.Button("🎲 Random", menuBtnStyle, GUILayout.Width(75 * scale), GUILayout.Height(30 * scale)))
                {
                    seedInput = ProceduralDataGenerator.GenerateRandomSeedString();
                }
                GUILayout.EndHorizontal();

                GUILayout.Space(12 * scale);

                // Continue Button
                GUI.enabled = hasSaveData;
                GUI.color = hasSaveData ? new Color(0.2f, 1f, 0.5f) : new Color(0.4f, 0.4f, 0.4f);
                string continueLabel = hasSaveData ? $"⚔️ CONTINUE GAME (Biome {loadedSavePreview.currentBiomeIndex + 1})" : "⚔️ CONTINUE GAME (No Save)";
                if (GUILayout.Button(continueLabel, menuBtnStyle, GUILayout.Height(44 * scale)))
                {
                    ProceduralDataGenerator.Instance?.InitializeWithSeed(seedInput);
                    SaveManager.Instance?.LoadGame();
                    CloseMenu();
                }

                GUI.enabled = true;
                GUI.color = new Color(0.2f, 0.85f, 1f);
                GUILayout.Space(8 * scale);

                // New Game Button
                if (GUILayout.Button("🌟 NEW GAME (APPLY SEED)", menuBtnStyle, GUILayout.Height(44 * scale)))
                {
                    ProceduralDataGenerator.Instance?.InitializeWithSeed(seedInput);
                    SaveManager.Instance?.DeleteSave();
                    SaveManager.Instance?.SaveGame();
                    CloseMenu();
                }

                GUI.color = Color.white;
                GUILayout.Space(8 * scale);

                // Biome Map Button
                if (GUILayout.Button("🗺️ BIOME PROGRESSION MAP", menuBtnStyle, GUILayout.Height(38 * scale)))
                {
                    showBiomeMap = true;
                }

                GUILayout.Space(8 * scale);

                // Delete Save
                if (hasSaveData)
                {
                    GUI.color = new Color(1f, 0.4f, 0.4f);
                    if (GUILayout.Button("🗑️ Reset Local Save File", menuBtnStyle, GUILayout.Height(32 * scale)))
                    {
                        SaveManager.Instance?.DeleteSave();
                        CheckExistingSave();
                    }
                    GUI.color = Color.white;
                }
            }
            else
            {
                // Biome Map Sub-View
                GUILayout.Label("<b>🗺️ 5-BIOME CURRICULUM MAP</b>", subtitleStyle);
                GUILayout.Space(10 * scale);

                bool[] unl = (BiomeManager.Instance != null) ? BiomeManager.Instance.UnlockedBiomes : new bool[] { true, false, false, false, false };
                string[] names = (BiomeManager.Instance != null) ? BiomeManager.Instance.BiomeNames : new string[]
                {
                    "1. Linear Steppes", "2. Binary Marshlands", "3. Variance Tundra", "4. Branching Canopy", "5. Deep Synapse Citadel"
                };

                for (int i = 0; i < 5; i++)
                {
                    bool isU = (i < unl.Length) && unl[i];
                    string status = isU ? "<color=#55FF55>UNLOCKED</color>" : "<color=#888888>LOCKED</color>";
                    GUILayout.Label($"<b>{names[i]}</b> ➔ {status}", labelStyle);
                }

                GUILayout.Space(14 * scale);
                if (GUILayout.Button("← Back to Menu", menuBtnStyle, GUILayout.Height(36 * scale)))
                {
                    showBiomeMap = false;
                }
            }

            GUILayout.EndArea();
        }

        private void InitStyles()
        {
            float scale = Screen.dpi > 0 ? Screen.dpi / 160f : 1f;

            if (cardBoxStyle == null)
            {
                cardBoxStyle = new GUIStyle(GUI.skin.box);
                Texture2D bg = new Texture2D(1, 1);
                bg.SetPixel(0, 0, new Color(0.04f, 0.07f, 0.12f, 0.96f));
                bg.Apply();
                cardBoxStyle.normal.background = bg;
            }

            if (titleStyle == null)
            {
                titleStyle = new GUIStyle(GUI.skin.label) { fontSize = (int)(22 * scale), fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter };
                titleStyle.normal.textColor = new Color(0.2f, 0.9f, 1f);
            }

            if (subtitleStyle == null)
            {
                subtitleStyle = new GUIStyle(GUI.skin.label) { fontSize = (int)(11 * scale), fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter };
                subtitleStyle.normal.textColor = new Color(0.9f, 0.75f, 0.2f);
            }

            if (menuBtnStyle == null)
            {
                menuBtnStyle = new GUIStyle(GUI.skin.button) { fontSize = (int)(12 * scale), fontStyle = FontStyle.Bold };
                menuBtnStyle.normal.textColor = Color.white;
            }

            if (labelStyle == null)
            {
                labelStyle = new GUIStyle(GUI.skin.label) { fontSize = (int)(11 * scale), richText = true };
                labelStyle.normal.textColor = new Color(0.85f, 0.88f, 0.92f);
            }

            if (seedInputStyle == null)
            {
                seedInputStyle = new GUIStyle(GUI.skin.textField) { fontSize = (int)(12 * scale), fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter };
                seedInputStyle.normal.textColor = new Color(0.3f, 1f, 0.5f);
            }
        }
    }
}
