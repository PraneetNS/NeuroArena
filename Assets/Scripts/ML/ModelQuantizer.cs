using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.ML
{
    /// <summary>
    /// Precision mode for neural network weight quantization.
    /// </summary>
    public enum QuantizationPrecision
    {
        FP32,
        FP16,
        INT8,
        INT4
    }

    /// <summary>
    /// Pruning strategy for neural model compression.
    /// </summary>
    public enum PruningStrategy
    {
        None,
        MagnitudeL1,
        StructuredColumn,
        RandomSparse
    }

    /// <summary>
    /// Production-grade model quantization and pruning engine for NeuroArena runtime.
    /// Reduces memory footprint by up to 75% and accelerates edge forward passes.
    /// </summary>
    public static class ModelQuantizer
    {
        [Serializable]
        public struct QuantizedWeights
        {
            public byte[] PackedData;
            public float Scale;
            public float ZeroPoint;
            public int OriginalLength;
            public QuantizationPrecision Precision;
            public float SparsityRatio;
        }

        [Serializable]
        public struct CompressionMetrics
        {
            public int OriginalBytes;
            public int CompressedBytes;
            public float CompressionRatio;
            public float SparsityPercent;
            public float MeanSquaredError;
            public float MaxAbsoluteError;
        }

        /// <summary>
        /// Quantizes a 32-bit floating point weight array to INT8 with scale and zero-point calibration.
        /// </summary>
        public static QuantizedWeights QuantizeToInt8(float[] weights, float clipPercentile = 0.999f)
        {
            if (weights == null || weights.Length == 0)
                throw new ArgumentException("Weights array cannot be null or empty.");

            float minVal = float.MaxValue;
            float maxVal = float.MinValue;

            for (int i = 0; i < weights.Length; i++)
            {
                if (float.IsNaN(weights[i]) || float.IsInfinity(weights[i]))
                    continue;
                if (weights[i] < minVal) minVal = weights[i];
                if (weights[i] > maxVal) maxVal = weights[i];
            }

            // Guard against zero-range
            if (Mathf.Approximately(minVal, maxVal))
            {
                maxVal = minVal + 1e-4f;
            }

            // Symmetric quantization around 0
            float maxAbs = Mathf.Max(Mathf.Abs(minVal), Mathf.Abs(maxVal)) * clipPercentile;
            if (maxAbs < 1e-6f) maxAbs = 1e-6f;

            float scale = maxAbs / 127.0f;
            float zeroPoint = 0f;

            byte[] packed = new byte[weights.Length];
            int zeroCount = 0;

            for (int i = 0; i < weights.Length; i++)
            {
                float clamped = Mathf.Clamp(weights[i], -maxAbs, maxAbs);
                sbyte qVal = (sbyte)Mathf.Round(clamped / scale);
                packed[i] = (byte)qVal;
                if (qVal == 0) zeroCount++;
            }

            return new QuantizedWeights
            {
                PackedData = packed,
                Scale = scale,
                ZeroPoint = zeroPoint,
                OriginalLength = weights.Length,
                Precision = QuantizationPrecision.INT8,
                SparsityRatio = (float)zeroCount / weights.Length
            };
        }

        /// <summary>
        /// Dequantizes INT8 packed weights back to 32-bit floating point for inference.
        /// </summary>
        public static float[] DequantizeFromInt8(QuantizedWeights quantized)
        {
            if (quantized.PackedData == null)
                throw new ArgumentException("Quantized data is null.");

            float[] restored = new float[quantized.OriginalLength];
            for (int i = 0; i < quantized.OriginalLength; i++)
            {
                sbyte raw = (sbyte)quantized.PackedData[i];
                restored[i] = raw * quantized.Scale;
            }

            return restored;
        }

        /// <summary>
        /// Applies magnitude-based pruning by zeroing out the bottom percentile of weights.
        /// </summary>
        public static float[] PruneMagnitude(float[] weights, float targetSparsity = 0.3f)
        {
            if (weights == null || weights.Length == 0) return weights;
            if (targetSparsity <= 0f) return (float[])weights.Clone();
            if (targetSparsity >= 1f) targetSparsity = 0.95f;

            float[] result = (float[])weights.Clone();
            float[] absWeights = new float[weights.Length];

            for (int i = 0; i < weights.Length; i++)
            {
                absWeights[i] = Mathf.Abs(weights[i]);
            }

            Array.Sort(absWeights);
            int thresholdIndex = (int)(absWeights.Length * targetSparsity);
            float threshold = absWeights[Mathf.Clamp(thresholdIndex, 0, absWeights.Length - 1)];

            for (int i = 0; i < result.Length; i++)
            {
                if (Mathf.Abs(result[i]) <= threshold)
                {
                    result[i] = 0f;
                }
            }

            return result;
        }

        /// <summary>
        /// Computes comprehensive compression and accuracy loss metrics.
        /// </summary>
        public static CompressionMetrics EvaluateCompression(float[] original, float[] reconstructed, QuantizationPrecision precision)
        {
            int originalBytes = original.Length * sizeof(float);
            int bytesPerWeight = precision == QuantizationPrecision.INT8 ? 1 : (precision == QuantizationPrecision.FP16 ? 2 : 4);
            int compressedBytes = original.Length * bytesPerWeight + sizeof(float) * 2; // + scale, zeroPoint

            float sumSqErr = 0f;
            float maxAbsErr = 0f;
            int zeroCount = 0;

            for (int i = 0; i < original.Length; i++)
            {
                float diff = Mathf.Abs(original[i] - reconstructed[i]);
                sumSqErr += diff * diff;
                if (diff > maxAbsErr) maxAbsErr = diff;
                if (Mathf.Approximately(reconstructed[i], 0f)) zeroCount++;
            }

            return new CompressionMetrics
            {
                OriginalBytes = originalBytes,
                CompressedBytes = compressedBytes,
                CompressionRatio = (float)originalBytes / compressedBytes,
                SparsityPercent = ((float)zeroCount / original.Length) * 100f,
                MeanSquaredError = sumSqErr / original.Length,
                MaxAbsoluteError = maxAbsErr
            };
        }
    }
}
