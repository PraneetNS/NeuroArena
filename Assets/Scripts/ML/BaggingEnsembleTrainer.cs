using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.ML
{
    [Serializable]
    public struct BaggingPartyResult
    {
        public int numTrees;
        public List<DecisionTreeNode> partyRoots;
        public float[] individualAccuracies;
        public float ensembleTrainAccuracy;
        public float ensembleTestAccuracy;
        public float outOfBagError;
        public string partyTitle;
    }

    /// <summary>
    /// Pure C# Bootstrap Aggregation (Bagging) Ensemble Engine.
    /// Trains 5 small, diverse decision tree familiars ("Party Members") on bootstrapped subsets
    /// with replacement, aggregating predictions via majority vote.
    /// </summary>
    public static class BaggingEnsembleTrainer
    {
        public static BaggingPartyResult TrainParty(
            float[][] X,
            int[] Y,
            float[][] X_test,
            int[] Y_test,
            int numTrees = 5,
            int maxDepthPerTree = 3,
            int minSamplesSplit = 2)
        {
            int n = X.Length;
            var partyRoots = new List<DecisionTreeNode>();
            float[] individualAccs = new float[numTrees];
            System.Random rng = new System.Random(42);

            // 1. Train each tree on a distinct Bootstrap Sample
            for (int t = 0; t < numTrees; t++)
            {
                float[][] bootX = new float[n][];
                int[] bootY = new int[n];
                bool[] isInBag = new bool[n];

                // Sample N points WITH REPLACEMENT (~63.2% distinct)
                for (int i = 0; i < n; i++)
                {
                    int pick = rng.Next(n);
                    bootX[i] = X[pick];
                    bootY[i] = Y[pick];
                    isInBag[pick] = true;
                }

                // Train small diverse tree
                DecisionTreeResult singleResult = DecisionTreeTrainer.Train(
                    bootX, bootY, X_test, Y_test,
                    maxDepthPerTree, minSamplesSplit, "Gini"
                );

                partyRoots.Add(singleResult.root);
                individualAccs[t] = singleResult.valAccuracy;
            }

            // 2. Evaluate Ensemble Majority Vote on Training Data
            int trainCorrect = 0;
            for (int i = 0; i < n; i++)
            {
                if (PredictEnsemble(partyRoots, X[i]) == Y[i]) trainCorrect++;
            }
            float ensTrainAcc = (float)trainCorrect / n;

            // 3. Evaluate Ensemble Majority Vote on Held-Out Test Data
            float ensTestAcc = 0f;
            if (X_test != null && Y_test != null && X_test.Length > 0)
            {
                int testCorrect = 0;
                for (int i = 0; i < X_test.Length; i++)
                {
                    if (PredictEnsemble(partyRoots, X_test[i]) == Y_test[i]) testCorrect++;
                }
                ensTestAcc = (float)testCorrect / X_test.Length;
            }

            return new BaggingPartyResult
            {
                numTrees = numTrees,
                partyRoots = partyRoots,
                individualAccuracies = individualAccs,
                ensembleTrainAccuracy = ensTrainAcc,
                ensembleTestAccuracy = ensTestAcc,
                outOfBagError = 1f - ensTrainAcc,
                partyTitle = $"Summoned Party of {numTrees} Tree Familiars"
            };
        }

        public static int PredictEnsemble(List<DecisionTreeNode> party, float[] x)
        {
            if (party == null || party.Count == 0) return 0;

            Dictionary<int, int> votes = new Dictionary<int, int>();
            foreach (var tree in party)
            {
                if (tree == null) continue;
                int vote = tree.Predict(x);
                if (!votes.ContainsKey(vote)) votes[vote] = 0;
                votes[vote]++;
            }

            int bestClass = 0;
            int maxVotes = -1;
            foreach (var kvp in votes)
            {
                if (kvp.Value > maxVotes)
                {
                    maxVotes = kvp.Value;
                    bestClass = kvp.Key;
                }
            }
            return bestClass;
        }
    }
}
