#if UNITY_EDITOR
using NUnit.Framework;
using UnityEngine;
using NeuroArena.Data;

namespace NeuroArena.Tests
{
    [TestFixture]
    public class DatasetShiftTests
    {
        [Test]
        public void TestCovariateShiftAndConceptDriftMixing()
        {
            // Distribution A: Linear Steppes (y = 2.45x + 1.15)
            // Distribution B: Shifted Tundra (y = -1.80x + 6.20)
            float slopeA = 2.45f, biasA = 1.15f;
            float slopeB = -1.80f, biasB = 6.20f;

            int nA = 12, nB = 12;
            float[] xA = new float[nA], yA = new float[nA];
            float[] xB = new float[nB], yB = new float[nB];

            for (int i = 0; i < nA; i++)
            {
                xA[i] = -3f + (i / 11f) * 6f;
                yA[i] = slopeA * xA[i] + biasA;
            }

            for (int i = 0; i < nB; i++)
            {
                xB[i] = -3f + (i / 11f) * 6f;
                yB[i] = slopeB * xB[i] + biasB;
            }

            // OLS on blended mixture (50% A, 50% B)
            float[] mixedX = new float[nA + nB];
            float[] mixedY = new float[nA + nB];
            for (int i = 0; i < nA; i++) { mixedX[i] = xA[i]; mixedY[i] = yA[i]; }
            for (int i = 0; i < nB; i++) { mixedX[nA + i] = xB[i]; mixedY[nA + i] = yB[i]; }

            float meanX = 0f, meanY = 0f;
            for (int i = 0; i < mixedX.Length; i++) { meanX += mixedX[i]; meanY += mixedY[i]; }
            meanX /= mixedX.Length;
            meanY /= mixedY.Length;

            float num = 0f, den = 0f;
            for (int i = 0; i < mixedX.Length; i++)
            {
                num += (mixedX[i] - meanX) * (mixedY[i] - meanY);
                den += (mixedX[i] - meanX) * (mixedX[i] - meanX);
            }
            float compW = num / den;
            float compB = meanY - compW * meanX;

            // Compromise slope is forced between 2.45 and -1.80
            Assert.Less(compW, slopeA, "Compromise slope must be pulled below Distribution A");
            Assert.Greater(compW, slopeB, "Compromise slope must be pulled above Distribution B");

            // Evaluate MSE on blended mixture - must be significantly higher than pure fit
            float totalCompLoss = 0f;
            for (int i = 0; i < mixedX.Length; i++)
            {
                float pred = compW * mixedX[i] + compB;
                float err = pred - mixedY[i];
                totalCompLoss += err * err;
            }
            float compMSE = totalCompLoss / (2f * mixedX.Length);

            Assert.Greater(compMSE, 2.0f, "Conflicting distributions must cause elevated compromise MSE loss (>2.0)");
        }
    }
}
#endif
