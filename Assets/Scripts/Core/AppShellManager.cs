using System;
using System.Collections;
using UnityEngine;
using NeuroArena.UI;
using NeuroArena.Data;

namespace NeuroArena.Core
{
    public enum AppShellState
    {
        SplashScreen,
        MainMenu,
        Settings,
        Codex,
        LoadingScreen,
        GameplayArena
    }

    /// <summary>
    /// Master App Shell Coordinator.
    /// Manages the state machine across Splash Screen (2-3s skippable), Main Menu, Settings,
    /// Loading Screen (with minimum duration gating), and 3D Gameplay Arena.
    /// </summary>
    public class AppShellManager : MonoBehaviour
    {
        public static AppShellManager Instance { get; private set; }

        [Header("State")]
        [SerializeField] private AppShellState currentState = AppShellState.SplashScreen;
        [SerializeField] private float splashDuration = 2.5f;

        private float splashTimer = 0f;
        private bool isSplashSkipped = false;

        private GUIStyle splashTitleStyle;
        private GUIStyle splashSubStyle;
        private GUIStyle splashPromptStyle;
        private Texture2D whitePixel;

        public AppShellState CurrentState => currentState;

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

        private void Start()
        {
            StartCoroutine(SplashScreenSequence());
        }

        private void Update()
        {
            if (currentState == AppShellState.SplashScreen && (Input.anyKeyDown || Input.touchCount > 0))
            {
                isSplashSkipped = true;
            }
        }

        private IEnumerator SplashScreenSequence()
        {
            currentState = AppShellState.SplashScreen;
            NeuroAudioEngine.Instance?.PlayTerminalOpen();

            splashTimer = 0f;
            while (splashTimer < splashDuration && !isSplashSkipped)
            {
                splashTimer += Time.unscaledDeltaTime;
                yield return null;
            }

            TransitionToMainMenu();
        }

        public void TransitionToMainMenu()
        {
            currentState = AppShellState.MainMenu;
            MainMenuUI.Instance?.OpenMenu();
        }

        public void StartGameWithLoading(string seed, int biomeIndex = 0)
        {
            currentState = AppShellState.LoadingScreen;
            MainMenuUI.Instance?.CloseMenu();

            LoadingScreenManager.Instance?.LoadBiomeSequence(biomeIndex, () =>
            {
                currentState = AppShellState.GameplayArena;
                ProceduralDataGenerator.Instance?.GenerateProceduralDataset(seed);
                FirstRunTutorialDirector.Instance?.StartTutorial();
            });
        }

        public void QuitGame()
        {
            Debug.Log("[AppShell] Exiting NeuroArena application...");
#if UNITY_EDITOR
            UnityEditor.EditorApplication.isPlaying = false;
#else
            Application.Quit();
#endif
        }

        private void OnGUI()
        {
            if (currentState != AppShellState.SplashScreen) return;

            InitStyles();
            float scale = Screen.dpi > 0 ? Screen.dpi / 160f : 1f;

            Rect full = new Rect(0, 0, Screen.width, Screen.height);
            Color prev = GUI.color;
            GUI.color = new Color(0.02f, 0.04f, 0.08f, 1.0f);
            GUI.DrawTexture(full, whitePixel);
            GUI.color = prev;

            float w = Mathf.Min(480 * scale, Screen.width * 0.90f);
            float h = 180 * scale;
            Rect center = new Rect((Screen.width - w) * 0.5f, (Screen.height - h) * 0.5f, w, h);

            GUILayout.BeginArea(center);
            GUILayout.Label("⚡ NEURO-ARENA", splashTitleStyle);
            GUILayout.Label("GRADIENTS OF THE WILD  |  3D MACHINE LEARNING SIMULATION", splashSubStyle);
            GUILayout.Space(24 * scale);
            GUILayout.Label("Tap anywhere or press any key to skip", splashPromptStyle);
            GUILayout.EndArea();
        }

        private void InitStyles()
        {
            float scale = Screen.dpi > 0 ? Screen.dpi / 160f : 1f;

            if (splashTitleStyle == null)
            {
                splashTitleStyle = new GUIStyle(GUI.skin.label) { fontSize = (int)(26 * scale), fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter, richText = true };
                splashTitleStyle.normal.textColor = new Color(0.22f, 0.74f, 0.97f);
            }

            if (splashSubStyle == null)
            {
                splashSubStyle = new GUIStyle(GUI.skin.label) { fontSize = (int)(10 * scale), fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter, richText = true };
                splashSubStyle.normal.textColor = new Color(0.96f, 0.62f, 0.04f);
            }

            if (splashPromptStyle == null)
            {
                splashPromptStyle = new GUIStyle(GUI.skin.label) { fontSize = (int)(9 * scale), fontStyle = FontStyle.Italic, alignment = TextAnchor.MiddleCenter, richText = true };
                splashPromptStyle.normal.textColor = new Color(0.55f, 0.65f, 0.75f);
            }
        }
    }
}
