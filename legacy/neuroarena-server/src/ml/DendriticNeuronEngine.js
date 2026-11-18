/**
 * DendriticNeuronEngine.js
 *
 * Implements Multi-Compartment Pyramidal Neurons with Active Dendritic Computation
 * and Non-Linear NMDA Receptor Spiking.
 *
 * Biological / Mathematical Foundations:
 * Standard point neurons reduce dendritic trees to a linear sum. In contrast,
 * neocortical pyramidal neurons perform non-linear multi-layer logic within a single cell.
 *
 * Compartment Structure:
 * 1. Soma: Leaky integrate-and-fire with resting potential V_rest, threshold V_th, and reset V_reset.
 * 2. Basal Dendrites (feedforward inputs): Integrate local synaptic inputs with NMDA non-linearities.
 * 3. Apical Trunk: Axial conductance coupling basal and apical compartments.
 * 4. Apical Tuft (contextual / top-down inputs): Generates long-duration dendritic calcium/NMDA plateau potentials.
 *
 * Non-Linear NMDA Conductance (Jahr & Stevens 1990):
 *   g_{NMDA}(V_d) = \frac{g_{max}}{1 + 0.28 [Mg^{2+}] \exp(-0.062 V_d)}
 * When localized input exceeds threshold, an NMDA plateau potential depolarizes the branch
 * for 20-50 ms, driving burst firing at the soma (coincidence detection between feedforward and context).
 *
 * References:
 * - London & Häusser (Annual Review of Neuroscience 2005): "Dendritic computation"
 * - Poirazi, Brannon, Mel (Neuron 2003): "Pyramidal neuron as 2-layer neural network"
 * - Larkum (Science 1999): "A new cellular mechanism for coupling inputs arriving at different cortical layers"
 */

class DendriticBranch {
    /**
     * @param {Object} options
     * @param {string} options.id - Branch identifier
     * @param {string} options.type - 'basal' or 'apical'
     * @param {number} [options.synapseCount=8] - Number of synaptic inputs
     * @param {number} [options.nmdaThreshold=1.5] - Depolarization threshold for NMDA spike initiation
     */
    constructor(options = {}) {
        this.id = options.id || 'branch';
        this.type = options.type || 'basal';
        this.synapseCount = options.synapseCount || 8;
        this.nmdaThreshold = options.nmdaThreshold || 1.5;

        this.weights = new Float64Array(this.synapseCount);
        for (let i = 0; i < this.synapseCount; i++) {
            this.weights[i] = 0.2 + 0.3 * Math.random();
        }

        this.voltage = -70.0; // Resting potential in mV
        this.plateauActive = false;
        this.plateauRemainingMs = 0;
    }

    /**
     * NMDA Magnesium Block factor B(V) \in [0, 1]
     */
    nmdaMagnesiumBlock(v) {
        const mgConcentration = 1.0; // 1.0 mM physiological Mg2+
        return 1.0 / (1.0 + 0.28 * mgConcentration * Math.exp(-0.062 * v));
    }

    /**
     * Integrates presynaptic spikes for this branch
     * @param {Array<number>} spikes - Binary spike array (0 or 1) of length synapseCount
     * @param {number} dt - Step duration in ms
     * @returns {number} Dendritic branch output current to soma/trunk
     */
    step(spikes, dt = 1.0) {
        // Linear AMPA-like synaptic sum
        let ampaSum = 0.0;
        for (let i = 0; i < this.synapseCount; i++) {
            if (spikes[i] > 0) {
                ampaSum += this.weights[i];
            }
        }

        // NMDA non-linear enhancement
        const mgFactor = this.nmdaMagnesiumBlock(this.voltage);
        const nmdaCurrent = ampaSum * 2.5 * mgFactor;

        // Update branch voltage towards resting (-70 mV)
        const tauDendrite = 15.0; // ms
        const dV = ((-70.0 - this.voltage) + (ampaSum + nmdaCurrent) * 10.0) * (dt / tauDendrite);
        this.voltage += dV;

        // Trigger dendritic plateau if local threshold is reached
        if (ampaSum >= this.nmdaThreshold && !this.plateauActive) {
            this.plateauActive = true;
            this.plateauRemainingMs = 25.0; // 25ms plateau potential
        }

        let outputSignal = 0.0;
        if (this.plateauActive) {
            this.plateauRemainingMs -= dt;
            outputSignal = 3.0; // Sustained depolarizing current
            if (this.plateauRemainingMs <= 0) {
                this.plateauActive = false;
            }
        } else {
            outputSignal = Math.max(0.0, (this.voltage + 70.0) * 0.05);
        }

        return outputSignal;
    }
}

class DendriticNeuronEngine {
    /**
     * @param {Object} options
     * @param {number} [options.basalBranches=3] - Number of basal dendritic branches
     * @param {number} [options.apicalBranches=2] - Number of apical dendritic branches
     * @param {number} [options.synapsesPerBranch=6] - Synapses per branch
     */
    constructor(options = {}) {
        this.basalBranchCount = options.basalBranches || 3;
        this.apicalBranchCount = options.apicalBranches || 2;
        this.synapsesPerBranch = options.synapsesPerBranch || 6;

        this.somaVoltage = -70.0;
        this.somaThreshold = -50.0;
        this.somaReset = -75.0;
        this.refractoryTimer = 0.0;

        // Create compartmental branches
        this.basalBranches = [];
        for (let i = 0; i < this.basalBranchCount; i++) {
            this.basalBranches.push(new DendriticBranch({
                id: `basal_${i}`,
                type: 'basal',
                synapseCount: this.synapsesPerBranch,
                nmdaThreshold: 1.2
            }));
        }

        this.apicalBranches = [];
        for (let i = 0; i < this.apicalBranchCount; i++) {
            this.apicalBranches.push(new DendriticBranch({
                id: `apical_${i}`,
                type: 'apical',
                synapseCount: this.synapsesPerBranch,
                nmdaThreshold: 1.0
            }));
        }

        this.spikeHistory = [];
    }

    /**
     * Steps the multi-compartment neuron by dt milliseconds
     * @param {Array<Array<number>>} basalInputs - Inputs per basal branch
     * @param {Array<Array<number>>} apicalInputs - Inputs per apical branch (context)
     * @param {number} [dt=1.0] - Time step in ms
     * @returns {{ fired: boolean, somaVoltage: number, burstMode: boolean, apicalCoincidence: boolean }}
     */
    step(basalInputs, apicalInputs, dt = 1.0) {
        if (this.refractoryTimer > 0) {
            this.refractoryTimer -= dt;
            return { fired: false, somaVoltage: this.somaReset, burstMode: false, apicalCoincidence: false };
        }

        // 1. Process basal branch compartments
        let totalBasalCurrent = 0.0;
        for (let i = 0; i < this.basalBranches.length; i++) {
            const inputs = basalInputs[i] || new Array(this.synapsesPerBranch).fill(0);
            totalBasalCurrent += this.basalBranches[i].step(inputs, dt);
        }

        // 2. Process apical branch compartments
        let totalApicalCurrent = 0.0;
        let anyApicalPlateau = false;
        for (let i = 0; i < this.apicalBranches.length; i++) {
            const inputs = apicalInputs[i] || new Array(this.synapsesPerBranch).fill(0);
            totalApicalCurrent += this.apicalBranches[i].step(inputs, dt);
            if (this.apicalBranches[i].plateauActive) {
                anyApicalPlateau = true;
            }
        }

        // 3. Dual-compartment coincidence coupling (Larkum mechanism)
        // If apical trunk is activated while basal receives feedforward drive -> Burst firing mode
        const burstMode = anyApicalPlateau && (totalBasalCurrent > 1.5);
        const couplingFactor = burstMode ? 2.8 : 1.0;

        // 4. Soma leaky integration
        const tauSoma = 10.0; // ms
        const totalDrive = (totalBasalCurrent + totalApicalCurrent * 0.6) * couplingFactor;
        const dV = ((-70.0 - this.somaVoltage) + totalDrive * 8.0) * (dt / tauSoma);
        this.somaVoltage += dV;

        let fired = false;
        if (this.somaVoltage >= this.somaThreshold) {
            fired = true;
            this.somaVoltage = this.somaReset;
            this.refractoryTimer = burstMode ? 1.0 : 3.0; // Shorter refractory period during burst
        }

        this.spikeHistory.push(fired ? 1 : 0);
        if (this.spikeHistory.length > 100) this.spikeHistory.shift();

        return {
            fired,
            somaVoltage: this.somaVoltage,
            burstMode,
            apicalCoincidence: anyApicalPlateau
        };
    }
}

module.exports = DendriticNeuronEngine;
