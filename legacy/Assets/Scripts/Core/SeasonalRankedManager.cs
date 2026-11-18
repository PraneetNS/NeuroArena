using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Networking;

namespace NeuroArena.Core
{
    [Serializable]
    public class RankedProfileData
    {
        public string accountId;
        public string playerName;
        public string characterBuild;
        public string seasonId;
        public int rating = 1500;
        public float rd = 350f;
        public string tier = "BRONZE";
        public string highestTierAchieved = "BRONZE";
        public int wins;
        public int losses;
        public int draws;
        public int totalMatches;
        public int quantumShards;
        public string activeTitle;
        public List<string> unlockedTitles = new List<string>();
        public List<string> unlockedCosmetics = new List<string>();
    }

    [Serializable]
    public class SeasonStatusData
    {
        public string seasonId;
        public int seasonNumber;
        public string seasonName;
        public int durationWeeks;
        public int daysRemaining;
        public int totalRankedPlayers;
    }

    [Serializable]
    public class RankedProfileResponse
    {
        public bool success;
        public RankedProfileData profile;
        public SeasonStatusData season;
    }

    /// <summary>
    /// Cross-Platform Seasonal Ranked Manager for Unity (Android / Standalone).
    /// Interacts directly with the authoritative server to guarantee 100% cross-progression parity with Web PWA.
    /// </summary>
    public class SeasonalRankedManager : MonoBehaviour
    {
        public static SeasonalRankedManager Instance { get; private set; }

        public event Action<RankedProfileData, SeasonStatusData> OnProfileUpdated;
        public event Action<string, string> OnRankUpEvent;

        [Header("Configuration")]
        [SerializeField] private string serverBaseUrl = "http://localhost:2567/api/ranked";

        private RankedProfileData currentProfile;
        private SeasonStatusData currentSeason;

        public RankedProfileData CurrentProfile => currentProfile;
        public SeasonStatusData CurrentSeason => currentSeason;
        public string ActiveTier => currentProfile?.tier ?? "BRONZE";
        public int CurrentRating => currentProfile?.rating ?? 1500;

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

        public void FetchPlayerRankedState(string accountId, string playerName = "Duelist", string characterBuild = "scholar")
        {
            StartCoroutine(FetchProfileCoroutine(accountId, playerName, characterBuild));
        }

        private IEnumerator FetchProfileCoroutine(string accountId, string playerName, string characterBuild)
        {
            string url = $"{serverBaseUrl}/profile?accountId={UnityWebRequest.EscapeURL(accountId)}&name={UnityWebRequest.EscapeURL(playerName)}&build={UnityWebRequest.EscapeURL(characterBuild)}";
            using (UnityWebRequest req = UnityWebRequest.Get(url))
            {
                req.timeout = 8;
                yield return req.SendWebRequest();

                if (req.result == UnityWebRequest.Result.Success)
                {
                    try
                    {
                        var res = JsonUtility.FromJson<RankedProfileResponse>(req.downloadHandler.text);
                        if (res != null && res.success && res.profile != null)
                        {
                            string oldTier = currentProfile?.tier;
                            currentProfile = res.profile;
                            currentSeason = res.season;

                            Debug.Log($"[SeasonalRanked] Synced account {currentProfile.accountId} - Rating: {currentProfile.rating} ({currentProfile.tier})");
                            OnProfileUpdated?.Invoke(currentProfile, currentSeason);

                            // Detect Rank Up
                            if (!string.IsNullOrEmpty(oldTier) && IsHigherTier(currentProfile.tier, oldTier))
                            {
                                TriggerRankUpJuice(oldTier, currentProfile.tier);
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        Debug.LogWarning($"[SeasonalRanked] Failed to parse profile response: {ex.Message}");
                    }
                }
                else
                {
                    Debug.LogWarning($"[SeasonalRanked] Network fetch failed: {req.error}");
                }
            }
        }

        private bool IsHigherTier(string newTier, string oldTier)
        {
            int GetTierIndex(string t) => t switch
            {
                "ARCHITECT" => 4,
                "PLATINUM" => 3,
                "GOLD" => 2,
                "SILVER" => 1,
                _ => 0
            };
            return GetTierIndex(newTier) > GetTierIndex(oldTier);
        }

        public void TriggerRankUpJuice(string oldTier, string newTier)
        {
            Debug.Log($"🌟 [RANK UP JUICE] Promoted from {oldTier} to {newTier}!");
            OnRankUpEvent?.Invoke(oldTier, newTier);

            // Hook into existing JuiceFeedbackManager for maximum presentation impact
            if (JuiceFeedbackManager.Instance != null)
            {
                JuiceFeedbackManager.Instance.TriggerHaptic(HapticPulseType.SuccessBurst);
                JuiceFeedbackManager.Instance.OnModelConvergence(Vector3.zero);
            }
        }
    }
}
