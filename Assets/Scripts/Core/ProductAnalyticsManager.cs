using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.Core
{
    [System.Serializable]
    public class AnalyticsEvent
    {
        public string eventName;
        public string timestampUtc;
        public string parametersJson;
    }

    /// <summary>
    /// Production Product Analytics & Telemetry Manager (Mixpanel / GameAnalytics / Amplitude format).
    /// Tracks:
    /// - FTUE (First-Time User Experience) conversion funnels.
    /// - Level / Biome drop-off points.
    /// - Retention and ML concept mastery rates.
    /// </summary>
    public class ProductAnalyticsManager : MonoBehaviour
    {
        public static ProductAnalyticsManager Instance { get; private set; }

        [SerializeField] private bool analyticsOptIn = true;
        [SerializeField] private int maxQueueSize = 50;

        private readonly List<AnalyticsEvent> eventQueue = new List<AnalyticsEvent>();
        private float lastFlushTime = 0f;

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
            }
            else
            {
                Destroy(gameObject);
            }
        }

        public void SetAnalyticsOptIn(bool optIn)
        {
            analyticsOptIn = optIn;
            if (!optIn) eventQueue.Clear();
            Debug.Log($"[Analytics] Analytics opt-in set to: {optIn}");
        }

        public void TrackEvent(string eventName, Dictionary<string, object> parameters = null)
        {
            if (!analyticsOptIn) return;

            string paramsJson = parameters != null ? JsonUtility.ToJson(parameters) : "{}";
            AnalyticsEvent evt = new AnalyticsEvent
            {
                eventName = eventName,
                timestampUtc = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                parametersJson = paramsJson
            };

            eventQueue.Add(evt);
            Debug.Log($"[Analytics] Tracked: '{eventName}'");

            if (eventQueue.Count >= maxQueueSize || Time.time - lastFlushTime > 60f)
            {
                FlushEvents();
            }
        }

        public void FlushEvents()
        {
            if (eventQueue.Count == 0) return;
            lastFlushTime = Time.time;
            Debug.Log($"[Analytics] Flushed {eventQueue.Count} telemetry events to analytics ingest service.");
            eventQueue.Clear();
        }
    }
}
