using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.ML
{
    /// <summary>
    /// Client-side adversarial attack generation and robustness evaluation engine.
    /// Implements Fast Gradient Sign Method (FGSM) and Projected Gradient Descent (PGD)
    /// perturbations across L-infinity and L2 norm balls to benchmark model defense capabilities.
    /// </summary>
    public class AdversarialRobustnessEngine
    {
        public enum AttackType
        {
            FGSM,
            PGD,
            RandomNoise
        }

        public struct AttackConfig
        {
            public AttackType Type;
            public float Epsilon;       // Maximum perturbation bound
            public float StepSize;      // Alpha for PGD iterations
            public int Iterations;      // Steps for PGD
            public bool ClipToBounds;   // Clamp inputs to [0, 1] or original domain bounds
            public float MinBound;
            public float MaxBound;

            public static AttackConfig DefaultFGSM => new AttackConfig
            {
                Type = AttackType.FGSM,
                Epsilon = 0.05f,
                StepSize = 0.05f,
                Iterations = 1,
                ClipToBounds = true,
                MinBound = -5f,
                MaxBound = 5f
            };

            public static AttackConfig DefaultPGD => new AttackConfig
            {
                Type = AttackType.PGD,
                Epsilon = 0.08f,
                StepSize = 0.02f,
                Iterations = 7,
                ClipToBounds = true,
                MinBound = -5f,
                MaxBound = 5f
            };
        }

        [Serializable]
        public struct RobustnessReport
        {
            public float CleanAccuracy;
            public float AdversarialAccuracy;
            public float RelativeAccuracyDrop;
            public float MeanPerturbationNorm;
            public float EmpiricalRobustnessScore; // 0.0 to 1.0
            public int EvaluatedSamples;
        }

        /// <summary>
        /// Generates an adversarial example using FGSM perturbation:
        /// x_adv = x + eps * sign(grad_x)
        /// </summary>
        public static float[] GenerateFGSM(float[] originalInput, float[] inputGradients, float epsilon, float minBound = -5f, float maxBound = 5f)
        {
            if (originalInput == null || inputGradients == null || originalInput.Length != inputGradients.Length)
                throw new ArgumentException("Input vector and gradient vector dimensions must match.");

            int len = originalInput.Length;
            float[] adversarial = new float[len];

            for (int i = 0; i < len; i++)
            {
                float sign = inputGradients[i] > 0f ? 1f : (inputGradients[i] < 0f ? -1f : 0f);
                float perturbed = originalInput[i] + epsilon * sign;
                adversarial[i] = Mathf.Clamp(perturbed, minBound, maxBound);
            }

            return adversarial;
        }

        /// <summary>
        /// Generates an adversarial example using Projected Gradient Descent (PGD) with iterative projection:
        /// x_{t+1} = Proj_{x, eps}( x_t + alpha * sign(grad_{x_t}) )
        /// </summary>
        public static float[] GeneratePGD(
            float[] originalInput,
            Func<float[], float[]> gradientEvaluator,
            float epsilon,
            float alpha,
            int iterations,
            float minBound = -5f,
            float maxBound = 5f)
        {
            if (originalInput == null) throw new ArgumentNullException(nameof(originalInput));
            if (gradientEvaluator == null) throw new ArgumentNullException(nameof(gradientEvaluator));

            int len = originalInput.Length;
            float[] current = (float[])originalInput.Clone();

            // Random initial start within epsilon ball for stronger PGD exploration
            for (int i = 0; i < len; i++)
            {
                float delta = UnityEngine.Random.Range(-epsilon * 0.5f, epsilon * 0.5f);
                current[i] = Mathf.Clamp(current[i] + delta, minBound, maxBound);
            }

            for (int step = 0; step < iterations; step++)
            {
                float[] grads = gradientEvaluator(current);
                if (grads == null || grads.Length != len) break;

                for (int i = 0; i < len; i++)
                {
                    float sign = grads[i] > 0f ? 1f : (grads[i] < 0f ? -1f : 0f);
                    float nextVal = current[i] + alpha * sign;

                    // Project onto L-infinity ball centered at originalInput
                    float diff = nextVal - originalInput[i];
                    diff = Mathf.Clamp(diff, -epsilon, epsilon);
                    current[i] = Mathf.Clamp(originalInput[i] + diff, minBound, maxBound);
                }
            }

            return current;
        }

        /// <summary>
        /// Evaluates model robustness across a dataset against specified attack configuration.
        /// </summary>
        public static RobustnessReport EvaluateRobustness(
            List<float[]> inputs,
            List<int> groundTruthLabels,
            Func<float[], int> modelPredictor,
            Func<float[], int, float[]> gradientEvaluator,
            AttackConfig config)
        {
            if (inputs == null || groundTruthLabels == null || inputs.Count != groundTruthLabels.Count || inputs.Count == 0)
            {
                return new RobustnessReport { CleanAccuracy = 0, AdversarialAccuracy = 0, EmpiricalRobustnessScore = 0 };
            }

            int count = inputs.Count;
            int cleanCorrect = 0;
            int advCorrect = 0;
            float totalPerturbation = 0f;

            for (int i = 0; i < count; i++)
            {
                float[] x = inputs[i];
                int yTrue = groundTruthLabels[i];

                // 1. Clean prediction
                int yPredClean = modelPredictor(x);
                if (yPredClean == yTrue) cleanCorrect++;

                // 2. Generate adversarial sample
                float[] xAdv;
                if (config.Type == AttackType.FGSM)
                {
                    float[] grads = gradientEvaluator(x, yTrue);
                    xAdv = GenerateFGSM(x, grads, config.Epsilon, config.MinBound, config.MaxBound);
                }
                else if (config.Type == AttackType.PGD)
                {
                    xAdv = GeneratePGD(x, curr => gradientEvaluator(curr, yTrue), config.Epsilon, config.StepSize, config.Iterations, config.MinBound, config.MaxBound);
                }
                else
                {
                    xAdv = new float[x.Length];
                    for (int j = 0; j < x.Length; j++)
                    {
                        float delta = UnityEngine.Random.Range(-config.Epsilon, config.Epsilon);
                        xAdv[j] = Mathf.Clamp(x[j] + delta, config.MinBound, config.MaxBound);
                    }
                }

                // 3. Compute perturbation norm
                float l2Dist = 0f;
                for (int j = 0; j < x.Length; j++)
                {
                    float diff = xAdv[j] - x[j];
                    l2Dist += diff * diff;
                }
                totalPerturbation += Mathf.Sqrt(l2Dist);

                // 4. Adversarial prediction
                int yPredAdv = modelPredictor(xAdv);
                if (yPredAdv == yTrue) advCorrect++;
            }

            float cleanAcc = (float)cleanCorrect / count;
            float advAcc = (float)advCorrect / count;
            float relDrop = cleanAcc > 0f ? (cleanAcc - advAcc) / cleanAcc : 0f;
            float avgNorm = totalPerturbation / count;
            float robustnessScore = Mathf.Clamp01(cleanAcc > 0 ? (advAcc / cleanAcc) : 0f);

            return new RobustnessReport
            {
                CleanAccuracy = cleanAcc,
                AdversarialAccuracy = advAcc,
                RelativeAccuracyDrop = relDrop,
                MeanPerturbationNorm = avgNorm,
                EmpiricalRobustnessScore = robustnessScore,
                EvaluatedSamples = count
            };
        }
    }
}
