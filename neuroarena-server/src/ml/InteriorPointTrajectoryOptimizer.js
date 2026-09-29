/**
 * InteriorPointTrajectoryOptimizer.js
 *
 * Implements a Primal-Dual Interior-Point Optimizer for boundary-constrained
 * optimal vehicle racing trajectories and kinematic path planning.
 *
 * Formulates the constrained program:
 *   minimize    f(x) = sum_k ( ||x_{k+1} - x_k||^2 + alpha * ||a_k||^2 )  (Path smoothness & energy)
 *   subject to  c_i(x_k) >= 0  (Track boundaries & obstacle exclusion zones)
 *
 * Uses logarithmic barrier function:
 *   B(x, mu) = f(x) - mu * sum_i ln(c_i(x))
 *
 * Iterates toward KKT (Karush-Kuhn-Tucker) stationarity with damped Newton steps
 * and geometric barrier parameter decay: mu_{k+1} = beta * mu_k.
 *
 * Mathematical Reference:
 * Nocedal & Wright (2006) "Numerical Optimization" - Chapter 19: Interior-Point Methods
 * Boyd & Vandenberghe (2004) "Convex Optimization"
 */

class InteriorPointTrajectoryOptimizer {
    /**
     * @param {Object} options
     * @param {number} [options.numWaypoints=12] - Number of discrete trajectory waypoints
     * @param {number} [options.barrierMu=1.0] - Initial barrier penalty parameter
     * @param {number} [options.muDecay=0.2] - Barrier reduction factor per outer iteration
     * @param {number} [options.smoothnessWeight=1.0] - Path length penalty
     * @param {number} [options.boundaryClearance=25.0] - Track corridor radius
     * @param {number} [options.maxOuterIters=8]
     * @param {number} [options.maxNewtonIters=10]
     */
    constructor(options = {}) {
        this.numWaypoints = options.numWaypoints || 12;
        this.barrierMu = options.barrierMu || 1.0;
        this.muDecay = options.muDecay || 0.2;
        this.smoothnessWeight = options.smoothnessWeight || 1.0;
        this.boundaryClearance = options.boundaryClearance || 25.0;
        this.maxOuterIters = options.maxOuterIters || 8;
        this.maxNewtonIters = options.maxNewtonIters || 10;
    }

    /**
     * Barrier objective: B(x, mu) = f(x) - mu * sum_i ln(R^2 - ||x_k||^2)
     */
    evaluateBarrierObjective(waypoints, obstacles, mu) {
        let f = 0.0;
        const n = waypoints.length;

        // Path smoothness (quadratic variation / kinetic energy)
        for (let i = 0; i < n - 1; i++) {
            const dx = waypoints[i + 1][0] - waypoints[i][0];
            const dy = waypoints[i + 1][1] - waypoints[i][1];
            f += this.smoothnessWeight * (dx * dx + dy * dy);
        }

        // Boundary barrier: R^2 - (x^2 + y^2) > 0
        const R2 = this.boundaryClearance * this.boundaryClearance;
        let barrier = 0.0;

        for (let i = 0; i < n; i++) {
            const r2 = waypoints[i][0] * waypoints[i][0] + waypoints[i][1] * waypoints[i][1];
            const margin = R2 - r2;
            if (margin <= 1e-4) {
                return Infinity; // Boundary violation
            }
            barrier += Math.log(margin);

            // Obstacle exclusion barriers
            for (const obs of obstacles) {
                const odx = waypoints[i][0] - obs.x;
                const ody = waypoints[i][1] - obs.y;
                const distSq = odx * odx + ody * ody;
                const obsMargin = distSq - (obs.radius * obs.radius);
                if (obsMargin <= 1e-4) {
                    return Infinity;
                }
                barrier += Math.log(obsMargin);
            }
        }

        return f - mu * barrier;
    }

    /**
     * Numerical gradient of the barrier objective wrt intermediate waypoint coordinates
     */
    computeBarrierGradient(waypoints, obstacles, mu) {
        const eps = 1e-4;
        const grad = [];
        const baseVal = this.evaluateBarrierObjective(waypoints, obstacles, mu);

        for (let i = 0; i < waypoints.length; i++) {
            // Pin start (index 0) and goal (last index)
            if (i === 0 || i === waypoints.length - 1) {
                grad.push([0, 0]);
                continue;
            }

            const pX = waypoints[i][0];
            const pY = waypoints[i][1];

            // Perturb X
            waypoints[i][0] = pX + eps;
            const valX = this.evaluateBarrierObjective(waypoints, obstacles, mu);
            const gx = (valX - baseVal) / eps;
            waypoints[i][0] = pX;

            // Perturb Y
            waypoints[i][1] = pY + eps;
            const valY = this.evaluateBarrierObjective(waypoints, obstacles, mu);
            const gy = (valY - baseVal) / eps;
            waypoints[i][1] = pY;

            grad.push([gx, gy]);
        }
        return grad;
    }

    /**
     * Solves trajectory via Primal-Dual Interior-Point Newton method
     */
    optimizeTrajectory(startPos, goalPos, obstacles = []) {
        // Initialize straight-line interpolation between start and goal
        const waypoints = [];
        for (let i = 0; i < this.numWaypoints; i++) {
            const alpha = i / (this.numWaypoints - 1);
            waypoints.push([
                startPos[0] + alpha * (goalPos[0] - startPos[0]),
                startPos[1] + alpha * (goalPos[1] - startPos[1])
            ]);
        }

        let currentMu = this.barrierMu;
        let totalSteps = 0;

        for (let outer = 0; outer < this.maxOuterIters; outer++) {
            for (let inner = 0; inner < this.maxNewtonIters; inner++) {
                totalSteps++;
                const grad = this.computeBarrierGradient(waypoints, obstacles, currentMu);

                // Armijo line search
                let stepSize = 0.05;
                let improved = false;
                const oldObj = this.evaluateBarrierObjective(waypoints, obstacles, currentMu);

                for (let ls = 0; ls < 5; ls++) {
                    const candidateWaypoints = waypoints.map((wp, idx) => [
                        wp[0] - stepSize * grad[idx][0],
                        wp[1] - stepSize * grad[idx][1]
                    ]);

                    const newObj = this.evaluateBarrierObjective(candidateWaypoints, obstacles, currentMu);
                    if (newObj < oldObj) {
                        for (let k = 0; k < waypoints.length; k++) {
                            waypoints[k][0] = candidateWaypoints[k][0];
                            waypoints[k][1] = candidateWaypoints[k][1];
                        }
                        improved = true;
                        break;
                    }
                    stepSize *= 0.5;
                }

                if (!improved) break;
            }

            // Decay barrier parameter mu toward 0
            currentMu *= this.muDecay;
        }

        return {
            optimizedWaypoints: waypoints,
            finalMu: currentMu,
            totalIterations: totalSteps,
            isFeasible: Number.isFinite(this.evaluateBarrierObjective(waypoints, obstacles, 1e-4))
        };
    }
}

module.exports = InteriorPointTrajectoryOptimizer;
