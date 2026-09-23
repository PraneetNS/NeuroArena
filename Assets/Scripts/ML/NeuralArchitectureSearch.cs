using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.ML
{
    public enum ActivationFunction
    {
        ReLU,
        LeakyReLU,
        GELU,
        Swish,
        Tanh
    }

    [Serializable]
    public struct LayerSpec
    {
        public int Units;
        public ActivationFunction Activation;
        public bool UseDropout;
        public float DropoutRate;
        public bool UseSkipConnection;
    }

    [Serializable]
    public class CandidateArchitecture
    {
        public string CandidateId;
        public List<LayerSpec> Layers = new List<LayerSpec>();
        public float LearningRate;
        public float RegularizationL2;
        public int TotalParameters;
        public long EstimatedFlops;
        public float ValidationLoss;
        public float ValidationAccuracy;
        public float ParetoScore;
    }

    /// <summary>
    /// Neural Architecture Search (NAS) engine exploring micro-topologies
    /// and optimizing accuracy vs latency trade-offs on the Pareto frontier.
    /// </summary>
    public class NeuralArchitectureSearch
    {
        private readonly int _inputDim;
        private readonly int _outputDim;
        private readonly System.Random _rng;

        public NeuralArchitectureSearch(int inputDim, int outputDim, int seed = 42)
        {
            _inputDim = inputDim;
            _outputDim = outputDim;
            _rng = new System.Random(seed);
        }

        public CandidateArchitecture MutateArchitecture(CandidateArchitecture parent)
        {
            var child = new CandidateArchitecture
            {
                CandidateId = "nas_" + Guid.NewGuid().ToString("N").Substring(0, 8),
                LearningRate = Mathf.Clamp(parent.LearningRate * (float)(_rng.NextDouble() * 0.4 + 0.8), 1e-4f, 0.1f),
                RegularizationL2 = Mathf.Clamp(parent.RegularizationL2 * (float)(_rng.NextDouble() * 0.4 + 0.8), 1e-6f, 1e-2f),
                Layers = new List<LayerSpec>()
            };

            int layerCount = parent.Layers.Count;
            // Mutation: add, remove, or modify layer
            double roll = _rng.NextDouble();
            if (roll < 0.2 && layerCount < 6)
            {
                layerCount++;
            }
            else if (roll < 0.35 && layerCount > 1)
            {
                layerCount--;
            }

            int[] unitChoices = { 16, 32, 64, 128, 256 };
            ActivationFunction[] actChoices = {
                ActivationFunction.ReLU,
                ActivationFunction.LeakyReLU,
                ActivationFunction.GELU,
                ActivationFunction.Swish
            };

            for (int i = 0; i < layerCount; i++)
            {
                if (i < parent.Layers.Count && _rng.NextDouble() > 0.4)
                {
                    child.Layers.Add(parent.Layers[i]);
                }
                else
                {
                    child.Layers.Add(new LayerSpec
                    {
                        Units = unitChoices[_rng.Next(unitChoices.Length)],
                        Activation = actChoices[_rng.Next(actChoices.Length)],
                        UseDropout = _rng.NextDouble() > 0.5,
                        DropoutRate = (float)Math.Round(_rng.NextDouble() * 0.3 + 0.1, 2),
                        UseSkipConnection = i > 0 && _rng.NextDouble() > 0.6
                    });
                }
            }

            ComputeComplexity(child);
            return child;
        }

        public void ComputeComplexity(CandidateArchitecture candidate)
        {
            int prevDim = _inputDim;
            int totalParams = 0;
            long totalFlops = 0;

            for (int i = 0; i < candidate.Layers.Count; i++)
            {
                int currentUnits = candidate.Layers[i].Units;
                int weights = prevDim * currentUnits;
                int biases = currentUnits;

                totalParams += (weights + biases);
                totalFlops += (long)weights * 2; // multiply-accumulate

                prevDim = currentUnits;
            }

            // Output layer
            int outWeights = prevDim * _outputDim;
            int outBiases = _outputDim;
            totalParams += (outWeights + outBiases);
            totalFlops += (long)outWeights * 2;

            candidate.TotalParameters = totalParams;
            candidate.EstimatedFlops = totalFlops;
        }

        public float ComputeParetoScore(CandidateArchitecture candidate, float accuracyWeight = 0.7f, float efficiencyWeight = 0.3f)
        {
            // Normalize accuracy (0..1) and FLOPs efficiency (smaller is better)
            float accScore = Mathf.Clamp01(candidate.ValidationAccuracy);
            float flopNorm = Mathf.Clamp01(1.0f - (candidate.EstimatedFlops / 250000.0f));

            candidate.ParetoScore = (accScore * accuracyWeight) + (flopNorm * efficiencyWeight);
            return candidate.ParetoScore;
        }
    }
}
