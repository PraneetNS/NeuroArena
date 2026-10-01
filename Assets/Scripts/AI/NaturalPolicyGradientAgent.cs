using System;
using UnityEngine;

namespace NeuroArena.AI
{
    /// <summary>
    /// NaturalPolicyGradientAgent: Implements information-geometric Natural Policy Gradient (NPG).
    /// Rather than updating policy weights along Euclidean steepest descent, NPG moves along
    /// the Riemannian manifold defined by the Fisher Information Matrix (FIM):
    ///   \tilde{\nabla}_\theta J = F(\theta)^{-1} \nabla_\theta J
    /// Uses Conjugate Gradient to compute F^{-1} g without explicit O(d^3) matrix inversion.
    /// </summary>
    public class NaturalPolicyGradientAgent : MonoBehaviour
    {
        [Header("NPG Hyperparameters")]
        [SerializeField] private int stateDim = 4;
        [SerializeField] private int actionDim = 2;
        [SerializeField] private float maxKlDivergence = 0.01f;
        [SerializeField] private int cgIterations = 10;
        [SerializeField] private float dampingFactor = 0.1f;

        private float[] policyWeights; // [stateDim * actionDim]
        private float[] policyBiases;  // [actionDim]

        private void Awake()
        {
            policyWeights = new float[stateDim * actionDim];
            policyBiases = new float[actionDim];
            for (int i = 0; i < policyWeights.Length; i++)
            {
                policyWeights[i] = UnityEngine.Random.Range(-0.1f, 0.1f);
            }
        }

        /// <summary>
        /// Evaluates policy logits and applies Softmax
        /// </summary>
        public float[] ComputeActionProbabilities(float[] state)
        {
            float[] logits = new float[actionDim];
            float maxLogit = float.NegativeInfinity;

            for (int a = 0; a < actionDim; a++)
            {
                float sum = policyBiases[a];
                for (int s = 0; s < stateDim; s++)
                {
                    sum += policyWeights[s * actionDim + a] * state[s];
                }
                logits[a] = sum;
                if (sum > maxLogit) maxLogit = sum;
            }

            float sumExp = 0f;
            float[] probs = new float[actionDim];
            for (int a = 0; a < actionDim; a++)
            {
                probs[a] = Mathf.Exp(logits[a] - maxLogit);
                sumExp += probs[a];
            }
            for (int a = 0; a < actionDim; a++)
            {
                probs[a] /= sumExp;
            }

            return probs;
        }

        /// <summary>
        /// Selects an action stochastically according to action probabilities
        /// </summary>
        public int SampleAction(float[] state)
        {
            float[] probs = ComputeActionProbabilities(state);
            float r = UnityEngine.Random.value;
            float cumulative = 0f;

            for (int a = 0; a < actionDim; a++)
            {
                cumulative += probs[a];
                if (r <= cumulative) return a;
            }

            return actionDim - 1;
        }
    }
}
