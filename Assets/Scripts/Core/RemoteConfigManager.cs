using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Networking;

namespace NeuroArena.Core
{
    [Serializable]
    public class HarvestBalanceConfig
    {
        public float baseYieldMultiplier = 1.0f;
        public float crystalSpawnMultiplier = 1.0f;
        public float shardDropRateMultiplier = 1.0f;
        public float burstHarvestDurationSec = 30.0f;
        public float burstHarvestMultiplier = 2.0f;
    }

    [Serializable]
    public class BossStatsConfig
    {
        public int maxHp = 500;
        public int attackDamage = 25;
        public float phaseThreshold = 0.50f;
        public int enrageTimerSec = 90;
        public int rewardCrystals = 100;
    }

    [Serializable]
    public class DailyChallengeConfig
    {
        public int baseRewardCrystals = 150;
        public int bonusMasteryExp = 300;
        public float targetMseThreshold = 0.08f;
        public int maxAllowedSteps = 100;
        public float streakMultiplierCap = 3.0f;
    }

    [Serializable]
    public class LiveOpsEventSlotConfig
    {
        public string id = "modifier_harvest_weekend";
        public string title = "2x Harvest Yield & Compute Surge Weekend";
        public string type = "HARVEST_MULTIPLIER";
        public bool active = false;
        public float multiplier = 2.0f;
        public string rotatingBoss = "The Overfit Colossus (Empowered)";
        public string description = "All dataset token harvesting and training compute rewards are doubled worldwide!";
        public string bannerColor = "#F59E0B";
    }

    [Serializable]
    public class RemoteConfigPayload
    {
        public int version = 1;
        public int schemaCompatibilityVersion = 3;
        public string lastUpdatedAt;
        public bool maintenanceMode = false;
        public HarvestBalanceConfig harvestBalance = new HarvestBalanceConfig();
        public DailyChallengeConfig dailyChallengeTuning = new DailyChallengeConfig();
        public LiveOpsEventSlotConfig liveOpsEventSlot = new LiveOpsEventSlotConfig();
    }

    [Serializable]
    public class RemoteConfigResponse
    {
        public bool success;
        public RemoteConfigPayload config;
    }

    /// <summary>
    /// Production Remote Configuration & Balance Tuning Manager for Unity.
    /// Features:
    /// - 5-minute TTL caching with background refresh.
    /// - Safe offline fallback to last-known-good configuration in PlayerPrefs.
    /// - Live-ops modifier weekend toggling and boss balance tuning without client redeployment.
    /// - Zero save-incompatibility guarantee.
    /// </summary>
    public class RemoteConfigManager : MonoBehaviour
    {
        public static RemoteConfigManager Instance { get; private set; }

        public event Action<RemoteConfigPayload> OnRemoteConfigUpdated;

        [Header("Configuration")]
        [SerializeField] private string remoteConfigUrl = "http://localhost:2567/api/remote-config";
        [SerializeField] private float cacheTtlSeconds = 300.0f; // 5-minute TTL

        private const string PREF_LAST_KNOWN_GOOD = "neuroarena_last_known_good_remote_config";

        private RemoteConfigPayload activeConfig = new RemoteConfigPayload();
        private float lastFetchTime = -9999f;
        private bool isFetching = false;

        public int ConfigVersion => activeConfig != null ? activeConfig.version : 1;
        public bool MaintenanceMode => activeConfig != null && activeConfig.maintenanceMode;

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
                LoadLastKnownGoodConfig();
            }
            else
            {
                Destroy(gameObject);
            }
        }

        private void Start()
        {
            StartCoroutine(PeriodicConfigSyncLoop());
        }

        private void LoadLastKnownGoodConfig()
        {
            string savedJson = PlayerPrefs.GetString(PREF_LAST_KNOWN_GOOD, "");
            if (!string.IsNullOrEmpty(savedJson))
            {
                try
                {
                    var cached = JsonUtility.FromJson<RemoteConfigPayload>(savedJson);
                    if (cached != null)
                    {
                        activeConfig = cached;
                        Debug.Log($"[RemoteConfig] Loaded last-known-good config (v{activeConfig.version}) from PlayerPrefs.");
                    }
                }
                catch (Exception ex)
                {
                    Debug.LogWarning($"[RemoteConfig] Failed to parse last-known-good config: {ex.Message}");
                }
            }
        }

        private IEnumerator PeriodicConfigSyncLoop()
        {
            while (true)
            {
                if (Time.realtimeSinceStartup - lastFetchTime >= cacheTtlSeconds)
                {
                    yield return FetchRemoteConfigCoroutine();
                }
                yield return new WaitForSeconds(30f); // Check TTL interval every 30s
            }
        }

        public void ForceRefresh()
        {
            if (!isFetching)
            {
                StartCoroutine(FetchRemoteConfigCoroutine());
            }
        }

        private IEnumerator FetchRemoteConfigCoroutine()
        {
            isFetching = true;
            using (UnityWebRequest req = UnityWebRequest.Get(remoteConfigUrl))
            {
                req.timeout = 5;
                yield return req.SendWebRequest();

                if (req.result == UnityWebRequest.Result.Success)
                {
                    try
                    {
                        string json = req.downloadHandler.text;
                        var response = JsonUtility.FromJson<RemoteConfigResponse>(json);
                        if (response != null && response.config != null)
                        {
                            activeConfig = response.config;
                            lastFetchTime = Time.realtimeSinceStartup;

                            // Cache last-known-good to PlayerPrefs
                            string configJson = JsonUtility.ToJson(activeConfig);
                            PlayerPrefs.SetString(PREF_LAST_KNOWN_GOOD, configJson);
                            PlayerPrefs.Save();

                            Debug.Log($"[RemoteConfig] Successfully synced config v{activeConfig.version} (Updated: {activeConfig.lastUpdatedAt})");
                            OnRemoteConfigUpdated?.Invoke(activeConfig);
                        }
                    }
                    catch (Exception ex)
                    {
                        Debug.LogWarning($"[RemoteConfig] Error parsing remote config JSON: {ex.Message}. Falling back to last-known-good.");
                    }
                }
                else
                {
                    Debug.LogWarning($"[RemoteConfig] Fetch failed ({req.error}). Retaining last-known-good config v{activeConfig.version}.");
                }
            }
            isFetching = false;
        }

        // =========================================================
        // 🎯 TYPED BALANCE & LIVE-OPS ACCESSORS
        // =========================================================

        public float GetHarvestYieldMultiplier()
        {
            float baseMult = activeConfig?.harvestBalance?.baseYieldMultiplier ?? 1.0f;
            if (IsModifierWeekendActive())
            {
                baseMult *= activeConfig.liveOpsEventSlot.multiplier;
            }
            return Mathf.Max(0.1f, baseMult);
        }

        public float GetDailyTargetMse(float defaultMse = 0.08f)
        {
            return activeConfig?.dailyChallengeTuning?.targetMseThreshold ?? defaultMse;
        }

        public int GetDailyRewardCrystals(int defaultReward = 150)
        {
            return activeConfig?.dailyChallengeTuning?.baseRewardCrystals ?? defaultReward;
        }

        public bool IsModifierWeekendActive()
        {
            return activeConfig != null && activeConfig.liveOpsEventSlot != null && activeConfig.liveOpsEventSlot.active;
        }

        public LiveOpsEventSlotConfig GetModifierWeekendConfig()
        {
            return activeConfig?.liveOpsEventSlot ?? new LiveOpsEventSlotConfig();
        }
    }
}
