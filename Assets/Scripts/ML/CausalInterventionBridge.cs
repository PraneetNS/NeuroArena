using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.ML
{
    /// <summary>
    /// CausalInterventionBridge: Dispatches do-calculus intervention events from the client
    /// to runtime physics / biome environmental parameters and tracks counterfactual divergences.
    /// </summary>
    public class CausalInterventionBridge : MonoBehaviour
    {
        [Header("Observable Biome Factors")]
        [SerializeField] private float terrainSlope = 0.12f;
        [SerializeField] private float agentVelocity = 6.5f;
        [SerializeField] private float energyConsumption = 24.3f;
        [SerializeField] private float surfaceFriction = 0.85f;
        [SerializeField] private float spikeRate = 42.0f;

        [Header("Causal Interventions")]
        [SerializeField] private bool hasActiveIntervention;
        [SerializeField] private string activeIntervenedVar;
        [SerializeField] private float activeIntervenedVal;

        public event Action<string, float, Dictionary<string, float>> OnInterventionComputed;

        public Dictionary<string, float> GetCurrentState()
        {
            return new Dictionary<string, float>
            {
                { "terrain_slope", terrainSlope },
                { "agent_velocity", agentVelocity },
                { "energy_consumption", energyConsumption },
                { "friction", surfaceFriction },
                { "spike_rate", spikeRate }
            };
        }

        /// <summary>
        /// Applies Pearl's do-operator: do(varName = value)
        /// </summary>
        public void ApplyDoIntervention(string varName, float value)
        {
            hasActiveIntervention = true;
            activeIntervenedVar = varName;
            activeIntervenedVal = value;

            var downstream = new Dictionary<string, float>(GetCurrentState());
            downstream[varName] = value;

            // Downstream simulated propagation heuristics
            if (varName == "friction")
            {
                // Lower friction increases velocity, decreases spike effort
                downstream["agent_velocity"] = Mathf.Clamp(agentVelocity * (1.0f + (0.85f - value)), 1f, 25f);
                downstream["energy_consumption"] = energyConsumption * (0.8f + value * 0.2f);
            }
            else if (varName == "terrain_slope")
            {
                downstream["energy_consumption"] = energyConsumption * (1.0f + value * 2.5f);
                downstream["spike_rate"] = spikeRate * (1.0f + value * 1.8f);
            }

            OnInterventionComputed?.Invoke(varName, value, downstream);
        }

        public void ResetInterventions()
        {
            hasActiveIntervention = false;
            activeIntervenedVar = null;
            activeIntervenedVal = 0f;
        }
    }
}
