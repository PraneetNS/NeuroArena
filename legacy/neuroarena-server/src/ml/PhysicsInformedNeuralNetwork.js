/**
 * PhysicsInformedNeuralNetwork.js
 *
 * Implements a Physics-Informed Neural Network (PINN) enforcing Hamiltonian mechanics
 * and symplectic energy conservation for arena trajectory modeling and robotic agents.
 * Penalizes non-physical energy drift and violations of Hamilton's equations of motion:
 *   dq/dt =  dH/dp
 *   dp/dt = -dH/dq
 *
 * Mathematical Reference:
 * Raissi, Perdikaris, Karniadakis (J. Comput. Phys. 2019) "Physics-informed neural networks"
 * Greydanus et al. (NeurIPS 2019) "Hamiltonian Neural Networks"
 */

class PhysicsInformedNeuralNetwork {
    /**
     * @param {Object} options
     * @param {number} [options.mass=1.0] - Invariant mass of simulated agent
     * @param {number} [options.gravity=9.81] - Gravitational acceleration
     * @param {number} [options.hamiltonianWeight=10.0] - Weight lambda for energy conservation loss
     * @param {number} [options.symplecticWeight=5.0] - Weight lambda for Hamilton's residual equations
     * @param {number} [options.learningRate=0.01]
     */
    constructor(options = {}) {
        this.mass = options.mass || 1.0;
        this.gravity = options.gravity || 9.81;
        this.hamiltonianWeight = options.hamiltonianWeight || 10.0;
        this.symplecticWeight = options.symplecticWeight || 5.0;
        this.learningRate = options.learningRate || 0.01;

        // Neural network weights for potential field estimation V_theta(q)
        // [q] -> [hidden_8] -> [V(q)]
        this.w1 = new Float32Array(8); // Input dimension = 1 (height/pos q)
        this.b1 = new Float32Array(8);
        this.w2 = new Float32Array(8);
        this.b2 = 0.0;

        this.initializeWeights();
        this.totalSteps = 0;
        this.lastLossMetrics = null;
    }

    initializeWeights() {
        for (let i = 0; i < 8; i++) {
            this.w1[i] = (Math.random() - 0.5) * 0.5;
            this.b1[i] = 0.0;
            this.w2[i] = (Math.random() - 0.5) * 0.5;
        }
        this.b2 = 0.0;
    }

    /**
     * Forward pass to compute potential energy V(q)
     * V(q) = w2 * tanh(w1 * q + b1) + b2
     */
    forwardPotential(q) {
        let sum = 0;
        for (let i = 0; i < 8; i++) {
            const z = this.w1[i] * q + this.b1[i];
            const a = Math.tanh(z);
            sum += this.w2[i] * a;
        }
        return sum + this.b2;
    }

    /**
     * Analytical gradient of potential energy with respect to coordinate q: dV/dq
     */
    gradPotential(q) {
        let grad = 0;
        for (let i = 0; i < 8; i++) {
            const z = this.w1[i] * q + this.b1[i];
            const tanh_z = Math.tanh(z);
            const dtanh = 1.0 - tanh_z * tanh_z;
            grad += this.w2[i] * dtanh * this.w1[i];
        }
        return grad;
    }

    /**
     * Total Hamiltonian energy: H(q, p) = T(p) + V(q) = (p^2) / (2m) + V(q)
     */
    computeHamiltonian(q, p) {
        const kinetic = (p * p) / (2.0 * this.mass);
        const potential = this.forwardPotential(q);
        return kinetic + potential;
    }

    /**
     * Predicts time derivatives using Hamilton's equations:
     * dq_dt = p / m
     * dp_dt = -dV/dq
     */
    predictDerivatives(q, p) {
        const dq_dt = p / this.mass;
        const dp_dt = -this.gradPotential(q);
        return { dq_dt, dp_dt };
    }

    /**
     * PINN Loss function:
     * L_total = L_data + lambda_H * L_Hamiltonian + lambda_sym * L_symplectic
     *
     * @param {Array<{q: number, p: number, dq_dt_obs: number, dp_dt_obs: number, H0: number}>} trajectoryBatch
     * @returns {Object} Loss components and parameter updates
     */
    trainStep(trajectoryBatch) {
        const batchSize = trajectoryBatch.length;
        if (batchSize === 0) return null;

        let totalDataLoss = 0;
        let totalHamLoss = 0;
        let totalSympLoss = 0;

        for (const sample of trajectoryBatch) {
            const { q, p, dq_dt_obs, dp_dt_obs, H0 } = sample;

            // 1. Hamiltonian conservation residual: (H(q, p) - H0)^2
            const currentH = this.computeHamiltonian(q, p);
            const hResidual = currentH - H0;
            totalHamLoss += hResidual * hResidual;

            // 2. Symplectic equation residuals
            const { dq_dt, dp_dt } = this.predictDerivatives(q, p);
            const qDotResidual = dq_dt - dq_dt_obs;
            const pDotResidual = dp_dt - dp_dt_obs;
            totalSympLoss += (qDotResidual * qDotResidual) + (pDotResidual * pDotResidual);

            // 3. Empirical data loss
            totalDataLoss += (dp_dt - dp_dt_obs) * (dp_dt - dp_dt_obs);

            // Backpropagate gradient step on weights (stochastic approximation)
            const dLoss_dPred = 2.0 * (dp_dt - dp_dt_obs) + 2.0 * this.hamiltonianWeight * hResidual;
            for (let i = 0; i < 8; i++) {
                const z = this.w1[i] * q + this.b1[i];
                const tanh_z = Math.tanh(z);
                this.w2[i] -= this.learningRate * (dLoss_dPred * tanh_z) / batchSize;
                this.w1[i] -= this.learningRate * (dLoss_dPred * this.w2[i] * (1.0 - tanh_z * tanh_z) * q) / batchSize;
            }
        }

        const avgDataLoss = totalDataLoss / batchSize;
        const avgHamLoss = totalHamLoss / batchSize;
        const avgSympLoss = totalSympLoss / batchSize;
        const totalLoss = avgDataLoss + (this.hamiltonianWeight * avgHamLoss) + (this.symplecticWeight * avgSympLoss);

        this.totalSteps++;
        this.lastLossMetrics = {
            step: this.totalSteps,
            totalLoss,
            dataLoss: avgDataLoss,
            hamiltonianLoss: avgHamLoss,
            symplecticLoss: avgSympLoss,
            energyConserved: avgHamLoss < 0.05
        };

        return this.lastLossMetrics;
    }

    /**
     * Integrates trajectory forward using Symplectic Verlet / Euler integration
     * preserving the phase space volume (Liouville's theorem)
     */
    integrateSymplecticStep(q, p, dt) {
        // Half-step momentum
        const gradV1 = this.gradPotential(q);
        const p_half = p - 0.5 * dt * gradV1;

        // Full-step position
        const q_next = q + dt * (p_half / this.mass);

        // Second half-step momentum
        const gradV2 = this.gradPotential(q_next);
        const p_next = p_half - 0.5 * dt * gradV2;

        return {
            q: q_next,
            p: p_next,
            energy: this.computeHamiltonian(q_next, p_next)
        };
    }
}

module.exports = PhysicsInformedNeuralNetwork;
