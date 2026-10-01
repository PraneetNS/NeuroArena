using System;
using UnityEngine;

namespace NeuroArena.ML
{
    /// <summary>
    /// KolmogorovArnoldNetwork (KAN): Implements a neural layer based on the Kolmogorov-Arnold
    /// representation theorem. Replaces traditional node-based activations with learnable
    /// univariate 1D B-spline functions parameterized along each incoming connection edge:
    ///   \Phi(x) = \sum_{i=1}^{d_{in}} \phi_i(x_i)
    /// where \phi_i(x) = w_b * silu(x) + w_s * \sum_k c_k B_k(x).
    /// </summary>
    public class KolmogorovArnoldNetwork : MonoBehaviour
    {
        [Header("KAN Architecture")]
        [SerializeField] private int inputDimension = 4;
        [SerializeField] private int outputDimension = 2;
        [SerializeField] private int gridIntervals = 5;
        [SerializeField] private int splineOrder = 3;

        private float[] gridKnots;
        private float[,,] splineWeights; // [inDim, outDim, numCoeffs]
        private float[,] baseWeights;    // [inDim, outDim]

        private void Awake()
        {
            InitializeKAN();
        }

        private void InitializeKAN()
        {
            int numCoeffs = gridIntervals + splineOrder;
            splineWeights = new float[inputDimension, outputDimension, numCoeffs];
            baseWeights = new float[inputDimension, outputDimension];

            // Setup uniform grid knots over [-1.0, 1.0] with margin
            int totalKnots = gridIntervals + 2 * splineOrder + 1;
            gridKnots = new float[totalKnots];
            float step = 2.0f / gridIntervals;
            float start = -1.0f - splineOrder * step;

            for (int i = 0; i < totalKnots; i++)
            {
                gridKnots[i] = start + i * step;
            }

            // Initialize weights with Xavier variance scaling
            float scale = Mathf.Sqrt(1.0f / inputDimension);
            for (int i = 0; i < inputDimension; i++)
            {
                for (int j = 0; j < outputDimension; j++)
                {
                    baseWeights[i, j] = UnityEngine.Random.Range(-scale, scale);
                    for (int k = 0; k < numCoeffs; k++)
                    {
                        splineWeights[i, j, k] = UnityEngine.Random.Range(-scale * 0.1f, scale * 0.1f);
                    }
                }
            }
        }

        /// <summary>
        /// Cox-de Boor recursive evaluation of B-spline basis function B_{i, p}(x)
        /// </summary>
        private float EvaluateSplineBasis(float x, int i, int p)
        {
            if (p == 0)
            {
                return (x >= gridKnots[i] && x < gridKnots[i + 1]) ? 1.0f : 0.0f;
            }

            float leftDenom = gridKnots[i + p] - gridKnots[i];
            float rightDenom = gridKnots[i + p + 1] - gridKnots[i + 1];

            float left = 0f;
            if (Mathf.Abs(leftDenom) > 1e-6f)
            {
                left = ((x - gridKnots[i]) / leftDenom) * EvaluateSplineBasis(x, i, p - 1);
            }

            float right = 0f;
            if (Mathf.Abs(rightDenom) > 1e-6f)
            {
                right = ((gridKnots[i + p + 1] - x) / rightDenom) * EvaluateSplineBasis(x, i + 1, p - 1);
            }

            return left + right;
        }

        /// <summary>
        /// Forward inference pass computing output activations
        /// </summary>
        public float[] Forward(float[] inputs)
        {
            float[] outputs = new float[outputDimension];
            int numCoeffs = gridIntervals + splineOrder;

            for (int j = 0; j < outputDimension; j++)
            {
                float sum = 0f;
                for (int i = 0; i < inputDimension; i++)
                {
                    float x = Mathf.Clamp(inputs[i], -1.0f, 0.999f);

                    // Base residual activation: SiLU(x) = x / (1 + exp(-x))
                    float silu = x / (1.0f + Mathf.Exp(-x));
                    float baseVal = baseWeights[i, j] * silu;

                    // Spline activation: \sum_k c_k B_k(x)
                    float splineVal = 0f;
                    for (int k = 0; k < numCoeffs; k++)
                    {
                        splineVal += splineWeights[i, j, k] * EvaluateSplineBasis(x, k, splineOrder);
                    }

                    sum += baseVal + splineVal;
                }
                outputs[j] = sum;
            }

            return outputs;
        }
    }
}
