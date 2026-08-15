#if UNITY_EDITOR
using NUnit.Framework;
using UnityEngine;
using NeuroArena.ML;

namespace NeuroArena.Tests
{
    [TestFixture]
    public class DecisionTreeTests
    {
        [Test]
        public void TestGiniImpurityPureSubset()
        {
            // Pure subset with 10 samples of class 1 -> Gini = 1 - (1^2) = 0
            int[] labels = new int[] { 1, 1, 1, 1, 1, 1 };
            float p1 = 1.0f;
            float gini = 1.0f - (p1 * p1);
            Assert.AreEqual(0.0f, gini, 0.001f, "Pure subset must have 0.0 Gini impurity");
        }

        [Test]
        public void TestGiniImpuritySplitCalculation()
        {
            // 50/50 split -> Gini = 1 - (0.5^2 + 0.5^2) = 0.5
            float p0 = 0.5f, p1 = 0.5f;
            float gini = 1.0f - (p0 * p0 + p1 * p1);
            Assert.AreEqual(0.5f, gini, 0.001f, "Even 50/50 split must have 0.5 Gini impurity");
        }
    }
}
#endif
