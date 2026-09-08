using System;
using NUnit.Framework;
using UnityEngine;
using NeuroArena.ML;

namespace NeuroArena.Tests
{
    public class AdaptiveCoachingTests
    {
        [SetUp]
        public void Setup()
        {
            AdaptiveCoachingManager.ResetForTesting();
        }

        [Test]
        public void TestInitialBaselineUnadjustedEnvelope()
        {
            var entry = AdaptiveCoachingManager.ComputeAdaptiveEnvelope(2, "practice", false);
            Assert.IsFalse(entry.isAdapted);
            Assert.AreEqual(1.0f, entry.modifiers.noiseScaleMultiplier, 0.001f);
            Assert.AreEqual(1.0f, entry.modifiers.bossHpMultiplier, 0.001f);
        }

        [Test]
        public void TestStruggle3xBossFailuresEnvelopeAdjustment()
        {
            int biomeIndex = 2;
            AdaptiveCoachingManager.RecordTelemetrySignal(biomeIndex, "BOSS_ATTEMPT_FAILED", "practice", false);
            AdaptiveCoachingManager.RecordTelemetrySignal(biomeIndex, "BOSS_ATTEMPT_FAILED", "practice", false);
            AdaptiveCoachingManager.RecordTelemetrySignal(biomeIndex, "BOSS_ATTEMPT_FAILED", "practice", false);
            AdaptiveCoachingManager.RecordTelemetrySignal(biomeIndex, "OVERFITTING_ALERT", "practice", false);

            var entry = AdaptiveCoachingManager.ComputeAdaptiveEnvelope(biomeIndex, "practice", false, "RUN_TEST_001");
            Assert.IsTrue(entry.isAdapted);
            Assert.LessOrEqual(entry.modifiers.noiseScaleMultiplier, 0.95f);
            Assert.GreaterOrEqual(entry.modifiers.noiseScaleMultiplier, 0.75f);
            Assert.LessOrEqual(entry.modifiers.bossHpMultiplier, 0.96f);
            Assert.GreaterOrEqual(entry.modifiers.bossHpMultiplier, 0.85f);
            Assert.IsTrue(entry.reasons.Exists(r => r.Contains("STUCK_ON_BOSS_3X")));
        }

        [Test]
        public void TestNonRubberbandingHardBoundsClamp()
        {
            int biomeIndex = 2;
            for (int i = 0; i < 20; i++)
            {
                AdaptiveCoachingManager.RecordTelemetrySignal(biomeIndex, "BOSS_ATTEMPT_FAILED", "practice", false);
            }

            var entry = AdaptiveCoachingManager.ComputeAdaptiveEnvelope(biomeIndex, "practice", false);
            Assert.AreEqual(0.75f, entry.modifiers.noiseScaleMultiplier, 0.001f, "Noise scale floor must be 0.75");
            Assert.AreEqual(0.70f, entry.modifiers.outlierScaleMultiplier, 0.001f, "Outlier floor must be 0.70");
            Assert.AreEqual(0.85f, entry.modifiers.bossHpMultiplier, 0.001f, "Boss HP floor must be 0.85");
            Assert.AreEqual(0.85f, entry.modifiers.bossDamageMultiplier, 0.001f, "Boss Damage floor must be 0.85");
        }

        [Test]
        public void TestOptInCoachingEscalationZeroSpoilers()
        {
            int biomeIndex = 2;
            AdaptiveCoachingManager.RecordTelemetrySignal(biomeIndex, "BOSS_ATTEMPT_FAILED", "practice", false);
            AdaptiveCoachingManager.RecordTelemetrySignal(biomeIndex, "BOSS_ATTEMPT_FAILED", "practice", false);

            // 1. Without Opt-In: Offer available but no hint text
            var offer = AdaptiveCoachingManager.RequestCoachingHint(biomeIndex, false, "practice", false);
            Assert.IsTrue(offer.isAvailable);
            Assert.IsFalse(offer.optedIn);
            Assert.IsNull(offer.hintText);

            // 2. With Opt-In: Reveals conceptual diagnostic guidance
            var unlocked = AdaptiveCoachingManager.RequestCoachingHint(biomeIndex, true, "practice", false);
            Assert.IsTrue(unlocked.isAvailable);
            Assert.IsTrue(unlocked.optedIn);
            Assert.AreEqual("REGULARIZATION", unlocked.category);
            Assert.IsFalse(unlocked.isAnswerSpoiled);
            Assert.IsTrue(unlocked.hintText.Contains("L2 regularization"));
        }

        [Test]
        public void TestTransparencyAuditLogs()
        {
            int biomeIndex = 0;
            AdaptiveCoachingManager.RecordTelemetrySignal(biomeIndex, "BOSS_ATTEMPT_FAILED", "practice", false);
            AdaptiveCoachingManager.RecordTelemetrySignal(biomeIndex, "BOSS_ATTEMPT_FAILED", "practice", false);
            AdaptiveCoachingManager.RecordTelemetrySignal(biomeIndex, "BOSS_ATTEMPT_FAILED", "practice", false);

            AdaptiveCoachingManager.ComputeAdaptiveEnvelope(biomeIndex, "practice", false, "RUN_AUDIT_99");
            var logs = AdaptiveCoachingManager.GetTransparencyAuditLogs();

            Assert.Greater(logs.Count, 0);
            Assert.AreEqual("RUN_AUDIT_99", logs[0].runId);
            Assert.IsTrue(logs[0].explanation.Contains("Difficulty envelope adjusted"));
        }

        [Test]
        public void TestStrictRankedAndDuelGuard()
        {
            Assert.Throws<InvalidOperationException>(() =>
            {
                AdaptiveCoachingManager.AssertRoomEligibility("duel_room", false);
            });

            Assert.Throws<InvalidOperationException>(() =>
            {
                AdaptiveCoachingManager.AssertRoomEligibility("practice", true);
            });

            Assert.Throws<InvalidOperationException>(() =>
            {
                AdaptiveCoachingManager.ComputeAdaptiveEnvelope(0, "duel_room", false);
            });

            Assert.Throws<InvalidOperationException>(() =>
            {
                AdaptiveCoachingManager.RequestCoachingHint(0, true, "duel_room", false);
            });
        }
    }
}
