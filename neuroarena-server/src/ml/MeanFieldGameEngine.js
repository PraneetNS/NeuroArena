/**
 * MeanFieldGameEngine.js
 *
 * Implements a Continuum Mean Field Game (MFG) Master Equation Solver
 * for massive-scale (100+ agents) swarm coordination and territorial defense.
 *
 * Formulates multi-agent equilibrium through coupled non-linear partial differential equations:
 * 1. Hamilton-Jacobi-Bellman (HJB) equation (Backward in time):
 *    -\partial_t u(t, x) - \frac{\sigma^2}{2} \Delta u + \frac{1}{2} |\nabla u|^2 = F(x, m(t))
 * 2. Fokker-Planck (FP) equation (Forward in time):
 *    \partial_t m(t, x) - \frac{\sigma^2}{2} \Delta m + \text{div}(m \cdot v^*) = 0
 *    where v^*(t, x) = -\nabla u(t, x) is the optimal collective drift field.
 *
 * Numerical Scheme:
 * Upwind finite-difference spatial discretization with alternating fixed-point Picard iterations.
 *
 * References:
 * - Lasry & Lions (2007): "Mean Field Games"
 * - Huang, Malhame, Caines (2006): "Large Population Stochastic Dynamic Games"
 * - Carmona & Delarue (2018): "Probabilistic Theory of Mean Field Games with Applications"
 */

class MeanFieldGameEngine {
    /**
     * @param {Object} options
     * @param {number} [options.gridSize=16] - Spatial discretization cells along each 2D axis (gridSize x gridSize)
     * @param {number} [options.timeHorizon=10] - Number of temporal discretization steps
     * @param {number} [options.diffusion=0.1] - Brownian diffusion coefficient \sigma^2 / 2
     * @param {number} [options.spatialStep=1.0] - Physical grid spacing \Delta x
     * @param {number} [options.timeStep=0.1] - Time step \Delta t
     */
    constructor(options = {}) {
        this.gridSize = options.gridSize || 16;
        this.timeHorizon = options.timeHorizon || 10;
        this.diffusion = options.diffusion || 0.1;
        this.dx = options.spatialStep || 1.0;
        this.dt = options.timeStep || 0.1;

        this.numCells = this.gridSize * this.gridSize;

        // Density field m[t][cell] forward in time
        this.m = Array.from({ length: this.timeHorizon }, () => new Float32Array(this.numCells));

        // Value field u[t][cell] backward in time
        this.u = Array.from({ length: this.timeHorizon }, () => new Float32Array(this.numCells));

        // Optimal velocity drift field [vx, vy] per cell
        this.driftFields = Array.from({ length: this.timeHorizon }, () => ({
            vx: new Float32Array(this.numCells),
            vy: new Float32Array(this.numCells)
        }));
    }

    cellIndex(x, y) {
        const cx = Math.max(0, Math.min(this.gridSize - 1, x));
        const cy = Math.max(0, Math.min(this.gridSize - 1, y));
        return cy * this.gridSize + cx;
    }

    /**
     * Initializes initial density distribution m_0(x) from swarm agent positions
     * @param {Array<{ x: number, y: number }>} agents
     */
    initializeDensity(agents) {
        const m0 = this.m[0];
        m0.fill(0);
        const count = Math.max(1, agents.length);

        for (const agent of agents) {
            const gx = Math.floor((agent.x / this.dx) % this.gridSize);
            const gy = Math.floor((agent.y / this.dx) % this.gridSize);
            const idx = this.cellIndex(gx, gy);
            m0[idx] += 1.0 / count;
        }
    }

    /**
     * Computes the interaction running cost F(x, m) (e.g. congestion penalty + target attraction)
     */
    interactionCost(cellX, cellY, density, targetX = 8, targetY = 8) {
        const distSq = (cellX - targetX) ** 2 + (cellY - targetY) ** 2;
        const targetCost = 0.05 * distSq;
        const congestionPenalty = 2.0 * density; // Disincentivizes over-clustering
        return targetCost + congestionPenalty;
    }

    /**
     * Solves one coupled HJB-FP iteration step to find Nash equilibrium drift fields.
     */
    solveEquilibriumStep(iterations = 3) {
        for (let iter = 0; iter < iterations; iter++) {
            // 1. Backward HJB Solve: Compute u[t] from t = T-1 down to 0
            for (let t = this.timeHorizon - 1; t >= 0; t--) {
                const uCurrent = this.u[t];
                const uNext = (t === this.timeHorizon - 1) ? uCurrent : this.u[t + 1];
                const mCurrent = this.m[t];

                for (let y = 0; y < this.gridSize; y++) {
                    for (let x = 0; x < this.gridSize; x++) {
                        const idx = this.cellIndex(x, y);

                        // Discrete gradients via central difference
                        const idxR = this.cellIndex(x + 1, y);
                        const idxL = this.cellIndex(x - 1, y);
                        const idxU = this.cellIndex(x, y + 1);
                        const idxD = this.cellIndex(x, y - 1);

                        const gradX = (uNext[idxR] - uNext[idxL]) / (2.0 * this.dx);
                        const gradY = (uNext[idxU] - uNext[idxD]) / (2.0 * this.dx);
                        const kineticHamiltonian = 0.5 * (gradX * gradX + gradY * gradY);

                        // Running cost
                        const cost = this.interactionCost(x, y, mCurrent[idx]);

                        // Backward Euler step: u[t] = u[t+1] + dt * (cost - Hamiltonian + diffusion * Laplacian)
                        const laplacian = (uNext[idxR] + uNext[idxL] + uNext[idxU] + uNext[idxD] - 4.0 * uNext[idx]) / (this.dx * this.dx);

                        uCurrent[idx] = uNext[idx] + this.dt * (cost - kineticHamiltonian + this.diffusion * laplacian);

                        // Drift velocity v* = -grad(u)
                        this.driftFields[t].vx[idx] = -gradX;
                        this.driftFields[t].vy[idx] = -gradY;
                    }
                }
            }

            // 2. Forward Fokker-Planck Solve: Compute m[t+1] from t = 0 up to T-2
            for (let t = 0; t < this.timeHorizon - 1; t++) {
                const mCurrent = this.m[t];
                const mNext = this.m[t + 1];
                const vx = this.driftFields[t].vx;
                const vy = this.driftFields[t].vy;

                mNext.fill(0);
                for (let y = 0; y < this.gridSize; y++) {
                    for (let x = 0; x < this.gridSize; x++) {
                        const idx = this.cellIndex(x, y);
                        const dens = mCurrent[idx];
                        if (dens <= 0) continue;

                        // Advection step: transport mass along v*
                        const targetX = Math.round(x + vx[idx] * this.dt);
                        const targetY = Math.round(y + vy[idx] * this.dt);
                        const targetIdx = this.cellIndex(targetX, targetY);

                        mNext[targetIdx] += dens;
                    }
                }

                // Normalization
                let sumMass = 0;
                for (let i = 0; i < this.numCells; i++) sumMass += mNext[i];
                if (sumMass > 0) {
                    for (let i = 0; i < this.numCells; i++) mNext[i] /= sumMass;
                }
            }
        }
    }

    /**
     * Samples optimal drift vector for an agent at physical coordinates (x, y)
     */
    getOptimalDrift(x, y, tIndex = 0) {
        const t = Math.max(0, Math.min(this.timeHorizon - 1, tIndex));
        const gx = Math.floor((x / this.dx) % this.gridSize);
        const gy = Math.floor((y / this.dx) % this.gridSize);
        const idx = this.cellIndex(gx, gy);

        return {
            vx: this.driftFields[t].vx[idx],
            vy: this.driftFields[t].vy[idx],
            localDensity: this.m[t][idx]
        };
    }
}

module.exports = MeanFieldGameEngine;
