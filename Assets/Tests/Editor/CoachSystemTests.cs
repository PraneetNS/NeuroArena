#if UNITY_EDITOR
using NUnit.Framework;
using UnityEngine;
using NeuroArena.Core;
using NeuroArena.Data;

namespace NeuroArena.Tests
{
    [TestFixture]
    public class CoachSystemTests
    {
        [Test]
        public void TestPreflightTipsCoverageAllBiomes()
        {
            Assert.AreEqual(6, CoachSystem.BiomePreflightTips.Length, "Must have preflight curation tips for all 6 biomes");
            for (int i = 0; i < 6; i++)
            {
                var tip = CoachSystem.GetTipForBiome(i);
                Assert.IsNotEmpty(tip.biomeName);
                Assert.IsNotEmpty(tip.keyDataPrinciple);
                Assert.IsNotEmpty(tip.curationGuidance);
                Assert.IsNotEmpty(tip.whatToAvoid);
            }
        }

        [Test]
        public void TestOverfittingDiagnosisDetection()
        {
            // Low training loss, high validation loss
            float trainMSE = 0.04f;
            float valMSE = 2.45f;
            DatasetStatistics stats = new DatasetStatistics { sampleCount = 6, minX = -4f, maxX = 4f };
            DatasetHealthMetrics health = DatasetHealthMetrics.Default;

            var diag = CoachSystem.DiagnoseFailure(stats, health, trainMSE, valMSE, 2, "Adam");
            Assert.AreEqual("Overfitting (High Variance)", diag.failureCategory);
            StringAssert.Contains("memorized", diag.computedDiagnosis);
        }

        [Test]
        public void TestOutlierCorruptionDiagnosisDetection()
        {
            float trainMSE = 1.45f;
            float valMSE = 1.65f;
            DatasetStatistics stats = new DatasetStatistics { sampleCount = 8, minX = -4f, maxX = 4f };
            DatasetHealthMetrics health = new DatasetHealthMetrics
            {
                outlierCount = 3,
                cleanlinessScore = 20f
            };

            var diag = CoachSystem.DiagnoseFailure(stats, health, trainMSE, valMSE, 0, "Adam");
            Assert.AreEqual("Outlier Pull & Parameter Distortion", diag.failureCategory);
            StringAssert.Contains("3 extreme outlier", diag.computedDiagnosis);
        }

        [Test]
        public void TestClassImbalanceDiagnosisDetection()
        {
            float trainMSE = 1.1f;
            float valMSE = 1.2f;
            DatasetStatistics stats = new DatasetStatistics
            {
                sampleCount = 10,
                isClassification = true,
                class0Ratio = 0.90f,
                class1Ratio = 0.10f
            };
            DatasetHealthMetrics health = DatasetHealthMetrics.Default;

            var diag = CoachSystem.DiagnoseFailure(stats, health, trainMSE, valMSE, 1, "Adam");
            Assert.AreEqual("Class Imbalance Bias", diag.failureCategory);
            StringAssert.Contains("severely imbalanced", diag.computedDiagnosis);
        }
    }
}
#endif
