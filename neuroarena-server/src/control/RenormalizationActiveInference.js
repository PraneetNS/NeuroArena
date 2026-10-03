/**
 * RenormalizationActiveInference.js
 *
 * Implements Variational Free Energy Active Inference coupled with
 * Wilsonian Renormalization Group (RG) coarse-graining for multi-scale
 * perception, epistemic exploration, and goal-directed action selection.
 *
 * Mathematical Foundations:
 * 1. Variational Free Energy F[q, y]:
 *      F = D_{KL}(q(\theta) \parallel p(\theta)) - \mathbb{E}_{q(\theta)} [\ln p(y \mid \theta)]
 *    where:
 *      y: Sensory observation vector
 *      \theta: Hidden state of the arena environment
 *      q(\theta): Recognition density (agent beliefs)
 *      p(y, \theta): Generative world model
 *    Minimizing F w.r.t q(\theta) yields Bayesian perceptual inference.
 *
 * 2. Expected Free Energy G(\pi) for Policy Selection \pi:
 *      G(\pi) = \underbrace{D_{KL}(q(y_\tau \mid \pi) \parallel p(y_\tau))}_{\text{Pragmatic Risk (Goal Divergence)}}
 *             + \underbrace{\mathbb{E}_{q(\theta_\tau \mid \pi)} [H(p(y_\tau \mid \theta_\tau))]}_{\text{Epistemic Ambiguity / Information Gain}}
 *    Action policy probability: \pi^* = \sigma(-\gamma G(\pi)).
 *
 * 3. Wilsonian Renormalization Group (RG) Coarse-Graining:
 *    Successively projects high-dimensional micro-sensory inputs y \in \mathbb{R}^D
 *    into scale-invariant slow macroscopic latent representations:
 *      y^{(l+1)} = \mathcal{R}(y^{(l)}) = \text{Downsample}(\text{GaussianFilter}(y^{(l)}))
 *    allowing hierarchical active inference across temporal horizons.
 *
 * References:
 * - Friston, K. (2010): "The free-energy principle: a unified brain theory?", Nature Reviews Neuroscience.
 * - Parr, T., & Friston, K. (2019): "Generalised free energy and active inference", Biological Cybernetics.
 * - Bény, C. (2013): "Deep learning and the renormalization group", arXiv:1301.3124.
 */

class RenormalizationActiveInference {
    /**
     * @param {Object} options
     * @param {number} [options.stateDim=4] - Dimension of hidden state \theta
     * @param {number} [options.actionCount=4] - Number of candidate discrete actions
     * @param {number} [options.precisionGamma=2.0] - Action selection inverse temperature \gamma
     * @param {number} [options.rgLevels=3] - Number of Renormalization Group coarse-graining scales
     */
    constructor(options = {}) {
        this.stateDim = options.stateDim || 4;
        this.actionCount = options.actionCount || 4;
        this.precisionGamma = options.precisionGamma || 2.0;
        this.rgLevels = options.rgLevels || 3;

        // Prior beliefs p(\theta): Gaussian N(\mu_p, \Sigma_p)
        this.priorMean = new Float64Array(this.stateDim).fill(0.0);
        this.priorVariance = new Float64Array(this.stateDim).fill(1.0);

        // Posterior beliefs q(\theta): Gaussian N(\mu_q, \Sigma_q)
        this.beliefMean = new Float64Array(this.stateDim).fill(0.0);
        this.beliefVariance = new Float64Array(this.stateDim).fill(1.0);

        // Target goal distribution p(y^*)
        this.preferredObservations = new Float64Array(this.stateDim).fill(1.0);

        // Candidate action transition matrices [action][stateDim]
        this.actionDynamics = [];
        this._initActionDynamics();
    }

    /**
     * Wilsonian Renormalization Group (RG) coarse-graining step:
     * Eliminates fast short-wavelength fluctuations by convolution with a Gaussian kernel
     * followed by decimation / momentum-shell contraction.
     * 
     * @param {number[]} microSensorySignal - High-resolution sensory input array
     * @returns {number[][]} Multi-scale representations [level][coarse_values]
     */
    applyRenormalizationGroup(microSensorySignal) {
        const pyramid = [Array.from(microSensorySignal)];

        for (let l = 1; l < this.rgLevels; l++) {
            const prev = pyramid[l - 1];
            if (prev.length <= 2) break;

            const nextLevel = [];
            // Decimation by stride 2 with triangular filter [0.25, 0.5, 0.25]
            for (let i = 0; i < prev.length; i += 2) {
                const left = i > 0 ? prev[i - 1] : prev[i];
                const center = prev[i];
                const right = i + 1 < prev.length ? prev[i + 1] : prev[i];
                nextLevel.push(0.25 * left + 0.5 * center + 0.25 * right);
            }
            pyramid.push(nextLevel);
        }

        return pyramid;
    }

    /**
     * Performs Perceptual Inference by gradient descent on Variational Free Energy F:
     * Updates belief mean \mu_q and variance \Sigma_q to minimize discrepancy with observation y.
     * 
     * @param {number[]} observation - Observed sensory vector y
     * @param {number} [learningRate=0.1] - Gradient descent step size
     * @param {number} [iterations=15] - Inference cycles
     * @returns {Object} Variational Free Energy F, KL divergence, and log-likelihood
     */
    updatePerception(observation, learningRate = 0.1, iterations = 15) {
        let finalF = 0.0;
        let klDiv = 0.0;
        let nll = 0.0;

        for (let iter = 0; iter < iterations; iter++) {
            let fVal = 0.0;
            let kl = 0.0;
            let logLikelihood = 0.0;

            const gradMean = new Float64Array(this.stateDim);

            for (let i = 0; i < this.stateDim; i++) {
                const mu_q = this.beliefMean[i];
                const var_q = this.beliefVariance[i];
                const mu_p = this.priorMean[i];
                const var_p = this.priorVariance[i];
                const y_i = observation[i] || 0.0;

                // KL(q || p) for univariate Gaussians:
                // 0.5 * [ (var_q / var_p) + (mu_p - mu_q)^2 / var_p - 1 + \ln(var_p / var_q) ]
                const kl_i = 0.5 * (
                    (var_q / var_p) +
                    Math.pow(mu_p - mu_q, 2) / var_p -
                    1.0 +
                    Math.log(var_p / var_q)
                );
                kl += kl_i;

                // Observation likelihood: p(y_i | \theta_i) ~ N(\theta_i, \sigma_{obs}^2 = 0.5)
                const obsVar = 0.5;
                const predictionError = y_i - mu_q;
                const logLikelihood_i = -0.5 * (Math.log(2 * Math.PI * obsVar) + (predictionError * predictionError) / obsVar);
                logLikelihood += logLikelihood_i;

                // F = KL - LogLikelihood
                fVal += kl_i - logLikelihood_i;

                // Gradient w.r.t \mu_q:
                // \partial KL / \partial \mu_q = (\mu_q - \mu_p) / var_p
                // \partial (- \ln p) / \partial \mu_q = - (y_i - \mu_q) / obsVar
                gradMean[i] = (mu_q - mu_p) / var_p - predictionError / obsVar;
            }

            // Belief update: \mu_q \gets \mu_q - \eta \nabla F
            for (let i = 0; i < this.stateDim; i++) {
                this.beliefMean[i] -= learningRate * gradMean[i];
            }

            finalF = fVal;
            klDiv = kl;
            nll = -logLikelihood;
        }

        return {
            freeEnergy: finalF,
            klDivergence: klDiv,
            negativeLogLikelihood: nll,
            beliefMean: Array.from(this.beliefMean)
        };
    }

    /**
     * Evaluates Expected Free Energy G(\pi) for each policy and samples action
     * balancing pragmatic goal achievement with epistemic information gain.
     * 
     * @returns {Object} Selected action index, action probabilities, and expected free energies
     */
    selectAction() {
        const expectedFreeEnergies = new Float64Array(this.actionCount);

        for (let a = 0; a < this.actionCount; a++) {
            let pragmaticRisk = 0.0;
            let epistemicAmbiguity = 0.0;

            const transitionOffset = this.actionDynamics[a];

            for (let i = 0; i < this.stateDim; i++) {
                // Expected future state under action a: \theta_{pred} = \mu_q + offset
                const expectedState = this.beliefMean[i] + transitionOffset[i];
                const targetState = this.preferredObservations[i];

                // Pragmatic value: Divergence from target goal preference (quadratic surrogate for KL)
                const goalError = expectedState - targetState;
                pragmaticRisk += 0.5 * goalError * goalError;

                // Epistemic value: Ambiguity reduction (entropy of observations given beliefs)
                // Lower variance -> lower ambiguity
                epistemicAmbiguity += 0.5 * Math.log(2 * Math.PI * Math.E * this.beliefVariance[i]);
            }

            // G(\pi) = PragmaticRisk - EpistemicValue (lower G is preferred)
            expectedFreeEnergies[a] = pragmaticRisk - 0.2 * epistemicAmbiguity;
        }

        // Softmax with precision parameter \gamma: P(\pi) = \frac{\exp(-\gamma G(\pi))}{\sum \exp(-\gamma G)}
        const minG = Math.min(...expectedFreeEnergies);
        const unnormalized = new Float64Array(this.actionCount);
        let sumUnnorm = 0.0;

        for (let a = 0; a < this.actionCount; a++) {
            unnormalized[a] = Math.exp(-this.precisionGamma * (expectedFreeEnergies[a] - minG));
            sumUnnorm += unnormalized[a];
        }

        const actionProbabilities = [];
        for (let a = 0; a < this.actionCount; a++) {
            actionProbabilities.push(unnormalized[a] / sumUnnorm);
        }

        // Sample action
        const rand = Math.random();
        let cumulative = 0.0;
        let selectedAction = 0;

        for (let a = 0; a < this.actionCount; a++) {
            cumulative += actionProbabilities[a];
            if (rand <= cumulative) {
                selectedAction = a;
                break;
            }
        }

        return {
            selectedAction,
            actionProbabilities,
            expectedFreeEnergies: Array.from(expectedFreeEnergies),
            bestAction: expectedFreeEnergies.indexOf(Math.min(...expectedFreeEnergies))
        };
    }

    _initActionDynamics() {
        // Simple directional transitions for test actions
        // Action 0: +x, Action 1: -x, Action 2: +y, Action 3: -y
        this.actionDynamics = [
            [ 0.8,  0.0,  0.2,  0.0],
            [-0.8,  0.0, -0.2,  0.0],
            [ 0.0,  0.8,  0.0,  0.2],
            [ 0.0, -0.8,  0.0, -0.2]
        ];
    }
}

module.exports = RenormalizationActiveInference;
