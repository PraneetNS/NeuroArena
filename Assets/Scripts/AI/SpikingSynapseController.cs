using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.AI
{
    /// <summary>
    /// SpikingSynapseController: Implements biologically inspired Leaky Integrate-and-Fire (LIF)
    /// membrane potential dynamics in Unity C# for micro-watt equivalent sparse evasive maneuvers.
    /// </summary>
    public class SpikingSynapseController : MonoBehaviour
    {
        [Header("LIF Neuron Configuration")]
        [SerializeField] private float membranePotential = 0.0f;
        [SerializeField] private float restingPotential = 0.0f;
        [SerializeField] private float thresholdPotential = 1.0f;
        [SerializeField] private float decayRate = 0.85f;
        [SerializeField] private float refractoryPeriod = 0.04f;

        [Header("Sensory Receptor")]
        [SerializeField] private float sensoryCurrent = 0.0f;
        [SerializeField] private int totalSpikesFired = 0;

        private float refractoryTimer = 0.0f;
        private readonly Queue<float> spikeTimestamps = new Queue<float>();

        public float MembranePotential => membranePotential;
        public int TotalSpikesFired => totalSpikesFired;

        private void Update()
        {
            float dt = Time.deltaTime;
            if (refractoryTimer > 0f)
            {
                refractoryTimer -= dt;
                membranePotential = restingPotential;
                return;
            }

            // Continuous Leaky Integration: dV/dt = -decay*(V - V_rest) + I_ext
            membranePotential = (membranePotential - restingPotential) * Mathf.Pow(decayRate, dt * 60f) + restingPotential;
            membranePotential += sensoryCurrent * dt;

            // Spike Condition
            if (membranePotential >= thresholdPotential)
            {
                EmitSpike();
            }
        }

        private void EmitSpike()
        {
            totalSpikesFired++;
            membranePotential = restingPotential;
            refractoryTimer = refractoryPeriod;
            spikeTimestamps.Enqueue(Time.time);

            while (spikeTimestamps.Count > 0 && Time.time - spikeTimestamps.Peek() > 1.0f)
            {
                spikeTimestamps.Dequeue();
            }

            // Quick evasive micro-torque pulse
            transform.Rotate(Vector3.up, UnityEngine.Random.Range(-15f, 15f));
        }

        public void InjectCurrent(float current)
        {
            sensoryCurrent = current;
        }

        public float GetInstantaneousFiringRate()
        {
            return spikeTimestamps.Count; // Spikes per last second
        }
    }
}
