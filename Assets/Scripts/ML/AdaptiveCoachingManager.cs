using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.ML
{
    [System.Serializable]
    public class AdaptiveModifiers
    {
        public float noiseScaleMultiplier = 1.0f;
        public float outlierScaleMultiplier = 1.0f;
        public float bossHpMultiplier = 1.0f;
        public float bossDamageMultiplier = 1.0f;
        public float targetLossRelaxation = 1.0f;
    }

    [System.Serializable]
    public class PlayerStruggleProfile
    {
        public int biomeIndex;
        public int consecutiveBossFailures;
        public int overfittingAlertCount;
        public int convergencePlateauCount;
        public string lastAttemptTimestamp;
    }

    [System.Serializable]
    public class CoachingHintResult
    {
        public bool isAvailable;
        public bool optedIn;
        public int hintTier;
        public int biomeIndex;
        public string category;
        public string conceptName;
        public string hintText;
        public string guidanceAction;
        public bool isAnswerSpoiled;
        public string message;
    }

    [System.Serializable]
    public class TransparencyLogEntry
    {
        public string runId;
        public int biomeIndex;
        public string timestamp;
        public bool isAdapted;
        public List<string> reasons = new List<string>();
        public AdaptiveModifiers modifiers;
        public string explanation;
    }

    /// <summary>
    /// Unity C# Adaptive Difficulty & Opt-in Coaching Manager.
    /// Ingests real-time struggle signals, calculates bounded envelope adjustments,
    /// manages conceptual coaching escalation (zero answers spoiled),
    /// records inspectable transparency audit logs, and enforces strict isolation from ranked duels.
    /// </summary>
    public static class AdaptiveCoachingManager
    {
        private static readonly Dictionary<int, PlayerStruggleProfile> struggleProfiles = new Dictionary<int, PlayerStruggleProfile>();
        private static readonly List<TransparencyLogEntry> auditLogs = new List<TransparencyLogEntry>();

        public static void ResetForTesting()
        {
            struggleProfiles.Clear();
            auditLogs.Clear();
        }

        public static void AssertRoomEligibility(string roomType, bool isRanked)
        {
            string norm = (roomType ?? "").ToLower().Trim();
            if (norm == "duel_room" || norm == "duel" || isRanked || norm == "ranked" || norm == "ranked_coop" || norm == "coop_room" || norm == "coop")
            {
                throw new InvalidOperationException("ADAPTIVE_COACHING_FORBIDDEN_IN_RANKED");
            }
        }

        public static PlayerStruggleProfile GetOrCreateProfile(int biomeIndex)
        {
            int safeBiome = Mathf.Clamp(biomeIndex, 0, 5);
            if (!struggleProfiles.TryGetValue(safeBiome, out var profile))
            {
                profile = new PlayerStruggleProfile
                {
                    biomeIndex = safeBiome,
                    consecutiveBossFailures = 0,
                    overfittingAlertCount = 0,
                    convergencePlateauCount = 0,
                    lastAttemptTimestamp = DateTime.UtcNow.ToString("o")
                };
                struggleProfiles[safeBiome] = profile;
            }
            return profile;
        }

        public static PlayerStruggleProfile RecordTelemetrySignal(int biomeIndex, string signalType, string roomType = "practice", bool isRanked = false)
        {
            AssertRoomEligibility(roomType, isRanked);
            var profile = GetOrCreateProfile(biomeIndex);
            profile.lastAttemptTimestamp = DateTime.UtcNow.ToString("o");

            switch (signalType)
            {
                case "BOSS_ATTEMPT_FAILED":
                    profile.consecutiveBossFailures++;
                    break;
                case "BOSS_ATTEMPT_WON":
                    profile.consecutiveBossFailures = 0;
                    break;
                case "OVERFITTING_ALERT":
                    profile.overfittingAlertCount++;
                    break;
                case "SLOW_CONVERGENCE":
                case "CONVERGENCE_PLATEAU":
                    profile.convergencePlateauCount++;
                    break;
            }

            return profile;
        }

        public static TransparencyLogEntry ComputeAdaptiveEnvelope(int biomeIndex, string roomType = "practice", bool isRanked = false, string runId = null)
        {
            AssertRoomEligibility(roomType, isRanked);
            int safeBiome = Mathf.Clamp(biomeIndex, 0, 5);
            var profile = GetOrCreateProfile(safeBiome);
            string activeRunId = runId ?? $"RUN-{DateTime.UtcNow.Ticks}";

            int failures = profile.consecutiveBossFailures;
            int overfits = profile.overfittingAlertCount;
            int plateaus = profile.convergencePlateauCount;

            float noiseScale = 1.0f;
            float outlierScale = 1.0f;
            float bossHp = 1.0f;
            float bossDmg = 1.0f;
            float targetLoss = 1.0f;
            var reasons = new List<string>();

            if (failures >= 3)
            {
                noiseScale = Mathf.Max(0.75f, 1.0f - (failures - 2) * 0.05f);
                outlierScale = Mathf.Max(0.70f, 1.0f - (failures - 2) * 0.08f);
                bossHp = Mathf.Max(0.85f, 1.0f - (failures - 2) * 0.04f);
                bossDmg = Mathf.Max(0.85f, 1.0f - (failures - 2) * 0.03f);
                targetLoss = Mathf.Min(1.15f, 1.0f + (failures - 2) * 0.03f);
                reasons.Add($"STUCK_ON_BOSS_{failures}X");
            }
            else if (failures == 2)
            {
                noiseScale = 0.96f;
                outlierScale = 0.95f;
                bossHp = 0.96f;
                targetLoss = 1.04f;
                reasons.Add("BOSS_FAILURES_2X");
            }

            if (overfits >= 3)
            {
                noiseScale = Mathf.Min(noiseScale, 0.85f);
                reasons.Add($"OVERFITTING_TELEMETRY_{overfits}X");
            }

            if (plateaus >= 4)
            {
                outlierScale = Mathf.Min(outlierScale, 0.80f);
                targetLoss = Mathf.Min(1.18f, targetLoss * 1.05f);
                reasons.Add($"SLOW_CONVERGENCE_{plateaus}X");
            }

            // Hard clamp enforcement
            noiseScale = Mathf.Clamp(noiseScale, 0.75f, 1.0f);
            outlierScale = Mathf.Clamp(outlierScale, 0.70f, 1.0f);
            bossHp = Mathf.Clamp(bossHp, 0.85f, 1.0f);
            bossDmg = Mathf.Clamp(bossDmg, 0.85f, 1.0f);
            targetLoss = Mathf.Clamp(targetLoss, 1.0f, 1.20f);

            bool isAdapted = reasons.Count > 0;
            string explanation = isAdapted
                ? $"Difficulty envelope adjusted for practice run: Noise reduced by {Mathf.RoundToInt((1f - noiseScale) * 100f)}%, outliers reduced by {Mathf.RoundToInt((1f - outlierScale) * 100f)}%, boss health tuned by {Mathf.RoundToInt((1f - bossHp) * 100f)}% due to [{string.Join(", ", reasons)}]. Theoretical solvability maintained."
                : "Standard unadjusted difficulty envelope.";

            var entry = new TransparencyLogEntry
            {
                runId = activeRunId,
                biomeIndex = safeBiome,
                timestamp = DateTime.UtcNow.ToString("o"),
                isAdapted = isAdapted,
                reasons = reasons,
                modifiers = new AdaptiveModifiers
                {
                    noiseScaleMultiplier = noiseScale,
                    outlierScaleMultiplier = outlierScale,
                    bossHpMultiplier = bossHp,
                    bossDamageMultiplier = bossDmg,
                    targetLossRelaxation = targetLoss
                },
                explanation = explanation
            };

            auditLogs.Insert(0, entry);
            if (auditLogs.Count > 50) auditLogs.RemoveAt(auditLogs.Count - 1);

            return entry;
        }

        public static CoachingHintResult RequestCoachingHint(int biomeIndex, bool optIn, string roomType = "practice", bool isRanked = false)
        {
            AssertRoomEligibility(roomType, isRanked);
            int safeBiome = Mathf.Clamp(biomeIndex, 0, 5);
            var profile = GetOrCreateProfile(safeBiome);
            int failures = profile.consecutiveBossFailures;

            if (failures < 2)
            {
                return new CoachingHintResult
                {
                    isAvailable = false,
                    hintTier = 0,
                    biomeIndex = safeBiome,
                    message = "Coaching hints unlock after 2 consecutive failed attempts in practice mode."
                };
            }

            if (!optIn)
            {
                return new CoachingHintResult
                {
                    isAvailable = true,
                    optedIn = false,
                    hintTier = failures >= 3 ? 2 : 1,
                    biomeIndex = safeBiome,
                    message = $"Coach analysis available for Biome {safeBiome + 1} ({failures} failed attempts recorded). Opt-in to reveal conceptual diagnostics."
                };
            }

            // Conceptual non-spoilery hint
            int tier = failures >= 3 ? 2 : 1;
            string category = "REGULARIZATION";
            string concept = "L2 Ridge Penalty / Weight Decay";
            string hint = "Validation error is rising while training error nears zero. Introducing L2 regularization (weight decay) penalizes large weights, enforcing a smoother curve without memorizing noise.";
            string guidance = "Apply L2 regularization to restrain higher-order polynomial coefficients.";

            if (safeBiome == 0)
            {
                category = "GRADIENT_DYNAMICS";
                concept = "Learning Rate & Outlier Sensitivity";
                hint = "High-residual leverage points cause steep parameter oscillations. Reduce your gradient step scale to stabilize the descent trajectory.";
                guidance = "Moderate step sizes to avoid overshooting on outlier samples.";
            }

            return new CoachingHintResult
            {
                isAvailable = true,
                optedIn = true,
                hintTier = tier,
                biomeIndex = safeBiome,
                category = category,
                conceptName = concept,
                hintText = hint,
                guidanceAction = guidance,
                isAnswerSpoiled = false
            };
        }

        public static List<TransparencyLogEntry> GetTransparencyAuditLogs()
        {
            return new List<TransparencyLogEntry>(auditLogs);
        }
    }
}
