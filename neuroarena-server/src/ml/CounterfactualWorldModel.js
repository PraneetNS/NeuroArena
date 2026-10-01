/**
 * CounterfactualWorldModel.js
 *
 * Implements Judea Pearl's Level 3 Ladder of Causation (Counterfactual Reasoning)
 * via Structural Causal Models (SCM).
 *
 * Mathematical Foundations:
 * An SCM is defined by a 4-tuple \mathcal{M} = \langle U, V, F, P(U) \rangle:
 *   U: Exogenous background disturbance variables (unobserved / environmental randomness)
 *   V: Endogenous system variables (kinematics, rewards, actions)
 *   F: Structural functions: v_i = f_i(pa_i, u_i)
 *
 * 3-Stage Counterfactual Algorithm:
 * 1. Abduction:  Compute P(U | E = e) — deduce the specific realization of noise U
 *                that generated the factual episode.
 * 2. Action:     Replace structural equation for target variable X with constant x*:
 *                \mathcal{M}_{do(X = x^*)}.
 * 3. Prediction: Compute the counterfactual state distribution:
 *                Y_{X = x^*}(u) = f_Y^{\mathcal{M}_{do(X = x^*)}}(pa_Y, u).
 *
 * References:
 * - Pearl (Cambridge 2009): "Causality: Models, Reasoning, and Inference"
 * - Bica et al. (ICLR 2021): "Counterfactual World Models for Counterfactual Planning"
 */

class CounterfactualWorldModel {
    /**
     * @param {Object} options
     * @param {number} [options.stateDim=4] - State dimension [x, y, vx, vy]
     * @param {number} [options.actionDim=3] - Action space dimension
     */
    constructor(options = {}) {
        this.stateDim = options.stateDim || 4;
        this.actionDim = options.actionDim || 3;

        // Transition weights: s_{t+1} = W_s * s_t + W_a * a_t + b + u_t
        this.Ws = new Float32Array(this.stateDim * this.stateDim);
        this.Wa = new Float32Array(this.stateDim * this.actionDim);
        this.bias = new Float32Array(this.stateDim);

        this.initModel();
    }

    initModel() {
        for (let i = 0; i < this.stateDim; i++) {
            this.Ws[i * this.stateDim + i] = 0.95; // Inertia
            for (let a = 0; a < this.actionDim; a++) {
                this.Wa[i * this.actionDim + a] = (i === a) ? 1.5 : 0.0;
            }
            this.bias[i] = 0.0;
        }
    }

    /**
     * Evaluates deterministic forward prediction \hat{s}_{t+1} = f(s_t, a_t)
     */
    forwardDeterministic(state, action) {
        const nextState = new Array(this.stateDim).fill(0);
        for (let i = 0; i < this.stateDim; i++) {
            let sum = this.bias[i];
            for (let j = 0; j < this.stateDim; j++) {
                sum += this.Ws[i * this.stateDim + j] * state[j];
            }
            for (let a = 0; a < this.actionDim; a++) {
                sum += this.Wa[i * this.actionDim + a] * (action[a] || 0);
            }
            nextState[i] = sum;
        }
        return nextState;
    }

    /**
     * Step 1: Abduction
     * Infers exogenous noise shock u_t = s_{t+1}^{factual} - f(s_t^{factual}, a_t^{factual})
     * @param {Array<number>} factualState
     * @param {Array<number>} factualAction
     * @param {Array<number>} factualNextState
     * @returns {Array<number>} Abduced exogenous noise vector U
     */
    abduceNoise(factualState, factualAction, factualNextState) {
        const pred = this.forwardDeterministic(factualState, factualAction);
        const noiseU = new Array(this.stateDim);
        for (let i = 0; i < this.stateDim; i++) {
            noiseU[i] = factualNextState[i] - pred[i];
        }
        return noiseU;
    }

    /**
     * Step 2 & 3: Action & Prediction
     * Performs surgical intervention do(A = counterfactualAction) under abduced noise U
     * @param {Array<number>} factualState
     * @param {Array<number>} factualAction
     * @param {Array<number>} factualNextState
     * @param {Array<number>} counterfactualAction
     * @returns {Array<number>} Counterfactual next state s*_{t+1}
     */
    counterfactualStep(factualState, factualAction, factualNextState, counterfactualAction) {
        const noiseU = this.abduceNoise(factualState, factualAction, factualNextState);
        const cfPred = this.forwardDeterministic(factualState, counterfactualAction);

        const cfNextState = new Array(this.stateDim);
        for (let i = 0; i < this.stateDim; i++) {
            cfNextState[i] = cfPred[i] + noiseU[i];
        }
        return cfNextState;
    }

    /**
     * Counterfactual rollout over H steps given a recorded factual trace
     * @param {Array<Object>} factualTrace Array of { state, action, nextState }
     * @param {Array<Array<number>>} alternativeActions Array of alternate action vectors
     * @returns {Array<Array<number>>} Counterfactual state trajectory
     */
    counterfactualRollout(factualTrace, alternativeActions) {
        const trajectory = [];
        let curState = factualTrace[0].state.slice();

        for (let t = 0; t < factualTrace.length && t < alternativeActions.length; t++) {
            const step = factualTrace[t];
            const altAction = alternativeActions[t];

            const noiseU = this.abduceNoise(step.state, step.action, step.nextState);
            const cfNext = this.forwardDeterministic(curState, altAction);

            for (let i = 0; i < this.stateDim; i++) {
                cfNext[i] += noiseU[i];
            }
            trajectory.push(cfNext);
            curState = cfNext;
        }

        return trajectory;
    }
}

module.exports = CounterfactualWorldModel;
