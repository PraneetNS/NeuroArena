using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.ML
{
    [Serializable]
    public struct ConceptRune
    {
        public string word;
        public string category;     // "Fire", "Ice", "Neural"
        public float[] embeddingVector;
        public Vector3 spatialPos3D;
        public Color runeColor;
    }

    [Serializable]
    public struct RetrievalResult
    {
        public string word;
        public string category;
        public float cosineSimilarity;
        public int rank;
    }

    /// <summary>
    /// Represents a single token's attention entry in the simplified attention distribution:
    /// α_i = softmax(CosineSimilarity(query, key_i) / temperature).
    /// </summary>
    [Serializable]
    public struct AttentionWeightEntry
    {
        public string word;
        public string category;
        public float rawSimilarity;
        public float attentionWeight; // Softmax probability in [0.0, 1.0]
        public float pulseIntensity;   // 1.0x to 6.5x scaled emission boost
        public int rank;
    }

    /// <summary>
    /// Pure C# Word/Item Embedding Engine, Vector Retrieval Simulator,
    /// and Simplified Softmax Attention Mechanism.
    /// Builds a co-occurrence matrix from scratch over text corpora,
    /// computes Positive Pointwise Mutual Information (PPMI) embeddings,
    /// evaluates Cosine Similarity, and computes simplified single-head similarity-weighted attention distributions.
    /// </summary>
    public static class VectorEmbeddingEngine
    {
        public static readonly string[] Vocabulary = new string[]
        {
            // Cluster A: Fire / Solar (Elemental)
            "fire", "sun", "flame", "heat", "solar", "combustion",
            // Cluster B: Ice / Glacial (Frost)
            "frost", "ice", "snow", "glacier", "cold", "freeze",
            // Cluster C: Neural / Matrix (Cyber)
            "neural", "synapse", "matrix", "gradient", "code", "circuit"
        };

        private static readonly string[] TextCorpus = new string[]
        {
            "fire flame heat combustion sun solar energy burns warm radiant",
            "sun solar heat fire flame light radiant heat warm solar combustion",
            "flame combustion heat fire sun solar radiant burning heat",
            "frost ice cold glacier snow freeze frozen chill zero arctic",
            "ice snow cold frost glacier freeze arctic mountain chill ice",
            "glacier frozen freeze ice snow cold frost arctic chill",
            "neural synapse gradient matrix code circuit weights backprop activation",
            "matrix gradient neural code synapse circuit compute backprop tensor",
            "synapse neural circuit gradient matrix code activation layers weights"
        };

        private static Dictionary<string, float[]> cachedEmbeddings;
        private static List<ConceptRune> cachedRunes;

        public static List<ConceptRune> GetRunes()
        {
            if (cachedRunes == null) ComputeAllEmbeddings();
            return cachedRunes;
        }

        public static void ComputeAllEmbeddings()
        {
            int V = Vocabulary.Length;
            Dictionary<string, int> wordIndex = new Dictionary<string, int>();
            for (int i = 0; i < V; i++) wordIndex[Vocabulary[i]] = i;

            // 1. Build Co-occurrence Matrix with window size = 3
            float[,] C = new float[V, V];
            int window = 3;

            foreach (var doc in TextCorpus)
            {
                var tokens = doc.Split(' ');
                for (int i = 0; i < tokens.Length; i++)
                {
                    if (!wordIndex.ContainsKey(tokens[i])) continue;
                    int wIdx = wordIndex[tokens[i]];

                    for (int j = Math.Max(0, i - window); j <= Math.Min(tokens.Length - 1, i + window); j++)
                    {
                        if (i == j || !wordIndex.ContainsKey(tokens[j])) continue;
                        int cIdx = wordIndex[tokens[j]];
                        C[wIdx, cIdx] += 1f;
                    }
                }
            }

            // 2. Compute Total Counts and Marginal Probabilities
            float totalCooc = 0f;
            float[] rowSums = new float[V];
            float[] colSums = new float[V];

            for (int i = 0; i < V; i++)
            {
                for (int j = 0; j < V; j++)
                {
                    totalCooc += C[i, j];
                    rowSums[i] += C[i, j];
                    colSums[j] += C[i, j];
                }
            }
            if (totalCooc < 1f) totalCooc = 1f;

            // 3. Compute Positive Pointwise Mutual Information (PPMI)
            float[][] ppmi = new float[V][];
            for (int i = 0; i < V; i++)
            {
                ppmi[i] = new float[V];
                for (int j = 0; j < V; j++)
                {
                    if (C[i, j] > 0)
                    {
                        float p_wc = C[i, j] / totalCooc;
                        float p_w = rowSums[i] / totalCooc;
                        float p_c = colSums[j] / totalCooc;
                        float pmi = Mathf.Log(p_wc / (p_w * p_c + 1e-8f), 2f);
                        ppmi[i][j] = Mathf.Max(0f, pmi);
                    }
                }
            }

            // 4. Dimensionality Reduction & L2 Normalization
            cachedEmbeddings = new Dictionary<string, float[]>();
            cachedRunes = new List<ConceptRune>();

            for (int i = 0; i < V; i++)
            {
                float[] rawVec = ppmi[i];
                float norm = 0f;
                for (int d = 0; d < V; d++) norm += rawVec[d] * rawVec[d];
                norm = Mathf.Sqrt(norm);
                if (norm < 1e-7f) norm = 1f;

                float[] normalized = new float[V];
                for (int d = 0; d < V; d++) normalized[d] = rawVec[d] / norm;

                string word = Vocabulary[i];
                cachedEmbeddings[word] = normalized;

                string cat = i < 6 ? "Fire" : (i < 12 ? "Ice" : "Neural");
                Color col = cat == "Fire" ? new Color(1f, 0.45f, 0.15f) : (cat == "Ice" ? new Color(0.2f, 0.85f, 1f) : new Color(0.75f, 0.35f, 1f));

                // 3D Spatial projection based on category center + semantic jitter
                float baseAngle = cat == "Fire" ? 0f : (cat == "Ice" ? (Mathf.PI * 2f / 3f) : (Mathf.PI * 4f / 3f));
                float subAngle = baseAngle + (i % 6 - 2.5f) * 0.22f;
                float radius = 7.5f + (i % 3) * 1.5f;
                Vector3 spatialPos = new Vector3(Mathf.Cos(subAngle) * radius, 1.8f + (i % 2) * 0.8f, Mathf.Sin(subAngle) * radius);

                cachedRunes.Add(new ConceptRune
                {
                    word = word,
                    category = cat,
                    embeddingVector = normalized,
                    spatialPos3D = spatialPos,
                    runeColor = col
                });
            }
        }

        /// <summary>
        /// Computes Cosine Similarity between two L2-normalized vectors in [-1.0, 1.0].
        /// </summary>
        public static float CosineSimilarity(float[] u, float[] v)
        {
            if (u == null || v == null || u.Length != v.Length) return 0f;
            float dot = 0f;
            for (int i = 0; i < u.Length; i++) dot += u[i] * v[i];
            return Mathf.Clamp(dot, -1f, 1f);
        }

        /// <summary>
        /// Simulates Top-K Nearest Neighbor Vector Retrieval (RAG Foundation).
        /// If the token has never been collected in the model's vocabulary satchel, returns an honest <UNK> response.
        /// </summary>
        public static List<RetrievalResult> RetrieveTopK(string queryWord, int k = 5)
        {
            var results = new List<RetrievalResult>();
            if (cachedEmbeddings == null) ComputeAllEmbeddings();

            queryWord = (queryWord ?? "").Trim().ToLower();
            if (!cachedEmbeddings.ContainsKey(queryWord))
            {
                // Honest Unknown Token (<UNK>) Rejection
                results.Add(new RetrievalResult
                {
                    word = $"<UNK>({queryWord})",
                    category = "Out-Of-Vocabulary",
                    cosineSimilarity = 0f,
                    rank = 1
                });
                return results;
            }

            float[] qVec = cachedEmbeddings[queryWord];

            for (int i = 0; i < Vocabulary.Length; i++)
            {
                string w = Vocabulary[i];
                float sim = CosineSimilarity(qVec, cachedEmbeddings[w]);
                string cat = i < 6 ? "Fire" : (i < 12 ? "Ice" : "Neural");

                results.Add(new RetrievalResult
                {
                    word = w,
                    category = cat,
                    cosineSimilarity = sim,
                    rank = 0
                });
            }

            // Sort by highest cosine similarity
            results.Sort((a, b) => b.cosineSimilarity.CompareTo(a.cosineSimilarity));

            for (int i = 0; i < results.Count; i++)
            {
                var r = results[i];
                r.rank = i + 1;
                results[i] = r;
            }

            return results.GetRange(0, Math.Min(k, results.Count));
        }

        /// <summary>
        /// Computes a genuine simplified single-head similarity-softmax attention distribution
        /// over all vocabulary entries: α_i = softmax(CosineSim(query, key_i) / temperature).
        /// Returns attention weights guaranteeing sum(α_i) == 1.0 (100%).
        /// </summary>
        public static List<AttentionWeightEntry> ComputeAttentionWeights(string queryWord, float temperature = 0.35f)
        {
            var list = new List<AttentionWeightEntry>();
            if (cachedEmbeddings == null) ComputeAllEmbeddings();

            queryWord = (queryWord ?? "").Trim().ToLower();
            if (!cachedEmbeddings.ContainsKey(queryWord))
            {
                // Out-of-vocabulary honest empty attention distribution
                return list;
            }

            float[] qVec = cachedEmbeddings[queryWord];
            int V = Vocabulary.Length;
            float[] logits = new float[V];
            float maxLogit = float.MinValue;

            // 1. Calculate similarity logits: s_i = CosineSim(q, k_i) / tau
            float tau = Mathf.Max(0.05f, temperature);
            for (int i = 0; i < V; i++)
            {
                string w = Vocabulary[i];
                float sim = CosineSimilarity(qVec, cachedEmbeddings[w]);
                float logit = sim / tau;
                logits[i] = logit;
                if (logit > maxLogit) maxLogit = logit;
            }

            // 2. Numerically stable Softmax calculation: exp(z_i - max_z) / sum(exp)
            float sumExp = 0f;
            float[] exps = new float[V];
            for (int i = 0; i < V; i++)
            {
                exps[i] = Mathf.Exp(logits[i] - maxLogit);
                sumExp += exps[i];
            }
            if (sumExp < 1e-8f) sumExp = 1e-8f;

            // 3. Construct structured attention weight entries
            for (int i = 0; i < V; i++)
            {
                string w = Vocabulary[i];
                float sim = CosineSimilarity(qVec, cachedEmbeddings[w]);
                float alpha = exps[i] / sumExp;
                string cat = i < 6 ? "Fire" : (i < 12 ? "Ice" : "Neural");

                // Pulse intensity scales from 1.0x (baseline) up to 6.5x for dominant attention focus
                float pulse = 1.0f + alpha * 5.5f;

                list.Add(new AttentionWeightEntry
                {
                    word = w,
                    category = cat,
                    rawSimilarity = sim,
                    attentionWeight = alpha,
                    pulseIntensity = pulse,
                    rank = 0
                });
            }

            // 4. Sort descending by highest attention weight
            list.Sort((a, b) => b.attentionWeight.CompareTo(a.attentionWeight));
            for (int i = 0; i < list.Count; i++)
            {
                var item = list[i];
                item.rank = i + 1;
                list[i] = item;
            }

            return list;
        }

        /// <summary>
        /// Evaluates Semantic Analogy Vector Arithmetic: u = a - b + c
        /// (e.g. fire - heat + cold ~= ice)
        /// </summary>
        public static string EvaluateVectorAnalogy(string wordA, string wordB, string wordC)
        {
            if (cachedEmbeddings == null) ComputeAllEmbeddings();
            if (!cachedEmbeddings.ContainsKey(wordA) || !cachedEmbeddings.ContainsKey(wordB) || !cachedEmbeddings.ContainsKey(wordC))
                return "Unknown concept tokens";

            float[] a = cachedEmbeddings[wordA];
            float[] b = cachedEmbeddings[wordB];
            float[] c = cachedEmbeddings[wordC];

            int dim = a.Length;
            float[] target = new float[dim];
            float norm = 0f;
            for (int i = 0; i < dim; i++)
            {
                target[i] = a[i] - b[i] + c[i];
                norm += target[i] * target[i];
            }
            norm = Mathf.Sqrt(norm);
            if (norm > 1e-6f)
            {
                for (int i = 0; i < dim; i++) target[i] /= norm;
            }

            float bestSim = -1f;
            string bestWord = "";
            for (int i = 0; i < Vocabulary.Length; i++)
            {
                string w = Vocabulary[i];
                if (w == wordA || w == wordB || w == wordC) continue;
                float sim = CosineSimilarity(target, cachedEmbeddings[w]);
                if (sim > bestSim)
                {
                    bestSim = sim;
                    bestWord = w;
                }
            }

            return $"({wordA} - {wordB} + {wordC}) ➔ <b>{bestWord.ToUpper()}</b> (Cosine Sim = {bestSim:F3})";
        }
    }
}
