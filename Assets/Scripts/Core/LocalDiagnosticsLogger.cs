using System;
using System.IO;
using System.Text;
using UnityEngine;

namespace NeuroArena.Core
{
    /// <summary>
    /// Opt-In Local Diagnostics Logger: Records local session metrics, active biome/screen transitions,
    /// frame-time spikes (>50ms), and exceptions to a local file for manual player export.
    /// STRICTLY 100% OFFLINE: Zero network calls, zero automatic uploads.
    /// </summary>
    public class LocalDiagnosticsLogger : MonoBehaviour
    {
        public static LocalDiagnosticsLogger Instance { get; private set; }

        private const string PREFS_OPT_IN_KEY = "neuroarena_diagnostics_opt_in";
        private const float SPIKE_THRESHOLD_SEC = 0.050f; // 50ms (dropped frame threshold)

        private bool isEnabled = false;
        private string logFilePath;
        private DateTime sessionStartTime;
        private string currentScreen = "WorldView";
        private int currentBiome = 0;
        private int recordedSpikesCount = 0;
        private int recordedExceptionsCount = 0;

        public bool IsEnabled => isEnabled;
        public int SpikesCount => recordedSpikesCount;
        public int ExceptionsCount => recordedExceptionsCount;
        public string LogFilePath => logFilePath;

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
                logFilePath = Path.Combine(Application.persistentDataPath, "neuroarena_diagnostics.log");
                isEnabled = PlayerPrefs.GetInt(PREFS_OPT_IN_KEY, 0) == 1;
                sessionStartTime = DateTime.UtcNow;

                Application.logMessageReceived += HandleUnityLog;

                if (isEnabled)
                {
                    AppendLogEntry($"[SESSION_START] App Version: {Application.version} | Unity: {Application.unityVersion} | Platform: {Application.platform} | Time: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC");
                }
            }
            else
            {
                Destroy(gameObject);
            }
        }

        private void OnDestroy()
        {
            Application.logMessageReceived -= HandleUnityLog;
        }

        private void Update()
        {
            if (!isEnabled) return;

            float dt = Time.unscaledDeltaTime;
            if (dt >= SPIKE_THRESHOLD_SEC)
            {
                recordedSpikesCount++;
                float spikeMs = dt * 1000f;
                TimeSpan elapsed = DateTime.UtcNow - sessionStartTime;
                AppendLogEntry($"[PERF_SPIKE] Frame Duration: {spikeMs:F1}ms (FPS ~{(1f / dt):F1}) | Screen: {currentScreen} | Biome: #{currentBiome} | Session Elapsed: {elapsed:hh\\:mm\\:ss}");
            }
        }

        public void SetConsent(bool optIn)
        {
            isEnabled = optIn;
            PlayerPrefs.SetInt(PREFS_OPT_IN_KEY, optIn ? 1 : 0);
            PlayerPrefs.Save();

            if (isEnabled)
            {
                AppendLogEntry($"[CONSENT_GRANTED] User opted in to local diagnostics logging at {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC. Zero network transmission guaranteed.");
            }
            else
            {
                AppendLogEntry($"[CONSENT_REVOKED] User opted out of diagnostics at {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC.");
            }
        }

        public void LogScreenTransition(string screenName, int biomeIndex)
        {
            currentScreen = screenName;
            currentBiome = biomeIndex;

            if (!isEnabled) return;
            TimeSpan elapsed = DateTime.UtcNow - sessionStartTime;
            AppendLogEntry($"[SCREEN_TRANSITION] Navigated to '{screenName}' (Biome #{biomeIndex}) | Elapsed: {elapsed:hh\\:mm\\:ss}");
        }

        public void LogException(string condition, string stackTrace, LogType type)
        {
            if (!isEnabled) return;
            recordedExceptionsCount++;
            TimeSpan elapsed = DateTime.UtcNow - sessionStartTime;
            AppendLogEntry($"[EXCEPTION_{type.ToString().ToUpper()}] {condition} | Screen: {currentScreen} | Biome: #{currentBiome} | Elapsed: {elapsed:hh\\:mm\\:ss}\nStack:\n{stackTrace}");
        }

        private void HandleUnityLog(string condition, string stackTrace, LogType type)
        {
            if (type == LogType.Exception || type == LogType.Error)
            {
                LogException(condition, stackTrace, type);
            }
        }

        public void AppendLogEntry(string message)
        {
            try
            {
                string timestamp = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss.fff");
                string line = $"[{timestamp}] {message}\n";
                File.AppendAllText(logFilePath, line, Encoding.UTF8);
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[LocalDiagnosticsLogger] Failed to write log: {e.Message}");
            }
        }

        public string ReadFullLog()
        {
            try
            {
                if (File.Exists(logFilePath))
                {
                    return File.ReadAllText(logFilePath, Encoding.UTF8);
                }
            }
            catch (Exception e)
            {
                return $"Error reading log file: {e.Message}";
            }
            return "[No diagnostics logged yet. Enable Diagnostics in Settings to begin recording.]";
        }

        public void ClearLog()
        {
            try
            {
                if (File.Exists(logFilePath))
                {
                    File.Delete(logFilePath);
                }
                recordedSpikesCount = 0;
                recordedExceptionsCount = 0;
                AppendLogEntry($"[LOG_CLEARED] Diagnostics log erased by user at {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC.");
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[LocalDiagnosticsLogger] Failed to clear log: {e.Message}");
            }
        }
    }
}
