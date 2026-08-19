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
    }
}
