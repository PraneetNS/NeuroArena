#if UNITY_EDITOR
using NUnit.Framework;
using UnityEngine;
using NeuroArena.Data;
using NeuroArena.ML;

namespace NeuroArena.Tests
{
    [TestFixture]
    public class ModelConsultTests
    {
        [Test]
        public void TestInDomainInterpolationDetection()
        {
            TrainedModelRecord record = new TrainedModelRecord
            {
                minX = -5.0f,
                maxX = 5.0f,
                meanX = 0.0f,
                stdDevX = 2.5f,
                weightW = 2.0f,
                weightB = 1.0f,
                trainingX = new float[] { -4f, -2f, 0f, 2f, 4f }
            };

            var res = ModelConsultEngine.ConsultModel(record, 1.5f);
            Assert.IsFalse(res.isExtrapolation, "Query inside [-5, 5] must be in-domain interpolation");
            Assert.AreEqual(4.0f, res.predictedValue, 0.01f, "y = 2*(1.5) + 1 = 4.0");
        }

        [Test]
        public void TestOutOfDomainExtrapolationDetection()
        {
            TrainedModelRecord record = new TrainedModelRecord
            {
                minX = -5.0f,
                maxX = 5.0f,
                meanX = 0.0f,
                stdDevX = 2.5f,
                weightW = 2.0f,
                weightB = 1.0f,
                trainingX = new float[] { -4f, -2f, 0f, 2f, 4f }
            };

            var res = ModelConsultEngine.ConsultModel(record, 16.0f);
            Assert.IsTrue(res.isExtrapolation, "Query X=16.0 far outside [-5, 5] must trigger Extrapolation Error");
            Assert.AreEqual(33.0f, res.predictedValue, 0.01f, "Genuine inference: y = 2*(16) + 1 = 33.0");
            StringAssert.Contains("EXTRAPOLATION ERROR", res.confidenceLevel);
        }
    }
}
#endif
