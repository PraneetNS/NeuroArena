using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.ML
{
    [Serializable]
    public class DecisionTreeNode
    {
        public int nodeId;
        public int depth;
        public bool isLeaf;
        public int splitFeatureIndex; // 0 for X1, 1 for X2
        public float threshold;
        public float impurity;        // Gini or Entropy value
        public int samplesCount;
        public int[] classCounts;     // Count of samples in each class
        public int predictedClass;
        public bool isPruned;         // Player manual pruning flag

        public DecisionTreeNode leftChild;  // Feature <= threshold
        public DecisionTreeNode rightChild; // Feature > threshold

        public DecisionTreeNode(int id, int depth, int samples, int[] counts, float imp)
        {
            this.nodeId = id;
            this.depth = depth;
            this.samplesCount = samples;
            this.classCounts = counts != null ? (int[])counts.Clone() : new int[3];
            this.impurity = imp;
            this.isLeaf = true;
            this.isPruned = false;

            // Majority voting for predicted class
            int maxCount = -1;
            predictedClass = 0;
            if (counts != null)
            {
                for (int i = 0; i < counts.Length; i++)
                {
                    if (counts[i] > maxCount)
                    {
                        maxCount = counts[i];
                        predictedClass = i;
                    }
                }
            }
        }

        public int Predict(float[] sample)
        {
            if (isLeaf || isPruned || leftChild == null || rightChild == null)
            {
                return predictedClass;
            }

            float val = (splitFeatureIndex < sample.Length) ? sample[splitFeatureIndex] : 0f;
            if (val <= threshold)
            {
                return leftChild.Predict(sample);
            }
            else
            {
                return rightChild.Predict(sample);
            }
        }

        public int CountAllNodes()
        {
            if (isLeaf || isPruned || leftChild == null || rightChild == null) return 1;
            return 1 + leftChild.CountAllNodes() + rightChild.CountAllNodes();
        }

        public int CountLeaves()
        {
            if (isLeaf || isPruned || leftChild == null || rightChild == null) return 1;
            return leftChild.CountLeaves() + rightChild.CountLeaves();
        }

        public int GetMaxDepth()
        {
            if (isLeaf || isPruned || leftChild == null || rightChild == null) return depth;
            return Math.Max(leftChild.GetMaxDepth(), rightChild.GetMaxDepth());
        }

        public DecisionTreeNode FindNode(int id)
        {
            if (nodeId == id) return this;
            if (leftChild != null)
            {
                DecisionTreeNode found = leftChild.FindNode(id);
                if (found != null) return found;
            }
            if (rightChild != null)
            {
                DecisionTreeNode found = rightChild.FindNode(id);
                if (found != null) return found;
            }
            return null;
        }
    }
}
