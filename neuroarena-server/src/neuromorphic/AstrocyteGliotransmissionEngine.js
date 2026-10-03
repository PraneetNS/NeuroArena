/**
 * AstrocyteGliotransmissionEngine.js
 *
 * Implements Tripartite Synapse Dynamics with Astrocyte Intracellular Calcium Waves
 * and Gliotransmitter-Modulated Synaptic Metaplasticity.
 *
 * Mathematical Foundations:
 * 1. Tripartite Synapse Architecture:
 *    - Presynaptic terminal + Postsynaptic dendritic spine + Peri-synaptic Astrocytic process (PAP).
 * 2. Inositol 1,4,5-Trisphosphate (IP_3) Production:
 *      \frac{d [IP_3]}{dt} = \frac{[IP_3]_0 - [IP_3]}{\tau_{IP3}} + \nu_\beta \cdot \text{Glu}_{syn}(t)
 * 3. Intracellular Calcium (Ca^{2+}) Dynamics (Li-Rinzel simplified model):
 *      \frac{d [Ca^{2+}]}{dt} = J_{channel}([IP_3], [Ca^{2+}], h) - J_{pump}([Ca^{2+}]) + J_{leak}
 *    - J_{pump} captures SERCA calcium uptake pump into the endoplasmic reticulum (ER).
 * 4. Gliotransmitter Exocytosis:
 *    - When astrocytic [Ca^{2+}] exceeds threshold \Theta_{astro}, gliotransmitter (D-Serine / Glutamate)
 *      is exocytosed into the extrasynaptic space:
 *        \text{Glio}(t) = \Theta([Ca^{2+}] - \Theta_{astro}) \cdot \exp(-t / \tau_{glio})
 * 5. Metaplastic STDP Modulation:
 *    - The gliotransmitter acts as a permissive co-agonist on postsynaptic NMDA receptors,
 *      scaling the Spike-Timing-Dependent Plasticity (STDP) learning rate:
 *        \eta_{effective} = \eta_0 \cdot (1.0 + \kappa_{astro} \cdot \text{Glio}(t))
 *
 * References:
 * - Araque, Parpura, Sanzgiri, Haydon (Trends in Neurosciences 1999): "Tripartite synapses: glia, the unacknowledged partner"
 * - De Pittà, Volman, Berry, Parpura, Volterra, Ben-Jacob (PLoS Comput. Biol. 2011): "A Molecule-Event Approach to Transmitter Release"
 * - Perea, Navarrete, Araque (Science 2009): "Tripartite synapses: astrocytes process and control synaptic information"
 */

class AstrocyteGliotransmissionEngine {
    /**
     * @param {Object} options
     * @param {number} [options.synapseCount=8] - Number of synapses enveloped by this astrocyte domain
     * @param {number} [options.caThreshold=0.35] - Intracellular Ca^{2+} threshold \Theta_{astro} (\mu M)
     * @param {number} [options.dt=0.001] - Integration time step in seconds (1 ms)
     */
    constructor(options = {}) {
        this.synapseCount = options.synapseCount || 8;
        this.caThreshold = options.caThreshold || 0.35;
        this.dt = options.dt || 0.001;

        // Astrocytic intracellular state variables
        this.ip3 = 0.1;           // [IP_3] in \mu M
        this.ip3Resting = 0.1;
        this.tauIP3 = 0.15;       // 150 ms decay
        this.nuBeta = 0.8;        // mGluR coupling gain

        this.calcium = 0.08;      // [Ca^{2+}] in \mu M
        this.calciumResting = 0.08;
        this.tauCa = 0.25;        // 250 ms pump clearance

        this.gliotransmitter = 0.0;
        this.tauGlio = 0.10;      // 100 ms gliotransmitter clearance

        // Synaptic weights array
        this.weights = new Float64Array(this.synapseCount).fill(0.5);
    }

    /**
     * Advances the tripartite synapse simulation by dt
     * 
     * @param {number[]} presynapticSpikes - Binary array [0, 1] for each synapse indicating presynaptic action potentials
     * @param {number[]} postsynapticSpikes - Binary array [0, 1] indicating postsynaptic spikes
     * @returns {Object} Astrocytic state telemetry and weight update magnitudes
     */
    step(presynapticSpikes, postsynapticSpikes) {
        const dt = this.dt;

        // 1. Synaptic glutamate release from presynaptic spikes
        let totalGlutamate = 0.0;
        for (let i = 0; i < this.synapseCount; i++) {
            if (presynapticSpikes[i]) totalGlutamate += 1.0;
        }

        // 2. IP_3 dynamics in astrocytic microdomain
        // d[IP_3]/dt = ([IP_3]_0 - [IP_3]) / \tau_{IP3} + \nu_\beta * Glu
        const dIP3 = ((this.ip3Resting - this.ip3) / this.tauIP3 + this.nuBeta * totalGlutamate) * dt;
        this.ip3 = Math.max(0.01, this.ip3 + dIP3);

        // 3. Calcium release from endoplasmic reticulum (ER) triggered by IP_3
        // J_{channel} \propto [IP_3]^2, J_{pump} \propto [Ca^{2+}]
        const jChannel = 2.5 * (this.ip3 * this.ip3) / (this.ip3 * this.ip3 + 0.1);
        const jPump = 1.8 * (this.calcium - this.calciumResting);
        const dCa = (jChannel - jPump) * dt;
        this.calcium = Math.max(0.01, this.calcium + dCa);

        // 4. Gliotransmitter release when Ca^{2+} surpasses threshold
        if (this.calcium > this.caThreshold) {
            const excess = this.calcium - this.caThreshold;
            this.gliotransmitter += 1.5 * excess;
        }
        // Clearance of gliotransmitter
        this.gliotransmitter = Math.max(0.0, this.gliotransmitter - (this.gliotransmitter / this.tauGlio) * dt);

        // 5. Astrocyte-modulated STDP weight updates
        // Effective learning rate modulated by extrasynaptic gliotransmitter
        const astroModulation = 1.0 + 1.2 * this.gliotransmitter;
        const baseLearningRate = 0.02;
        const effectiveLR = baseLearningRate * astroModulation;

        const weightDeltas = new Float64Array(this.synapseCount);

        for (let i = 0; i < this.synapseCount; i++) {
            const pre = presynapticSpikes[i] ? 1 : 0;
            const post = postsynapticSpikes[i] ? 1 : 0;

            // Simplified STDP: pre followed by post promotes LTP, post without pre promotes LTD
            let dw = 0.0;
            if (pre && post) {
                dw = effectiveLR * (1.0 - this.weights[i]); // LTP
            } else if (post && !pre) {
                dw = -effectiveLR * 0.5 * this.weights[i];  // LTD
            }

            this.weights[i] = Math.max(0.0, Math.min(1.0, this.weights[i] + dw));
            weightDeltas[i] = dw;
        }

        return {
            calcium: this.calcium,
            ip3: this.ip3,
            gliotransmitter: this.gliotransmitter,
            astroModulationFactor: astroModulation,
            isAstrocyteActive: this.calcium > this.caThreshold,
            weights: Array.from(this.weights),
            weightDeltas: Array.from(weightDeltas)
        };
    }
}

module.exports = AstrocyteGliotransmissionEngine;
