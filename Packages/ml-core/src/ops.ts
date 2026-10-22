/**
 * Float64 mathematical operations and hand-derived analytical backward gradients
 * for fixed Transformer architecture.
 */

const SQRT_2_OVER_PI = Math.sqrt(2.0 / Math.PI);

/**
 * 2D Matrix Multiplication: C = A * B
 * A: [M, K], B: [K, N], C: [M, N]
 */
export function matmul(
  A: Float64Array,
  B: Float64Array,
  C: Float64Array,
  M: number,
  K: number,
  N: number
): void {
  C.fill(0);
  for (let i = 0; i < M; i++) {
    const iK = i * K;
    const iN = i * N;
    for (let k = 0; k < K; k++) {
      const aVal = A[iK + k];
      if (aVal === 0) continue;
      const kN = k * N;
      for (let j = 0; j < N; j++) {
        C[iN + j] += aVal * B[kN + j];
      }
    }
  }
}

/**
 * Analytical backward pass for 2D Matrix Multiplication:
 * dA += dC * B^T
 * dB += A^T * dC
 */
export function matmulBackward(
  dC: Float64Array,
  A: Float64Array,
  B: Float64Array,
  dA: Float64Array,
  dB: Float64Array,
  M: number,
  K: number,
  N: number
): void {
  // dA += dC * B^T (dC is [M, N], B^T is [N, K], dA is [M, K])
  for (let i = 0; i < M; i++) {
    const iN = i * N;
    const iK = i * K;
    for (let j = 0; j < N; j++) {
      const dcVal = dC[iN + j];
      if (dcVal === 0) continue;
      for (let k = 0; k < K; k++) {
        dA[iK + k] += dcVal * B[k * N + j];
      }
    }
  }

  // dB += A^T * dC (A^T is [K, M], dC is [M, N], dB is [K, N])
  for (let k = 0; k < K; k++) {
    const kN = k * N;
    for (let i = 0; i < M; i++) {
      const aVal = A[i * K + k];
      if (aVal === 0) continue;
      const iN = i * N;
      for (let j = 0; j < N; j++) {
        dB[kN + j] += aVal * dC[iN + j];
      }
    }
  }
}

/**
 * Row-wise Bias Addition: Y[m, n] = X[m, n] + bias[n]
 */
export function addBias(
  X: Float64Array,
  bias: Float64Array,
  out: Float64Array,
  M: number,
  N: number
): void {
  for (let i = 0; i < M; i++) {
    const iN = i * N;
    for (let j = 0; j < N; j++) {
      out[iN + j] = X[iN + j] + bias[j];
    }
  }
}

/**
 * Bias Backward pass:
 * dX += dY
 * dBias[n] += sum_m dY[m, n]
 */
export function addBiasBackward(
  dY: Float64Array,
  dX: Float64Array,
  dBias: Float64Array,
  M: number,
  N: number
): void {
  for (let i = 0; i < M; i++) {
    const iN = i * N;
    for (let j = 0; j < N; j++) {
      const val = dY[iN + j];
      dX[iN + j] += val;
      dBias[j] += val;
    }
  }
}

/**
 * Layer Normalization forward pass
 * X: [M, D], gamma: [D], beta: [D] -> out: [M, D]
 */
export function layerNorm(
  X: Float64Array,
  gamma: Float64Array,
  beta: Float64Array,
  out: Float64Array,
  meanOut: Float64Array,
  rstdOut: Float64Array,
  M: number,
  D: number,
  eps = 1e-5
): void {
  for (let i = 0; i < M; i++) {
    const iD = i * D;
    let sum = 0;
    for (let j = 0; j < D; j++) {
      sum += X[iD + j];
    }
    const mean = sum / D;
    meanOut[i] = mean;

    let varSum = 0;
    for (let j = 0; j < D; j++) {
      const diff = X[iD + j] - mean;
      varSum += diff * diff;
    }
    const variance = varSum / D;
    const rstd = 1.0 / Math.sqrt(variance + eps);
    rstdOut[i] = rstd;

    for (let j = 0; j < D; j++) {
      const xNorm = (X[iD + j] - mean) * rstd;
      out[iD + j] = xNorm * gamma[j] + beta[j];
    }
  }
}

/**
 * Exact analytical Layer Normalization backward pass
 */
export function layerNormBackward(
  dY: Float64Array,
  X: Float64Array,
  gamma: Float64Array,
  mean: Float64Array,
  rstd: Float64Array,
  dX: Float64Array,
  dGamma: Float64Array,
  dBeta: Float64Array,
  M: number,
  D: number
): void {
  const invD = 1.0 / D;

  for (let i = 0; i < M; i++) {
    const iD = i * D;
    const m = mean[i];
    const r = rstd[i];

    let sumDyGamma = 0;
    let sumDyGammaXhat = 0;

    for (let j = 0; j < D; j++) {
      const dy = dY[iD + j];
      const xHat = (X[iD + j] - m) * r;

      dGamma[j] += dy * xHat;
      dBeta[j] += dy;

      const dyGamma = dy * gamma[j];
      sumDyGamma += dyGamma;
      sumDyGammaXhat += dyGamma * xHat;
    }

    const meanDyGamma = sumDyGamma * invD;
    const meanDyGammaXhat = sumDyGammaXhat * invD;

    for (let j = 0; j < D; j++) {
      const dyGamma = dY[iD + j] * gamma[j];
      const xHat = (X[iD + j] - m) * r;
      dX[iD + j] += r * (dyGamma - meanDyGamma - xHat * meanDyGammaXhat);
    }
  }
}

/**
 * GELU activation (tanh approximation):
 * 0.5 * x * (1 + tanh(sqrt(2/pi) * (x + 0.044715 * x^3)))
 */
export function gelu(x: number): number {
  const x3 = x * x * x;
  const inner = SQRT_2_OVER_PI * (x + 0.044715 * x3);
  return 0.5 * x * (1.0 + Math.tanh(inner));
}

export function geluArray(X: Float64Array, out: Float64Array, len: number): void {
  for (let i = 0; i < len; i++) {
    out[i] = gelu(X[i]);
  }
}

/**
 * GELU backward pass
 */
export function geluBackward(
  dY: Float64Array,
  X: Float64Array,
  dX: Float64Array,
  len: number
): void {
  for (let i = 0; i < len; i++) {
    const x = X[i];
    const x2 = x * x;
    const x3 = x2 * x;
    const inner = SQRT_2_OVER_PI * (x + 0.044715 * x3);
    const tanhVal = Math.tanh(inner);
    const sech2 = 1.0 - tanhVal * tanhVal;
    const dInner = SQRT_2_OVER_PI * (1.0 + 3.0 * 0.044715 * x2);
    const grad = 0.5 * (1.0 + tanhVal) + 0.5 * x * sech2 * dInner;
    dX[i] += dY[i] * grad;
  }
}

/**
 * Batched Causal Multi-Head Self-Attention Forward Pass.
 * Q, K, V: [B, T, D] where D = H * headDim
 * out: [B, T, D]
 * attnWeights: [B, H, T, T] (saved for backward & inspection)
 */
export function causalAttention(
  Q: Float64Array,
  K: Float64Array,
  V: Float64Array,
  out: Float64Array,
  attnWeights: Float64Array,
  B: number,
  T: number,
  H: number,
  headDim: number
): void {
  const D = H * headDim;
  const scale = 1.0 / Math.sqrt(headDim);
  out.fill(0);
  attnWeights.fill(0);

  for (let b = 0; b < B; b++) {
    const bOffsetD = b * T * D;
    const bOffsetAttn = b * H * T * T;

    for (let h = 0; h < H; h++) {
      const hOffsetAttn = bOffsetAttn + h * T * T;
      const hDimOffset = h * headDim;

      for (let i = 0; i < T; i++) {
        const qOffset = bOffsetD + i * D + hDimOffset;
        const iAttnRow = hOffsetAttn + i * T;

        // Compute dot products with causal mask
        let maxVal = -Infinity;
        for (let j = 0; j <= i; j++) {
          const kOffset = bOffsetD + j * D + hDimOffset;
          let dot = 0;
          for (let d = 0; d < headDim; d++) {
            dot += Q[qOffset + d] * K[kOffset + d];
          }
          const scaled = dot * scale;
          attnWeights[iAttnRow + j] = scaled;
          if (scaled > maxVal) maxVal = scaled;
        }

        // Softmax normalization over causal prefix [0..i]
        let sumExp = 0;
        for (let j = 0; j <= i; j++) {
          const expVal = Math.exp(attnWeights[iAttnRow + j] - maxVal);
          attnWeights[iAttnRow + j] = expVal;
          sumExp += expVal;
        }
        const invSum = 1.0 / (sumExp || 1e-15);
        for (let j = 0; j <= i; j++) {
          attnWeights[iAttnRow + j] *= invSum;
        }

        // Context = Attn * V
        const outOffset = bOffsetD + i * D + hDimOffset;
        for (let d = 0; d < headDim; d++) {
          let cVal = 0;
          for (let j = 0; j <= i; j++) {
            const vOffset = bOffsetD + j * D + hDimOffset;
            cVal += attnWeights[iAttnRow + j] * V[vOffset + d];
          }
          out[outOffset + d] = cVal;
        }
      }
    }
  }
}

/**
 * Batched Causal Multi-Head Self-Attention Backward Pass.
 */
export function causalAttentionBackward(
  dOut: Float64Array,
  Q: Float64Array,
  K: Float64Array,
  V: Float64Array,
  attnWeights: Float64Array,
  dQ: Float64Array,
  dK: Float64Array,
  dV: Float64Array,
  B: number,
  T: number,
  H: number,
  headDim: number
): void {
  const D = H * headDim;
  const scale = 1.0 / Math.sqrt(headDim);

  for (let b = 0; b < B; b++) {
    const bOffsetD = b * T * D;
    const bOffsetAttn = b * H * T * T;

    for (let h = 0; h < H; h++) {
      const hOffsetAttn = bOffsetAttn + h * T * T;
      const hDimOffset = h * headDim;

      for (let i = 0; i < T; i++) {
        const iAttnRow = hOffsetAttn + i * T;
        const outOffset = bOffsetD + i * D + hDimOffset;

        // 1. Gradient into attention weights & V
        // out[i, d] = sum_{j<=i} attn[i, j] * V[j, d]
        let dotSum = 0;
        for (let j = 0; j <= i; j++) {
          const vOffset = bOffsetD + j * D + hDimOffset;
          let dAttnVal = 0;
          for (let d = 0; d < headDim; d++) {
            const dout = dOut[outOffset + d];
            dAttnVal += dout * V[vOffset + d];
            dV[vOffset + d] += dout * attnWeights[iAttnRow + j];
          }

          // Softmax intermediate sum
          dotSum += dAttnVal * attnWeights[iAttnRow + j];
          // Temporarily store dAttnVal in a local calculation
          // We apply softmax derivative directly below
        }

        // 2. Softmax backward & scaled dot product into dQ and dK
        const qOffset = bOffsetD + i * D + hDimOffset;
        for (let j = 0; j <= i; j++) {
          const vOffset = bOffsetD + j * D + hDimOffset;
          let dAttnVal = 0;
          for (let d = 0; d < headDim; d++) {
            dAttnVal += dOut[outOffset + d] * V[vOffset + d];
          }

          const a = attnWeights[iAttnRow + j];
          const dScore = a * (dAttnVal - dotSum) * scale;

          const kOffset = bOffsetD + j * D + hDimOffset;
          for (let d = 0; d < headDim; d++) {
            dQ[qOffset + d] += dScore * K[kOffset + d];
            dK[kOffset + d] += dScore * Q[qOffset + d];
          }
        }
      }
    }
  }
}

/**
 * Cross-Entropy Loss and analytical gradient computation.
 * logits: [totalTokens, vocabSize], targets: [totalTokens]
 * returns mean cross-entropy loss and accumulates dLogits.
 */
export function crossEntropy(
  logits: Float64Array,
  targets: Uint16Array | number[],
  dLogits: Float64Array,
  totalTokens: number,
  vocabSize: number
): number {
  dLogits.fill(0);
  let totalLoss = 0;
  const invTotal = 1.0 / totalTokens;

  for (let i = 0; i < totalTokens; i++) {
    const iV = i * vocabSize;
    const target = targets[i];

    // Find max for numerical stability
    let maxVal = -Infinity;
    for (let v = 0; v < vocabSize; v++) {
      if (logits[iV + v] > maxVal) maxVal = logits[iV + v];
    }

    let sumExp = 0;
    for (let v = 0; v < vocabSize; v++) {
      sumExp += Math.exp(logits[iV + v] - maxVal);
    }

    const logSumExp = maxVal + Math.log(sumExp);
    const targetLogit = logits[iV + target];
    const loss = logSumExp - targetLogit;
    totalLoss += loss;

    // Gradient: (softmax_p - 1(v == target)) / totalTokens
    const invSum = 1.0 / sumExp;
    for (let v = 0; v < vocabSize; v++) {
      const prob = Math.exp(logits[iV + v] - maxVal) * invSum;
      const grad = (v === target ? prob - 1.0 : prob) * invTotal;
      dLogits[iV + v] = grad;
    }
  }

  return totalLoss * invTotal;
}
