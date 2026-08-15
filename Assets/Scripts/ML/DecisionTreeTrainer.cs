using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.ML
{
    [Serializable]
    public struct DecisionTreeResult
    {
        public DecisionTreeNode root;
        public float trainAccuracy;
        public float valAccuracy;
        public int totalNodes;
        public int totalLeaves;
        public int treeDepth;
        public string criterion;
        public int maxDepthConfig;
        public int minSamplesConfig;
        public bool isBossHydraPassed;

        public string GetSummary()
        {
            float overfitGap = Mathf.Max(0f, (trainAccuracy - valAccuracy) * 100f);
            return $"=== DECISION TREE REPORT ===\n" +
                   $"Splitting Criterion: {criterion} | Max Depth: {maxDepthConfig} | Min Split: {minSamplesConfig}\n" +
                   $"Nodes: {totalNodes} (Leaves: {totalLeaves}, Actual Depth: {treeDepth})\n" +
                   $"Train Accuracy: <b>{trainAccuracy * 100f:F1}%</b> | Val Accuracy: <b>{valAccuracy * 100f:F1}%</b>\n" +
                   $"Overfitting Gap: {overfitGap:F1}%\n" +
                   $"Boss Verdict: {(isBossHydraPassed ? "<color=#55FF55>DENDRITE HYDRA DEFEATED! PRUNED GENERALIZATION OPTIMAL</color>" : "<color=#FFCC00>ACCEPTABLE / OVERFITTING DETECTED (USE PRUNING SHEARS)</color>")}";
        }
    }

    /// <summary>
    /// Pure C# Decision Tree Classification Engine.
    /// Supports multi-class recursive binary partitioning using Gini Impurity or Information Gain (Entropy).
    /// </summary>
    public static class DecisionTreeTrainer
    {
        private static int nextNodeId = 1;

        public static DecisionTreeResult Train(
            float[][] Xtrain,
            int[] Ytrain,
            float[][] Xval,
            int[] Yval,
            int maxDepth,
            int minSamplesSplit,
            string criterion = "Gini",
            int numClasses = 3)
        {
            if (Xtrain == null || Ytrain == null || Xtrain.Length == 0)
            {
                Debug.LogWarning("[DecisionTreeTrainer] Empty dataset provided.");
                return default;
            }

            nextNodeId = 1;
            List<int> sampleIndices = new List<int>();
            for (int i = 0; i < Xtrain.Length; i++) sampleIndices.Add(i);

            DecisionTreeNode root = BuildRecursive(Xtrain, Ytrain, sampleIndices, 0, maxDepth, minSamplesSplit, criterion, numClasses);

            float trainAcc = EvaluateAccuracy(root, Xtrain, Ytrain);
            float valAcc = (Xval != null && Xval.Length > 0) ? EvaluateAccuracy(root, Xval, Yval) : trainAcc;

            int totalNodes = root.CountAllNodes();
            int totalLeaves = root.CountLeaves();
            int actualDepth = root.GetMaxDepth();

            // Boss Dendrite Hydra Condition: Val Accuracy >= 85% AND Overfitting Gap (TrainAcc - ValAcc) <= 12%
            bool isPassed = (valAcc >= 0.85f) && ((trainAcc - valAcc) <= 0.12f);

            return new DecisionTreeResult
            {
                root = root,
                trainAccuracy = trainAcc,
                valAccuracy = valAcc,
                totalNodes = totalNodes,
                totalLeaves = totalLeaves,
                treeDepth = actualDepth,
                criterion = criterion,
                maxDepthConfig = maxDepth,
                minSamplesConfig = minSamplesSplit,
                isBossHydraPassed = isPassed
            };
        }

        private static DecisionTreeNode BuildRecursive(
            float[][] X,
            int[] Y,
            List<int> indices,
            int currentDepth,
            int maxDepth,
            int minSamplesSplit,
            string criterion,
            int numClasses)
        {
            int n = indices.Count;
            int[] counts = GetClassCounts(Y, indices, numClasses);
            float currentImpurity = CalculateImpurity(counts, n, criterion);

            DecisionTreeNode node = new DecisionTreeNode(nextNodeId++, currentDepth, n, counts, currentImpurity);

            // Stopping conditions
            if (currentDepth >= maxDepth || n < minSamplesSplit || currentImpurity < 1e-4f)
            {
                node.isLeaf = true;
                return node;
            }

            // Find best split across all features
            int numFeatures = X[0].Length;
            int bestFeature = -1;
            float bestThreshold = 0f;
            float bestScore = -1f; // Best reduction in impurity
            List<int> bestLeft = null;
            List<int> bestRight = null;

            for (int f = 0; f < numFeatures; f++)
            {
                // Collect and sort unique feature values
                List<float> values = new List<float>();
                for (int i = 0; i < n; i++) values.Add(X[indices[i]][f]);
                values.Sort();

                for (int i = 0; i < values.Count - 1; i++)
                {
                    if (Mathf.Approximately(values[i], values[i + 1])) continue;

                    float thresh = (values[i] + values[i + 1]) * 0.5f;

                    List<int> left = new List<int>();
                    List<int> right = new List<int>();

                    for (int k = 0; k < n; k++)
                    {
                        int idx = indices[k];
                        if (X[idx][f] <= thresh) left.Add(idx);
                        else right.Add(idx);
                    }

                    if (left.Count == 0 || right.Count == 0) continue;

                    int[] leftCounts = GetClassCounts(Y, left, numClasses);
                    int[] rightCounts = GetClassCounts(Y, right, numClasses);

                    float leftImp = CalculateImpurity(leftCounts, left.Count, criterion);
                    float rightImp = CalculateImpurity(rightCounts, right.Count, criterion);

                    float weightedImp = ((float)left.Count / n) * leftImp + ((float)right.Count / n) * rightImp;
                    float gain = currentImpurity - weightedImp;

                    if (gain > bestScore)
                    {
                        bestScore = gain;
                        bestFeature = f;
                        bestThreshold = thresh;
                        bestLeft = left;
                        bestRight = right;
                    }
                }
            }

            // If valid split found
            if (bestScore > 1e-4f && bestLeft != null && bestRight != null)
            {
                node.isLeaf = false;
                node.splitFeatureIndex = bestFeature;
                node.threshold = bestThreshold;
                node.leftChild = BuildRecursive(X, Y, bestLeft, currentDepth + 1, maxDepth, minSamplesSplit, criterion, numClasses);
                node.rightChild = BuildRecursive(X, Y, bestRight, currentDepth + 1, maxDepth, minSamplesSplit, criterion, numClasses);
            }
            else
            {
                node.isLeaf = true;
            }

            return node;
        }

        public static float CalculateImpurity(int[] counts, int totalSamples, string criterion)
        {
            if (totalSamples == 0) return 0f;

            if (criterion.Equals("Entropy", StringComparison.OrdinalIgnoreCase) || criterion.Equals("InformationGain", StringComparison.OrdinalIgnoreCase))
            {
                // Shannon Entropy: H = - sum(p * log2(p))
                float entropy = 0f;
                for (int i = 0; i < counts.Length; i++)
                {
                    if (counts[i] > 0)
                    {
                        float p = (float)counts[i] / totalSamples;
                        entropy -= p * (Mathf.Log(p) / Mathf.Log(2f));
                    }
                }
                return entropy;
            }
            else
            {
                // Gini Impurity: 1 - sum(p^2)
                float sumSq = 0f;
                for (int i = 0; i < counts.Length; i++)
                {
                    float p = (float)counts[i] / totalSamples;
                    sumSq += p * p;
                }
                return 1f - sumSq;
            }
        }

        private static int[] GetClassCounts(int[] Y, List<int> indices, int numClasses)
        {
            int[] counts = new int[numClasses];
            for (int i = 0; i < indices.Count; i++)
            {
                int c = Y[indices[i]];
                if (c >= 0 && c < numClasses) counts[c]++;
            }
            return counts;
        }

        public static float EvaluateAccuracy(DecisionTreeNode root, float[][] X, int[] Y)
        {
            if (root == null || X == null || Y == null || X.Length == 0) return 0f;
            int correct = 0;
            for (int i = 0; i < X.Length; i++)
            {
                int pred = root.Predict(X[i]);
                if (pred == Y[i]) correct++;
            }
            return (float)correct / X.Length;
        }

        public static void TogglePrune(DecisionTreeNode root, int nodeId)
        {
            if (root == null) return;
            DecisionTreeNode target = root.FindNode(nodeId);
            if (target != null && !target.isLeaf)
            {
                target.isPruned = !target.isPruned;
            }
        }
    }
}
