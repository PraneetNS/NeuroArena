/**
 * QuantumAnnealingQUBOEngine.js
 *
 * Implements Adiabatic Quantum Annealing & Transverse-Field Ising Solver
 * for Quadratic Unconstrained Binary Optimization (QUBO) in real-time weapon-target assignment
 * and multi-agent sensor coverage.
 *
 * Mathematical Foundations:
 * 1. QUBO Formulation:
 *    Minimize E(x) = x^T Q x = \sum_i Q_{ii} x_i + \sum_{i < j} Q_{ij} x_i x_j,  x_i \in \{0, 1\}
 * 2. Mapping to Ising Spin Glasses:
 *    Transformation: x_i = (1 + \sigma_i^z) / 2, with \sigma_i^z \in \{-1, +1\}
 *    H_{problem} = -\sum_{i < j} J_{ij} \sigma_i^z \sigma_j^z - \sum_i h_i \sigma_i^z + C
 *    where J_{ij} = -Q_{ij} / 4, and h_i = -Q_{ii}/2 - \sum_{j \neq i} Q_{ij}/4.
 * 3. Time-Dependent Adiabatic Hamiltonian:
 *    H(s) = A(s) H_{driver} + B(s) H_{problem},  s = t / T \in [0, 1]
 *    where H_{driver} = -\sum_i \sigma_i^x (quantum transverse field enabling barrier tunneling).
 * 4. Trotterized Quantum Monte Carlo (Path-Integral Monte Carlo):
 *    Simulates M imaginary-time replicas coupled along the Trotter dimension with coupling J_\perp(s).
 *
 * References:
 * - Kadowaki & Nishimori (Physical Review E 1998): "Quantum annealing in the transverse Ising model"
 * - Farhi et al. (Science 2001): "A Quantum Adiabatic Evolution Algorithm Applied to Random Instances of an NP-Complete Problem"
 * - Lucas (Frontiers in Physics 2014): "Ising formulations of many NP problems"
 */

class QuantumAnnealingQUBOEngine {
    /**
     * @param {Object} options
     * @param {number} [options.trotterSlices=8] - Number of quantum Trotter replicas (M)
     * @param {number} [options.annealSteps=50] - Number of discrete annealing steps
     * @param {number} [options.temperature=0.1] - Thermal bath temperature \beta^{-1}
     */
    constructor(options = {}) {
        this.trotterSlices = options.trotterSlices || 8;
        this.annealSteps = options.annealSteps || 50;
        this.temperature = options.temperature || 0.1;
    }

    /**
     * Converts a symmetric QUBO matrix Q into an Ising model (J, h, offset)
     * @param {Array<Array<number>>} Q - n x n QUBO matrix
     * @returns {{ J: Array<Array<number>>, h: Float64Array, offset: number, n: number }}
     */
    quboToIsing(Q) {
        const n = Q.length;
        const J = Array.from({ length: n }, () => new Float64Array(n));
        const h = new Float64Array(n);
        let offset = 0;

        for (let i = 0; i < n; i++) {
            h[i] = -0.5 * Q[i][i];
            offset += 0.25 * Q[i][i];
            for (let j = 0; j < n; j++) {
                if (i !== j) {
                    const q_val = Q[i][j];
                    h[i] -= 0.25 * q_val;
                    offset += 0.125 * q_val;
                    if (i < j) {
                        const total_q = Q[i][j] + Q[j][i];
                        J[i][j] = -0.25 * total_q;
                        J[j][i] = -0.25 * total_q;
                    }
                }
            }
        }

        return { J, h, offset, n };
    }

    /**
     * Evaluates classical energy of a binary bitstring x \in {0, 1}^n on QUBO matrix Q
     * @param {Array<number>} x
     * @param {Array<Array<number>>} Q
     * @returns {number}
     */
    evaluateQUBOEnergy(x, Q) {
        const n = x.length;
        let e = 0;
        for (let i = 0; i < n; i++) {
            if (x[i] === 0) continue;
            e += Q[i][i];
            for (let j = i + 1; j < n; j++) {
                if (x[j] === 1) {
                    e += (Q[i][j] + Q[j][i]);
                }
            }
        }
        return e;
    }

    /**
     * Solves the QUBO problem using Simulated Quantum Annealing (SQA)
     * @param {Array<Array<number>>} Q - QUBO matrix
     * @returns {{ bestSolution: Array<number>, bestEnergy: number, annealHistory: Array<number> }}
     */
    solveQUBO(Q) {
        const { J, h, n } = this.quboToIsing(Q);
        const M = this.trotterSlices;
        const steps = this.annealSteps;
        const beta = 1.0 / this.temperature;

        // Initialize M Trotter replicas with random spins \sigma \in {-1, +1}
        const spins = Array.from({ length: M }, () => {
            const arr = new Int8Array(n);
            for (let i = 0; i < n; i++) {
                arr[i] = Math.random() < 0.5 ? -1 : 1;
            }
            return arr;
        });

        let bestSpins = new Int8Array(n);
        let minEnergy = Infinity;
        const annealHistory = [];

        for (let step = 0; step < steps; step++) {
            const s = step / steps; // Annealing parameter s \in [0, 1]

            // Transverse field A(s) and Problem field B(s) schedules
            const Gamma = 3.0 * (1.0 - s); // Transverse quantum tunneling field
            const B_s = s;

            // Trotter coupling between adjacent imaginary-time slices
            const jPerp = Gamma > 1e-4
                ? -0.5 / beta * Math.log(Math.tanh(beta * Gamma / M))
                : 10.0;

            // Metropolis spin sweep across all Trotter slices
            for (let m = 0; m < M; m++) {
                const mPrev = (m - 1 + M) % M;
                const mNext = (m + 1) % M;

                for (let i = 0; i < n; i++) {
                    const sigma_i = spins[m][i];

                    // Classical intra-slice interaction energy difference
                    let effField = h[i];
                    for (let j = 0; j < n; j++) {
                        if (i !== j) {
                            effField += J[i][j] * spins[m][j];
                        }
                    }
                    const dE_intra = -2.0 * B_s * sigma_i * effField / M;

                    // Quantum inter-slice Trotter interaction
                    const dE_inter = -2.0 * jPerp * sigma_i * (spins[mPrev][i] + spins[mNext][i]);

                    const deltaE = dE_intra + dE_inter;

                    // Glauber / Metropolis acceptance
                    if (deltaE < 0 || Math.random() < Math.exp(-beta * deltaE)) {
                        spins[m][i] = -sigma_i;
                    }
                }
            }

            // Track lowest energy across all replicas
            for (let m = 0; m < M; m++) {
                const candidateX = new Array(n);
                for (let i = 0; i < n; i++) {
                    candidateX[i] = spins[m][i] === 1 ? 1 : 0;
                }
                const e = this.evaluateQUBOEnergy(candidateX, Q);
                if (e < minEnergy) {
                    minEnergy = e;
                    bestSpins = new Int8Array(spins[m]);
                }
            }

            annealHistory.push(minEnergy);
        }

        const bestSolution = new Array(n);
        for (let i = 0; i < n; i++) {
            bestSolution[i] = bestSpins[i] === 1 ? 1 : 0;
        }

        return {
            bestSolution,
            bestEnergy: minEnergy,
            annealHistory
        };
    }

    /**
     * Builds weapon-to-target assignment QUBO matrix
     * Solves optimal assignment of W weapons to T targets with ammo and priority constraints.
     */
    static buildTargetAssignmentQUBO(weaponCosts, targetPriorities, effectivenessMatrix) {
        const numWeapons = weaponCosts.length;
        const numTargets = targetPriorities.length;
        const n = numWeapons * numTargets;
        const Q = Array.from({ length: n }, () => new Float64Array(n));

        const getIdx = (w, t) => w * numTargets + t;

        // Reward for eliminating high priority targets
        for (let w = 0; w < numWeapons; w++) {
            for (let t = 0; t < numTargets; t++) {
                const idx = getIdx(w, t);
                const benefit = targetPriorities[t] * effectivenessMatrix[w][t];
                const cost = weaponCosts[w];
                Q[idx][idx] = cost - benefit;
            }
        }

        // Constraint: each weapon can be assigned to at most one target
        const penaltyA = 50.0;
        for (let w = 0; w < numWeapons; w++) {
            for (let t1 = 0; t1 < numTargets; t1++) {
                for (let t2 = t1 + 1; t2 < numTargets; t2++) {
                    const i1 = getIdx(w, t1);
                    const i2 = getIdx(w, t2);
                    Q[i1][i2] += penaltyA;
                    Q[i2][i1] += penaltyA;
                }
            }
        }

        return Q;
    }
}

module.exports = QuantumAnnealingQUBOEngine;
