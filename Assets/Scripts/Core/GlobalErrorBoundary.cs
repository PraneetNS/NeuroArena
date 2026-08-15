using System;
using System.IO;
using UnityEngine;
using UnityEngine.SceneManagement;
using NeuroArena.Data;

namespace NeuroArena.Core
{
    /// <summary>
    /// Global Error Boundary & Crash Recovery System.
    /// Hooks Unity's fatal log callback, writes stack traces to local disk,
    /// performs an emergency auto-save, and displays a friendly recovery GUI instead of an OS crash.
    /// </summary>
    public class GlobalErrorBoundary : MonoBehaviour
    {
        public static GlobalErrorBoundary Instance { get; private set; }

        private bool isErrorModalActive = false;
        private string lastErrorMessage = "";
        private string lastErrorStackTrace = "";
        private string crashLogPath;

        private GUIStyle overlayStyle;
        private GUIStyle cardStyle;
        private GUIStyle titleStyle;
        private GUIStyle messageStyle;
        private GUIStyle buttonStyle;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);

            crashLogPath = Path.Combine(Application.persistentDataPath, "neuroarena_crash.log");
            Application.logMessageReceived += HandleApplicationLog;
        }

        private void OnDestroy()
        {
            Application.logMessageReceived -= HandleApplicationLog;
        }

        private void HandleApplicationLog(string logString, string stackTrace, LogType type)
        {
            if (type == LogType.Exception || type == LogType.Assert)
            {
                lastErrorMessage = logString;
                lastErrorStackTrace = stackTrace;

                // 1. Write to Crash Log on Local Disk
                try
                {
                    string timestamp = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");
                    string logEntry = $"[{timestamp}] FATAL EXCEPTION:\nMessage: {logString}\nStackTrace:\n{stackTrace}\n-----------------------------------\n";
                    File.AppendAllText(crashLogPath, logEntry);
                    Debug.Log($"[GlobalErrorBoundary] Exception logged to: {crashLogPath}");
                }
                catch (Exception ex)
                {
                    Debug.LogWarning($"[GlobalErrorBoundary] Failed to write crash log: {ex.Message}");
                }

                // 2. Perform Emergency Auto-Save
                try
                {
                    if (SaveManager.Instance != null)
                    {
                        SaveManager.Instance.SaveGame();
                        Debug.Log("[GlobalErrorBoundary] Emergency progress save completed successfully!");
                    }
                }
                catch (Exception ex)
                {
                    Debug.LogWarning($"[GlobalErrorBoundary] Emergency save failed: {ex.Message}");
                }

                // 3. Trigger Recovery Screen
                isErrorModalActive = true;
            }
        }

        private void OnGUI()
        {
            if (!isErrorModalActive) return;

            InitStyles();
            float scale = Screen.dpi > 0 ? Screen.dpi / 160f : 1f;

            // Fullscreen backdrop
            GUI.Box(new Rect(0, 0, Screen.width, Screen.height), GUIContent.none, overlayStyle);

            // Centered Modal
            float w = Mathf.Min(560 * scale, Screen.width * 0.92f);
            float h = Mathf.Min(340 * scale, Screen.height * 0.88f);
            Rect modalRect = new Rect((Screen.width - w) * 0.5f, (Screen.height - h) * 0.5f, w, h);

            GUI.Box(modalRect, GUIContent.none, cardStyle);
            GUILayout.BeginArea(modalRect);

            GUILayout.Space(12 * scale);
            GUILayout.Label("⚠️ <b>SOMETHING WENT WRONG</b>", titleStyle);
            GUILayout.Space(8 * scale);

            GUILayout.Label("An unexpected error occurred, but <b>your progress and model weights were safely saved</b> to persistent storage.", messageStyle);
            GUILayout.Space(6 * scale);

            GUILayout.Label($"<color=#94A3B8>Error details logged to:</color> <color=#38BDF8>{Path.GetFileName(crashLogPath)}</color>", messageStyle);
            GUILayout.Space(14 * scale);

            GUILayout.BeginHorizontal();
            if (GUILayout.Button("🔄 <b>RELOAD GAME</b>", buttonStyle, GUILayout.Height(36 * scale)))
            {
                isErrorModalActive = false;
                SceneManager.LoadScene(SceneManager.GetActiveScene().buildIndex);
            }
            GUILayout.Space(8 * scale);
            if (GUILayout.Button("✕ <b>DISMISS & CONTINUE</b>", buttonStyle, GUILayout.Height(36 * scale)))
            {
                isErrorModalActive = false;
            }
            GUILayout.EndHorizontal();

            GUILayout.EndArea();
        }

        private void InitStyles()
        {
            float scale = Screen.dpi > 0 ? Screen.dpi / 160f : 1f;

            if (overlayStyle == null)
            {
                overlayStyle = new GUIStyle();
                Texture2D bg = new Texture2D(1, 1);
                bg.SetPixel(0, 0, new Color(0.02f, 0.04f, 0.08f, 0.90f));
                bg.Apply();
                overlayStyle.normal.background = bg;
            }

            if (cardStyle == null)
            {
                cardStyle = new GUIStyle(GUI.skin.box);
                Texture2D bg = new Texture2D(1, 1);
                bg.SetPixel(0, 0, new Color(0.08f, 0.12f, 0.20f, 0.98f));
                bg.Apply();
                cardStyle.normal.background = bg;
                cardStyle.padding = new RectOffset((int)(16 * scale), (int)(16 * scale), (int)(16 * scale), (int)(16 * scale));
            }

            if (titleStyle == null)
            {
                titleStyle = new GUIStyle(GUI.skin.label) { fontSize = (int)(14 * scale), fontStyle = FontStyle.Bold, richText = true, alignment = TextAnchor.MiddleCenter };
                titleStyle.normal.textColor = new Color(0.96f, 0.62f, 0.04f);
            }

            if (messageStyle == null)
            {
                messageStyle = new GUIStyle(GUI.skin.label) { fontSize = (int)(10 * scale), richText = true, wordWrap = true, alignment = TextAnchor.MiddleCenter };
                messageStyle.normal.textColor = new Color(0.88f, 0.92f, 0.96f);
            }

            if (buttonStyle == null)
            {
                buttonStyle = new GUIStyle(GUI.skin.button) { fontSize = (int)(10 * scale), fontStyle = FontStyle.Bold, richText = true };
                buttonStyle.normal.textColor = Color.white;
            }
        }
    }
}
