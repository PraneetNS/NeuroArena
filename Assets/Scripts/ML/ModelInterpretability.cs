using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.ML
{
    [Serializable]
    public struct FeatureImportanceScore
    {
        public string featureName;
        public int featureIndex;
        public float rawDrop;           // Delta Accuracy or Delta (1-MSE)
        public float relativePercent;   // Normalized in [0%, 100%]
    }

    [Serializable]
    public struct TreeSplitContribution
    {
        public int nodeId;
        public int depth;
        public string condition;
        public float impurityBefore;
        public float impurityAfter;
        public float impurityDrop;
        public float contributionPercent;
        public int sampleCount;
    }

    /// <summary>
    /// Pure C# Model Interpretability and Feature Importance Engine.
    /// Implements permutation importance (shuffling individual feature columns),
    /// Decision Tree Mean Decrease in Impurity (MDI) split contribution breakdown,
    /// and Pearson correlation coefficients without external libraries.
    /// </summary>
    public static class ModelInterpretability
    {
        /// <summary>
        /// Computes Permutation Feature Importance for a Decision Tree or Multi-feature Model.
        /// Evaluates baseline accuracy, shuffles feature column j, and computes accuracy drop.
        /// </summary>
        public static List<FeatureImportanceScore> ComputePermutationImportance(
            float[][] X,
            int[] Y,
            Func<float[], int> predictFunc,
            string[] featureNames = null)
        {
            var results = new List<FeatureImportanceScore>();
            if (X == null || Y == null || X.Length == 0 || predictFunc == null) return results;

            int m = X.Length;
            int numFeatures = X[0].Length;

            if (featureNames == null || featureNames.Length < numFeatures)
            {
                featureNames = new string[numFeatures];
                for (int j = 0; j < numFeatures; j++) featureNames[j] = $"Feature X{j + 1}";
            }

            // 1. Compute Baseline Accuracy
            int baseCorrect = 0;
            for (int i = 0; i < m; i++)
            {
                if (predictFunc(X[i]) == Y[i]) baseCorrect++;
            }
            float baseAccuracy = (float)baseCorrect / m;

            float[] rawDrops = new float[numFeatures];
            float totalDrop = 0f;

            System.Random rng = new System.Random(1337);

            // 2. Permute each feature column independently
            for (int j = 0; j < numFeatures; j++)
            {
                // Create copy of X with column j shuffled (Fisher-Yates)
                float[] colValues = new float[m];
                for (int i = 0; i < m; i++) colValues[i] = X[i][j];

                for (int i = m - 1; i > 0; i--)
                {
                    int k = rng.Next(i + 1);
                    float temp = colValues[i];
                    colValues[i] = colValues[k];
                    colValues[k] = temp;
                }

                int permCorrect = 0;
                for (int i = 0; i < m; i++)
                {
                    float[] permRow = new float[numFeatures];
                    for (int f = 0; f < numFeatures; f++)
                    {
                        permRow[f] = (f == j) ? colValues[i] : X[i][f];
                    }

                    if (predictFunc(permRow) == Y[i]) permCorrect++;
                }

                float permAccuracy = (float)permCorrect / m;
                float drop = Mathf.Max(0f, baseAccuracy - permAccuracy);
                rawDrops[j] = drop;
                totalDrop += drop;
            }

            // 3. Normalize to Relative Percentages
            for (int j = 0; j < numFeatures; j++)
            {
                float relative = totalDrop > 1e-6f ? (rawDrops[j] / totalDrop) * 100f : (100f / numFeatures);
                results.Add(new FeatureImportanceScore
                {
                    featureName = featureNames[j],
                    featureIndex = j,
                    rawDrop = rawDrops[j],
                    relativePercent = relative
                });
            }

            // Sort by highest importance
            results.Sort((a, b) => b.relativePercent.CompareTo(a.relativePercent));
            return results;
        }

        /// <summary>
        /// Traverses internal Decision Tree nodes and calculates exact Mean Decrease in Impurity (MDI)
        /// per-split attribution.
        /// </summary>
        public static List<TreeSplitContribution> ComputeTreeSplitContributions(DecisionTreeNode root)
        {
            var list = new List<TreeSplitContribution>();
            if (root == null) return list;

            float totalImpurityDrop = 0f;

            void TraverseNode(DecisionTreeNode node)
            {
                if (node == null || node.isLeaf || node.isPruned || node.leftChild == null || node.rightChild == null) return;

                int N = node.samplesCount;
                int NL = node.leftChild.samplesCount;
                int NR = node.rightChild.samplesCount;

                float impBefore = node.impurity;
                float impAfter = ((float)NL / N) * node.leftChild.impurity + ((float)NR / N) * node.rightChild.impurity;
                float drop = Mathf.Max(0f, impBefore - impAfter) * N;

                totalImpurityDrop += drop;

                list.Add(new TreeSplitContribution
                {
                    nodeId = node.nodeId,
                    depth = node.depth,
                    condition = $"x{node.splitFeatureIndex + 1} ≤ {node.threshold:F2}",
                    impurityBefore = impBefore,
                    impurityAfter = impAfter,
                    impurityDrop = drop,
                    sampleCount = N
                });

                TraverseNode(node.leftChild);
                TraverseNode(node.rightChild);
            }

            TraverseNode(root);

            // Compute relative percentage contributions
            for (int i = 0; i < list.Count; i++)
            {
                var item = list[i];
                item.contributionPercent = totalImpurityDrop > 1e-6f ? (item.impurityDrop / totalImpurityDrop) * 100f : 0f;
                list[i] = item;
            }

            return list;
        }

        /// <summary>
        /// Computes Pearson Correlation Coefficient r in [-1.0, 1.0].
        /// </summary>
        public static float ComputePearsonCorrelation(float[] X, float[] Y)
        {
            if (X == null || Y == null || X.Length != Y.Length || X.Length == 0) return 0f;

            int n = X.Length;
            float sumX = 0f, sumY = 0f;
            for (int i = 0; i < n; i++) { sumX += X[i]; sumY += Y[i]; }

            float meanX = sumX / n;
            float meanY = sumY / n;

            float numer = 0f, denomX = 0f, denomY = 0f;
            for (int i = 0; i < n; i++)
            {
                float dx = X[i] - meanX;
                float dy = Y[i] - meanY;
                numer += dx * dy;
                denomX += dx * dx;
                denomY += dy * dy;
            }

            float denom = Mathf.Sqrt(denomX * denomY);
            return denom > 1e-7f ? numer / denom : 0f;
        }

        [Serializable]
        public struct ROCCurvePoint
        {
            public float falsePositiveRate;
            public float truePositiveRate;
            public float threshold;
        }

        /// <summary>
        /// Generates Receiver Operating Characteristic (ROC) curve coordinates and computes AUC.
        /// </summary>
        public static (List<ROCCurvePoint> points, float auc) ComputeROCCurve(float[] probabilities, int[] trueLabels, int numThresholds = 50)
        {
            var points = new List<ROCCurvePoint>();
            if (probabilities == null || trueLabels == null || probabilities.Length == 0)
            {
                return (points, 0.5f);
            }

            int P = 0, N = 0;
            for (int i = 0; i < trueLabels.Length; i++)
            {
                if (trueLabels[i] == 1) P++;
                else N++;
            }

            if (P == 0 || N == 0) return (points, 0.5f);

            for (int s = 0; s <= numThresholds; s++)
            {
                float threshold = (float)s / numThresholds;
                int tp = 0, fp = 0;

                for (int i = 0; i < probabilities.Length; i++)
                {
                    bool pred = probabilities[i] >= threshold;
                    if (pred && trueLabels[i] == 1) tp++;
                    else if (pred && trueLabels[i] == 0) fp++;
                }

                float tpr = (float)tp / P;
                float fpr = (float)fp / N;

                points.Add(new ROCCurvePoint
                {
                    falsePositiveRate = fpr,
                    truePositiveRate = tpr,
                    threshold = threshold
                });
            }

            // Sort points by FPR ascending for trapezoidal integration
            points.Sort((a, b) => a.falsePositiveRate.CompareTo(b.falsePositiveRate));

            // Numerical integration via Trapezoidal Rule: AUC = sum 0.5 * (FPR[i] - FPR[i-1]) * (TPR[i] + TPR[i-1])
            float auc = 0f;
            for (int i = 1; i < points.Count; i++)
            {
                float dFpr = points[i].falsePositiveRate - points[i - 1].falsePositiveRate;
                float avgTpr = (points[i].truePositiveRate + points[i - 1].truePositiveRate) * 0.5f;
                auc += dFpr * avgTpr;
            }

            auc = Mathf.Clamp01(Mathf.Abs(auc));
            return (points, auc);
        }
    }
}
