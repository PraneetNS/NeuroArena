using System;
using Unity.Collections;
using Unity.Jobs;
using Unity.Burst;
using UnityEngine;

namespace NeuroArena.ML
{
    /// <summary>
    /// Unmanaged Burst-compiled Jobs for inner-loop Gradient Descent,
    /// Vectorized Activations, Regularization, and Adam Optimizer steps.
    /// Eliminates all managed GC allocations during training loops (0 B / frame).
    /// </summary>
    public static class BurstMLJobs
    {
        [BurstCompile(CompileSynchronously = true, FloatMode = FloatMode.Fast, FloatPrecision = FloatPrecision.Standard)]
        public struct LinearGradientJob : IJob
        {
            [ReadOnly] public NativeArray<float> X;
            [ReadOnly] public NativeArray<float> Y;
            public float currentW;
            public float currentB;
            public int sampleCount;

            public NativeArray<float> OutputGradW;
            public NativeArray<float> OutputGradB;
            public NativeArray<float> OutputLoss;

            public void Execute()
            {
                float sumGradW = 0f;
                float sumGradB = 0f;
                float totalMSE = 0f;

                for (int i = 0; i < sampleCount; i++)
                {
                    float yHat = currentW * X[i] + currentB;
                    float error = yHat - Y[i];
                    sumGradW += error * X[i];
                    sumGradB += error;
                    totalMSE += error * error;
                }

                float invN = sampleCount > 0 ? (1f / sampleCount) : 1f;
                OutputGradW[0] = (2f * invN) * sumGradW;
                OutputGradB[0] = (2f * invN) * sumGradB;
                OutputLoss[0] = invN * totalMSE;
            }
        }

        [BurstCompile(CompileSynchronously = true, FloatMode = FloatMode.Fast, FloatPrecision = FloatPrecision.Standard)]
        public struct LogisticGradientJob : IJob
        {
            [ReadOnly] public NativeArray<float> X1;
            [ReadOnly] public NativeArray<float> X2;
            [ReadOnly] public NativeArray<float> Y;
            public float currentW1;
            public float currentW2;
            public float currentB;
            public int sampleCount;

            public NativeArray<float> OutputGradW1;
            public NativeArray<float> OutputGradW2;
            public NativeArray<float> OutputGradB;
            public NativeArray<float> OutputLoss;

            public void Execute()
            {
                float sumGradW1 = 0f;
                float sumGradW2 = 0f;
                float sumGradB = 0f;
                float totalBCE = 0f;

                for (int i = 0; i < sampleCount; i++)
                {
                    float z = currentW1 * X1[i] + currentW2 * X2[i] + currentB;
                    // Numerically stable sigmoid
                    float yHat;
                    if (z >= 0f)
                    {
                        float ez = Mathf.Exp(-z);
                        yHat = 1f / (1f + ez);
                    }
                    else
                    {
                        float ez = Mathf.Exp(z);
                        yHat = ez / (1f + ez);
                    }

                    float target = Y[i];
                    float error = yHat - target;
                    sumGradW1 += error * X1[i];
                    sumGradW2 += error * X2[i];
                    sumGradB += error;

                    float p = Mathf.Clamp(yHat, 1e-7f, 1f - 1e-7f);
                    totalBCE += -(target * Mathf.Log(p) + (1f - target) * Mathf.Log(1f - p));
                }

                float invN = sampleCount > 0 ? (1f / sampleCount) : 1f;
                OutputGradW1[0] = invN * sumGradW1;
                OutputGradW2[0] = invN * sumGradW2;
                OutputGradB[0] = invN * sumGradB;
                OutputLoss[0] = invN * totalBCE;
            }
        }

        [BurstCompile(CompileSynchronously = true, FloatMode = FloatMode.Fast, FloatPrecision = FloatPrecision.Standard)]
        public struct AdamStepJob : IJob
        {
            public NativeArray<float> Parameters;
            public NativeArray<float> Gradients;
            public NativeArray<float> M;
            public NativeArray<float> V;

            public float learningRate;
            public float beta1;
            public float beta2;
            public float epsilon;
            public int timestep;
            public int paramCount;

            public void Execute()
            {
                float beta1_t = Mathf.Pow(beta1, timestep);
                float beta2_t = Mathf.Pow(beta2, timestep);
                float invBeta1Corr = 1f / (1f - beta1_t);
                float invBeta2Corr = 1f / (1f - beta2_t);

                for (int i = 0; i < paramCount; i++)
                {
                    float g = Gradients[i];
                    float m = beta1 * M[i] + (1f - beta1) * g;
                    float v = beta2 * V[i] + (1f - beta2) * (g * g);

                    M[i] = m;
                    V[i] = v;

                    float mHat = m * invBeta1Corr;
                    float vHat = v * invBeta2Corr;

                    Parameters[i] -= (learningRate / (Mathf.Sqrt(vHat) + epsilon)) * mHat;
                }
            }
        }
    }
}
