using System;
using UnityEngine;

namespace NeuroArena.ML.Reinforcement
{
    /// <summary>
    /// Intrinsic Curiosity Module (ICM) formulating exploration incentives via state prediction discrepancy.
    /// Incorporates random feature projection, Welford running variance normalization, and reward clipping.
    /// </summary>
    public class CuriosityRewardModule : MonoBehaviour
    {
        [Header("Curiosity Parameters")]
        [SerializeField] private float curiosityWeight = 0.05f;
        [SerializeField] private int featureDim = 8;
        [SerializeField] private float rewardClipLimit = 1.0f;
        [SerializeField] private float runningEpsilon = 1e-5f;

        // Running statistics via Welford's algorithm
        private float _meanError = 0f;
        private float _m2Error = 0f;
        private int _stepCount = 0;
        private float _lastIntrinsicReward = 0f;

        // Random projection weights phi(s)
        private float[,] _projectionMatrix;
        private bool _isInitialized = false;

        public float LastIntrinsicReward => _lastIntrinsicReward;
        public float RunningMean => _meanError;
        public float RunningVariance => _stepCount > 1 ? _m2Error / (_stepCount - 1) : 1f;
        public int TotalStepsEncountered => _stepCount;

        private void Awake()
        {
            InitializeProjectionMatrix(16, featureDim);
        }

        public void InitializeProjectionMatrix(int rawStateDim, int targetFeatureDim)
        {
            featureDim = targetFeatureDim;
            _projectionMatrix = new float[targetFeatureDim, rawStateDim];
            var rng = new System.Random(1337);

            // Gaussian initialization with He/Xavier scaling
            float scale = Mathf.Sqrt(2.0f / rawStateDim);
            for (int f = 0; f < targetFeatureDim; f++)
            {
                for (int s = 0; s < rawStateDim; s++)
                {
                    _projectionMatrix[f, s] = (float)(rng.NextDouble() * 2.0 - 1.0) * scale;
                }
            }
            _isInitialized = true;
        }

        public float[] ProjectFeatures(float[] rawState)
        {
            if (rawState == null) return new float[0];
            if (!_isInitialized || _projectionMatrix.GetLength(1) != rawState.Length)
            {
                InitializeProjectionMatrix(rawState.Length, featureDim);
            }

            float[] features = new float[featureDim];
            int rawLen = rawState.Length;

            for (int f = 0; f < featureDim; f++)
            {
                float sum = 0f;
                for (int s = 0; s < rawLen; s++)
                {
                    sum += _projectionMatrix[f, s] * rawState[s];
                }
                // LeakyReLU non-linearity on projected feature embedding
                features[f] = sum > 0f ? sum : sum * 0.1f;
            }
            return features;
        }

        /// <summary>
        /// Computes normalized intrinsic curiosity reward: r_i = eta * 0.5 * ||hat_phi(s_{t+1}) - phi(s_{t+1})||^2 / sigma
        /// </summary>
        public float CalculateIntrinsicReward(float[] predictedNextState, float[] actualNextState)
        {
            if (predictedNextState == null || actualNextState == null) return 0f;
            int len = Mathf.Min(predictedNextState.Length, actualNextState.Length);
            if (len == 0) return 0f;

            float rawPredictionErrorSqr = 0f;
            for (int i = 0; i < len; i++)
            {
                float diff = predictedNextState[i] - actualNextState[i];
                rawPredictionErrorSqr += diff * diff;
            }
            float rawError = 0.5f * rawPredictionErrorSqr;

            // Update running error statistics using Welford's algorithm
            _stepCount++;
            float delta = rawError - _meanError;
            _meanError += delta / _stepCount;
            float delta2 = rawError - _meanError;
            _m2Error += delta * delta2;

            float stdDev = _stepCount > 1 
                ? Mathf.Sqrt(_m2Error / (_stepCount - 1)) + runningEpsilon 
                : 1.0f;

            // Normalized curiosity reward prevents reward explosion in unmodeled biomes
            float normalizedError = rawError / stdDev;
            _lastIntrinsicReward = Mathf.Clamp(normalizedError * curiosityWeight, 0f, rewardClipLimit);

            return _lastIntrinsicReward;
        }

        public void ResetRunningStatistics()
        {
            _meanError = 0f;
            _m2Error = 0f;
            _stepCount = 0;
            _lastIntrinsicReward = 0f;
        }
    }
}
