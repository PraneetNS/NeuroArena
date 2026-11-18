/**
 * QuantumSimulatedBifurcation.js
 *
 * Implements the adiabatic Simulated Bifurcation (aSB) and ballistic Simulated Bifurcation (bSB)
 * algorithm for high-speed combinatorial Ising optimization.
 * Solves NP-hard discrete optimization problems (graph partitioning, neural sparse topology selection,
 * hyperparameter feature allocation) by simulating non-linear Kerr parametric oscillators.
 *
 * References:
 * - Goto, H. et al. (Science Advances 2019) "Combinatorial optimization by simulating adiabatic bifurcations"
 * - Goto, H. et al. (Science Advances 2021) "High-performance combinatorial optimization based on classical mechanics"
 */

class QuantumSimulatedBifurcation {
    /**
     * @param {Object} options
     * @param {number} [options.numSpins=16] - Number of discrete binary decision variables s_i in {-1, +1}
     * @param {number} [options.timeSteps=100] - Total integration steps
     * @param {number} [options.dt=0.25] - Symplectic time step
     * @param {number} [options.kerrParam=1.0] - Non-linear Kerr detuning parameter K
     */
    constructor(options = {}) {
        this.numSpins = options.numSpins || 16;
        this.timeSteps = options.timeSteps || 100;
        this.dt = options.dt || 0.25;
        this.kerrParam = options.kerrParam || 1.0;

        // Coupling matrix J (symmetric, N x N) and linear bias h (N)
        this.J = Array.from({ length: this.numSpins }, () => new Float32Array(this.numSpins));
        this.h = new Float32Array(this.numSpins);
    }

    /**
     * Sets the Ising Hamiltonian parameters:
     * H(s) = -0.5 * sum_{i,j} J_ij s_i s_j - sum_i h_i s_i
     */
    setProblemMatrix(couplingJ, linearBiasH = null) {
        if (!couplingJ || couplingJ.length !== this.numSpins) {
            throw new Error(`[QuantumSimulatedBifurcation] J matrix dimension must match numSpins (${this.numSpins})`);
        }

        for (let i = 0; i < this.numSpins; i++) {
            for (let j = 0; j < this.numSpins; j++) {
                this.J[i][j] = couplingJ[i][j] || 0;
            }
            if (linearBiasH) {
                this.h[i] = linearBiasH[i] || 0;
            }
        }
    }

    /**
     * Evaluates classical Ising Hamiltonian energy for discrete spins s in {-1, +1}
     */
    computeEnergy(spins) {
        let energy = 0;
        for (let i = 0; i < this.numSpins; i++) {
            for (let j = 0; j < this.numSpins; j++) {
                energy -= 0.5 * this.J[i][j] * spins[i] * spins[j];
            }
            energy -= this.h[i] * spins[i];
        }
        return energy;
    }

    /**
     * Runs Adiabatic Simulated Bifurcation (aSB) ODE solver:
     * dx_i / dt = p_i
     * dp_i / dt = - (Delta(t) - p0) * x_i - K * x_i^3 + c0 * (sum_j J_ij x_j + h_i)
     *
     * @returns {Object} { spins: Int8Array, energy: number, elapsedSteps: number, convergenceTrajectory: Array<number> }
     */
    solve() {
        const n = this.numSpins;
        const x = new Float32Array(n);
        const y = new Float32Array(n); // Momentum p_i
        const spins = new Int8Array(n);

        // Small initial thermal quantum fluctuations
        for (let i = 0; i < n; i++) {
            x[i] = (Math.random() - 0.5) * 0.05;
            y[i] = (Math.random() - 0.5) * 0.05;
        }

        // Compute optimal coupling normalization c0
        let maxJRowSum = 0;
        for (let i = 0; i < n; i++) {
            let rowSum = 0;
            for (let j = 0; j < n; j++) rowSum += Math.abs(this.J[i][j]);
            if (rowSum > maxJRowSum) maxJRowSum = rowSum;
        }
        const c0 = maxJRowSum > 0 ? 0.5 / maxJRowSum : 0.5;

        const trajectory = [];

        // Symplectic numerical integration across ramping detuning schedule
        for (let step = 0; step < this.timeSteps; step++) {
            // Parametric pump frequency schedule: a(t) ramps from 0 to 1
            const pumpSched = step / this.timeSteps;

            // Half-step update for position x
            for (let i = 0; i < n; i++) {
                x[i] += 0.5 * this.dt * y[i];
            }

            // Full-step update for momentum y
            for (let i = 0; i < n; i++) {
                let couplingForce = 0;
                for (let j = 0; j < n; j++) {
                    couplingForce += this.J[i][j] * x[j];
                }
                couplingForce += this.h[i];

                // Non-linear Kerr oscillator potential gradient
                const force = -(1.0 - pumpSched) * x[i] - (this.kerrParam * x[i] * x[i] * x[i]) + (c0 * couplingForce);
                y[i] += this.dt * force;

                // Wall boundary condition / damping for ballistic stabilization
                if (Math.abs(x[i]) > 1.0) {
                    y[i] = 0;
                }
            }

            // Second half-step update for position x
            for (let i = 0; i < n; i++) {
                x[i] += 0.5 * this.dt * y[i];
                x[i] = Math.max(-1.0, Math.min(1.0, x[i]));
            }

            if (step % 20 === 0 || step === this.timeSteps - 1) {
                for (let i = 0; i < n; i++) {
                    spins[i] = x[i] >= 0 ? 1 : -1;
                }
                trajectory.push(this.computeEnergy(spins));
            }
        }

        // Final spin projection: s_i = sign(x_i)
        for (let i = 0; i < n; i++) {
            spins[i] = x[i] >= 0 ? 1 : -1;
        }

        const finalEnergy = this.computeEnergy(spins);

        return {
            spins: Array.from(spins),
            energy: finalEnergy,
            elapsedSteps: this.timeSteps,
            convergenceTrajectory: trajectory
        };
    }
}

module.exports = QuantumSimulatedBifurcation;
