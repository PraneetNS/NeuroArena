using NUnit.Framework;
using UnityEngine;
using NeuroArena.Network;
using NeuroArena.Core;

namespace NeuroArena.Tests
{
    public class CoopRoomTests
    {
        [Test]
        public void TestPartyDifficultyBossHpScaling()
        {
            int baseHp = 1000;

            float hp2P = CoopRoomManager.ComputePartyDifficultyBossHp(baseHp, 2);
            float hp3P = CoopRoomManager.ComputePartyDifficultyBossHp(baseHp, 3);
            float hp4P = CoopRoomManager.ComputePartyDifficultyBossHp(baseHp, 4);

            Assert.AreEqual(1650f, hp2P, 0.01f, "2-Player boss HP must be 1.65x base");
            Assert.AreEqual(2250f, hp3P, 0.01f, "3-Player boss HP must be 2.25x base");
            Assert.AreEqual(2800f, hp4P, 0.01f, "4-Player boss HP must be 2.80x base (sub-linear)");
            Assert.IsTrue(hp4P > hp2P, "4-player boss HP must exceed 2-player boss HP");
        }

        [Test]
        public void TestDatasetHealthMetricStructure()
        {
            var metrics = new CoopDatasetMetrics
            {
                totalSamples = 32,
                domainMin = -6.5f,
                domainMax = 6.5f,
                coverageScore = 95f,
                balanceScore = 90f,
                cleanlinessScore = 98f,
                overallHealthScore = 94f,
                healthGrade = "EXCELLENT",
                blindSpotsCount = 0
            };

            Assert.AreEqual(32, metrics.totalSamples);
            Assert.AreEqual("EXCELLENT", metrics.healthGrade);
            Assert.AreEqual(0, metrics.blindSpotsCount);
            Assert.IsTrue(metrics.coverageScore >= 90f);
        }

        [Test]
        public void TestPingMessageStructure()
        {
            var ping = new CoopPingMessage
            {
                senderId = "user_alpha",
                senderName = "Ada",
                pingType = "COVERAGE_GAP",
                x = 12.0f,
                z = -4.5f,
                domainX = -4.0f,
                targetPartition = 1,
                textPrompt = "Watch coverage gap!",
                hapticPulse = "MediumImpact"
            };

            Assert.AreEqual("COVERAGE_GAP", ping.pingType);
            Assert.AreEqual("MediumImpact", ping.hapticPulse);
            Assert.AreEqual(1, ping.targetPartition);
        }
    }
}
