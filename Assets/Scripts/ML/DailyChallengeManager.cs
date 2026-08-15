using System;
using UnityEngine;
using NeuroArena.Data;

namespace NeuroArena.ML
{
    /// <summary>
    /// Daily Seeded Challenge System.
    /// Computes a deterministic date seed (e.g. DAILY-20260815) identical for all players globally,
    /// generating a synchronized held-out dataset for competitive daily testing.
    /// </summary>
    public class DailyChallengeManager : MonoBehaviour
    {
        public static DailyChallengeManager Instance { get; private set; }

        public string CurrentDailySeed => $"DAILY-{DateTime.UtcNow:yyyyMMdd}";

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
        }

        public void StartDailyChallenge()
        {
            string dailySeed = CurrentDailySeed;
            Debug.Log($"[DailyChallenge] Starting competitive daily run with global seed: #{dailySeed}");
            ProceduralDataGenerator.Instance?.GenerateProceduralDataset(dailySeed);
        }
    }
}
