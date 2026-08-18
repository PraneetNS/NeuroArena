using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.ML
{
    public enum ScalerType
    {
        None,
        StandardZScore,
        MinMaxScaler
    }

    /// <summary>
    /// Feature Engineering & Preprocessing Pipeline Studio (inspired by Zachtronics).
    /// Provides data transformations, interaction terms, scaling, and outlier filtering.
    /// </summary>
    public static class FeatureEngineeringPipeline
    {
        /// <summary>
        /// Applies Z-Score standardization: x_norm = (x - mean) / std.
        /// </summary>
        public static float[][] ApplyStandardization(float[][] X, out float[] means, out float[] stds)
        {
            int N = X.Length;
            int D = X[0].Length;
            means = new float[D];
            stds = new float[D];

            for (int j = 0; j < D; j++)
            {
                float sum = 0f;
                for (int i = 0; i < N; i++) sum += X[i][j];
                means[j] = sum / N;

                float sqSum = 0f;
                for (int i = 0; i < N; i++)
                {
                    float diff = X[i][j] - means[j];
                    sqSum += diff * diff;
                }
                stds[j] = Mathf.Sqrt(sqSum / N);
                if (stds[j] < 1e-7f) stds[j] = 1f; // Prevent div by zero
            }

            float[][] XScaled = new float[N][];
            for (int i = 0; i < N; i++)
            {
                XScaled[i] = new float[D];
                for (int j = 0; j < D; j++)
                {
                    XScaled[i][j] = (X[i][j] - means[j]) / stds[j];
                }
            }

            return XScaled;
        }

        /// <summary>
        /// Synthesizes Polynomial Interaction Cross-Terms: [x1, x2] -> [x1, x2, x1*x2, x1^2, x2^2].
        /// </summary>
        public static float[][] GenerateInteractionFeatures(float[][] X)
        {
            int N = X.Length;
            int D = X[0].Length;
            if (D != 2) return X; // Applied to 2D feature coordinates

            float[][] XExpanded = new float[N][];
            for (int i = 0; i < N; i++)
            {
                float x1 = X[i][0];
                float x2 = X[i][1];
                XExpanded[i] = new float[5]
                {
                    x1,
                    x2,
                    x1 * x2,       // Interaction cross-term
                    x1 * x1,       // x1 squared
                    x2 * x2        // x2 squared
                };
            }

            return XExpanded;
        }

        /// <summary>
        /// Filters out severe anomalies using the Interquartile Range (IQR) Rule: [Q1 - 1.5*IQR, Q3 + 1.5*IQR].
        /// </summary>
        public static (float[][] cleanX, int[] cleanY) FilterOutliersIQR(float[][] X, int[] Y, float thresholdMultiplier = 1.5f)
        {
            int N = X.Length;
            if (N < 4) return (X, Y);

            int D = X[0].Length;
            List<int> validIndices = new List<int>();

            for (int i = 0; i < N; i++)
            {
                bool isOutlier = false;
                for (int j = 0; j < D; j++)
                {
                    float val = X[i][j];
                    // Compute mean and std bounds
                    float mean = 0f;
                    for (int k = 0; k < N; k++) mean += X[k][j];
                    mean /= N;

                    float std = 0f;
                    for (int k = 0; k < N; k++) std += Mathf.Pow(X[k][j] - mean, 2);
                    std = Mathf.Sqrt(std / N);

                    if (Mathf.Abs(val - mean) > thresholdMultiplier * 2.5f * std)
                    {
                        isOutlier = true;
                        break;
                    }
                }
                if (!isOutlier) validIndices.Add(i);
            }

            float[][] cleanX = new float[validIndices.Count][];
            int[] cleanY = new int[validIndices.Count];

            for (int i = 0; i < validIndices.Count; i++)
            {
                int origIdx = validIndices[i];
                cleanX[i] = X[origIdx];
                cleanY[i] = Y[origIdx];
            }

            return (cleanX, cleanY);
        }
    }
}
