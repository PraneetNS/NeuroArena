/**
 * ModelQuantizer.js
 * High-performance neural model quantization and sparse weight pruning engine.
 * Supports symmetric INT8 quantization, magnitude-based pruning, and delta metrics.
 */

'use strict';

class ModelQuantizer {
  /**
   * Quantize an array of FP32 weights to symmetric INT8.
   * @param {number[]} weights - Float32 weights
   * @param {number} clipPercentile - Percentile clipping (default: 0.999)
   * @returns {{ packed: Int8Array, scale: number, zeroPoint: number, originalLength: number, sparsity: number }}
   */
  static quantizeToInt8(weights, clipPercentile = 0.999) {
    if (!weights || weights.length === 0) {
      throw new Error('Weights array cannot be empty');
    }

    let minVal = Infinity;
    let maxVal = -Infinity;

    for (let i = 0; i < weights.length; i++) {
      const val = weights[i];
      if (isNaN(val) || !isFinite(val)) continue;
      if (val < minVal) minVal = val;
      if (val > maxVal) maxVal = val;
    }

    if (Math.abs(maxVal - minVal) < 1e-6) {
      maxVal = minVal + 1e-4;
    }

    const maxAbs = Math.max(Math.abs(minVal), Math.abs(maxVal)) * clipPercentile;
    const effectiveMax = Math.max(maxAbs, 1e-6);
    const scale = effectiveMax / 127.0;
    const zeroPoint = 0;

    const packed = new Int8Array(weights.length);
    let zeroCount = 0;

    for (let i = 0; i < weights.length; i++) {
      const clamped = Math.max(-effectiveMax, Math.min(effectiveMax, weights[i]));
      const qVal = Math.round(clamped / scale);
      packed[i] = qVal;
      if (qVal === 0) zeroCount++;
    }

    return {
      packed: Array.from(packed),
      scale,
      zeroPoint,
      originalLength: weights.length,
      precision: 'INT8',
      sparsity: zeroCount / weights.length
    };
  }

  /**
   * Dequantize INT8 representation back to FP32.
   * @param {{ packed: number[]|Int8Array, scale: number, originalLength: number }} quantized 
   * @returns {number[]}
   */
  static dequantizeFromInt8(quantized) {
    if (!quantized || !quantized.packed) {
      throw new Error('Invalid quantized payload');
    }

    const restored = new Float32Array(quantized.originalLength);
    const scale = quantized.scale;

    for (let i = 0; i < quantized.originalLength; i++) {
      restored[i] = quantized.packed[i] * scale;
    }

    return Array.from(restored);
  }

  /**
   * Prune weights based on L1 magnitude threshold.
   * @param {number[]} weights 
   * @param {number} targetSparsity (0.0 - 0.95)
   * @returns {number[]}
   */
  static pruneMagnitude(weights, targetSparsity = 0.3) {
    if (!weights || weights.length === 0) return weights || [];
    if (targetSparsity <= 0) return [...weights];
    const clampedSparsity = Math.min(targetSparsity, 0.95);

    const sortedAbs = weights.map(w => Math.abs(w)).sort((a, b) => a - b);
    const thresholdIdx = Math.floor(sortedAbs.length * clampedSparsity);
    const threshold = sortedAbs[Math.min(thresholdIdx, sortedAbs.length - 1)];

    return weights.map(w => Math.abs(w) <= threshold ? 0 : w);
  }

  /**
   * Calculate compression ratio, mean squared error, and max absolute error.
   */
  static evaluateMetrics(original, reconstructed) {
    let sumSqErr = 0;
    let maxAbsErr = 0;
    let zeros = 0;

    for (let i = 0; i < original.length; i++) {
      const diff = Math.abs(original[i] - reconstructed[i]);
      sumSqErr += diff * diff;
      if (diff > maxAbsErr) maxAbsErr = diff;
      if (Math.abs(reconstructed[i]) < 1e-6) zeros++;
    }

    const originalBytes = original.length * 4;
    const compressedBytes = original.length * 1 + 8; // 1 byte per int8 + 8 bytes header

    return {
      originalBytes,
      compressedBytes,
      compressionRatio: Number((originalBytes / compressedBytes).toFixed(2)),
      sparsityPercent: Number(((zeros / original.length) * 100).toFixed(2)),
      meanSquaredError: sumSqErr / original.length,
      maxAbsoluteError: maxAbsErr
    };
  }
}

module.exports = ModelQuantizer;
