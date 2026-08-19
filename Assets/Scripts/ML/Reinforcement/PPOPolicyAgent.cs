using System;
using UnityEngine;

namespace NeuroArena.ML.Reinforcement
{
    public class PPOPolicyAgent : MonoBehaviour
    {
        [Header("PPO Hyperparameters")]
        [SerializeField] private float clipEpsilon = 0.2f;
        [SerializeField] private float gamma = 0.99f;
        [SerializeField] private float lambdaGae = 0.95f;
        [SerializeField] private float learningRate = 0.0003f;
        [SerializeField] private int stateDim = 16;
        [SerializeField] private int actionDim = 4;

        private float[] _actorWeights;
        private float[] _criticWeights;

        private void Awake()
        {
            _actorWeights = new float[stateDim * actionDim];
            _criticWeights = new float[stateDim];
            InitializeWeights();
        }

        private void InitializeWeights()
        {
            var rand = new System.Random(42);
            for (int i = 0; i < _actorWeights.Length; i++)
                _actorWeights[i] = (float)(rand.NextDouble() - 0.5) * 0.1f;
            for (int i = 0; i < _criticWeights.Length; i++)
                _criticWeights[i] = (float)(rand.NextDouble() - 0.5) * 0.1f;
        }

        public float[] ComputeActionProbabilities(float[] state)
        {
            float[] logits = new float[actionDim];
            for (int a = 0; a < actionDim; a++)
            {
                float sum = 0f;
                for (int s = 0; s < stateDim; s++)
                {
                    sum += state[s] * _actorWeights[a * stateDim + s];
                }
                logits[a] = sum;
            }

            // Softmax
            float maxLogit = float.MinValue;
            for (int a = 0; a < actionDim; a++) if (logits[a] > maxLogit) maxLogit = logits[a];

            float sumExp = 0f;
            float[] probs = new float[actionDim];
            for (int a = 0; a < actionDim; a++)
            {
                probs[a] = Mathf.Exp(logits[a] - maxLogit);
                sumExp += probs[a];
            }
            for (int a = 0; a < actionDim; a++) probs[a] /= sumExp;

            return probs;
        }

        public float EstimateStateValue(float[] state)
        {
            float val = 0f;
            for (int s = 0; s < stateDim; s++)
                val += state[s] * _criticWeights[s];
            return val;
        }

        public float ComputePPOClipLoss(float oldProb, float newProb, float advantage)
        {
            float ratio = newProb / Mathf.Max(oldProb, 1e-7f);
            float surr1 = ratio * advantage;
            float surr2 = Mathf.Clamp(ratio, 1f - clipEpsilon, 1f + clipEpsilon) * advantage;
            return -Mathf.Min(surr1, surr2);
        }
    }
}
