using System;
using UnityEngine;

namespace NeuroArena.Data
{
    public enum MLResourceType
    {
        // Biome 1: The Linear Steppes (Linear Regression)
        FeatureCrystal_X,       // Input feature x in R
        TargetShard_Y,          // Continuous ground truth target y in R
        PairedDataTuple,        // Coupled (x, y) training sample
        WeightResidue_W,        // Model parameter slope w
        BiasSpark_B,            // Model parameter offset b
        StepFluid_Alpha,        // Hyperparameter learning rate alpha

        // Biome 2: The Binary Marshlands (Logistic Regression & Classification)
        SigmoidMembrane_Sigma,  // Logistic activation membrane (maps R -> [0, 1])
        Class0_PurpleSpore,     // Discrete negative class label y = 0
        Class1_AzureSpore,      // Discrete positive class label y = 1
        CrossEntropyVial,       // Binary Cross-Entropy log loss reagent

        // Biome 3: The Variance Tundra (Overfitting, Bias/Variance & Regularization)
        TrainCore_Frost,        // Sheltered training data point D_train
        ValEcho_Snow,           // Out-of-distribution validation data point D_val
        L2_RidgeRune,           // L2 weight decay penalty (lambda * sum(w^2))
        L1_LassoRibbon,         // L1 sparsity penalty (lambda * sum(|w|))
        PolyCatalyst            // Polynomial degree expansion catalyst (x^d)
    }

    [Serializable]
    public struct DataPoint
    {
        public float x;
        public float y;
        public float timestamp;
        public string biomeSource;
        public bool isValidation;

        public DataPoint(float x, float y, string biome = "Linear Steppes", bool isVal = false)
        {
            this.x = x;
            this.y = y;
            this.timestamp = Time.time;
            this.biomeSource = biome;
            this.isValidation = isVal;
        }

        public override string ToString()
        {
            return $"({x:F2}, {y:F2}) [{(isValidation ? "VAL" : "TRAIN")}]";
        }
    }

    [Serializable]
    public struct ClassificationSample
    {
        public float x1;
        public float x2;
        public float labelY; // 0.0f or 1.0f
        public float timestamp;

        public ClassificationSample(float x1, float x2, float labelY)
        {
            this.x1 = x1;
            this.x2 = x2;
            this.labelY = labelY;
            this.timestamp = Time.time;
        }

        public override string ToString()
        {
            return $"x1: {x1:F2}, x2: {x2:F2} ➔ Class {(int)labelY}";
        }
    }

    [Serializable]
    public struct DatasetStatistics
    {
        public int sampleCount;
        public float minX;
        public float maxX;
        public float minY;
        public float maxY;
        public float meanX;
        public float stdDevX;
        public float meanY;
        public float stdDevY;
        public int class0Count;
        public int class1Count;
        public float class0Ratio;
        public float class1Ratio;
        public float pearsonR;
        public bool isClassification;

        public static DatasetStatistics Empty => new DatasetStatistics
        {
            sampleCount = 0,
            minX = 0f,
            maxX = 0f,
            minY = 0f,
            maxY = 0f,
            meanX = 0f,
            stdDevX = 0f,
            meanY = 0f,
            stdDevY = 0f,
            class0Count = 0,
            class1Count = 0,
            class0Ratio = 0f,
            class1Ratio = 0f,
            pearsonR = 0f,
            isClassification = false
        };
    }

    [Serializable]
    public struct DatasetHealthMetrics
    {
        public float healthScore;        // 0 to 100%
        public float balanceScore;       // 0 to 100% (class balance or residual symmetry)
        public float cleanlinessScore;   // 0 to 100% (absence of severe outliers)
        public float coverageScore;      // 0 to 100% (spatial breadth of feature domain)
        public int outlierCount;
        public string healthGrade;       // EXCELLENT, GOOD, FAIR, POOR
        public string primaryDefect;     // Summary diagnosis of defect
        public string expectedGeneralization; // Pre-training test performance forecast

        public static DatasetHealthMetrics Default => new DatasetHealthMetrics
        {
            healthScore = 100f,
            balanceScore = 100f,
            cleanlinessScore = 100f,
            coverageScore = 100f,
            outlierCount = 0,
            healthGrade = "EXCELLENT",
            primaryDefect = "No empirical samples collected yet.",
            expectedGeneralization = "Harvest at least 3 empirical tokens in the biome."
        };
    }

    [Serializable]
    public struct DatasetShiftMetrics
    {
        public string sourceBiomeA;
        public string sourceBiomeB;
        public float mixRatioA;          // e.g. 0.50 (50% A, 50% B)
        public float distributionDivergence; // Divergence distance between distribution parameters
        public string shiftCategory;     // Covariate Shift P(X), Concept Drift P(Y|X), Subpopulation Shift
        public float compromiseLoss;     // Training MSE on blended mixture
        public float lossOnDistributionA;// Evaluated on pure Held-Out A
        public float lossOnDistributionB;// Evaluated on pure Held-Out B
        public string pedagogicalExplanation; // Explanation of why model struggled
    }
}
