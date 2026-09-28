using System;
using UnityEngine;

namespace NeuroArena.Optimization
{
    /// <summary>
    /// SimulatedBifurcationOptimizer: Client-side simulated bifurcation solver for fast
    /// combinatorial feature subset selection and neural topology partitioning.
    /// </summary>
    public class SimulatedBifurcationOptimizer : MonoBehaviour
    {
        [Header("Solver Configuration")]
        [SerializeField] private int spinCount = 8;
        [SerializeField] private int iterations = 60;
        [SerializeField] private float timeStep = 0.25f;

        [Header("Telemetry")]
        [SerializeField] private float bestEnergy;
        [SerializeField] private int[] activeSpins;

        public event Action<int[], float> OnOptimizationCompleted;

        public int[] SolveIsingProblem(float[,] couplingMatrix, float[] linearBias = null)
        {
            int n = couplingMatrix.GetLength(0);
            float[] x = new float[n];
            float[] y = new float[n];
            int[] spins = new int[n];

            // Thermal seed
            for (int i = 0; i < n; i++)
            {
                x[i] = UnityEngine.Random.Range(-0.05f, 0.05f);
                y[i] = UnityEngine.Random.Range(-0.05f, 0.05f);
            }

            // Normalization
            float maxRow = 0.001f;
            for (int i = 0; i < n; i++)
            {
                float rowSum = 0f;
                for (int j = 0; j < n; j++) rowSum += Mathf.Abs(couplingMatrix[i, j]);
                if (rowSum > maxRow) maxRow = rowSum;
            }
            float c0 = 0.5f / maxRow;

            for (int step = 0; step < iterations; step++)
            {
                float pump = (float)step / iterations;

                // Position half step
                for (int i = 0; i < n; i++) x[i] += 0.5f * timeStep * y[i];

                // Momentum full step
                for (int i = 0; i < n; i++)
                {
                    float forceJ = 0f;
                    for (int j = 0; j < n; j++) forceJ += couplingMatrix[i, j] * x[j];
                    if (linearBias != null && i < linearBias.Length) forceJ += linearBias[i];

                    float force = -(1f - pump) * x[i] - (x[i] * x[i] * x[i]) + (c0 * forceJ);
                    y[i] += timeStep * force;

                    if (Mathf.Abs(x[i]) > 1f) y[i] = 0f;
                }

                // Position second half step
                for (int i = 0; i < n; i++)
                {
                    x[i] += 0.5f * timeStep * y[i];
                    x[i] = Mathf.Clamp(x[i], -1f, 1f);
                }
            }

            for (int i = 0; i < n; i++)
            {
                spins[i] = x[i] >= 0f ? 1 : -1;
            }

            bestEnergy = EvaluateEnergy(spins, couplingMatrix, linearBias);
            activeSpins = spins;

            OnOptimizationCompleted?.Invoke(spins, bestEnergy);
            return spins;
        }

        private float EvaluateEnergy(int[] s, float[,] J, float[] h)
        {
            int n = s.Length;
            float energy = 0f;
            for (int i = 0; i < n; i++)
            {
                for (int j = 0; j < n; j++)
                {
                    energy -= 0.5f * J[i, j] * s[i] * s[j];
                }
                if (h != null && i < h.Length) energy -= h[i] * s[i];
            }
            return energy;
        }
    }
}
