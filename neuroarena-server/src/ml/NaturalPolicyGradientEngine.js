/**
 * NaturalPolicyGradientEngine.js
 *
 * Implements Amari's Natural Policy Gradient (NPG) algorithm with Fisher-Vector Products (FVP)
 * and Conjugate Gradient (CG) for geodesically invariant reinforcement learning.
 *
 * Mathematical Foundations:
 * Standard policy gradient moves in Euclidean coordinate space: \theta_{k+1} = \theta_k + \alpha \nabla_\theta J.
 * Natural Policy Gradient optimizes over the Riemannian manifold of policy distributions:
 *   \tilde{g} = F(\theta)^{-1} g
 * where F(\theta) = E_{s, a} [ \nabla_\theta \log \pi_\theta(a|s) \nabla_\theta \log \pi_\theta(a|s)^T ]
 *
 * Step Size Calibration via KL constraint:
 *   \beta = \sqrt{ \frac{2 \delta_{KL}}{g^T F^{-1} g} }
 *   \theta \leftarrow \theta + \beta F^{-1} g
 *
 * References:
 * - Amari (Neural Computation 1998): "Natural Gradient Works Efficiently in Learning"
 * - Kakade (NeurIPS 2001): "A Natural Policy Gradient"
 */

class NaturalPolicyGradientEngine {
    /**
     * @param {Object} options
     * @param {number} [options.stateDim=4]
     * @param {number} [options.actionDim=2]
     * @param {number} [options.maxKl=0.01] - Trust region radius
     * @param {number} [options.damping=0.1] - Fisher regularization factor
     * @param {number} [options.cgSteps=10] - Conjugate gradient iterations
     */
    constructor(options = {}) {
        this.stateDim = options.stateDim || 4;
        this.actionDim = options.actionDim || 2;
        this.maxKl = options.maxKl || 0.01;
        this.damping = options.damping || 0.1;
        this.cgSteps = options.cgSteps || 10;

        this.paramDim = this.stateDim * this.actionDim;
        this.theta = new Float32Array(this.paramDim);
        this.initParams();
    }

    initParams() {
        for (let i = 0; i < this.paramDim; i++) {
            this.theta[i] = (Math.random() * 2 - 1) * 0.1;
        }
    }

    getProbabilities(state) {
        const logits = new Float32Array(this.actionDim);
        let maxL = -Infinity;

        for (let a = 0; a < this.actionDim; a++) {
            let sum = 0;
            for (let s = 0; s < this.stateDim; s++) {
                sum += this.theta[s * this.actionDim + a] * state[s];
            }
            logits[a] = sum;
            if (sum > maxL) maxL = sum;
        }

        let sumExp = 0;
        const probs = new Float32Array(this.actionDim);
        for (let a = 0; a < this.actionDim; a++) {
            probs[a] = Math.exp(logits[a] - maxL);
            sumExp += probs[a];
        }
        for (let a = 0; a < this.actionDim; a++) {
            probs[a] /= sumExp;
        }
        return probs;
    }

    /**
     * Computes Fisher-Vector Product: F * v without storing the full matrix
     * @param {Array<Array<number>>} states
     * @param {Float32Array} v
     * @returns {Float32Array}
     */
    fisherVectorProduct(states, v) {
        const fvp = new Float32Array(this.paramDim);
        const N = states.length;

        for (let n = 0; n < N; n++) {
            const state = states[n];
            const probs = this.getProbabilities(state);

            // Compute score vector \nabla \log \pi(a|s) for each action
            for (let a = 0; a < this.actionDim; a++) {
                // grad_{s, a'} = s_i * (1_{a'=a} - probs[a'])
                let dotV = 0;
                for (let s = 0; s < this.stateDim; s++) {
                    for (let aPrime = 0; aPrime < this.actionDim; aPrime++) {
                        const gradVal = state[s] * ((a === aPrime ? 1 : 0) - probs[aPrime]);
                        dotV += gradVal * v[s * this.actionDim + aPrime];
                    }
                }

                // Accumulate outer product expectation weighted by probs[a]
                for (let s = 0; s < this.stateDim; s++) {
                    for (let aPrime = 0; aPrime < this.actionDim; aPrime++) {
                        const gradVal = state[s] * ((a === aPrime ? 1 : 0) - probs[aPrime]);
                        fvp[s * this.actionDim + aPrime] += (probs[a] / N) * dotV * gradVal;
                    }
                }
            }
        }

        // Tikhonov damping
        for (let i = 0; i < this.paramDim; i++) {
            fvp[i] += this.damping * v[i];
        }

        return fvp;
    }

    /**
     * Solves F * x = g via Conjugate Gradient
     */
    conjugateGradient(states, g) {
        let x = new Float32Array(this.paramDim);
        let r = g.slice();
        let p = g.slice();
        let rsOld = this.dot(r, r);

        for (let i = 0; i < this.cgSteps; i++) {
            const Ap = this.fisherVectorProduct(states, p);
            const pAp = this.dot(p, Ap);
            if (pAp <= 1e-12) break;

            const alpha = rsOld / pAp;
            for (let j = 0; j < this.paramDim; j++) {
                x[j] += alpha * p[j];
                r[j] -= alpha * Ap[j];
            }

            const rsNew = this.dot(r, r);
            if (rsNew < 1e-10) break;

            const beta = rsNew / rsOld;
            for (let j = 0; j < this.paramDim; j++) {
                p[j] = r[j] + beta * p[j];
            }
            rsOld = rsNew;
        }

        return x;
    }

    dot(a, b) {
        let sum = 0;
        for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
        return sum;
    }

    /**
     * Computes natural policy gradient step with trust-region constraint
     * @param {Array<Array<number>>} states
     * @param {Float32Array} policyGrad
     * @returns {Float32Array} Natural step direction
     */
    stepNatural(states, policyGrad) {
        const natGrad = this.conjugateGradient(states, policyGrad);
        const gFg = this.dot(policyGrad, natGrad);

        let stepScale = 1.0;
        if (gFg > 0) {
            stepScale = Math.sqrt((2.0 * this.maxKl) / gFg);
        }

        for (let i = 0; i < this.paramDim; i++) {
            this.theta[i] += natGrad[i] * stepScale;
        }

        return natGrad;
    }
}

module.exports = NaturalPolicyGradientEngine;
