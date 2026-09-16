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

        /// <summary>
        /// Scales features linearly into a specified target range [targetMin, targetMax] (default [0, 1]).
        /// </summary>
        public static float[][] ApplyMinMaxScaling(float[][] X, out float[] mins, out float[] maxs, float targetMin = 0f, float targetMax = 1f)
        {
            int N = X.Length;
            int D = X[0].Length;
            mins = new float[D];
            maxs = new float[D];

            for (int j = 0; j < D; j++)
            {
                mins[j] = float.MaxValue;
                maxs[j] = float.MinValue;
                for (int i = 0; i < N; i++)
                {
                    if (X[i][j] < mins[j]) mins[j] = X[i][j];
                    if (X[i][j] > maxs[j]) maxs[j] = X[i][j];
                }
                if (Mathf.Abs(maxs[j] - mins[j]) < 1e-7f)
                {
                    maxs[j] = mins[j] + 1.0f; // Prevent division by zero
                }
            }

            float[][] XScaled = new float[N][];
            float rangeSpan = targetMax - targetMin;
            for (int i = 0; i < N; i++)
            {
                XScaled[i] = new float[D];
                for (int j = 0; j < D; j++)
                {
                    float normalized = (X[i][j] - mins[j]) / (maxs[j] - mins[j]);
                    XScaled[i][j] = targetMin + normalized * rangeSpan;
                }
            }

            return XScaled;
        }

        /// <summary>
        /// Applies log1p non-linear transformation ln(1 + |x|) * sign(x) to compress heavy-tailed feature distributions.
        /// </summary>
        public static float[][] ApplyLog1pTransform(float[][] X)
        {
            int N = X.Length;
            int D = X[0].Length;
            float[][] XTransformed = new float[N][];

            for (int i = 0; i < N; i++)
            {
                XTransformed[i] = new float[D];
                for (int j = 0; j < D; j++)
                {
                    float val = X[i][j];
                    float sign = Mathf.Sign(val);
                    XTransformed[i][j] = sign * Mathf.Log(1f + Mathf.Abs(val));
                }
            }

            return XTransformed;
        }

        /// <summary>
        /// Computes Pearson correlation matrix between feature columns to detect multicollinearity.
        /// </summary>
        public static float[,] CalculateFeatureCorrelations(float[][] X)
        {
            int N = X.Length;
            int D = X[0].Length;
            float[,] correlationMatrix = new float[D, D];

            float[] means = new float[D];
            float[] stds = new float[D];
            ApplyStandardization(X, out means, out stds);

            for (int a = 0; a < D; a++)
            {
                correlationMatrix[a, a] = 1f;
                for (int b = a + 1; b < D; b++)
                {
                    float cov = 0f;
                    for (int i = 0; i < N; i++)
                    {
                        cov += (X[i][a] - means[a]) * (X[i][b] - means[b]);
                    }
                    float r = cov / (N * stds[a] * stds[b]);
                    correlationMatrix[a, b] = Mathf.Clamp(r, -1f, 1f);
                    correlationMatrix[b, a] = correlationMatrix[a, b];
                }
            }

            return correlationMatrix;
        }
    }
}
