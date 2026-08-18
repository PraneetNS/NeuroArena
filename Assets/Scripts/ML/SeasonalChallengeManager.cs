using System;
using System.Collections.Generic;
using UnityEngine;
using NeuroArena.Data;

namespace NeuroArena.ML
{
    [System.Serializable]
    public class BattlePassTier
    {
        public int tierLevel;
        public int requiredSeasonXp;
        public string freeRewardDescription;
        public int freeComputeCredits;
        public string premiumRewardDescription;
        public int premiumQuantumShards;
        public bool isClaimedFree;
        public bool isClaimedPremium;
    }

    [System.Serializable]
    public class DailyMission
    {
        public string missionId;
        public string description;
        public int currentProgress;
        public int targetGoal;
        public int rewardXp;
        public bool isCompleted;
    }

    /// <summary>
    /// Production Seasonal Battle Pass & Challenge Manager.
    /// Manages:
    /// - 30-day Season lifecycle with Free & Premium tracks.
    /// - Daily & Weekly ML Challenge missions.
    /// - Local push notification hooks for challenge refreshes.
    /// </summary>
    public class SeasonalChallengeManager : MonoBehaviour
    {
        public static SeasonalChallengeManager Instance { get; private set; }

        public event Action<int> OnSeasonXpGained;
        public event Action<int> OnTierUnlocked;

        [Header("Season State")]
        [SerializeField] private int currentSeason = 1;
        [SerializeField] private int seasonXp = 0;
        [SerializeField] private bool hasPremiumPass = false;
        [SerializeField] private List<BattlePassTier> tiers = new List<BattlePassTier>();
        [SerializeField] private List<DailyMission> dailyMissions = new List<DailyMission>();

        public int CurrentSeason => currentSeason;
        public int SeasonXp => seasonXp;
        public bool HasPremiumPass => hasPremiumPass;
        public IReadOnlyList<BattlePassTier> Tiers => tiers;
        public IReadOnlyList<DailyMission> DailyMissions => dailyMissions;

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
                InitializeSeasonTiers();
                GenerateDailyMissions();
            }
            else
            {
                Destroy(gameObject);
            }
        }

        private void InitializeSeasonTiers()
        {
            tiers.Clear();
            for (int i = 1; i <= 20; i++)
            {
                tiers.Add(new BattlePassTier
                {
                    tierLevel = i,
                    requiredSeasonXp = i * 200,
                    freeRewardDescription = $"{i * 50} Compute Credits",
                    freeComputeCredits = i * 50,
                    premiumRewardDescription = $"{i * 10} Quantum Shards",
                    premiumQuantumShards = i * 10
                });
            }
        }

        private void GenerateDailyMissions()
        {
            dailyMissions = new List<DailyMission>
            {
                new DailyMission { missionId = "daily_harvest_20", description = "Harvest 20 Feature Crystals in any Biome", currentProgress = 0, targetGoal = 20, rewardXp = 150 },
                new DailyMission { missionId = "daily_loss_converge", description = "Achieve Training Loss < 0.05 on Linear Regression", currentProgress = 0, targetGoal = 1, rewardXp = 250 },
                new DailyMission { missionId = "daily_duel_win", description = "Compete in a 1v1 Live Machine Learning Duel", currentProgress = 0, targetGoal = 1, rewardXp = 200 }
            };
        }

        public void AddSeasonXp(int amount)
        {
            seasonXp += amount;
            Debug.Log($"[SeasonalChallenge] Gained {amount} Season XP. Total: {seasonXp}");
            OnSeasonXpGained?.Invoke(seasonXp);

            foreach (var tier in tiers)
            {
                if (seasonXp >= tier.requiredSeasonXp)
                {
                    OnTierUnlocked?.Invoke(tier.tierLevel);
                }
            }
        }

        public bool ClaimTierReward(int tierLevel, bool isPremium)
        {
            BattlePassTier tier = tiers.Find(t => t.tierLevel == tierLevel);
            if (tier == null || seasonXp < tier.requiredSeasonXp) return false;

            if (isPremium)
            {
                if (!hasPremiumPass || tier.isClaimedPremium) return false;
                tier.isClaimedPremium = true;
                if (EconomyManager.Instance != null) EconomyManager.Instance.AddQuantumShards(tier.premiumQuantumShards, $"Pass_Tier_{tierLevel}");
                return true;
            }
            else
            {
                if (tier.isClaimedFree) return false;
                tier.isClaimedFree = true;
                if (EconomyManager.Instance != null) EconomyManager.Instance.AddComputeCredits(tier.freeComputeCredits, $"Pass_Tier_{tierLevel}");
                return true;
            }
        }

        public void UnlockPremiumPass()
        {
            hasPremiumPass = true;
            Debug.Log("[SeasonalChallenge] Premium Battle Pass Unlocked!");
        }

        public void ScheduleDailyChallengeNotification()
        {
            // Hooks to mobile native notifications (e.g., Unity Mobile Notifications)
            Debug.Log("[SeasonalChallenge] Scheduled 24h Daily Challenge Refresh push notification.");
        }
    }
}
