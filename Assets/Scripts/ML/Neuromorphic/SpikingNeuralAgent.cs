using System;
using UnityEngine;

namespace NeuroArena.ML.Neuromorphic
{
    /// <summary>
    /// Neuromorphic Spiking Neural Network (SNN) agent driven by Leaky Integrate-and-Fire (LIF)
    /// membrane dynamics and Spike-Timing-Dependent Plasticity (STDP).
    /// Provides bio-inspired ultra-low-power event-driven reflexes and synaptic adaptation
    /// for autonomous swarm drones operating in high-frequency adversarial biomes.
    /// </summary>
    public class SpikingNeuralAgent : MonoBehaviour
    {
        [Header("LIF Membrane Biophysics")]
        [Tooltip("Resting membrane potential in mV")]
        [SerializeField] private float restingPotential = -70f;

        [Tooltip("Spike generation threshold potential in mV")]
        [SerializeField] private float thresholdPotential = -55f;

        [Tooltip("Post-spike reset membrane potential in mV")]
        [SerializeField] private float resetPotential = -75f;

        [Tooltip("Membrane time constant tau_m in seconds (RC decay rate)")]
        [SerializeField] private float membraneTimeConstant = 0.020f; // 20ms

        [Tooltip("Absolute refractory period duration in seconds")]
        [SerializeField] private float refractoryPeriod = 0.003f; // 3ms

        [Tooltip("Membrane resistance R_m in MegaOhms")]
        [SerializeField] private float membraneResistance = 10f;

        [Header("SNN Topology & Synaptic Plasticity")]
        [SerializeField] private int inputNeuronCount = 8;
        [SerializeField] private int hiddenNeuronCount = 16;
        [SerializeField] private int motorNeuronCount = 4; // Thrust, Turn, Shield, Discharge
        [SerializeField] private float learningRateSTDP = 0.005f;
        [SerializeField] private float stdpTimeWindow = 0.020f; // 20ms plasticity window

        // Neuron states
        private float[] _membranePotentials;
        private float[] _lastSpikeTime;
        private bool[] _isSpiking;
        private int _totalNeuronCount;

        // Synaptic weight matrix [pre, post]
        private float[,] _synapticWeights;

        // Telemetry & metrics
        private int _totalSpikesFired = 0;
        private float _meanFiringRateHz = 0f;
        private float _simulationClock = 0f;

        // Public properties for telemetry and swarm coordination
        public int TotalNeuronCount => _totalNeuronCount;
        public int TotalSpikesFired => _totalSpikesFired;
        public float MeanFiringRateHz => _meanFiringRateHz;
        public float RestingPotential => restingPotential;
        public float ThresholdPotential => thresholdPotential;

        private void Awake()
        {
            InitializeNetwork();
        }

        /// <summary>
        /// Allocates membrane arrays and initializes synaptic weights with small random Gaussian values.
        /// </summary>
        public void InitializeNetwork()
        {
            _totalNeuronCount = inputNeuronCount + hiddenNeuronCount + motorNeuronCount;
            _membranePotentials = new float[_totalNeuronCount];
            _lastSpikeTime = new float[_totalNeuronCount];
            _isSpiking = new bool[_totalNeuronCount];

            for (int i = 0; i < _totalNeuronCount; i++)
            {
                _membranePotentials[i] = restingPotential;
                _lastSpikeTime[i] = -999f;
                _isSpiking[i] = false;
            }

            // Synaptic weights: dense connections from inputs -> hidden, and hidden -> motors
            _synapticWeights = new float[_totalNeuronCount, _totalNeuronCount];
            UnityEngine.Random.InitState(42);

            for (int i = 0; i < inputNeuronCount; i++)
            {
                for (int j = inputNeuronCount; j < inputNeuronCount + hiddenNeuronCount; j++)
                {
                    _synapticWeights[i, j] = UnityEngine.Random.Range(0.2f, 0.8f);
                }
            }

            for (int i = inputNeuronCount; i < inputNeuronCount + hiddenNeuronCount; i++)
            {
                for (int j = inputNeuronCount + hiddenNeuronCount; j < _totalNeuronCount; j++)
                {
                    _synapticWeights[i, j] = UnityEngine.Random.Range(0.2f, 0.8f);
                }
            }
        }

        /// <summary>
        /// Integrates input currents, updates membrane potentials via exact exponential Euler integration,
        /// fires threshold action potentials, and applies STDP synaptic updates.
        /// </summary>
        /// <param name="sensoryInputs">Normalized sensory currents in [0, 1] range</param>
        /// <param name="dt">Time step in seconds</param>
        /// <returns>Motor output spike array (length motorNeuronCount)</returns>
        public bool[] StepSimulation(float[] sensoryInputs, float dt)
        {
            if (sensoryInputs == null || sensoryInputs.Length != inputNeuronCount)
            {
                sensoryInputs = new float[inputNeuronCount];
            }

            _simulationClock += dt;
            int stepSpikeCount = 0;

            // 1. Calculate incoming synaptic and sensory currents I_syn(i)
            float[] inputCurrents = new float[_totalNeuronCount];

            // Direct sensory injection into input layer
            for (int i = 0; i < inputNeuronCount; i++)
            {
                inputCurrents[i] = sensoryInputs[i] * 3.5f; // nanoAmperes
            }

            // Recurrent / feedforward synaptic currents from previous step's spikes
            for (int pre = 0; pre < _totalNeuronCount; pre++)
            {
                if (_isSpiking[pre])
                {
                    for (int post = 0; post < _totalNeuronCount; post++)
                    {
                        float weight = _synapticWeights[pre, post];
                        if (weight > 0f)
                        {
                            inputCurrents[post] += weight * 2.0f;
                        }
                    }
                }
            }

            // 2. Clear spike flags for current step
            for (int i = 0; i < _totalNeuronCount; i++)
            {
                _isSpiking[i] = false;
            }

            // 3. Integrate Leaky Integrate-and-Fire equation:
            // dV/dt = -(V - V_rest) / tau_m + (R_m * I) / tau_m
            // Analytical Euler decay factor = exp(-dt / tau_m)
            float decay = Mathf.Exp(-dt / membraneTimeConstant);

            for (int i = 0; i < _totalNeuronCount; i++)
            {
                // Refractory period check: if neuron spiked recently, lock membrane at resetPotential
                if (_simulationClock - _lastSpikeTime[i] < refractoryPeriod)
                {
                    _membranePotentials[i] = resetPotential;
                    continue;
                }

                // Subthreshold decay and current integration
                float vInf = restingPotential + membraneResistance * inputCurrents[i];
                _membranePotentials[i] = vInf + (_membranePotentials[i] - vInf) * decay;

                // Threshold check: generate action potential
                if (_membranePotentials[i] >= thresholdPotential)
                {
                    _isSpiking[i] = true;
                    _lastSpikeTime[i] = _simulationClock;
                    _membranePotentials[i] = resetPotential; // Instantaneous reset
                    _totalSpikesFired++;
                    stepSpikeCount++;
                }
            }

            // 4. Spike-Timing-Dependent Plasticity (STDP) adaptation
            ApplySTDP();

            // 5. Update firing rate moving average
            float instantRate = stepSpikeCount / (Mathf.Max(dt, 0.0001f) * _totalNeuronCount);
            _meanFiringRateHz = Mathf.Lerp(_meanFiringRateHz, instantRate, 0.05f);

            // 6. Extract motor layer spikes
            bool[] motorSpikes = new bool[motorNeuronCount];
            int motorOffset = inputNeuronCount + hiddenNeuronCount;
            for (int m = 0; m < motorNeuronCount; m++)
            {
                motorSpikes[m] = _isSpiking[motorOffset + m];
            }

            return motorSpikes;
        }

        /// <summary>
        /// Adjusts synaptic weights based on relative spike timing:
        /// Long-Term Potentiation (LTP) if pre fires before post: delta_w > 0
        /// Long-Term Depression (LTD) if post fires before pre: delta_w < 0
        /// </summary>
        private void ApplySTDP()
        {
            for (int pre = 0; pre < _totalNeuronCount; pre++)
            {
                if (!_isSpiking[pre]) continue;

                for (int post = 0; post < _totalNeuronCount; post++)
                {
                    if (_synapticWeights[pre, post] <= 0f) continue;

                    float deltaT = _lastSpikeTime[post] - _lastSpikeTime[pre];
                    if (Mathf.Abs(deltaT) < stdpTimeWindow && deltaT != 0f)
                    {
                        if (deltaT > 0f)
                        {
                            // Pre before post -> LTP
                            float ltp = learningRateSTDP * Mathf.Exp(-deltaT / stdpTimeWindow);
                            _synapticWeights[pre, post] = Mathf.Clamp(_synapticWeights[pre, post] + ltp, 0.01f, 2.5f);
                        }
                        else
                        {
                            // Post before pre -> LTD
                            float ltd = learningRateSTDP * 1.05f * Mathf.Exp(deltaT / stdpTimeWindow);
                            _synapticWeights[pre, post] = Mathf.Clamp(_synapticWeights[pre, post] - ltd, 0.01f, 2.5f);
                        }
                    }
                }
            }
        }

        /// <summary>
        /// Returns a snapshot copy of the membrane potentials for visualization and telemetry.
        /// </summary>
        public float[] GetMembranePotentials()
        {
            return (float[])_membranePotentials.Clone();
        }

        /// <summary>
        /// Returns a snapshot of binary spike activities across all neurons.
        /// </summary>
        public bool[] GetSpikeStates()
        {
            return (bool[])_isSpiking.Clone();
        }
    }
}
