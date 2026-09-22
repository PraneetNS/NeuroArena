using System;
using System.Diagnostics;
using System.Threading.Tasks;
using UnityEngine;

namespace NeuroArena.ML.Benchmark
{
    [System.Serializable]
    public struct BenchmarkResult
    {
        public string BenchmarkName;
        public int Iterations;
        public int BatchSize;
        public int MatrixDim;
        public double ElapsedMilliseconds;
        public double P50LatencyMs;
        public double P95LatencyMs;
        public double P99LatencyMs;
        public double GFlops;
        public long AllocatedBytes;
        public bool PassedSanityCheck;
    }

    public static class MLInferenceBenchmark
    {
        public static BenchmarkResult RunDenseLayerBenchmark(int inputDim = 256, int outputDim = 256, int batchSize = 32, int iterations = 500)
        {
            float[,] weights = new float[outputDim, inputDim];
            float[] bias = new float[outputDim];
            float[,] inputs = new float[batchSize, inputDim];
            float[,] outputs = new float[batchSize, outputDim];

            // Initialize test tensors
            System.Random rand = new System.Random(42);
            for (int i = 0; i < outputDim; i++)
            {
                bias[i] = (float)rand.NextDouble() * 0.1f;
                for (int j = 0; j < inputDim; j++)
                    weights[i, j] = (float)(rand.NextDouble() - 0.5) * 0.2f;
            }
            for (int b = 0; b < batchSize; b++)
            {
                for (int j = 0; j < inputDim; j++)
                    inputs[b, j] = (float)rand.NextDouble();
            }

            double[] latencies = new double[iterations];
            long memBefore = GC.GetTotalMemory(true);
            Stopwatch swTotal = Stopwatch.StartNew();

            for (int it = 0; it < iterations; it++)
            {
                Stopwatch swIter = Stopwatch.StartNew();

                // Vectorized Matrix Multiply + Bias + ReLU Activation
                Parallel.For(0, batchSize, b =>
                {
                    for (int o = 0; o < outputDim; o++)
                    {
                        float sum = bias[o];
                        for (int k = 0; k < inputDim; k++)
                        {
                            sum += inputs[b, k] * weights[o, k];
                        }
                        outputs[b, o] = sum > 0f ? sum : 0f; // ReLU
                    }
                });

                swIter.Stop();
                latencies[it] = swIter.Elapsed.TotalMilliseconds;
            }

            swTotal.Stop();
            long memAfter = GC.GetTotalMemory(false);

            Array.Sort(latencies);
            double p50 = latencies[(int)(iterations * 0.50)];
            double p95 = latencies[(int)(iterations * 0.95)];
            double p99 = latencies[(int)(iterations * 0.99)];

            // 2 * batch * input * output operations per iteration
            double totalFlops = (double)iterations * (2.0 * batchSize * inputDim * outputDim);
            double gflops = (totalFlops / (swTotal.Elapsed.TotalSeconds * 1e9));

            return new BenchmarkResult
            {
                BenchmarkName = $"DenseForward_{inputDim}x{outputDim}_B{batchSize}",
                Iterations = iterations,
                BatchSize = batchSize,
                MatrixDim = inputDim,
                ElapsedMilliseconds = swTotal.Elapsed.TotalMilliseconds,
                P50LatencyMs = p50,
                P95LatencyMs = p95,
                P99LatencyMs = p99,
                GFlops = gflops,
                AllocatedBytes = Math.Max(0, memAfter - memBefore),
                PassedSanityCheck = outputs[0, 0] >= 0f
            };
        }

        public static BenchmarkResult RunSoftmaxAttentionBenchmark(int seqLen = 64, int headDim = 64, int numHeads = 4, int iterations = 300)
        {
            float[,,] Q = new float[numHeads, seqLen, headDim];
            float[,,] K = new float[numHeads, seqLen, headDim];
            float[,,] scores = new float[numHeads, seqLen, seqLen];

            System.Random rand = new System.Random(1337);
            for (int h = 0; h < numHeads; h++)
            {
                for (int i = 0; i < seqLen; i++)
                {
                    for (int d = 0; d < headDim; d++)
                    {
                        Q[h, i, d] = (float)rand.NextDouble() * 0.5f;
                        K[h, i, d] = (float)rand.NextDouble() * 0.5f;
                    }
                }
            }

            float scale = 1f / Mathf.Sqrt(headDim);
            double[] latencies = new double[iterations];
            Stopwatch swTotal = Stopwatch.StartNew();

            for (int it = 0; it < iterations; it++)
            {
                Stopwatch swIter = Stopwatch.StartNew();

                Parallel.For(0, numHeads, h =>
                {
                    for (int i = 0; i < seqLen; i++)
                    {
                        float maxScore = float.MinValue;
                        for (int j = 0; j < seqLen; j++)
                        {
                            float dot = 0f;
                            for (int d = 0; d < headDim; d++)
                                dot += Q[h, i, d] * K[h, j, d];
                            dot *= scale;
                            scores[h, i, j] = dot;
                            if (dot > maxScore) maxScore = dot;
                        }

                        // Stable Softmax
                        float sumExp = 0f;
                        for (int j = 0; j < seqLen; j++)
                        {
                            scores[h, i, j] = Mathf.Exp(scores[h, i, j] - maxScore);
                            sumExp += scores[h, i, j];
                        }
                        float invSum = 1f / sumExp;
                        for (int j = 0; j < seqLen; j++)
                            scores[h, i, j] *= invSum;
                    }
                });

                swIter.Stop();
                latencies[it] = swIter.Elapsed.TotalMilliseconds;
            }

            swTotal.Stop();
            Array.Sort(latencies);

            double totalFlops = (double)iterations * (2.0 * numHeads * seqLen * seqLen * headDim + 3.0 * numHeads * seqLen * seqLen);
            double gflops = (totalFlops / (swTotal.Elapsed.TotalSeconds * 1e9));

            return new BenchmarkResult
            {
                BenchmarkName = $"SoftmaxSelfAttention_S{seqLen}_H{numHeads}_D{headDim}",
                Iterations = iterations,
                BatchSize = 1,
                MatrixDim = seqLen,
                ElapsedMilliseconds = swTotal.Elapsed.TotalMilliseconds,
                P50LatencyMs = latencies[(int)(iterations * 0.50)],
                P95LatencyMs = latencies[(int)(iterations * 0.95)],
                P99LatencyMs = latencies[(int)(iterations * 0.99)],
                GFlops = gflops,
                AllocatedBytes = 0,
                PassedSanityCheck = scores[0, 0, 0] > 0f && scores[0, 0, 0] <= 1f
            };
        }

        public static BenchmarkResult RunConv2DForwardBenchmark(int inChannels = 8, int outChannels = 16, int height = 32, int width = 32, int kernelSize = 3, int iterations = 200)
        {
            float[,,,] input = new float[1, inChannels, height, width];
            float[,,,] kernels = new float[outChannels, inChannels, kernelSize, kernelSize];
            float[] bias = new float[outChannels];
            float[,,,] output = new float[1, outChannels, height, width];

            System.Random rand = new System.Random(2026);
            for (int oc = 0; oc < outChannels; oc++)
            {
                bias[oc] = (float)rand.NextDouble() * 0.05f;
                for (int ic = 0; ic < inChannels; ic++)
                {
                    for (int kh = 0; kh < kernelSize; kh++)
                    {
                        for (int kw = 0; kw < kernelSize; kw++)
                        {
                            kernels[oc, ic, kh, kw] = (float)(rand.NextDouble() - 0.5) * 0.1f;
                        }
                    }
                }
            }

            for (int ic = 0; ic < inChannels; ic++)
            {
                for (int h = 0; h < height; h++)
                {
                    for (int w = 0; w < width; w++)
                    {
                        input[0, ic, h, w] = (float)rand.NextDouble();
                    }
                }
            }

            int pad = kernelSize / 2;
            double[] latencies = new double[iterations];
            Stopwatch swTotal = Stopwatch.StartNew();

            for (int it = 0; it < iterations; it++)
            {
                Stopwatch swIter = Stopwatch.StartNew();

                Parallel.For(0, outChannels, oc =>
                {
                    for (int h = 0; h < height; h++)
                    {
                        for (int w = 0; w < width; w++)
                        {
                            float sum = bias[oc];
                            for (int ic = 0; ic < inChannels; ic++)
                            {
                                for (int kh = 0; kh < kernelSize; kh++)
                                {
                                    int inH = h + kh - pad;
                                    if (inH < 0 || inH >= height) continue;

                                    for (int kw = 0; kw < kernelSize; kw++)
                                    {
                                        int inW = w + kw - pad;
                                        if (inW < 0 || inW >= width) continue;

                                        sum += input[0, ic, inH, inW] * kernels[oc, ic, kh, kw];
                                    }
                                }
                            }
                            output[0, oc, h, w] = sum > 0f ? sum : 0f; // ReLU activation
                        }
                    }
                });

                swIter.Stop();
                latencies[it] = swIter.Elapsed.TotalMilliseconds;
            }

            swTotal.Stop();
            Array.Sort(latencies);

            double flopsPerIter = (double)outChannels * height * width * (2.0 * inChannels * kernelSize * kernelSize + 1.0);
            double totalFlops = (double)iterations * flopsPerIter;
            double gflops = totalFlops / (swTotal.Elapsed.TotalSeconds * 1e9);

            return new BenchmarkResult
            {
                BenchmarkName = $"Conv2D_C{inChannels}->C{outChannels}_{height}x{width}_K{kernelSize}",
                Iterations = iterations,
                BatchSize = 1,
                MatrixDim = height,
                ElapsedMilliseconds = swTotal.Elapsed.TotalMilliseconds,
                P50LatencyMs = latencies[(int)(iterations * 0.50)],
                P95LatencyMs = latencies[(int)(iterations * 0.95)],
                P99LatencyMs = latencies[(int)(iterations * 0.99)],
                GFlops = gflops,
                AllocatedBytes = 0,
                PassedSanityCheck = output[0, 0, 0, 0] >= 0f
            };
        }

        public static BenchmarkResult RunLayerNormBenchmark(int batchSize = 32, int hiddenDim = 512, float epsilon = 1e-5f, int iterations = 500)
        {
            float[,] x = new float[batchSize, hiddenDim];
            float[] gamma = new float[hiddenDim];
            float[] beta = new float[hiddenDim];
            float[,] outNorm = new float[batchSize, hiddenDim];

            System.Random rand = new System.Random(777);
            for (int d = 0; d < hiddenDim; d++)
            {
                gamma[d] = 1.0f + (float)(rand.NextDouble() * 0.1);
                beta[d] = (float)(rand.NextDouble() * 0.02);
            }

            for (int b = 0; b < batchSize; b++)
            {
                for (int d = 0; d < hiddenDim; d++)
                {
                    x[b, d] = (float)(rand.NextDouble() * 2.0 - 1.0);
                }
            }

            double[] latencies = new double[iterations];
            Stopwatch swTotal = Stopwatch.StartNew();

            for (int it = 0; it < iterations; it++)
            {
                Stopwatch swIter = Stopwatch.StartNew();

                Parallel.For(0, batchSize, b =>
                {
                    // Pass 1: Mean
                    float mean = 0f;
                    for (int d = 0; d < hiddenDim; d++) mean += x[b, d];
                    mean /= hiddenDim;

                    // Pass 2: Variance
                    float variance = 0f;
                    for (int d = 0; d < hiddenDim; d++)
                    {
                        float diff = x[b, d] - mean;
                        variance += diff * diff;
                    }
                    variance /= hiddenDim;
                    float invStd = 1.0f / Mathf.Sqrt(variance + epsilon);

                    // Pass 3: Normalize and affine scale
                    for (int d = 0; d < hiddenDim; d++)
                    {
                        outNorm[b, d] = ((x[b, d] - mean) * invStd) * gamma[d] + beta[d];
                    }
                });

                swIter.Stop();
                latencies[it] = swIter.Elapsed.TotalMilliseconds;
            }

            swTotal.Stop();
            Array.Sort(latencies);

            double totalFlops = (double)iterations * (5.0 * batchSize * hiddenDim);
            double gflops = totalFlops / (swTotal.Elapsed.TotalSeconds * 1e9);

            return new BenchmarkResult
            {
                BenchmarkName = $"LayerNorm_B{batchSize}_D{hiddenDim}",
                Iterations = iterations,
                BatchSize = batchSize,
                MatrixDim = hiddenDim,
                ElapsedMilliseconds = swTotal.Elapsed.TotalMilliseconds,
                P50LatencyMs = latencies[(int)(iterations * 0.50)],
                P95LatencyMs = latencies[(int)(iterations * 0.95)],
                P99LatencyMs = latencies[(int)(iterations * 0.99)],
                GFlops = gflops,
                AllocatedBytes = 0,
                PassedSanityCheck = !float.IsNaN(outNorm[0, 0]) && !float.IsInfinity(outNorm[0, 0])
            };
        }
    }
}
