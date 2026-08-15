#if UNITY_EDITOR
using NUnit.Framework;
using UnityEngine;
using NeuroArena.ML;

namespace NeuroArena.Tests
{
    [TestFixture]
    public class RegressionTests
    {
        [Test]
        public void TestLinearRegressionConvergence()
        {
            float[] x = new float[] { -2f, -1f, 0f, 1f, 2f };
            float[] y = new float[] { -3.8f, -1.9f, 0.1f, 2.1f, 4.0f }; // y ≈ 2x

            float w = 0.5f, b = 0.0f;
            float lr = 0.05f;

            for (int ep = 0; ep < 100; ep++)
            {
                float gradW = 0f, gradB = 0f;
                for (int i = 0; i < x.Length; i++)
                {
                    float pred = w * x[i] + b;
                    float err = pred - y[i];
                    gradW += err * x[i];
                    gradB += err;
                }
                w -= lr * (gradW / x.Length);
                b -= lr * (gradB / x.Length);
            }

            Assert.AreEqual(2.0f, w, 0.2f, "Weight w should converge close to 2.0");
            Assert.AreEqual(0.0f, b, 0.2f, "Bias b should converge close to 0.0");
        }

        [Test]
        public void TestMSELossCalculation()
        {
            float[] targets = new float[] { 2.0f, 4.0f, 6.0f };
            float[] predictions = new float[] { 2.0f, 3.0f, 5.0f }; // errors: 0, 1, 1 -> MSE = (0+1+1)/3 = 0.6667

            float totalErr = 0f;
            for (int i = 0; i < targets.Length; i++)
            {
                float diff = predictions[i] - targets[i];
                totalErr += diff * diff;
            }
            float mse = totalErr / targets.Length;

            Assert.AreEqual(0.6667f, mse, 0.01f);
        }
    }
}
#endif
