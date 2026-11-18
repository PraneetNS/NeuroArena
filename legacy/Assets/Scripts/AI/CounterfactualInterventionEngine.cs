using System;
using UnityEngine;

namespace NeuroArena.AI
{
    /// <summary>
    /// CounterfactualInterventionEngine: Implements Judea Pearl's Level 3 Causal Hierarchy (Counterfactuals)
    /// within a Structural Causal Model (SCM). Executes the 3-step counterfactual algorithm:
    ///   1. Abduction:  Infer exogenous background noise U given factual observation (S_t, A_t, S_{t+1}).
    ///   2. Action:     Perform surgical intervention by replacing action mechanism with do(A = a*).
    ///   3. Prediction: Evaluate counterfactual outcome S* using modified causal graph and abduced U.
    /// Enables AI boss agents and combat tutors to ask: "What would have happened if player dashed left instead of shielding?"
    /// </summary>
    public class CounterfactualInterventionEngine : MonoBehaviour
    {
        [Header("SCM Dynamics")]
        [SerializeField] private float frictionCoefficient = 0.92f;
        [SerializeField] private float thrustMagnitude = 5.0f;

        /// <summary>
        /// Step 1 - Abduction: Invert forward mechanics to extract exogenous shock U_t
        /// Factual model: S_{t+1} = S_t * friction + ActionVector(A_t) + U_t
        /// </summary>
        public Vector3 AbduceExogenousNoise(Vector3 stateT, int factualAction, Vector3 stateNext)
        {
            Vector3 actionImpulse = GetActionImpulse(factualAction);
            Vector3 deterministicPrediction = stateT * frictionCoefficient + actionImpulse;
            // Exogenous disturbance U = factual outcome - deterministic component
            return stateNext - deterministicPrediction;
        }

        /// <summary>
        /// Step 2 & 3 - Action & Prediction: Simulate counterfactual query do(A = counterfactualAction)
        /// </summary>
        public Vector3 PredictCounterfactualOutcome(Vector3 stateT, int factualAction, Vector3 stateNext, int counterfactualAction)
        {
            Vector3 abducedNoise = AbduceExogenousNoise(stateT, factualAction, stateNext);
            Vector3 counterfactualImpulse = GetActionImpulse(counterfactualAction);

            // Counterfactual outcome retains exact observed empirical noise U_t
            return stateT * frictionCoefficient + counterfactualImpulse + abducedNoise;
        }

        private Vector3 GetActionImpulse(int action)
        {
            switch (action)
            {
                case 0: return Vector3.zero;                    // Idle
                case 1: return Vector3.forward * thrustMagnitude; // Advance
                case 2: return Vector3.left * thrustMagnitude;    // Dash Left
                case 3: return Vector3.right * thrustMagnitude;   // Dash Right
                case 4: return Vector3.up * thrustMagnitude;      // Jump
                default: return Vector3.zero;
            }
        }
    }
}
