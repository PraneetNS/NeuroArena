using System;
using UnityEngine;

namespace NeuroArena.Data
{
    [Serializable]
    public class BiomeBestRecord
    {
        public string biomeName;
        public float bestMSE = 999.0f;
        public float bestAccuracy = 0.0f;
        public bool isCompleted = false;
    }

    /// <summary>
    /// Persistent Player Profile Data Model.
    /// Serializes player identity, avatar, playtime, per-biome records, Grand Prix win-rates, and daily challenge streaks.
    /// </summary>
    [Serializable]
    public class PlayerProfileData
    {
        public int slotIndex = 0;
        public string playerName = "Architect";
        public string avatarId = "avatar_ada"; // avatar_ada, avatar_brain, avatar_knight, avatar_star, avatar_sage
        public string creationDate = "";
        public float totalPlaytimeSeconds = 0f;

        public int biomesCompletedCount = 0;
        public BiomeBestRecord[] biomeRecords = new BiomeBestRecord[6];

        public int grandPrixRaces = 0;
        public int grandPrixWins = 0;

        public int dailyChallengeStreak = 0;
        public int bestDailyStreak = 0;
        public string lastDailyChallengeDate = "";

        public float GrandPrixWinRate => (grandPrixRaces > 0) ? ((float)grandPrixWins / grandPrixRaces) * 100f : 0f;

        public string FormattedPlaytime
        {
            get
            {
                int hours = (int)(totalPlaytimeSeconds / 3600);
                int minutes = (int)((totalPlaytimeSeconds % 3600) / 60);
                int secs = (int)(totalPlaytimeSeconds % 60);
                return (hours > 0) ? $"{hours}h {minutes}m" : $"{minutes}m {secs}s";
            }
        }

        public PlayerProfileData(int slot = 0)
        {
            slotIndex = slot;
            playerName = $"Architect-{slot + 1}";
            avatarId = "avatar_ada";
            creationDate = DateTime.UtcNow.ToString("yyyy-MM-dd");
            totalPlaytimeSeconds = 0f;
            grandPrixRaces = 0;
            grandPrixWins = 0;
            dailyChallengeStreak = 0;
            bestDailyStreak = 0;

            string[] names = {
                "1. Linear Steppes",
                "2. Binary Marshlands",
                "3. Variance Tundra",
                "4. Branching Canopy",
                "5. Deep Synapse Citadel",
                "6. Semantic Expanse"
            };

            biomeRecords = new BiomeBestRecord[6];
            for (int i = 0; i < 6; i++)
            {
                biomeRecords[i] = new BiomeBestRecord
                {
                    biomeName = names[i],
                    bestMSE = (i == 0 || i == 2) ? 999.0f : 0f,
                    bestAccuracy = 0f,
                    isCompleted = false
                };
            }
        }
    }
}
