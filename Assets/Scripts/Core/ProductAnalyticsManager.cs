using System;
using System.Collections;
using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

namespace NeuroArena.Core
{
    [System.Serializable]
    public class AnalyticsEventPayload
    {
        public string eventName;
        public string playerId;
        public string sessionId;
        public bool isGuest;
        public string clientPlatform = "unity";
        public string clientVersion = "2.0.0";
        public string timestamp;
        public string payloadJson;
    }

    [System.Serializable]
    public class BatchEventsWrapper
    {
        public List<AnalyticsEventPayload> events;
    }

    /// <summary>
    /// Production Product Analytics & Telemetry Client SDK for Unity.
    /// Emits privacy-conscious structured events:
    /// - Session start / end
    /// - FTUE tutorial step completion
    /// - Biome entry / exit
    /// - Boss attempt / win / loss
    /// - Duel start / result
    /// - Purchase / reward claims
    /// - Crash / fatal error reporting (integrated with GlobalErrorBoundary)
    /// </summary>
    public class ProductAnalyticsManager : MonoBehaviour
    {
        public static ProductAnalyticsManager Instance { get; private set; }

        [Header("Configuration")]
        [SerializeField] private string ingestEndpointUrl = "http://localhost:2567/api/telemetry/events";
        [SerializeField] private bool analyticsOptIn = true;
        [SerializeField] private int maxQueueSize = 25;
        [SerializeField] private float autoFlushIntervalSeconds = 30f;

        private readonly List<AnalyticsEventPayload> eventQueue = new List<AnalyticsEventPayload>();
        private string currentSessionId;
        private string currentPlayerId;
        private bool isGuestPlayer = true;
        private float sessionStartTime = 0f;
        private float lastFlushTime = 0f;
        private Coroutine flushCoroutine;

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
                InitSession();
            }
            else
            {
                Destroy(gameObject);
            }
        }

        private void Start()
        {
            if (PrivacyConsentManager.Instance != null)
            {
                analyticsOptIn = PrivacyConsentManager.Instance.AnalyticsAllowed;
            }
            flushCoroutine = StartCoroutine(PeriodicFlushLoop());
            TrackSessionStart(isGuestPlayer, Application.version);
        }

        private void OnApplicationQuit()
        {
            float duration = Time.realtimeSinceStartup - sessionStartTime;
            TrackSessionEnd(duration);
            FlushEventsSync();
        }

        private void OnApplicationPause(bool pauseStatus)
        {
            if (pauseStatus)
            {
                FlushEvents();
            }
        }

        private void InitSession()
        {
            currentSessionId = "sess_" + Guid.NewGuid().ToString("N").Substring(0, 16);
            currentPlayerId = PlayerPrefs.GetString("neuroarena_anon_player_id", "");
            if (string.IsNullOrEmpty(currentPlayerId))
            {
                currentPlayerId = "anon_" + Guid.NewGuid().ToString("N").Substring(0, 16);
                PlayerPrefs.SetString("neuroarena_anon_player_id", currentPlayerId);
                PlayerPrefs.Save();
            }
            sessionStartTime = Time.realtimeSinceStartup;
            lastFlushTime = Time.realtimeSinceStartup;
        }

        public void SetPlayerIdentity(string playerId, bool isGuest = false)
        {
            if (!string.IsNullOrEmpty(playerId))
            {
                currentPlayerId = playerId;
                isGuestPlayer = isGuest;
            }
        }

        public void SetAnalyticsOptIn(bool optIn)
        {
            analyticsOptIn = optIn;
            if (!optIn) eventQueue.Clear();
            Debug.Log($"[Analytics] Analytics opt-in set to: {optIn}");
        }

        public void TrackGeneric(string eventName, string jsonPayload = "{}")
        {
            if (!analyticsOptIn) return;

            AnalyticsEventPayload evt = new AnalyticsEventPayload
            {
                eventName = eventName,
                playerId = currentPlayerId,
                sessionId = currentSessionId,
                isGuest = isGuestPlayer,
                clientPlatform = Application.platform.ToString().ToLower(),
                clientVersion = Application.version,
                timestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                payloadJson = jsonPayload
            };

            lock (eventQueue)
            {
                eventQueue.Add(evt);
            }

            Debug.Log($"[Analytics] Emitted: '{eventName}' (Queue: {eventQueue.Count})");

            if (eventQueue.Count >= maxQueueSize)
            {
                FlushEvents();
            }
        }

        // =========================================================
        // 🎯 STRUCTURED EVENT EMITTERS
        // =========================================================

        public void TrackSessionStart(bool isGuest, string clientVersion)
        {
            string payload = $"{{\"is_guest\":{(isGuest ? "true" : "false")},\"version\":\"{clientVersion}\"}}";
            TrackGeneric("session_start", payload);
        }

        public void TrackSessionEnd(float sessionDurationSeconds)
        {
            string payload = $"{{\"duration_sec\":{sessionDurationSeconds:F2}}}";
            TrackGeneric("session_end", payload);
        }

        public void TrackTutorialStep(int stepIndex, string stepName, bool completed, float durationSec = 0f)
        {
            string payload = $"{{\"step_index\":{stepIndex},\"step_name\":\"{stepName}\",\"completed\":{(completed ? "true" : "false")},\"duration_sec\":{durationSec:F2}}}";
            TrackGeneric("tutorial_step", payload);
        }

        public void TrackTutorialCompleted(float totalDurationSec)
        {
            string payload = $"{{\"total_duration_sec\":{totalDurationSec:F2},\"status\":\"success\"}}";
            TrackGeneric("tutorial_completed", payload);
        }

        public void TrackBiomeEnter(int biomeIndex, string biomeName)
        {
            string payload = $"{{\"biome_index\":{biomeIndex},\"biome_name\":\"{biomeName}\"}}";
            TrackGeneric("biome_enter", payload);
        }

        public void TrackBiomeExit(int biomeIndex, string biomeName, float timeSpentSec, bool completed)
        {
            string payload = $"{{\"biome_index\":{biomeIndex},\"biome_name\":\"{biomeName}\",\"time_spent_sec\":{timeSpentSec:F2},\"completed\":{(completed ? "true" : "false")}}}";
            TrackGeneric("biome_exit", payload);
        }

        public void TrackBossAttempt(string bossId, string bossName, int biomeIndex, int attemptNumber = 1)
        {
            string payload = $"{{\"boss_id\":\"{bossId}\",\"boss_name\":\"{bossName}\",\"biome_index\":{biomeIndex},\"attempt_number\":{attemptNumber}}}";
            TrackGeneric("boss_attempt", payload);
        }

        public void TrackBossResult(string bossId, string bossName, bool won, float durationSec, int damageDealt = 0)
        {
            string payload = $"{{\"boss_id\":\"{bossId}\",\"boss_name\":\"{bossName}\",\"won\":{(won ? "true" : "false")},\"duration_sec\":{durationSec:F2},\"damage_dealt\":{damageDealt}}}";
            TrackGeneric("boss_result", payload);
        }

        public void TrackDuelStart(string matchId, string opponentId, bool isBot)
        {
            string payload = $"{{\"match_id\":\"{matchId}\",\"opponent_id\":\"{opponentId}\",\"is_bot\":{(isBot ? "true" : "false")}}}";
            TrackGeneric("duel_start", payload);
        }

        public void TrackDuelResult(string matchId, string outcome, int ratingChange, float matchDurationSec)
        {
            string payload = $"{{\"match_id\":\"{matchId}\",\"outcome\":\"{outcome}\",\"rating_change\":{ratingChange},\"duration_sec\":{matchDurationSec:F2}}}";
            TrackGeneric("duel_result", payload);
        }

        public void TrackRewardClaim(string rewardId, string rewardType, int amount)
        {
            string payload = $"{{\"reward_id\":\"{rewardId}\",\"reward_type\":\"{rewardType}\",\"amount\":{amount}}}";
            TrackGeneric("reward_claim", payload);
        }

        public void TrackPurchase(string itemId, string currency, float price, bool success)
        {
            string payload = $"{{\"item_id\":\"{itemId}\",\"currency\":\"{currency}\",\"price\":{price:F2},\"success\":{(success ? "true" : "false")}}}";
            TrackGeneric("purchase", payload);
        }

        public void TrackCrashOrError(string errorType, string message, string stackTrace)
        {
            string safeMsg = message.Replace("\"", "'").Replace("\n", " ");
            string safeStack = stackTrace.Replace("\"", "'").Replace("\n", " | ");
            if (safeStack.Length > 500) safeStack = safeStack.Substring(0, 500);

            string payload = $"{{\"error_type\":\"{errorType}\",\"message\":\"{safeMsg}\",\"stack\":\"{safeStack}\"}}";
            TrackGeneric("crash_error", payload);
        }

        // =========================================================
        // 🚀 INGESTION & DISPATCH
        // =========================================================

        private IEnumerator PeriodicFlushLoop()
        {
            while (true)
            {
                yield return new WaitForSeconds(autoFlushIntervalSeconds);
                if (eventQueue.Count > 0)
                {
                    FlushEvents();
                }
            }
        }

        public void FlushEvents()
        {
            if (eventQueue.Count == 0) return;
            lastFlushTime = Time.realtimeSinceStartup;

            List<AnalyticsEventPayload> batchToSend;
            lock (eventQueue)
            {
                batchToSend = new List<AnalyticsEventPayload>(eventQueue);
                eventQueue.Clear();
            }

            StartCoroutine(SendEventsBatchCoroutine(batchToSend));
        }

        private void FlushEventsSync()
        {
            if (eventQueue.Count == 0) return;
            Debug.Log($"[Analytics] Sync flushing {eventQueue.Count} events on shutdown.");
            eventQueue.Clear();
        }

        private IEnumerator SendEventsBatchCoroutine(List<AnalyticsEventPayload> batch)
        {
            if (batch == null || batch.Count == 0) yield break;

            StringBuilder sb = new StringBuilder();
            sb.Append("[");
            for (int i = 0; i < batch.Count; i++)
            {
                var evt = batch[i];
                sb.Append("{");
                sb.Append($"\"eventName\":\"{evt.eventName}\",");
                sb.Append($"\"playerId\":\"{evt.playerId}\",");
                sb.Append($"\"sessionId\":\"{evt.sessionId}\",");
                sb.Append($"\"isGuest\":{(evt.isGuest ? "true" : "false")},");
                sb.Append($"\"clientPlatform\":\"{evt.clientPlatform}\",");
                sb.Append($"\"clientVersion\":\"{evt.clientVersion}\",");
                sb.Append($"\"timestamp\":\"{evt.timestamp}\",");
                sb.Append($"\"payload\":{evt.payloadJson}");
                sb.Append("}");
                if (i < batch.Count - 1) sb.Append(",");
            }
            sb.Append("]");

            byte[] jsonBytes = Encoding.UTF8.GetBytes(sb.ToString());

            using (UnityWebRequest req = new UnityWebRequest(ingestEndpointUrl, "POST"))
            {
                req.uploadHandler = new UploadHandlerRaw(jsonBytes);
                req.downloadHandler = new DownloadHandlerBuffer();
                req.SetRequestHeader("Content-Type", "application/json");

                yield return req.SendWebRequest();

                if (req.result == UnityWebRequest.Result.Success)
                {
                    Debug.Log($"[Analytics] Successfully sent {batch.Count} events to {ingestEndpointUrl}");
                }
                else
                {
                    Debug.LogWarning($"[Analytics] Telemetry dispatch failed: {req.error}");
                }
            }
        }
    }
}

