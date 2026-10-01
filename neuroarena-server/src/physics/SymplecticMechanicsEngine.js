/**
 * SymplecticMechanicsEngine.js
 *
 * Implements Symplectic Integrators (Velocity Verlet & 4th-Order Forest-Ruth)
 * for Hamiltonian phase-space dynamics preserving Poincaré differential 2-forms:
 *   \omega = \sum dq_i \wedge dp_i
 *
 * Traditional Runge-Kutta methods accumulate energy drift over long orbits,
 * whereas symplectic integrators conserve the modified Hamiltonian indefinitely.
 *
 * Equations of Motion:
 *   dq/dt = \nabla_p H(q, p) = p / m
 *   dp/dt = -\nabla_q H(q, p) = F(q)
 *
 * References:
 * - Hairer, Lubich, Wanner (Springer 2006): "Geometric Numerical Integration"
 * - Forest & Ruth (Physica D 1990): "Fourth-order symplectic integration"
 */

class SymplecticMechanicsEngine {
    /**
     * @param {Object} options
     * @param {number} [options.mass=1.0] - Particle mass
     * @param {number} [options.gravitationalConstant=10.0] - Gravitational coupling constant
     * @param {number} [options.softening=0.1] - Gravitational softening parameter
     */
    constructor(options = {}) {
        this.mass = options.mass || 1.0;
        this.G = options.gravitationalConstant || 10.0;
        this.epsilon = options.softening || 0.1;

        // 4th order Forest-Ruth integration constants
        const theta = 1.0 / (2.0 - Math.cbrt(2.0));
        this.c = [theta / 2.0, (1.0 - theta) / 2.0, (1.0 - theta) / 2.0, theta / 2.0];
        this.d = [theta, 1.0 - 2.0 * theta, theta, 0.0];
    }

    /**
     * Computes gravitational force F(q) = -G * m / (||q||^2 + eps^2)^{3/2} * q
     */
    computeForce(q) {
        const r2 = q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + this.epsilon * this.epsilon;
        const invR3 = 1.0 / (r2 * Math.sqrt(r2));
        const factor = -this.G * this.mass * invR3;
        return [q[0] * factor, q[1] * factor, q[2] * factor];
    }

    /**
     * Computes total Hamiltonian energy H(q, p) = Kinetic + Potential
     */
    computeHamiltonian(q, p) {
        const kinetic = (p[0] * p[0] + p[1] * p[1] + p[2] * p[2]) / (2.0 * this.mass);
        const r = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + this.epsilon * this.epsilon);
        const potential = -this.G * this.mass / r;
        return kinetic + potential;
    }

    /**
     * 2nd-order Störmer-Verlet symplectic step
     * @param {Array<number>} q Position [x, y, z]
     * @param {Array<number>} p Momentum [px, py, pz]
     * @param {number} dt Time step
     * @returns {{ q: Array<number>, p: Array<number> }}
     */
    stepVerlet(q, p, dt) {
        const f0 = this.computeForce(q);
        const halfP = [
            p[0] + 0.5 * dt * f0[0],
            p[1] + 0.5 * dt * f0[1],
            p[2] + 0.5 * dt * f0[2]
        ];

        const nextQ = [
            q[0] + dt * halfP[0] / this.mass,
            q[1] + dt * halfP[1] / this.mass,
            q[2] + dt * halfP[2] / this.mass
        ];

        const f1 = this.computeForce(nextQ);
        const nextP = [
            halfP[0] + 0.5 * dt * f1[0],
            halfP[1] + 0.5 * dt * f1[1],
            halfP[2] + 0.5 * dt * f1[2]
        ];

        return { q: nextQ, p: nextP };
    }

    /**
     * 4th-order Forest-Ruth symplectic step for high-precision orbit stability
     * @param {Array<number>} q
     * @param {Array<number>} p
     * @param {number} dt
     * @returns {{ q: Array<number>, p: Array<number> }}
     */
    stepForestRuth(q, p, dt) {
        let curQ = q.slice();
        let curP = p.slice();

        for (let i = 0; i < 4; i++) {
            // Position update
            curQ[0] += this.c[i] * dt * curP[0] / this.mass;
            curQ[1] += this.c[i] * dt * curP[1] / this.mass;
            curQ[2] += this.c[i] * dt * curP[2] / this.mass;

            if (i < 3) {
                // Momentum update
                const f = this.computeForce(curQ);
                curP[0] += this.d[i] * dt * f[0];
                curP[1] += this.d[i] * dt * f[1];
                curP[2] += this.d[i] * dt * f[2];
            }
        }

        return { q: curQ, p: curP };
    }
}

module.exports = SymplecticMechanicsEngine;
