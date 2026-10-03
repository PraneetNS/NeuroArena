/**
 * ThermodynamicWorkEngine.js
 *
 * Implements Non-Equilibrium Statistical Mechanics and Stochastic Thermodynamics
 * for agent dynamics, swarm heat dissipation, and free-energy landscape exploration.
 *
 * Mathematical Framework:
 * 1. Overdamped and underdamped Langevin dynamics in phase space (q, p):
 *      dq = (p / m) dt
 *      dp = (-\nabla V(q, \lambda_t) - \gamma p) dt + \sqrt{2 \gamma m k_B T} dW_t
 * 2. Jarzynski Equality (Nonequilibrium Work Theorem):
 *      \langle \exp(-\beta W) \rangle = \exp(-\beta \Delta F)
 *    where \beta = 1 / (k_B T), W is external work protocol along path \lambda_t,
 *    and \Delta F = F_{final} - F_{initial} is the equilibrium Helmholtz free-energy difference.
 * 3. Crooks Fluctuation Theorem:
 *      P_F(W) / P_R(-W) = \exp(\beta (W - \Delta F))
 * 4. Clausius Entropy Production Rate:
 *      \dot{S}_{prod} = \beta (\langle \dot{W} \rangle - \Delta \dot{F}) \ge 0 (Second Law of Thermodynamics).
 *
 * References:
 * - Jarzynski, C. (1997): "Nonequilibrium Equality for Free Energy Differences", PRL.
 * - Crooks, G. E. (1999): "Entropy production fluctuation theorem", Phys. Rev. E.
 * - Seifert, U. (2012): "Stochastic thermodynamics, fluctuation theorems and molecular machines", Rep. Prog. Phys.
 */

class ThermodynamicWorkEngine {
    /**
     * @param {Object} options
     * @param {number} [options.temperature=300.0] - Temperature T in Kelvin (or normalized arena energy units)
     * @param {number} [options.boltzmannK=1.0] - Boltzmann constant k_B
     * @param {number} [options.frictionGamma=0.15] - Damping / friction coefficient \gamma
     * @param {number} [options.mass=1.0] - Particle / agent mass m
     */
    constructor(options = {}) {
        this.temperature = options.temperature || 300.0;
        this.kB = options.boltzmannK || 1.0;
        this.gamma = options.frictionGamma || 0.15;
        this.mass = options.mass || 1.0;
        this.beta = 1.0 / (this.kB * this.temperature);

        // History of forward and reverse protocol work values
        this.forwardWorkTrajectories = [];
        this.reverseWorkTrajectories = [];
    }

    /**
     * Harmonic double-well potential modulated by protocol parameter lambda:
     * V(x, \lambda) = 0.25 * (x^2 - 1)^2 - \lambda * x
     * @param {number} x - Coordinate
     * @param {number} lambdaParam - External protocol parameter (e.g. bias field)
     * @returns {number} Potential energy
     */
    potentialEnergy(x, lambdaParam = 0.0) {
        const x2 = x * x;
        return 0.25 * (x2 - 1.0) * (x2 - 1.0) - lambdaParam * x;
    }

    /**
     * Spatial gradient of potential energy: \nabla V(x, \lambda)
     * @param {number} x
     * @param {number} lambdaParam
     * @returns {number} Force gradient dV/dx
     */
    potentialGradient(x, lambdaParam = 0.0) {
        return (x * x - 1.0) * x - lambdaParam;
    }

    /**
     * Partial derivative of potential with respect to protocol parameter \lambda:
     * \partial V / \partial \lambda = -x
     * @param {number} x
     * @returns {number}
     */
    dPotentialDLambda(x) {
        return -x;
    }

    /**
     * Simulates a stochastic Langevin trajectory under an external protocol \lambda(t):
     * Computes the microscopic work done W = \int_0^\tau (\partial V / \partial \lambda) \dot{\lambda} dt.
     * 
     * @param {Object} config
     * @param {number} [config.x0=0.0] - Initial position
     * @param {number} [config.v0=0.0] - Initial velocity
     * @param {number} [config.lambdaStart=0.0] - Protocol initial parameter
     * @param {number} [config.lambdaEnd=1.5] - Protocol target parameter
     * @param {number} [config.steps=100] - Discretization steps
     * @param {number} [config.dt=0.01] - Time step dt
     * @returns {Object} Trajectory telemetry containing work, dissipated heat, final state
     */
    simulateProtocol(config = {}) {
        const x0 = config.x0 !== undefined ? config.x0 : -1.0;
        const v0 = config.v0 !== undefined ? config.v0 : 0.0;
        const lambdaStart = config.lambdaStart !== undefined ? config.lambdaStart : 0.0;
        const lambdaEnd = config.lambdaEnd !== undefined ? config.lambdaEnd : 1.0;
        const steps = config.steps || 100;
        const dt = config.dt || 0.01;

        let x = x0;
        let v = v0;
        let work = 0.0;
        let heat = 0.0;

        // Diffusion noise scale \sigma = \sqrt{2 \gamma k_B T / m}
        const noiseScale = Math.sqrt((2.0 * this.gamma * this.kB * this.temperature) / this.mass);
        const sqrtDt = Math.sqrt(dt);

        const states = [{ t: 0, x, v, lambda: lambdaStart }];

        for (let i = 0; i < steps; i++) {
            const t = (i + 1) * dt;
            const progress = (i + 1) / steps;
            const lambdaPrev = lambdaStart + (lambdaEnd - lambdaStart) * (i / steps);
            const lambdaCurr = lambdaStart + (lambdaEnd - lambdaStart) * progress;
            const dLambda = lambdaCurr - lambdaPrev;

            // External work contribution from shifting potential landscape
            // dW = (\partial V / \partial \lambda) * d\lambda
            const dW = this.dPotentialDLambda(x) * dLambda;
            work += dW;

            // Langevin force: F = -dV/dx - \gamma * m * v + \xi(t)
            const force = -this.potentialGradient(x, lambdaCurr);
            const standardNormal = this._sampleGaussian();
            const stochasticImpulse = noiseScale * standardNormal * sqrtDt;

            // Euler-Maruyama / Velocity Verlet update
            const dv = (force / this.mass - this.gamma * v) * dt + stochasticImpulse;
            v += dv;
            x += v * dt;

            // Heat dissipated to reservoir: dQ = (force_fric + stochastic) \cdot v dt
            const frictionForce = -this.gamma * this.mass * v;
            const dQ = (frictionForce * dt + this.mass * stochasticImpulse) * v;
            heat += dQ;

            states.push({ t, x, v, lambda: lambdaCurr });
        }

        const vInit = this.potentialEnergy(x0, lambdaStart) + 0.5 * this.mass * v0 * v0;
        const vFinal = this.potentialEnergy(x, lambdaEnd) + 0.5 * this.mass * v * v;
        const deltaU = vFinal - vInit;

        const record = {
            work,
            heat,
            deltaU,
            firstLawResidual: Math.abs(deltaU - (work - heat)),
            finalPosition: x,
            finalVelocity: v,
            pathLength: states.length
        };

        this.forwardWorkTrajectories.push(work);
        return record;
    }

    /**
     * Evaluates Free Energy difference \Delta F using Jarzynski Equality:
     * \exp(-\beta \Delta F) = (1/N) \sum_{i=1}^N \exp(-\beta W_i)
     * \Delta F_{jarzynski} = -(1/\beta) \ln \left( \frac{1}{N} \sum_{i=1}^N \exp(-\beta W_i) \right)
     *
     * @param {number[]} [workSamples=null] - Optional array of work values; defaults to recorded trajectories
     * @returns {Object} Estimated free energy difference, Jarzynski average, and second-law dissipated work
     */
    computeJarzynskiFreeEnergy(workSamples = null) {
        const samples = workSamples || this.forwardWorkTrajectories;
        if (!samples || samples.length === 0) {
            throw new Error('No work trajectories available for Jarzynski evaluation.');
        }

        const N = samples.length;

        // Use log-sum-exp trick to avoid numerical overflow/underflow
        // \ln \sum \exp(-\beta W_i) = c + \ln \sum \exp(-\beta W_i - c) where c = \max(-\beta W_i)
        const scaledExponents = samples.map(w => -this.beta * w);
        const maxExp = Math.max(...scaledExponents);

        let sumExp = 0.0;
        for (let i = 0; i < N; i++) {
            sumExp += Math.exp(scaledExponents[i] - maxExp);
        }

        const logMeanExp = maxExp + Math.log(sumExp / N);
        const deltaF = -logMeanExp / this.beta;

        // Mean work \langle W \rangle
        const meanWork = samples.reduce((a, b) => a + b, 0.0) / N;

        // Average dissipated work: W_{diss} = \langle W \rangle - \Delta F >= 0
        const dissipatedWork = meanWork - deltaF;

        // Total entropy production: \Delta S_{prod} = k_B * \beta * W_{diss}
        const entropyProduction = this.kB * this.beta * dissipatedWork;

        return {
            sampleCount: N,
            meanWork,
            freeEnergyDifference: deltaF,
            dissipatedWork,
            entropyProduction,
            secondLawSatisfied: dissipatedWork >= -1e-6
        };
    }

    /**
     * Evaluates Crooks Fluctuation Theorem probability ratio:
     * P_F(W) / P_R(-W) \approx \exp(\beta (W - \Delta F))
     *
     * @param {number[]} forwardSamples
     * @param {number[]} reverseSamples
     * @param {number} deltaF
     * @param {number} binCenter - Work value W to evaluate
     * @param {number} [binWidth=0.2]
     * @returns {Object} Empirical ratio vs theoretical ratio
     */
    verifyCrooksFluctuation(forwardSamples, reverseSamples, deltaF, binCenter, binWidth = 0.2) {
        const fCount = forwardSamples.filter(w => Math.abs(w - binCenter) <= binWidth / 2.0).length;
        const rCount = reverseSamples.filter(w => Math.abs(w - (-binCenter)) <= binWidth / 2.0).length;

        const pForward = fCount / forwardSamples.length;
        const pReverse = rCount / reverseSamples.length;

        const empiricalRatio = pReverse > 0 ? pForward / pReverse : null;
        const theoreticalRatio = Math.exp(this.beta * (binCenter - deltaF));

        return {
            binCenter,
            pForward,
            pReverse,
            empiricalRatio,
            theoreticalRatio,
            agreementError: empiricalRatio !== null ? Math.abs(empiricalRatio - theoreticalRatio) / theoreticalRatio : null
        };
    }

    /**
     * Box-Muller transform for standard normal random variables
     * @private
     */
    _sampleGaussian() {
        let u1 = 0, u2 = 0;
        while (u1 === 0) u1 = Math.random();
        while (u2 === 0) u2 = Math.random();
        return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    }
}

module.exports = ThermodynamicWorkEngine;
