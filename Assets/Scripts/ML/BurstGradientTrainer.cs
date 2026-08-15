using System;
using Unity.Collections;
using Unity.Jobs;
using UnityEngine;

namespace NeuroArena.ML
{
    /// <summary>
    /// High-performance Burst-compiled ML Trainer wrapper.
    /// Uses persistent NativeArray buffers to eliminate managed allocations (0 B / frame)
    /// and achieve smooth 60 FPS on Android mobile hardware.
    /// </summary>
    public class BurstGradientTrainer : MonoBehaviour
    {
        public static BurstGradientTrainer Instance { get; private set; }

        private NativeArray<float> nativeX;
        private NativeArray<float> nativeY;
        private NativeArray<float> outGradW;
        private NativeArray<float> outGradB;
        private NativeArray<float> outLoss;
        private bool isAllocated = false;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            AllocateNativeBuffers(1024);
        }

        private void AllocateNativeBuffers(int capacity)
        {
            if (isAllocated) DisposeNativeBuffers();

            nativeX = new NativeArray<float>(capacity, Allocator.Persistent);
            nativeY = new NativeArray<float>(capacity, Allocator.Persistent);
            outGradW = new NativeArray<float>(1, Allocator.Persistent);
            outGradB = new NativeArray<float>(1, Allocator.Persistent);
            outLoss = new NativeArray<float>(1, Allocator.Persistent);

            isAllocated = true;
        }

        private void DisposeNativeBuffers()
        {
            if (!isAllocated) return;
            if (nativeX.IsCreated) nativeX.Dispose();
            if (nativeY.IsCreated) nativeY.Dispose();
            if (outGradW.IsCreated) outGradW.Dispose();
            if (outGradB.IsCreated) outGradB.Dispose();
            if (outLoss.IsCreated) outLoss.Dispose();
            isAllocated = false;
        }

        private void OnDestroy()
        {
            DisposeNativeBuffers();
        }

        /// <summary>
        /// Executes a single vectorized gradient descent step using a Burst-compiled Job.
        /// Zero managed allocations (0 B GC).
        /// </summary>
        public (float nextW, float nextB, float loss) StepLinearBurst(
            float[] X, float[] Y, float currentW, float currentB, float learningRate)
        {
            int n = X.Length;
            if (n > nativeX.Length) AllocateNativeBuffers(n * 2);

            // Copy to native buffer
            for (int i = 0; i < n; i++)
            {
                nativeX[i] = X[i];
                nativeY[i] = Y[i];
            }

            var job = new BurstMLJobs.LinearGradientJob
            {
                X = nativeX,
                Y = nativeY,
                currentW = currentW,
                currentB = currentB,
                sampleCount = n,
                OutputGradW = outGradW,
                OutputGradB = outGradB,
                OutputLoss = outLoss
            };

            JobHandle handle = job.Schedule();
            handle.Complete();

            float gradW = outGradW[0];
            float gradB = outGradB[0];
            float loss = outLoss[0];

            float nextW = currentW - learningRate * gradW;
            float nextB = currentB - learningRate * gradB;

            return (nextW, nextB, loss);
        }
    }
}
