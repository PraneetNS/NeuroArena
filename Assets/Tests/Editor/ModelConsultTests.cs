#if UNITY_EDITOR
using System.Collections.Generic;
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

        [Test]
        public void TestOutOfVocabularyHonestRefusal()
        {
            // Player's Data Satchel only contains "fire", "flame", "heat"
            HashSet<string> playerSatchelVocabulary = new HashSet<string> { "fire", "flame", "heat" };

            // Querying an uncollected token "quantum_circuit"
            var unkResult = ModelConsultEngine.ConsultSemanticToken("quantum_circuit", playerSatchelVocabulary);

            Assert.IsTrue(unkResult.isOutOfVocabulary, "Uncollected token must be flagged as Out-of-Vocabulary");
            Assert.AreEqual(0.0f, unkResult.predictedValue, "Model must not predict values for unknown tokens");
            StringAssert.Contains("OUT-OF-VOCABULARY", unkResult.confidenceLevel);
            StringAssert.Contains("UNKNOWN TOKEN (<UNK>)", unkResult.explanationText);
            StringAssert.Contains("refuses to hallucinate", unkResult.explanationText);
        }

        [Test]
        public void TestInVocabularyValidConsult()
        {
            HashSet<string> playerSatchelVocabulary = new HashSet<string> { "fire", "flame", "heat" };

            // Querying a gathered token "flame"
            var validResult = ModelConsultEngine.ConsultSemanticToken("flame", playerSatchelVocabulary);

            Assert.IsFalse(validResult.isOutOfVocabulary, "Collected token must be recognized as in-vocabulary");
            Assert.Greater(validResult.predictedValue, 0.5f, "In-vocabulary token must produce a valid prediction");
            StringAssert.Contains("IN-VOCABULARY", validResult.confidenceLevel);
            StringAssert.Contains("IN-VOCABULARY TOKEN", validResult.explanationText);
        }
    }
}
#endif
