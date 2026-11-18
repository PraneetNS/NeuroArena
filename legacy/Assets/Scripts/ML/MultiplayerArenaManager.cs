using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.ML
{
    [Serializable]
    public struct LeaderboardEntry
    {
        public string playerName;
        public string modelArchitecture;
        public float testAccuracy;
        public string seedCode;
        public string timestamp;
    }

    [Serializable]
    public struct DuelMatchResult
    {
        public string playerModelName;
        public string ghostRivalName;
        public float playerTestAccuracy;
        public float ghostTestAccuracy;
        public int totalTestSamples;
        public int playerPoints;
        public int ghostPoints;
        public bool isPlayerVictory;
        public string victoryNarrative;
    }

    /// <summary>
    /// Async Head-to-Head Multiplayer and Ghost Duel Arena.
    /// Evaluates models head-to-head on an unseen held-out test set neither model saw during training.
    /// </summary>
    public static class MultiplayerArenaManager
    {
        private static List<LeaderboardEntry> localLeaderboard = new List<LeaderboardEntry>
        {
            new LeaderboardEntry { playerName = "Grandmaster Ada", modelArchitecture = "2-Layer MLP (H=8, Adam)", testAccuracy = 94.2f, seedCode = "NEURO-8842", timestamp = "2026-08-14" },
            new LeaderboardEntry { playerName = "Party of Five", modelArchitecture = "5-Tree Bagging Ensemble", testAccuracy = 91.5f, seedCode = "NEURO-8842", timestamp = "2026-08-14" },
            new LeaderboardEntry { playerName = "Overfitter-X", modelArchitecture = "Unpruned Tree (Depth=8)", testAccuracy = 68.0f, seedCode = "NEURO-8842", timestamp = "2026-08-13" }
        };

        public static List<LeaderboardEntry> GetLeaderboard() => localLeaderboard;

        /// <summary>
        /// Generates a strictly held-out, unseen test dataset D_test from seed.
        /// </summary>
        public static (float[][], int[]) GenerateHeldOutTestSet(string seedStr, int sampleCount = 30)
        {
            System.Random rng = new System.Random((seedStr + "_HELD_OUT_TEST").GetHashCode());
            float[][] X = new float[sampleCount][];
            int[] Y = new int[sampleCount];

            for (int i = 0; i < sampleCount; i++)
            {
                int corner = i % 4;
                float bx = (corner == 0 || corner == 3) ? -2.4f : 2.4f;
                float by = (corner == 0 || corner == 1) ? -2.4f : 2.4f;
                int target = (corner == 0 || corner == 2) ? 0 : 1;

                float x1 = bx + (float)(rng.NextDouble() - 0.5) * 2.0f;
                float x2 = by + (float)(rng.NextDouble() - 0.5) * 2.0f;

                X[i] = new float[] { x1, x2 };
                Y[i] = target;
            }

            return (X, Y);
        }

        /// <summary>
        /// Executes a head-to-head match evaluating Player model vs Ghost model on unseen test data.
        /// </summary>
        public static DuelMatchResult FightDuel(
            Func<float[], int> playerPredict,
            string playerModelName,
            string ghostRivalName,
            float[][] X_test,
            int[] Y_test,
            string seedCode)
        {
            int n = X_test.Length;
            int playerCorrect = 0;
            int ghostCorrect = 0;

            System.Random rng = new System.Random(ghostRivalName.GetHashCode());

            for (int i = 0; i < n; i++)
            {
                int pPred = playerPredict != null ? playerPredict(X_test[i]) : 0;
                if (pPred == Y_test[i]) playerCorrect++;

                // Ghost Archetype logic
                int gPred = 0;
                if (ghostRivalName.Contains("Overfitter"))
                {
                    // Overfitter memorized center but fails on noisy periphery (~65-70% acc)
                    bool isPeriphery = Mathf.Abs(X_test[i][0]) > 2.8f || Mathf.Abs(X_test[i][1]) > 2.8f;
                    gPred = isPeriphery ? (1 - Y_test[i]) : Y_test[i];
                }
                else if (ghostRivalName.Contains("Grandmaster"))
                {
                    // High quality model (~93% acc)
                    gPred = (rng.NextDouble() < 0.93) ? Y_test[i] : (1 - Y_test[i]);
                }
                else
                {
                    gPred = (rng.NextDouble() < 0.85) ? Y_test[i] : (1 - Y_test[i]);
                }

                if (gPred == Y_test[i]) ghostCorrect++;
            }

            float pAcc = ((float)playerCorrect / n) * 100f;
            float gAcc = ((float)ghostCorrect / n) * 100f;
            bool win = pAcc >= gAcc;

            // Record to leaderboard
            localLeaderboard.Add(new LeaderboardEntry
            {
                playerName = "You (Player)",
                modelArchitecture = playerModelName,
                testAccuracy = pAcc,
                seedCode = seedCode,
                timestamp = DateTime.UtcNow.ToString("yyyy-MM-dd")
            });
            localLeaderboard.Sort((a, b) => b.testAccuracy.CompareTo(a.testAccuracy));

            return new DuelMatchResult
            {
                playerModelName = playerModelName,
                ghostRivalName = ghostRivalName,
                playerTestAccuracy = pAcc,
                ghostTestAccuracy = gAcc,
                totalTestSamples = n,
                playerPoints = playerCorrect,
                ghostPoints = ghostCorrect,
                isPlayerVictory = win,
                victoryNarrative = win ?
                    $"🏆 <b>VICTORY ON HELD-OUT TEST DATA!</b>\nYour model scored <b>{pAcc:F1}%</b> vs {ghostRivalName}'s <b>{gAcc:F1}%</b> on {n} unseen test points!" :
                    $"⚠️ <b>DEFEAT:</b> {ghostRivalName} outperformed your model ({gAcc:F1}% vs {pAcc:F1}%). Tune regularization or summon a Bagging Party!"
            };
        }
    }
}
