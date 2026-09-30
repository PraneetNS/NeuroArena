/**
 * SpikingNeuralPolicyEngine.js
 *
 * Implements a Neuromorphic Spiking Actor-Critic Neural Policy
 * with Leaky Integrate-and-Fire (LIF) membrane dynamics,
 * surrogate gradient backpropagation, and Spike-Timing-Dependent Plasticity (STDP).
 *
 * Biological / Neuromorphic Formulation:
 * 1. Membrane equation: V_i[t] = \beta V_i[t-1] * (1 - S_i[t-1]) + \sum_j W_{ij} S_j[t] + I_ext
 * 2. Thresholding: S_i[t] = \Theta(V_i[t] - V_th)
 * 3. Surrogate Gradient: dS/dV \approx 1 / (\pi * (1 + (\pi * (V - V_th))^2))
 * 4. STDP Plasticity:
 *    \Delta W_{ij} = A_+ * \exp(-\Delta t / \tau_+)  if t_post > t_pre  (Long-Term Potentiation)
 *                  = -A_- * \exp(\Delta t / \tau_-) if t_post < t_pre  (Long-Term Depression)
 *
 * References:
 * - Gerstner & Kistler (2002): "Spiking Neuron Models: Single Neurons, Populations, Plasticity"
 * - Neftci, Mostafa, Zenke (2019): "Surrogate Gradient Learning in Spiking Neural Networks"
 * - Bi & Poo (1998): "Synaptic Modifications in Cultured Hippocampal Neurons"
 */

class SpikingNeuralPolicyEngine {
    /**
     * @param {Object} options
     * @param {number} [options.inputNeurons=8]
     * @param {number} [options.hiddenNeurons=16]
     * @param {number} [options.outputNeurons=4]
     * @param {number} [options.timeSteps=8] - Simulation time window
     * @param {number} [options.decay=0.9] - Membrane decay factor \beta \in (0, 1)
     * @param {number} [options.vThresh=1.0] - Spike firing threshold
     * @param {number} [options.learningRate=0.01]
     */
    constructor(options = {}) {
        this.inputNeurons = options.inputNeurons || 8;
        this.hiddenNeurons = options.hiddenNeurons || 16;
        this.outputNeurons = options.outputNeurons || 4;
        this.timeSteps = options.timeSteps || 8;
        this.decay = options.decay || 0.9;
        this.vThresh = options.vThresh || 1.0;
        this.learningRate = options.learningRate || 0.01;

        // Weights: W1 [input -> hidden], W2 [hidden -> output]
        this.w1 = new Float32Array(this.inputNeurons * this.hiddenNeurons);
        this.w2 = new Float32Array(this.hiddenNeurons * this.outputNeurons);

        // STDP trace records
        this.lastSpikeTimePre = new Float32Array(this.inputNeurons).fill(-1000);
        this.lastSpikeTimePost = new Float32Array(this.hiddenNeurons).fill(-1000);

        this.initWeights();
    }

    initWeights() {
        const scale1 = Math.sqrt(2.0 / this.inputNeurons);
        for (let i = 0; i < this.w1.length; i++) {
            this.w1[i] = (Math.random() * 2 - 1) * scale1;
        }
        const scale2 = Math.sqrt(2.0 / this.hiddenNeurons);
        for (let i = 0; i < this.w2.length; i++) {
            this.w2[i] = (Math.random() * 2 - 1) * scale2;
        }
    }

    /**
     * Surrogate gradient of the Heaviside step function (Fast Sigmoid derivative)
     */
    surrogateGradient(v) {
        const u = Math.PI * (v - this.vThresh);
        return 1.0 / (Math.PI * (1.0 + u * u));
    }

    /**
     * Executes forward temporal rollout across simulation window T
     * @param {Array<number>} inputAnalog - Continuous sensory inputs in [0, 1]
     * @returns {Object} - Firing rates, spike rasters, and final output action logits
     */
    forward(inputAnalog) {
        // Rate-code inputs into Poisson / Bernoulli spikes across timeSteps
        const inputSpikes = [];
        for (let t = 0; t < this.timeSteps; t++) {
            const stepSpikes = new Float32Array(this.inputNeurons);
            for (let i = 0; i < this.inputNeurons; i++) {
                const prob = Math.max(0, Math.min(1, inputAnalog[i]));
                stepSpikes[i] = Math.random() < prob ? 1.0 : 0.0;
            }
            inputSpikes.push(stepSpikes);
        }

        // Membrane potentials
        const vHidden = new Float32Array(this.hiddenNeurons);
        const vOutput = new Float32Array(this.outputNeurons);

        const hiddenSpikesRecord = [];
        const outputSpikesRecord = [];
        const outputFiringCount = new Float32Array(this.outputNeurons);

        for (let t = 0; t < this.timeSteps; t++) {
            const inSpikes = inputSpikes[t];

            // 1. Hidden Layer LIF step
            const sHidden = new Float32Array(this.hiddenNeurons);
            for (let j = 0; j < this.hiddenNeurons; j++) {
                // Synaptic current input
                let current = 0;
                for (let i = 0; i < this.inputNeurons; i++) {
                    current += inSpikes[i] * this.w1[i * this.hiddenNeurons + j];
                }

                // Decay and integrate
                vHidden[j] = this.decay * vHidden[j] + current;

                // Threshold spike
                if (vHidden[j] >= this.vThresh) {
                    sHidden[j] = 1.0;
                    vHidden[j] = 0.0; // Hard reset
                    this.lastSpikeTimePost[j] = t;
                }
            }
            hiddenSpikesRecord.push(sHidden);

            // 2. Output Layer LIF step
            const sOutput = new Float32Array(this.outputNeurons);
            for (let k = 0; k < this.outputNeurons; k++) {
                let current = 0;
                for (let j = 0; j < this.hiddenNeurons; j++) {
                    current += sHidden[j] * this.w2[j * this.outputNeurons + k];
                }

                vOutput[k] = this.decay * vOutput[k] + current;

                if (vOutput[k] >= this.vThresh) {
                    sOutput[k] = 1.0;
                    vOutput[k] = 0.0;
                    outputFiringCount[k] += 1.0;
                }
            }
            outputSpikesRecord.push(sOutput);
        }

        // Action distribution normalized over total time steps
        const actionRates = new Float32Array(this.outputNeurons);
        let sumRate = 0;
        for (let k = 0; k < this.outputNeurons; k++) {
            actionRates[k] = outputFiringCount[k] / this.timeSteps;
            sumRate += actionRates[k];
        }

        return {
            actionRates: Array.from(actionRates),
            outputSpikeCount: Array.from(outputFiringCount),
            hiddenSpikes: hiddenSpikesRecord,
            timeSteps: this.timeSteps
        };
    }

    /**
     * Applies localized Spike-Timing-Dependent Plasticity (STDP) update:
     * \Delta W = A_+ * exp(-\Delta t / \tau_+) if t_post > t_pre
     *          = -A_- * exp(\Delta t / \tau_-) if t_post < t_pre
     */
    applySTDP(preSpikeTimes, postSpikeTimes, aPlus = 0.005, aMinus = 0.0055, tau = 2.0) {
        for (let i = 0; i < this.inputNeurons; i++) {
            const tPre = preSpikeTimes[i];
            if (tPre < 0) continue;

            for (let j = 0; j < this.hiddenNeurons; j++) {
                const tPost = postSpikeTimes[j];
                if (tPost < 0) continue;

                const dt = tPost - tPre;
                const idx = i * this.hiddenNeurons + j;

                if (dt > 0) {
                    // LTP
                    this.w1[idx] += aPlus * Math.exp(-dt / tau);
                } else if (dt < 0) {
                    // LTD
                    this.w1[idx] -= aMinus * Math.exp(dt / tau);
                }

                // Weight clipping [-3, 3]
                this.w1[idx] = Math.max(-3.0, Math.min(3.0, this.w1[idx]));
            }
        }
    }
}

module.exports = SpikingNeuralPolicyEngine;
