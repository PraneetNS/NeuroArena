#if UNITY_EDITOR
using System.Collections.Generic;
using NUnit.Framework;
using UnityEngine;
using NeuroArena.ML;
using NeuroArena.Data;

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

        [Test]
        public void TestRetrieveTopKWithUnknownToken()
        {
            // Querying a non-existent / uncollected word token
            List<RetrievalResult> results = VectorEmbeddingEngine.RetrieveTopK("non_existent_alien_concept", k: 3);

            Assert.AreEqual(1, results.Count, "Uncollected token must return a single honest <UNK> entry");
            StringAssert.Contains("<UNK>", results[0].word, "Word must be flagged with <UNK>");
            Assert.AreEqual("Out-Of-Vocabulary", results[0].category);
            Assert.AreEqual(0.0f, results[0].cosineSimilarity, "Unknown token similarity must be 0.0");
        }

        [Test]
        public void TestDataSatchelVocabularySize()
        {
            GameObject invObj = new GameObject("TestMLInventory");
            MLInventory inv = invObj.AddComponent<MLInventory>();

            int initialSize = inv.VocabularySize;
            Assert.GreaterOrEqual(initialSize, 5, "Initial satchel must contain foundational tokens");

            inv.AddVocabularyToken("quantum_spin");
            Assert.AreEqual(initialSize + 1, inv.VocabularySize, "Adding unique concept must increase vocabulary size by exactly 1");

            // Adding duplicate concept must not inflate vocabulary size
            inv.AddVocabularyToken("quantum_spin");
            Assert.AreEqual(initialSize + 1, inv.VocabularySize, "Duplicate concept must not increase vocabulary size");

            Assert.IsTrue(inv.HasVocabularyToken("quantum_spin"));
            Assert.IsFalse(inv.HasVocabularyToken("uncollected_token_xyz"));

            Object.DestroyImmediate(invObj);
        }

        [Test]
        public void TestSimplifiedAttentionSoftmaxNormalization()
        {
            // Query a known concept
            var attn = VectorEmbeddingEngine.ComputeAttentionWeights("fire", temperature: 0.35f);

            Assert.AreEqual(VectorEmbeddingEngine.Vocabulary.Length, attn.Count, "Attention must cover entire vocabulary");

            float sumAlpha = 0f;
            for (int i = 0; i < attn.Count; i++)
            {
                Assert.GreaterOrEqual(attn[i].attentionWeight, 0f, "Attention weights must be non-negative");
                Assert.LessOrEqual(attn[i].attentionWeight, 1.0f, "Attention weights must not exceed 1.0");
                sumAlpha += attn[i].attentionWeight;
            }

            Assert.AreEqual(1.0f, sumAlpha, 0.001f, "Softmax normalized attention weights must sum to exactly 1.0 (100%)");
        }

        [Test]
        public void TestSimplifiedAttentionSelfAndClusterFocus()
        {
            var attn = VectorEmbeddingEngine.ComputeAttentionWeights("fire", temperature: 0.35f);

            // Top-1 must be the query word itself
            Assert.AreEqual("fire", attn[0].word.ToLower(), "Query word 'fire' must have highest self-attention");
            Assert.Greater(attn[0].attentionWeight, 0.15f, "Top attended word must receive significant attention weight");
            Assert.Greater(attn[0].pulseIntensity, 1.5f, "Pulse intensity must scale above 1.5x for top attended word");

            // Opposite cluster word (e.g. frost/ice) must have much lower attention weight than fire/flame
            float fireWeight = attn[0].attentionWeight;
            float frostWeight = 0f;
            for (int i = 0; i < attn.Count; i++)
            {
                if (attn[i].word == "frost") frostWeight = attn[i].attentionWeight;
            }

            Assert.Greater(fireWeight, frostWeight * 2f, "Fire cluster must receive significantly higher attention than frost");
        }
    }
}
#endif
