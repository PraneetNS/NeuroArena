#if UNITY_EDITOR
using NUnit.Framework;
using UnityEngine;
using NeuroArena.ML;

namespace NeuroArena.Tests
{
    [TestFixture]
    public class VectorEmbeddingTests
    {
        [Test]
        public void TestCosineSimilarityOrthogonal()
        {
            float[] v1 = new float[] { 1f, 0f, 0f };
            float[] v2 = new float[] { 0f, 1f, 0f };

            float dot = 0f, n1 = 0f, n2 = 0f;
            for (int i = 0; i < v1.Length; i++)
            {
                dot += v1[i] * v2[i];
                n1 += v1[i] * v1[i];
                n2 += v2[i] * v2[i];
            }
            float sim = dot / (Mathf.Sqrt(n1) * Mathf.Sqrt(n2));
            Assert.AreEqual(0.0f, sim, 0.001f, "Orthogonal vectors must have cosine similarity 0.0");
        }

        [Test]
        public void TestCosineSimilarityIdentical()
        {
            float[] v1 = new float[] { 0.6f, 0.8f };
            float[] v2 = new float[] { 0.6f, 0.8f };

            float dot = 0f, n1 = 0f, n2 = 0f;
            for (int i = 0; i < v1.Length; i++)
            {
                dot += v1[i] * v2[i];
                n1 += v1[i] * v1[i];
                n2 += v2[i] * v2[i];
            }
            float sim = dot / (Mathf.Sqrt(n1) * Mathf.Sqrt(n2));
            Assert.AreEqual(1.0f, sim, 0.001f, "Identical vectors must have cosine similarity 1.0");
        }
    }
}
#endif
