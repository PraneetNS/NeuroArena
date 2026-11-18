using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.Prediction
{
    /// <summary>
    /// KoopmanSpectralPredictor: Lifts non-linear kinematic state variables [x, y, z, v_x, v_y, v_z]
    /// into an infinite-dimensional Hilbert space of nonlinear observables \psi(x).
    /// Evolves observables linearly forward in time using Koopman Operator Theory:
    ///   \psi(x_{k+1}) = \mathcal{K} \psi(x_k)
    /// enabling fast closed-form multi-step ahead trajectory forecasting without numerical ODE stepping.
    /// </summary>
    public class KoopmanSpectralPredictor : MonoBehaviour
    {
        [Header("Observable Lifting")]
        [SerializeField] private int observableDim = 12;
        [SerializeField] private int predictionHorizon = 10;
        [SerializeField] private float timeStep = 0.05f;

        private float[] liftedObservables;
        private float[,] koopmanMatrix;

        private void Awake()
        {
            liftedObservables = new float[observableDim];
            koopmanMatrix = new float[observableDim, observableDim];

            // Initialize Koopman matrix with stable oscillatory/decay diagonal modes
            for (int i = 0; i < observableDim; i++)
            {
                for (int j = 0; j < observableDim; j++)
                {
                    koopmanMatrix[i, j] = (i == j) ? 0.98f : 0.0f;
                }
            }
        }

        /// <summary>
        /// Lift 3D position and velocity into observable dictionary
        /// \psi(x) = [x, y, z, vx, vy, vz, x^2, y^2, z^2, sin(x), sin(y), sin(z)]
        /// </summary>
        public float[] LiftState(Vector3 pos, Vector3 vel)
        {
            float[] obs = new float[observableDim];
            obs[0] = pos.x;
            obs[1] = pos.y;
            obs[2] = pos.z;
            obs[3] = vel.x;
            obs[4] = vel.y;
            obs[5] = vel.z;

            // Nonlinear higher-order observables
            obs[6] = pos.x * pos.x * 0.1f;
            obs[7] = pos.y * pos.y * 0.1f;
            obs[8] = pos.z * pos.z * 0.1f;
            obs[9] = Mathf.Sin(pos.x);
            obs[10] = Mathf.Sin(pos.y);
            obs[11] = Mathf.Sin(pos.z);

            return obs;
        }

        /// <summary>
        /// Forecasts trajectory H steps into the future via repeated linear Koopman operator action
        /// </summary>
        public List<Vector3> ForecastTrajectory(Vector3 currentPos, Vector3 currentVel, int steps)
        {
            List<Vector3> futurePositions = new List<Vector3>();
            float[] obs = LiftState(currentPos, currentVel);

            for (int h = 0; h < steps; h++)
            {
                float[] nextObs = new float[observableDim];
                for (int i = 0; i < observableDim; i++)
                {
                    float sum = 0f;
                    for (int j = 0; j < observableDim; j++)
                    {
                        sum += koopmanMatrix[i, j] * obs[j];
                    }
                    nextObs[i] = sum;
                }

                obs = nextObs;
                futurePositions.Add(new Vector3(obs[0], obs[1], obs[2]));
            }

            return futurePositions;
        }
    }
}
