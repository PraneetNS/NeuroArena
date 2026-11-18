using System;
using UnityEngine;

namespace NeuroArena.ML.Reinforcement
{
    /// <summary>
    /// Proximal Policy Optimization (PPO) clipped surrogate objective policy agent with 
    /// Generalized Advantage Estimation (GAE-lambda) and Shannon entropy exploration regularization.
    /// </summary>
    public class PPOPolicyAgent : MonoBehaviour
    {
        [Header("PPO Hyperparameters")]
        [SerializeField] private float clipEpsilon = 0.2f;
        [SerializeField] private float gamma = 0.99f;
        [SerializeField] private float lambdaGae = 0.95f;
        [SerializeField] private float learningRate = 0.0003f;
        [SerializeField] private float valueLossCoefficient = 0.5f;
        [SerializeField] private float entropyCoefficient = 0.01f;
        [SerializeField] private int stateDim = 16;
        [SerializeField] private int actionDim = 4;

        private float[] _actorWeights;
        private float[] _criticWeights;
        private float _lastComputedEntropy = 0f;
        private float _lastTotalLoss = 0f;

        public float LastComputedEntropy => _lastComputedEntropy;
        public float LastTotalLoss => _lastTotalLoss;
        public float ClipEpsilon => clipEpsilon;
        public float Gamma => gamma;
        public float LambdaGae => lambdaGae;

        private void Awake()
        {
            _actorWeights = new float[stateDim * actionDim];
            _criticWeights = new float[stateDim];
            InitializeWeights();
        }

        public void InitializeWeights()
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

            // Softmax with numerical stability
            float maxLogit = float.MinValue;
            for (int a = 0; a < actionDim; a++) if (logits[a] > maxLogit) maxLogit = logits[a];

            float sumExp = 0f;
            float[] probs = new float[actionDim];
            for (int a = 0; a < actionDim; a++)
            {
                probs[a] = Mathf.Exp(logits[a] - maxLogit);
                sumExp += probs[a];
            }
            for (int a = 0; a < actionDim; a++) probs[a] /= Mathf.Max(sumExp, 1e-8f);

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
            float loss = -Mathf.Min(surr1, surr2);

            if (advantage > 0f)
            {
                TriggerPolicyUpdateJuice();
            }

            return loss;
        }

        /// <summary>
        /// Shannon Entropy calculation H(pi) = -sum(p * ln(p)) over discrete action distributions.
        /// </summary>
        public float ComputeEntropy(float[] actionProbabilities)
        {
            if (actionProbabilities == null || actionProbabilities.Length == 0) return 0f;

            float entropy = 0f;
            for (int i = 0; i < actionProbabilities.Length; i++)
            {
                float p = Mathf.Max(actionProbabilities[i], 1e-8f);
                entropy -= p * Mathf.Log(p);
            }
            _lastComputedEntropy = entropy;
            return entropy;
        }

        /// <summary>
        /// Generalized Advantage Estimation (GAE-lambda) computed backwards across rollout trajectories.
        /// delta_t = r_t + gamma * V(s_{t+1}) * (1 - done_t) - V(s_t)
        /// A_t = delta_t + gamma * lambda * (1 - done_t) * A_{t+1}
        /// </summary>
        public float[] ComputeGAE(float[] rewards, float[] values, bool[] dones, float nextValue)
        {
            int n = rewards.Length;
            float[] advantages = new float[n];
            float gae = 0f;

            for (int t = n - 1; t >= 0; t--)
            {
                float nextVal = (t == n - 1) ? nextValue : values[t + 1];
                float nonTerminal = dones[t] ? 0f : 1f;
                float delta = rewards[t] + gamma * nextVal * nonTerminal - values[t];
                gae = delta + gamma * lambdaGae * nonTerminal * gae;
                advantages[t] = gae;
            }

            return advantages;
        }

        /// <summary>
        /// Total joint PPO objective: L = L_clip + c_1 * L_value - c_2 * H(pi)
        /// </summary>
        public float ComputeTotalLoss(float clipLoss, float targetValue, float predictedValue, float entropy)
        {
            float valueDiff = predictedValue - targetValue;
            float valueLoss = 0.5f * (valueDiff * valueDiff);
            _lastTotalLoss = clipLoss + (valueLossCoefficient * valueLoss) - (entropyCoefficient * entropy);
            return _lastTotalLoss;
        }

        public void TriggerPolicyUpdateJuice()
        {
            // Systematic Juice: Synapse spark burst + double haptic + audio tick
            NeuroArena.Core.JuiceFeedbackManager.Instance?.OnPPOPolicyUpdate(transform.position);
        }
    }
}
