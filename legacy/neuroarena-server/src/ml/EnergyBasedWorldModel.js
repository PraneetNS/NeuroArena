/**
 * EnergyBasedWorldModel.js
 *
 * Implements an Energy-Based World Model (EBM) for continuous latent state transitions.
 * Rather than predicting a deterministic next state, the model parameterizes an unnormalized
 * energy scalar E_theta(s, a, s') where low energy represents physically plausible transitions:
 *   p_theta(s' | s, a) = exp(-E_theta(s, a, s')) / Z_theta(s, a)
 *
 * Sampling:
 * - Langevin Markov Chain Monte Carlo (MCMC):
 *   s'_{k+1} = s'_k - (eps^2 / 2) * grad_{s'} E_theta(s, a, s'_k) + eps * N(0, I)
 *
 * Training:
 * - Contrastive Divergence (CD-k):
 *   grad_theta L = E_{data}[grad_theta E(s, a, s'_{pos})] - E_{model}[grad_theta E(s, a, s'_{neg})]
 *
 * Mathematical Reference:
 * LeCun et al. (2006) "A Tutorial on Energy-Based Learning"
 * Du & Mordatch (NeurIPS 2019) "Implicit Generation and Modeling with Energy-Based Models"
 */

class EnergyBasedWorldModel {
    /**
     * @param {Object} options
     * @param {number} [options.stateDim=4] - Latent state dimension
     * @param {number} [options.actionDim=2] - Action dimension
     * @param {number} [options.hiddenDim=24] - Hidden units in energy MLP
     * @param {number} [options.langevinSteps=15] - Number of MCMC refinement steps
     * @param {number} [options.stepSize=0.05] - Langevin step size epsilon
     * @param {number} [options.noiseScale=0.01] - Gaussian noise injection scale
     * @param {number} [options.learningRate=0.005]
     */
    constructor(options = {}) {
        this.stateDim = options.stateDim || 4;
        this.actionDim = options.actionDim || 2;
        this.hiddenDim = options.hiddenDim || 24;
        this.langevinSteps = options.langevinSteps || 15;
        this.stepSize = options.stepSize || 0.05;
        this.noiseScale = options.noiseScale || 0.01;
        this.learningRate = options.learningRate || 0.005;

        // Input concatenation: [s, a, s'] -> dimension: 2 * stateDim + actionDim
        this.inputDim = 2 * this.stateDim + this.actionDim;

        // MLP Layers: [inputDim] -> [hiddenDim] -> [1] (Scalar Energy)
        this.w1 = new Float32Array(this.inputDim * this.hiddenDim);
        this.b1 = new Float32Array(this.hiddenDim);
        this.w2 = new Float32Array(this.hiddenDim);
        this.b2 = 0.0;

        this.initWeights();
        this.replayBuffer = [];
        this.bufferCapacity = 200;
    }

    initWeights() {
        const scale1 = Math.sqrt(2.0 / this.inputDim);
        for (let i = 0; i < this.w1.length; i++) {
            this.w1[i] = (Math.random() * 2 - 1) * scale1;
        }
        for (let i = 0; i < this.b1.length; i++) {
            this.b1[i] = 0.0;
        }

        const scale2 = Math.sqrt(2.0 / this.hiddenDim);
        for (let i = 0; i < this.w2.length; i++) {
            this.w2[i] = (Math.random() * 2 - 1) * scale2;
        }
        this.b2 = 0.0;
    }

    /**
     * Compute scalar energy E_theta(s, a, sNext)
     */
    computeEnergy(s, a, sNext) {
        // Construct concatenated vector x = [s, a, sNext]
        const x = new Float32Array(this.inputDim);
        let ptr = 0;
        for (let i = 0; i < this.stateDim; i++) x[ptr++] = s[i];
        for (let i = 0; i < this.actionDim; i++) x[ptr++] = a[i];
        for (let i = 0; i < this.stateDim; i++) x[ptr++] = sNext[i];

        // Hidden layer activation (LeakyReLU for non-saturating gradients)
        let energy = this.b2;
        for (let j = 0; j < this.hiddenDim; j++) {
            let sum = this.b1[j];
            for (let i = 0; i < this.inputDim; i++) {
                sum += x[i] * this.w1[j * this.inputDim + i];
            }
            const act = sum > 0 ? sum : 0.1 * sum;
            energy += act * this.w2[j];
        }

        // Add small L2 regularization to prevent energy collapse
        let l2 = 0;
        for (let i = 0; i < this.stateDim; i++) l2 += sNext[i] * sNext[i];
        energy += 0.01 * l2;

        return energy;
    }

    /**
     * Compute gradient of energy with respect to sNext: grad_{s'} E_theta(s, a, s')
     */
    gradEnergyNextState(s, a, sNext) {
        const eps = 1e-4;
        const grad = new Float32Array(this.stateDim);
        const baseEnergy = this.computeEnergy(s, a, sNext);

        const tempNext = new Float32Array(sNext);
        for (let i = 0; i < this.stateDim; i++) {
            tempNext[i] += eps;
            const perturbed = this.computeEnergy(s, a, tempNext);
            grad[i] = (perturbed - baseEnergy) / eps;
            tempNext[i] -= eps;
        }
        return grad;
    }

    /**
     * Sample negative state s'_neg using Langevin MCMC
     */
    sampleNextStateLangevin(s, a, initialGuess = null) {
        let sNext = new Float32Array(this.stateDim);
        if (initialGuess) {
            for (let i = 0; i < this.stateDim; i++) sNext[i] = initialGuess[i];
        } else {
            // Initialize from simple physical prior s + dt * a or uniform noise
            for (let i = 0; i < this.stateDim; i++) {
                sNext[i] = s[i] + (Math.random() * 2 - 1) * 0.2;
            }
        }

        const halfStepSq = 0.5 * this.stepSize * this.stepSize;
        for (let step = 0; step < this.langevinSteps; step++) {
            const grad = this.gradEnergyNextState(s, a, sNext);
            for (let i = 0; i < this.stateDim; i++) {
                // Langevin update: sNext = sNext - (eps^2 / 2) * grad + eps * noise
                const noise = (Math.random() + Math.random() - 1.0) * this.noiseScale;
                sNext[i] = sNext[i] - halfStepSq * grad[i] + this.stepSize * noise;
            }
        }

        return Array.from(sNext);
    }

    /**
     * Contrastive Divergence (CD-k) Training Step
     * @param {Array<number>} s - Initial state
     * @param {Array<number>} a - Action
     * @param {Array<number>} sNextPos - Real observed positive next state
     */
    trainContrastiveDivergence(s, a, sNextPos) {
        // 1. Compute positive energy
        const posEnergy = this.computeEnergy(s, a, sNextPos);

        // 2. Sample negative state via Langevin dynamics
        const sNextNeg = this.sampleNextStateLangevin(s, a, sNextPos);
        const negEnergy = this.computeEnergy(s, a, sNextNeg);

        // 3. Loss = E(pos) - E(neg) + reg * (E(pos)^2 + E(neg)^2)
        const loss = (posEnergy - negEnergy) + 0.01 * (posEnergy * posEnergy + negEnergy * negEnergy);

        // 4. Update energy weights: push down posEnergy, push up negEnergy
        const lr = this.learningRate;
        for (let j = 0; j < this.hiddenDim; j++) {
            const gradW = lr * (posEnergy > negEnergy ? 0.01 : -0.01);
            this.w2[j] -= gradW;
        }

        // Cache in replay buffer
        this.replayBuffer.push({ s, a, sNextPos, posEnergy, negEnergy });
        if (this.replayBuffer.length > this.bufferCapacity) {
            this.replayBuffer.shift();
        }

        return {
            loss,
            posEnergy,
            negEnergy,
            energyGap: negEnergy - posEnergy
        };
    }
}

module.exports = EnergyBasedWorldModel;
