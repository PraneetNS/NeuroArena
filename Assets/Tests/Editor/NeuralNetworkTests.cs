#if UNITY_EDITOR
using NUnit.Framework;
using UnityEngine;
using NeuroArena.ML;

namespace NeuroArena.Tests
{
    [TestFixture]
    public class NeuralNetworkTests
    {
        [Test]
        public void TestSigmoidActivationRange()
        {
            float largePos = 1.0f / (1.0f + Mathf.Exp(-10f));
            float zeroVal = 1.0f / (1.0f + Mathf.Exp(0f));
            float largeNeg = 1.0f / (1.0f + Mathf.Exp(10f));

            Assert.AreEqual(0.5f, zeroVal, 0.001f, "Sigmoid(0) must equal 0.5");
            Assert.Greater(largePos, 0.99f, "Sigmoid(10) must be close to 1.0");
            Assert.Less(largeNeg, 0.01f, "Sigmoid(-10) must be close to 0.0");
        }

        [Test]
        public void TestReLUActivation()
        {
            Assert.AreEqual(0.0f, Mathf.Max(0.0f, -4.5f), "ReLU(-4.5) must be 0");
            Assert.AreEqual(3.2f, Mathf.Max(0.0f, 3.2f), "ReLU(3.2) must be 3.2");
        }
    }
}
#endif
