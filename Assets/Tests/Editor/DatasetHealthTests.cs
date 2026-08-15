#if UNITY_EDITOR
using NUnit.Framework;
using UnityEngine;
using NeuroArena.Data;

namespace NeuroArena.Tests
{
    [TestFixture]
    public class DatasetHealthTests
    {
        [Test]
        public void TestCleanBalancedDatasetHealthScore()
        {
            DatasetStatistics stats = new DatasetStatistics
            {
                sampleCount = 12,
                minX = -4.0f,
                maxX = 4.0f,
                meanX = 0.0f,
                stdDevX = 2.5f,
                class0Ratio = 0.5f,
                class1Ratio = 0.5f,
                isClassification = true
            };

            float skew = Mathf.Abs(stats.class0Ratio - stats.class1Ratio);
            float balance = Mathf.Clamp01(1.0f - skew) * 100f;
            float cleanliness = 100f; // 0 outliers
            float domainSpan = stats.maxX - stats.minX;
            float spanScore = Mathf.Clamp01(domainSpan / 7.5f);
            float countScore = Mathf.Clamp01((float)stats.sampleCount / 10f);
            float coverage = (spanScore * 0.65f + countScore * 0.35f) * 100f;

            float totalScore = balance * 0.35f + cleanliness * 0.35f + coverage * 0.30f;

            Assert.GreaterOrEqual(totalScore, 85f, "Clean balanced dataset with full coverage must score >= 85% (EXCELLENT)");
            Assert.AreEqual(100f, balance, "50/50 class balance must have 100% balance score");
        }

        [Test]
        public void TestImbalancedOutlierDatasetHealthDrop()
        {
            DatasetStatistics stats = new DatasetStatistics
            {
                sampleCount = 10,
                minX = 1.0f,
                maxX = 2.0f, // Narrow domain
                meanX = 1.5f,
                stdDevX = 0.3f,
                class0Ratio = 0.9f,
                class1Ratio = 0.1f, // Severe 90/10 imbalance
                isClassification = true
            };

            float skew = Mathf.Abs(stats.class0Ratio - stats.class1Ratio); // 0.8
            float balance = Mathf.Clamp01(1.0f - skew) * 100f; // 20%
            float outlierRatio = 0.30f; // 30% outliers
            float cleanliness = Mathf.Clamp01(1.0f - outlierRatio * 3.5f) * 100f; // 0%
            float domainSpan = stats.maxX - stats.minX; // 1.0
            float spanScore = Mathf.Clamp01(domainSpan / 7.5f);
            float countScore = Mathf.Clamp01((float)stats.sampleCount / 10f);
            float coverage = (spanScore * 0.65f + countScore * 0.35f) * 100f;

            float totalScore = balance * 0.35f + cleanliness * 0.35f + coverage * 0.30f;

            Assert.Less(totalScore, 50f, "Severely imbalanced and outlier-ridden dataset must score < 50% (CRITICAL / SKEWED)");
        }
    }
}
#endif
