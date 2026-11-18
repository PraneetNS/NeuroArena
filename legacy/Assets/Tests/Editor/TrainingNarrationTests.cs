#if UNITY_EDITOR
using NUnit.Framework;
using UnityEngine;
using NeuroArena.ML;

namespace NeuroArena.Tests
{
    [TestFixture]
    public class TrainingNarrationTests
    {
        [Test]
        public void TestSlopeRotationNarrationGeneration()
        {
            float currentW = 1.25f, prevW = 0.50f; // delta = +0.75
            var snip = TrainingNarrationEngine.GenerateEpochNarration(
                currentW, prevW, 0.2f, 0.0f, 1.8f, 3.5f, 1.8f, 1.9f, -0.8f, -0.9f, 2
            );

            Assert.AreEqual("ROTATION", snip.category);
            StringAssert.Contains("rotating", snip.plainEnglishText);
            StringAssert.Contains("+0.75", snip.plainEnglishText);
        }

        [Test]
        public void TestOverfittingDivergenceNarration()
        {
            float trainLoss = 0.05f;
            float valLoss = 1.85f; // gap = +1.80
            var snip = TrainingNarrationEngine.GenerateEpochNarration(
                2.45f, 2.40f, 1.15f, 1.10f, trainLoss, 0.08f, trainLoss, valLoss, 0.02f, 0.03f, 30
            );

            Assert.AreEqual("OVERFITTING", snip.category);
            StringAssert.Contains("Overfitting starting", snip.plainEnglishText);
            StringAssert.Contains("0.050", snip.plainEnglishText);
            StringAssert.Contains("1.850", snip.plainEnglishText);
        }

        [Test]
        public void TestLossPlateauNarration()
        {
            float prevLoss = 0.0245f;
            float currentLoss = 0.0244f; // delta = 0.0001 (<0.5%)
            var snip = TrainingNarrationEngine.GenerateEpochNarration(
                2.45f, 2.45f, 1.15f, 1.15f, currentLoss, prevLoss, currentLoss, currentLoss * 1.02f, 0.001f, 0.001f, 45
            );

            Assert.AreEqual("PLATEAU", snip.category);
            StringAssert.Contains("plateaued", snip.plainEnglishText);
        }

        [Test]
        public void TestGradientOscillationNarration()
        {
            float gradW = 0.85f;
            float prevGradW = -0.75f; // Sign flip across steep canyon
            var snip = TrainingNarrationEngine.GenerateEpochNarration(
                1.5f, 1.8f, 0.5f, 0.4f, 1.2f, 1.25f, 1.2f, 1.25f, gradW, prevGradW, 12
            );

            Assert.AreEqual("OSCILLATION", snip.category);
            StringAssert.Contains("reversed sign", snip.plainEnglishText);
        }
    }
}
#endif
