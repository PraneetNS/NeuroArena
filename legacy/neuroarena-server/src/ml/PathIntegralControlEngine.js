/**
 * PathIntegralControlEngine.js
 *
 * Implements Stochastic Optimal Control via Path Integrals (PI2 / Model Predictive Path Integral - MPPI).
 *
 * Mathematical Foundations:
 * Controlled diffusion process:
 *   dx = (f(x) + G(x) u) dt + B(x) dW_t
 * Trajectory Cost Functional:
 *   S(\tau) = \phi(x_T) + \int_0^T [ q(x_t) + \frac{1}{2} u_t^T R u_t ] dt
 *
 * Through Feynman-Kac transformation, the Hamilton-Jacobi-Bellman PDE is solved
 * via sampling forward stochastic trajectories under exploration noise \epsilon_{k, t} \sim \mathcal{N}(0, \Sigma):
 *   w_k = \frac{\exp(-\frac{1}{\lambda} S(\tau_k))}{\sum_{j=1}^K \exp(-\frac{1}{\lambda} S(\tau_j))}
 *   u^*(t) = u_{nom}(t) + \sum_{k=1}^K w_k \epsilon_{k, t}
 *
 * Key Advantages:
 * - Derivative-free: Handles non-differentiable obstacle bounds and discontinuous cost landscapes.
 * - Robust under severe noise and adversarial evasive agents.
 *
 * References:
 * - Kappen (Physical Review Letters 2005): "Path integrals and symmetry breaks for optimal control"
 * - Theodorou, Buchli, Schaal (JMLR 2010): "A Generalized Path Integral Control Approach to Reinforcement Learning"
 */

class PathIntegralControlEngine {
    /**
     * @param {Object} options
     * @param {number} [options.stateDim=4] - Dimension of state vector [x, y, vx, vy]
     * @param {number} [options.controlDim=2] - Dimension of control vector [ax, ay]
     * @param {number} [options.horizon=15] - Time steps in prediction horizon
     * @param {number} [options.dt=0.05] - Time discretization step (seconds)
     * @param {number} [options.numSamples=32] - Number of Monte Carlo stochastic rollouts
     * @param {number} [options.temperature=1.0] - Information temperature \lambda
     * @param {number} [options.noiseStd=1.5] - Standard deviation of Brownian control exploration
     */
    constructor(options = {}) {
        this.stateDim = options.stateDim || 4;
        this.controlDim = options.controlDim || 2;
        this.horizon = options.horizon || 15;
        this.dt = options.dt || 0.05;
        this.numSamples = options.numSamples || 32;
        this.lambda = options.temperature || 1.0;
        this.noiseStd = options.noiseStd || 1.5;

        // Nominal control sequence u_nom[t][d]
        this.nominalControl = Array.from({ length: this.horizon }, () => new Float64Array(this.controlDim));
    }

    /**
     * Standard normal random number (Box-Muller transform)
     */
    randn() {
        let u1 = 0, u2 = 0;
        while (u1 === 0) u1 = Math.random();
        while (u2 === 0) u2 = Math.random();
        return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    }

    /**
     * Forward system dynamics: x_{t+1} = f(x_t, u_t)
     * Default: 2D double integrator with linear drag
     */
    stepDynamics(x, u) {
        const nextX = new Float64Array(this.stateDim);
        const drag = 0.05;
        // Position update
        nextX[0] = x[0] + x[2] * this.dt;
        nextX[1] = x[1] + x[3] * this.dt;
        // Velocity update
        nextX[2] = x[2] + (u[0] - drag * x[2]) * this.dt;
        nextX[3] = x[3] + (u[1] - drag * x[3]) * this.dt;
        return nextX;
    }

    /**
     * Running cost q(x, u): distance to target + obstacle repulsion + control effort
     */
    runningCost(x, u, target, obstacles = []) {
        const dx = x[0] - target[0];
        const dy = x[1] - target[1];
        let cost = dx * dx + dy * dy;

        // Obstacle avoidance barrier penalty
        for (const obs of obstacles) {
            const ox = x[0] - obs.x;
            const oy = x[1] - obs.y;
            const dist = Math.sqrt(ox * ox + oy * oy);
            const radius = obs.radius || 1.0;
            if (dist < radius) {
                cost += 1000.0 * (radius - dist);
            }
        }

        // Control effort cost 1/2 u^T R u
        cost += 0.1 * (u[0] * u[0] + u[1] * u[1]);
        return cost;
    }

    /**
     * Terminal cost \phi(x_T)
     */
    terminalCost(x, target) {
        const dx = x[0] - target[0];
        const dy = x[1] - target[1];
        const vSq = x[2] * x[2] + x[3] * x[3];
        return 5.0 * (dx * dx + dy * dy) + 0.5 * vSq;
    }

    /**
     * Solves for the optimal MPPI control sequence given current state, target, and obstacles
     * @param {Array<number>} currentState - [x, y, vx, vy]
     * @param {Array<number>} target - [tx, ty]
     * @param {Array<Object>} obstacles - [{ x, y, radius }, ...]
     * @returns {{ optimalControl: Array<number>, predictedTrajectory: Array<Array<number>>, minCost: number }}
     */
    computeOptimalControl(currentState, target, obstacles = []) {
        const K = this.numSamples;
        const H = this.horizon;
        const D = this.controlDim;

        const noiseRollouts = [];
        const costs = new Float64Array(K);

        for (let k = 0; k < K; k++) {
            const noise = Array.from({ length: H }, () => {
                const arr = new Float64Array(D);
                for (let d = 0; d < D; d++) {
                    arr[d] = this.randn() * this.noiseStd;
                }
                return arr;
            });
            noiseRollouts.push(noise);

            let state = new Float64Array(currentState);
            let totalCost = 0;

            for (let t = 0; t < H; t++) {
                const u = new Float64Array(D);
                for (let d = 0; d < D; d++) {
                    u[d] = this.nominalControl[t][d] + noise[t][d];
                }

                totalCost += this.runningCost(state, u, target, obstacles);
                state = this.stepDynamics(state, u);
            }

            totalCost += this.terminalCost(state, target);
            costs[k] = totalCost;
        }

        // Numerical stability: subtract minimum cost before exponential
        let minCost = Infinity;
        for (let k = 0; k < K; k++) {
            if (costs[k] < minCost) minCost = costs[k];
        }

        const weights = new Float64Array(K);
        let sumWeights = 0.0;
        for (let k = 0; k < K; k++) {
            const w = Math.exp(-(costs[k] - minCost) / this.lambda);
            weights[k] = w;
            sumWeights += w;
        }

        for (let k = 0; k < K; k++) {
            weights[k] /= (sumWeights + 1e-12);
        }

        // Weighted control update
        for (let t = 0; t < H; t++) {
            for (let d = 0; d < D; d++) {
                let deltaU = 0.0;
                for (let k = 0; k < K; k++) {
                    deltaU += weights[k] * noiseRollouts[k][t][d];
                }
                this.nominalControl[t][d] += deltaU;
            }
        }

        // Generate nominal predicted trajectory
        const predictedTrajectory = [Array.from(currentState)];
        let pState = new Float64Array(currentState);
        for (let t = 0; t < H; t++) {
            pState = this.stepDynamics(pState, this.nominalControl[t]);
            predictedTrajectory.push(Array.from(pState));
        }

        const immediateControl = Array.from(this.nominalControl[0]);

        // Shift control horizon forward by 1 step for warm-start in next iteration
        for (let t = 0; t < H - 1; t++) {
            this.nominalControl[t].set(this.nominalControl[t + 1]);
        }
        this.nominalControl[H - 1].fill(0.0);

        return {
            optimalControl: immediateControl,
            predictedTrajectory,
            minCost
        };
    }
}

module.exports = PathIntegralControlEngine;
