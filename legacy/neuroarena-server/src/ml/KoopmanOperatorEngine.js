/**
 * KoopmanOperatorEngine.js
 *
 * Implements Dynamic Mode Decomposition (DMD) and Koopman Operator Theory
 * for exact linear modeling of non-linear combat dynamical systems.
 *
 * Mathematical Foundations:
 * Let x_k \in R^n be the state. The Koopman operator \mathcal{K} acts on scalar observables g:
 *   \mathcal{K} g(x_k) = g(f(x_k)) = g(x_{k+1})
 * By selecting a basis of observables \psi(x) = [\psi_1(x), \dots, \psi_p(x)]^T,
 * we approximate \mathcal{K} via Dynamic Mode Decomposition:
 *   X' \approx K X \implies K = X' X^\dagger = X' V \Sigma^{-1} U^*
 *
 * Future states at arbitrary time horizon t = m \Delta t can be evaluated directly via spectral modes:
 *   \psi(x_m) = K^m \psi(x_0) = \sum_{j=1}^r \phi_j \lambda_j^m b_j
 *
 * References:
 * - Williams, Kevrekidis, Rowley (J. Nonlinear Sci. 2015): "A Data-Driven Approximation of the Koopman Operator (EDMD)"
 * - Kutz et al. (SIAM 2016): "Dynamic Mode Decomposition: Data-Driven Modeling of Complex Systems"
 */

class KoopmanOperatorEngine {
    /**
     * @param {Object} options
     * @param {number} [options.stateDim=4] - Base physical dimension [x, y, vx, vy]
     * @param {number} [options.regularization=1e-4] - Ridge regularization for matrix inversion
     */
    constructor(options = {}) {
        this.stateDim = options.stateDim || 4;
        this.reg = options.regularization || 1e-4;

        // Observable basis: [x_i] (stateDim) + [x_i^2] (stateDim) + [sin(x_i)] (stateDim) + 1 (bias)
        this.observableDim = 3 * this.stateDim + 1;
        this.K = new Float32Array(this.observableDim * this.observableDim);

        // Initialize K as identity
        for (let i = 0; i < this.observableDim; i++) {
            this.K[i * this.observableDim + i] = 1.0;
        }
    }

    /**
     * Evaluates non-linear observable dictionary \psi(x)
     * @param {Array<number>} state
     * @returns {Float32Array} Lifted observable vector
     */
    lift(state) {
        const psi = new Float32Array(this.observableDim);
        let idx = 0;

        // Linear terms
        for (let i = 0; i < this.stateDim; i++) {
            psi[idx++] = state[i];
        }
        // Quadratic terms
        for (let i = 0; i < this.stateDim; i++) {
            psi[idx++] = state[i] * state[i] * 0.1;
        }
        // Trigonometric harmonic terms
        for (let i = 0; i < this.stateDim; i++) {
            psi[idx++] = Math.sin(state[i]);
        }
        // Constant bias observable
        psi[idx] = 1.0;

        return psi;
    }

    /**
     * Fit Koopman matrix K from pairs of consecutive snapshot vectors (X, Y)
     * where Y_k = f(X_k). Solves K = (Y \psi(X)^T) (\psi(X) \psi(X)^T + \lambda I)^{-1}
     * @param {Array<Array<number>>} X Snapshots at t_k
     * @param {Array<Array<number>>} Y Snapshots at t_{k+1}
     */
    fit(X, Y) {
        const p = this.observableDim;
        const M = X.length;

        // Accumulate G = \sum \psi(x) \psi(x)^T
        const G = new Float64Array(p * p);
        // Accumulate A = \sum \psi(y) \psi(x)^T
        const A = new Float64Array(p * p);

        for (let k = 0; k < M; k++) {
            const psiX = this.lift(X[k]);
            const psiY = this.lift(Y[k]);

            for (let i = 0; i < p; i++) {
                for (let j = 0; j < p; j++) {
                    G[i * p + j] += psiX[i] * psiX[j];
                    A[i * p + j] += psiY[i] * psiX[j];
                }
            }
        }

        // Add Tikhonov ridge regularization to diagonal of G
        for (let i = 0; i < p; i++) {
            G[i * p + i] += this.reg * M;
        }

        // Invert G using Gauss-Jordan elimination
        const G_inv = this.invertMatrix(G, p);

        // K = A * G_inv
        for (let i = 0; i < p; i++) {
            for (let j = 0; j < p; j++) {
                let sum = 0;
                for (let k = 0; k < p; k++) {
                    sum += A[i * p + k] * G_inv[k * p + j];
                }
                this.K[i * p + j] = sum;
            }
        }
    }

    /**
     * Forecast future state trajectory across H horizons in linear observable space
     * @param {Array<number>} initialState
     * @param {number} horizon
     * @returns {Array<Array<number>>} Predicted state snapshots
     */
    forecast(initialState, horizon) {
        let psi = this.lift(initialState);
        const p = this.observableDim;
        const predictions = [];

        for (let step = 0; step < horizon; step++) {
            const nextPsi = new Float32Array(p);
            for (let i = 0; i < p; i++) {
                let sum = 0;
                for (let j = 0; j < p; j++) {
                    sum += this.K[i * p + j] * psi[j];
                }
                nextPsi[i] = sum;
            }

            // Extract physical states from first stateDim observables
            const state = [];
            for (let d = 0; d < this.stateDim; d++) {
                state.push(nextPsi[d]);
            }
            predictions.push(state);
            psi = nextPsi;
        }

        return predictions;
    }

    invertMatrix(matrix, n) {
        const aug = new Float64Array(n * 2 * n);
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                aug[i * 2 * n + j] = matrix[i * n + j];
            }
            aug[i * 2 * n + (n + i)] = 1.0;
        }

        for (let i = 0; i < n; i++) {
            let pivot = aug[i * 2 * n + i];
            if (Math.abs(pivot) < 1e-12) pivot = 1e-12;

            for (let j = 0; j < 2 * n; j++) {
                aug[i * 2 * n + j] /= pivot;
            }

            for (let r = 0; r < n; r++) {
                if (r === i) continue;
                const factor = aug[r * 2 * n + i];
                for (let c = 0; c < 2 * n; c++) {
                    aug[r * 2 * n + c] -= factor * aug[i * 2 * n + c];
                }
            }
        }

        const inv = new Float64Array(n * n);
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                inv[i * n + j] = aug[i * 2 * n + (n + j)];
            }
        }
        return inv;
    }
}

module.exports = KoopmanOperatorEngine;
