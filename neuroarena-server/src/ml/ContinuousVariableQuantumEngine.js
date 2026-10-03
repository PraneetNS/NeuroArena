/**
 * ContinuousVariableQuantumEngine.js
 *
 * Implements Continuous-Variable (CV) Quantum Optical Computing,
 * Bosonic Fock State Representation, and Wigner Quasiprobability Phase-Space Engine.
 *
 * Mathematical Foundations:
 * 1. Infinite-dimensional Hilbert space truncated to N Fock states: \{|0\rangle, |1\rangle, ..., |N-1\rangle\}.
 * 2. Bosonic Annihilation (a) and Creation (a^\dagger) ladder operators:
 *      a |n\rangle = \sqrt{n} |n - 1\rangle
 *      a^\dagger |n\rangle = \sqrt{n + 1} |n + 1\rangle \quad (n < N-1)
 *    Canonical Commutation Relation: [a, a^\dagger] = I.
 * 3. Quadrature Operators:
 *      \hat{q} = \frac{a + a^\dagger}{\sqrt{2}}, \quad \hat{p} = \frac{a - a^\dagger}{i\sqrt{2}}
 * 4. Gaussian Symplectic Transformations:
 *    - Displacement Operator: D(\alpha) = \exp(\alpha a^\dagger - \alpha^* a)
 *    - Squeezing Operator: S(r, \phi) = \exp(\frac{1}{2} (z^* a^2 - z a^{\dagger 2})), \quad z = r e^{i\phi}
 *    - Phase Rotation: R(\theta) = \exp(-i \theta a^\dagger a)
 * 5. Wigner Quasiprobability Phase-Space Function:
 *      W(q, p) = \frac{1}{\pi} \sum_{n, m} \rho_{n,m} W_{n,m}(q, p)
 *    For diagonal Fock state |n\rangle\langle n|:
 *      W_n(q, p) = \frac{(-1)^n}{\pi} \exp(-(q^2 + p^2)) L_n(2(q^2 + p^2))
 *    where L_n is the n-th Laguerre polynomial.
 *    Negative values W(q, p) < 0 signify genuine quantum non-classicality!
 *
 * References:
 * - Weedbrook et al. (Rev. Mod. Phys. 2012): "Gaussian quantum information"
 * - Killoran et al. (Phys. Rev. Research 2019): "Continuous-variable quantum neural networks"
 */

class ContinuousVariableQuantumEngine {
    /**
     * @param {Object} options
     * @param {number} [options.cutoff=8] - Fock space truncation dimension N
     */
    constructor(options = {}) {
        this.cutoff = options.cutoff || 8;
        this.state = new Float64Array(this.cutoff * 2); // Complex amplitudes: [re0, im0, re1, im1, ...]
        this.state[0] = 1.0; // Vacuum state |0\rangle
    }

    /**
     * Resets state to vacuum |0\rangle
     */
    resetVacuum() {
        this.state.fill(0.0);
        this.state[0] = 1.0;
    }

    /**
     * Sets state to a pure Fock number state |n\rangle
     * @param {number} n - Photon number (0 <= n < cutoff)
     */
    setFockState(n) {
        if (n < 0 || n >= this.cutoff) {
            throw new Error(`Fock state ${n} exceeds cutoff ${this.cutoff}`);
        }
        this.state.fill(0.0);
        this.state[n * 2] = 1.0;
    }

    /**
     * Normalizes the quantum state vector to \langle\psi|\psi\rangle = 1
     */
    normalize() {
        let normSq = 0.0;
        for (let i = 0; i < this.cutoff; i++) {
            const re = this.state[i * 2];
            const im = this.state[i * 2 + 1];
            normSq += re * re + im * im;
        }

        if (normSq > 1e-12) {
            const invNorm = 1.0 / Math.sqrt(normSq);
            for (let i = 0; i < this.state.length; i++) {
                this.state[i] *= invNorm;
            }
        }
    }

    /**
     * Computes expectation values of quadrature operators: \langle q \rangle, \langle p \rangle
     * and number operator \langle n \rangle = \langle a^\dagger a \rangle.
     * @returns {{meanQ: number, meanP: number, meanN: number, purity: number}}
     */
    computeExpectationValues() {
        let meanN = 0.0;
        let meanQ = 0.0;
        let meanP = 0.0;

        for (let n = 0; n < this.cutoff; n++) {
            const re_n = this.state[n * 2];
            const im_n = this.state[n * 2 + 1];
            const prob_n = re_n * re_n + im_n * im_n;

            meanN += n * prob_n;

            // Off-diagonal transitions for ladder operator a
            if (n + 1 < this.cutoff) {
                const re_np1 = this.state[(n + 1) * 2];
                const im_np1 = this.state[(n + 1) * 2 + 1];
                const sqrtN = Math.sqrt(n + 1);

                // \langle n | a | n+1 \rangle = \sqrt{n+1}
                // Term \psi_n^* \psi_{n+1} = (re_n - i im_n)(re_{n+1} + i im_{n+1})
                const crossRe = re_n * re_np1 + im_n * im_np1;
                const crossIm = re_n * im_np1 - im_n * re_np1;

                // \hat{q} = (a + a^\dagger) / \sqrt{2}
                meanQ += Math.sqrt(2.0) * sqrtN * crossRe;
                // \hat{p} = (a - a^\dagger) / (i \sqrt{2})
                meanP += Math.sqrt(2.0) * sqrtN * crossIm;
            }
        }

        return {
            meanQ,
            meanP,
            meanN,
            purity: 1.0 // Pure state assumption
        };
    }

    /**
     * Applies displacement operator D(\alpha) = \exp(\alpha a^\dagger - \alpha^* a)
     * using Baker-Campbell-Hausdorff series / Taylor expansion up to order 12.
     * @param {number} reAlpha - Real part of coherent displacement
     * @param {number} [imAlpha=0.0] - Imaginary part of coherent displacement
     */
    applyDisplacement(reAlpha, imAlpha = 0.0) {
        // Construct generator G = \alpha a^\dagger - \alpha^* a
        // G is anti-hermitian
        const N = this.cutoff;
        const nextState = new Float64Array(this.state);

        // Power series approximation of exp(G)
        let currentTerm = new Float64Array(this.state);

        for (let order = 1; order <= 12; order++) {
            const nextTerm = new Float64Array(N * 2);

            for (let n = 0; n < N; n++) {
                const re = currentTerm[n * 2];
                const im = currentTerm[n * 2 + 1];

                // a term: - \alpha^* a |n\rangle = - \sqrt{n} (\alpha_r - i \alpha_i) |n-1\rangle
                if (n > 0) {
                    const sqrtN = Math.sqrt(n);
                    const targetIdx = (n - 1) * 2;
                    // -(\alpha_r - i \alpha_i)(re + i im) = - (\alpha_r re + \alpha_i im) - i (-\alpha_r im + \alpha_i re)
                    nextTerm[targetIdx] += -sqrtN * (reAlpha * re + imAlpha * im) / order;
                    nextTerm[targetIdx + 1] += -sqrtN * (reAlpha * im - imAlpha * re) / order;
                }

                // a^\dagger term: \alpha a^\dagger |n\rangle = \sqrt{n+1} (\alpha_r + i \alpha_i) |n+1\rangle
                if (n + 1 < N) {
                    const sqrtNp1 = Math.sqrt(n + 1);
                    const targetIdx = (n + 1) * 2;
                    nextTerm[targetIdx] += sqrtNp1 * (reAlpha * re - imAlpha * im) / order;
                    nextTerm[targetIdx + 1] += sqrtNp1 * (reAlpha * im + imAlpha * re) / order;
                }
            }

            for (let i = 0; i < N * 2; i++) {
                nextState[i] += nextTerm[i];
            }
            currentTerm = nextTerm;
        }

        this.state.set(nextState);
        this.normalize();
    }

    /**
     * Applies phase rotation operator R(\theta) = \exp(-i \theta a^\dagger a)
     * Exactly diagonal in Fock basis: |n\rangle \to \exp(-i n \theta) |n\rangle
     * @param {number} theta - Phase angle in radians
     */
    applyPhaseRotation(theta) {
        for (let n = 0; n < this.cutoff; n++) {
            const angle = -n * theta;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            const re = this.state[n * 2];
            const im = this.state[n * 2 + 1];

            this.state[n * 2] = re * cos - im * sin;
            this.state[n * 2 + 1] = re * sin + im * cos;
        }
    }

    /**
     * Evaluates the Wigner function W(q, p) at phase-space coordinate (q, p)
     * For pure state |\psi\rangle = \sum_n c_n |n\rangle:
     * W(q, p) = \frac{1}{\pi} \sum_{n, m} c_n^* c_m W_{n,m}(q, p)
     * 
     * @param {number} q - Position quadrature
     * @param {number} p - Momentum quadrature
     * @returns {number} Wigner quasiprobability density W(q, p)
     */
    evaluateWigner(q, p) {
        const r2 = q * q + p * p;
        const expFactor = Math.exp(-r2) / Math.PI;

        let wTotal = 0.0;

        // Diagonal Fock contributions: c_n^* c_n W_n(q, p)
        for (let n = 0; n < this.cutoff; n++) {
            const re = this.state[n * 2];
            const im = this.state[n * 2 + 1];
            const prob_n = re * re + im * im;

            if (prob_n > 1e-9) {
                const sign = (n % 2 === 0) ? 1.0 : -1.0;
                const laguerre = this._laguerre(n, 2.0 * r2);
                wTotal += prob_n * sign * laguerre;
            }
        }

        return expFactor * wTotal;
    }

    /**
     * Computes the total Wigner negativity volume:
     * \delta(\rho) = \int \int (|W(q, p)| - W(q, p)) dq dp
     * as an operational metric of non-classical computational advantage.
     * 
     * @param {number} [gridSize=16]
     * @param {number} [extent=3.0]
     * @returns {{negativity: number, minWigner: number, maxWigner: number}}
     */
    computeWignerNegativity(gridSize = 16, extent = 3.0) {
        const dq = (2.0 * extent) / gridSize;
        const dp = (2.0 * extent) / gridSize;
        const dArea = dq * dp;

        let negativity = 0.0;
        let minW = Infinity;
        let maxW = -Infinity;

        for (let i = 0; i < gridSize; i++) {
            const q = -extent + (i + 0.5) * dq;
            for (let j = 0; j < gridSize; j++) {
                const p = -extent + (j + 0.5) * dp;
                const w = this.evaluateWigner(q, p);

                if (w < minW) minW = w;
                if (w > maxW) maxW = w;

                if (w < 0.0) {
                    negativity += (-w) * dArea;
                }
            }
        }

        return {
            negativity,
            minWigner: minW,
            maxWigner: maxW,
            isNonClassical: minW < -1e-4
        };
    }

    /**
     * Evaluates Laguerre polynomial L_n(x) via three-term recurrence:
     * (k+1) L_{k+1}(x) = (2k + 1 - x) L_k(x) - k L_{k-1}(x)
     * @private
     */
    _laguerre(n, x) {
        if (n === 0) return 1.0;
        if (n === 1) return 1.0 - x;

        let lPrev = 1.0;
        let lCurr = 1.0 - x;

        for (let k = 1; k < n; k++) {
            const lNext = ((2 * k + 1 - x) * lCurr - k * lPrev) / (k + 1);
            lPrev = lCurr;
            lCurr = lNext;
        }

        return lCurr;
    }
}

module.exports = ContinuousVariableQuantumEngine;
