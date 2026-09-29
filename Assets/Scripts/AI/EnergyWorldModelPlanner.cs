using System;
using UnityEngine;

namespace NeuroArena.AI
{
    /// <summary>
    /// EnergyWorldModelPlanner: Plans control trajectories by optimizing action sequences
    /// that minimize free energy on the learned neural energy landscape.
    /// </summary>
    public class EnergyWorldModelPlanner : MonoBehaviour
    {
        [Header("State Representation")]
        [SerializeField] private Vector3 currentPosition;
        [SerializeField] private Vector3 currentVelocity;
        [SerializeField] private Vector3 goalPosition;

        [Header("Planner Hyperparameters")]
        [SerializeField] private int horizon = 5;
        [SerializeField] private int optimizationIterations = 8;
        [SerializeField] private float learningRate = 0.1f;
        [SerializeField] private float energyThreshold = 0.05f;

        [Header("Telemetry")]
        [SerializeField] private float minimumEnergyFound;
        [SerializeField] private Vector3 plannedAcceleration;

        private void Update()
        {
            currentPosition = transform.position;
            if (GetComponent<Rigidbody>() != null)
            {
                currentVelocity = GetComponent<Rigidbody>().velocity;
            }

            PlanOptimalTrajectory();
        }

        /// <summary>
        /// Evaluates heuristic energy landscape E(state, goal) = DistanceToGoal + VelocityAlignment
        /// </summary>
        public float EvaluateEnergy(Vector3 pos, Vector3 vel, Vector3 goal)
        {
            float distToGoal = Vector3.Distance(pos, goal);
            Vector3 desiredDir = (goal - pos).normalized;
            float alignment = 1.0f - Mathf.Clamp01(Vector3.Dot(vel.normalized, desiredDir));

            // Energy is low when near the goal and aligned
            return distToGoal * 0.7f + alignment * 2.0f;
        }

        /// <summary>
        /// Optimizes planned acceleration vector using gradient descent on the energy surface
        /// </summary>
        public void PlanOptimalTrajectory()
        {
            Vector3 candidateAction = (goalPosition - currentPosition).normalized * 5f;
            float bestEnergy = float.MaxValue;
            const float dt = 0.1f;

            for (int iter = 0; iter < optimizationIterations; iter++)
            {
                // Predict simulated next state
                Vector3 simVel = currentVelocity + candidateAction * dt;
                Vector3 simPos = currentPosition + simVel * dt;

                float energy = EvaluateEnergy(simPos, simVel, goalPosition);
                if (energy < bestEnergy)
                {
                    bestEnergy = energy;
                    plannedAcceleration = candidateAction;
                }

                // Numerical gradient wrt action components
                const float eps = 0.01f;
                Vector3 grad = Vector3.zero;

                // X gradient
                Vector3 simVelX = currentVelocity + (candidateAction + Vector3.right * eps) * dt;
                Vector3 simPosX = currentPosition + simVelX * dt;
                grad.x = (EvaluateEnergy(simPosX, simVelX, goalPosition) - energy) / eps;

                // Z gradient
                Vector3 simVelZ = currentVelocity + (candidateAction + Vector3.forward * eps) * dt;
                Vector3 simPosZ = currentPosition + simVelZ * dt;
                grad.z = (EvaluateEnergy(simPosZ, simVelZ, goalPosition) - energy) / eps;

                // Gradient descent step
                candidateAction -= grad * learningRate;
                candidateAction = Vector3.ClampMagnitude(candidateAction, 15f);
            }

            minimumEnergyFound = bestEnergy;
        }

        public void SetGoal(Vector3 newGoal)
        {
            goalPosition = newGoal;
        }
    }
}
