using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.ML
{
    /// <summary>
    /// MetaLearningController: Unity C# runtime controller for Model-Agnostic Meta-Learning (MAML).
    /// Executes fast parameter adaptation on procedural biome shifts using few-shot support sets.
    /// </summary>
    public class MetaLearningController : MonoBehaviour
    {
        [Header("MAML Hyperparameters")]
        [SerializeField] private int parameterDimension = 16;
        [SerializeField] private float innerLoopLearningRate = 0.05f;
        [SerializeField] private int innerAdaptationSteps = 3;
        [SerializeField] private bool autoAdaptOnBiomeShift = true;

        [Header("Runtime State")]
        [SerializeField] private float currentZeroShotLoss;
        [SerializeField] private float currentFewShotLoss;
        [SerializeField] private float adaptationGainPercent;

        private float[] metaParameters;
        private float[] runtimeAdaptedParameters;

        public event Action<float, float> OnFewShotAdapted;

        private void Awake()
        {
            InitializeParameters();
        }

        public void InitializeParameters()
        {
            metaParameters = new float[parameterDimension];
            runtimeAdaptedParameters = new float[parameterDimension];

            float scale = Mathf.Sqrt(2f / parameterDimension);
            for (int i = 0; i < parameterDimension; i++)
            {
                metaParameters[i] = UnityEngine.Random.Range(-scale, scale);
                runtimeAdaptedParameters[i] = metaParameters[i];
            }
        }

        public void SyncMetaParameters(float[] serverMetaWeights)
        {
            if (serverMetaWeights == null || serverMetaWeights.Length != parameterDimension) return;
            Array.Copy(serverMetaWeights, metaParameters, parameterDimension);
            Array.Copy(metaParameters, runtimeAdaptedParameters, parameterDimension);
        }

        /// <summary>
        /// Adapt to new procedural terrain/biome dynamics in 1-5 support iterations
        /// </summary>
        public void FastAdapt(List<SupportSample> supportSet)
        {
            if (supportSet == null || supportSet.Count == 0) return;

            // Reset adapted parameters to meta-prior
            Array.Copy(metaParameters, runtimeAdaptedParameters, parameterDimension);

            currentZeroShotLoss = EvaluateLoss(runtimeAdaptedParameters, supportSet);

            for (int step = 0; step < innerAdaptationSteps; step++)
            {
                float[] gradients = ComputeGradients(runtimeAdaptedParameters, supportSet);
                for (int i = 0; i < parameterDimension; i++)
                {
                    runtimeAdaptedParameters[i] -= innerLoopLearningRate * gradients[i];
                }
            }

            currentFewShotLoss = EvaluateLoss(runtimeAdaptedParameters, supportSet);
            adaptationGainPercent = currentZeroShotLoss > 1e-5f
                ? ((currentZeroShotLoss - currentFewShotLoss) / currentZeroShotLoss) * 100f
                : 0f;

            OnFewShotAdapted?.Invoke(currentZeroShotLoss, currentFewShotLoss);
        }

        public float Predict(float[] features)
        {
            float prediction = 0f;
            for (int i = 0; i < parameterDimension && i < features.Length; i++)
            {
                prediction += features[i] * runtimeAdaptedParameters[i];
            }
            return prediction;
        }

        private float EvaluateLoss(float[] weights, List<SupportSample> samples)
        {
            float total = 0f;
            for (int i = 0; i < samples.Count; i++)
            {
                float pred = 0f;
                for (int d = 0; d < parameterDimension; d++)
                {
                    pred += samples[i].Features[d] * weights[d];
                }
                float err = pred - samples[i].Target;
                total += 0.5f * err * err;
            }
            return total / samples.Count;
        }

        private float[] ComputeGradients(float[] weights, List<SupportSample> samples)
        {
            float[] grad = new float[parameterDimension];
            int n = samples.Count;
            for (int i = 0; i < n; i++)
            {
                float pred = 0f;
                for (int d = 0; d < parameterDimension; d++)
                {
                    pred += samples[i].Features[d] * weights[d];
                }
                float err = pred - samples[i].Target;
                for (int d = 0; d < parameterDimension; d++)
                {
                    grad[d] += err * samples[i].Features[d];
                }
            }
            for (int d = 0; d < parameterDimension; d++)
            {
                grad[d] /= n;
            }
            return grad;
        }

        [Serializable]
        public struct SupportSample
        {
            public float[] Features;
            public float Target;

            public SupportSample(float[] f, float t)
            {
                Features = f;
                Target = t;
            }
        }
    }
}
