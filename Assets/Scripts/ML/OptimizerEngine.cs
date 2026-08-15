using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.ML
{
    public enum OptimizerType
    {
        SGD,        // 🗡️ Standard Blade: Vanilla Gradient Descent
        Momentum,   // 🔨 Heavy Hammer: Polyak Momentum with velocity accumulation
        RMSprop,    // ⚡ Adaptive Coil: Root Mean Square squared gradient scaling
        Adam        // 🔱 Cyber Glaive: Adaptive Moment Estimation (1st + 2nd moments with bias correction)
    }

    [Serializable]
    public struct OptimizerRaceResult
    {
        public string name;
        public Color color;
        public float[] lossHistory;
        public List<Vector2> trajectory; // (w1, w2) path on loss surface
        public float finalLoss;
        public int epochsToConverge;
        public bool converged;
    }

    /// <summary>
    /// Pure C# stateful optimizers with zero ML libraries.
    /// Implements Vanilla SGD, Momentum, RMSprop, and Adam for scalar and array parameters.
    /// Includes the 4-Way Multi-Trajectory Loss Surface Grand Prix simulator.
    /// </summary>
    public class OptimizerEngine
    {
        public OptimizerType Type { get; private set; }
        public float LearningRate { get; set; }
        public float Beta1 { get; set; } = 0.9f;
        public float Beta2 { get; set; } = 0.999f;
        public float Epsilon { get; set; } = 1e-8f;

        // Momentum / Adam 1st moments (velocities)
        private float[] m_weights;
        private float m_bias;

        // RMSprop / Adam 2nd moments (squared gradients)
        private float[] v_weights;
        private float v_bias;

        private int timeStep = 0;

        public OptimizerEngine(OptimizerType type, float learningRate, int weightDimension)
        {
            Type = type;
            LearningRate = learningRate;
            Reset(weightDimension);
        }

        public void Reset(int weightDimension)
        {
            m_weights = new float[weightDimension];
            v_weights = new float[weightDimension];
            m_bias = 0.0f;
            v_bias = 0.0f;
            timeStep = 0;
        }

        public void Step(float[] weights, ref float bias, float[] gradWeights, float gradBias)
        {
            timeStep++;

            switch (Type)
            {
                case OptimizerType.SGD:
                    for (int j = 0; j < weights.Length; j++)
                    {
                        weights[j] -= LearningRate * gradWeights[j];
                    }
                    bias -= LearningRate * gradBias;
                    break;

                case OptimizerType.Momentum:
                    for (int j = 0; j < weights.Length; j++)
                    {
                        m_weights[j] = Beta1 * m_weights[j] + (1f - Beta1) * gradWeights[j];
                        weights[j] -= LearningRate * m_weights[j];
                    }
                    m_bias = Beta1 * m_bias + (1f - Beta1) * gradBias;
                    bias -= LearningRate * m_bias;
                    break;

                case OptimizerType.RMSprop:
                    for (int j = 0; j < weights.Length; j++)
                    {
                        v_weights[j] = Beta2 * v_weights[j] + (1f - Beta2) * (gradWeights[j] * gradWeights[j]);
                        weights[j] -= (LearningRate / (Mathf.Sqrt(v_weights[j]) + Epsilon)) * gradWeights[j];
                    }
                    v_bias = Beta2 * v_bias + (1f - Beta2) * (gradBias * gradBias);
                    bias -= (LearningRate / (Mathf.Sqrt(v_bias) + Epsilon)) * gradBias;
                    break;

                case OptimizerType.Adam:
                    float beta1_t = Mathf.Pow(Beta1, timeStep);
                    float beta2_t = Mathf.Pow(Beta2, timeStep);

                    for (int j = 0; j < weights.Length; j++)
                    {
                        // 1st moment (Mean)
                        m_weights[j] = Beta1 * m_weights[j] + (1f - Beta1) * gradWeights[j];
                        // 2nd moment (Variance)
                        v_weights[j] = Beta2 * v_weights[j] + (1f - Beta2) * (gradWeights[j] * gradWeights[j]);

                        // Bias correction
                        float mHat = m_weights[j] / (1f - beta1_t);
                        float vHat = v_weights[j] / (1f - beta2_t);

                        weights[j] -= (LearningRate / (Mathf.Sqrt(vHat) + Epsilon)) * mHat;
                    }

                    m_bias = Beta1 * m_bias + (1f - Beta1) * gradBias;
                    v_bias = Beta2 * v_bias + (1f - Beta2) * (gradBias * gradBias);

                    float mHatB = m_bias / (1f - beta1_t);
                    float vHatB = v_bias / (1f - beta2_t);

                    bias -= (LearningRate / (Mathf.Sqrt(vHatB) + Epsilon)) * mHatB;
                    break;
            }
        }

        /// <summary>
        /// Runs a 4-way comparative race on an ill-conditioned, noisy anisotropic ravine landscape.
        /// Demonstrates why SGD oscillates and fails, while Adam converges swiftly.
        /// </summary>
        public static Dictionary<OptimizerType, OptimizerRaceResult> RunGrandPrixRace(int epochs = 80, float noiseLevel = 0.45f)
        {
            var results = new Dictionary<OptimizerType, OptimizerRaceResult>();

            // Synthetic anisotropic ravine landscape: J(w1, w2) = 15.0 * w1^2 + 0.3 * w2^2 + noise
            // Target optimum: w1* = 0, w2* = 0
            OptimizerType[] types = new OptimizerType[]
            {
                OptimizerType.SGD,
                OptimizerType.Momentum,
                OptimizerType.RMSprop,
                OptimizerType.Adam
            };

            Color[] colors = new Color[]
            {
                new Color(0.95f, 0.25f, 0.25f), // Red: SGD
                new Color(1.0f, 0.65f, 0.15f),  // Orange: Momentum
                new Color(0.2f, 0.85f, 1.0f),   // Cyan: RMSprop
                new Color(0.25f, 1.0f, 0.45f)   // Neon Green: Adam
            };

            for (int t = 0; t < types.Length; t++)
            {
                OptimizerType optType = types[t];
                float lr = optType == OptimizerType.SGD ? 0.035f : (optType == OptimizerType.Momentum ? 0.035f : 0.12f);
                OptimizerEngine opt = new OptimizerEngine(optType, lr, 2);

                // Initial position far up the narrow ravine walls
                float[] weights = new float[] { 3.2f, 4.0f };
                float bias = 0.0f;

                float[] lossHistory = new float[epochs];
                List<Vector2> trajectory = new List<Vector2>();
                int convEpoch = -1;

                for (int ep = 0; ep < epochs; ep++)
                {
                    trajectory.Add(new Vector2(weights[0], weights[1]));

                    // Compute loss on anisotropic ravine with noise
                    float noisyW1 = weights[0] + UnityEngine.Random.Range(-noiseLevel, noiseLevel) * 0.15f;
                    float noisyW2 = weights[1] + UnityEngine.Random.Range(-noiseLevel, noiseLevel) * 0.15f;
                    float loss = 12.0f * (noisyW1 * noisyW1) + 0.4f * (noisyW2 * noisyW2);
                    lossHistory[ep] = loss;

                    if (loss < 0.08f && convEpoch == -1)
                    {
                        convEpoch = ep + 1;
                    }

                    // Gradients
                    float grad1 = 24.0f * weights[0] + UnityEngine.Random.Range(-noiseLevel, noiseLevel);
                    float grad2 = 0.8f * weights[1] + UnityEngine.Random.Range(-noiseLevel, noiseLevel);

                    opt.Step(weights, ref bias, new float[] { grad1, grad2 }, 0f);
                }

                results[optType] = new OptimizerRaceResult
                {
                    name = optType.ToString(),
                    color = colors[t],
                    lossHistory = lossHistory,
                    trajectory = trajectory,
                    finalLoss = lossHistory[epochs - 1],
                    epochsToConverge = convEpoch != -1 ? convEpoch : epochs,
                    converged = convEpoch != -1
                };
            }

            return results;
        }
    }
}
