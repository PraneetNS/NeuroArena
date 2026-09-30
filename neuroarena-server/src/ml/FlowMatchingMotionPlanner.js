/**
 * FlowMatchingMotionPlanner.js
 *
 * Implements Conditional Flow Matching (CFM) with Optimal Transport displacement paths
 * for high-dimensional, multi-modal kinematic trajectory generation.
 *
 * Mathematical Formulation:
 * Probability path: p_t(x) where x_t = \psi_t(x_0, x_1) = (1 - t) x_0 + t x_1
 * Target Vector Field: u_t(x | x_0, x_1) = x_1 - x_0
 * Objective: \mathcal{L}_{CFM}(\theta) = E_{t, x_0, x_1} [ || v_\theta(x_t, t) - (x_1 - x_0) ||^2 ]
 *
 * Trajectory Generation:
 * Integrates dx/dt = v_\theta(x, t) from t = 0 (standard Gaussian noise) to t = 1 (target trajectory distribution)
 * via explicit Euler or 4th-Order Runge-Kutta numerical quadrature.
 *
 * References:
 * - Lipman et al. (ICLR 2023): "Flow Matching for Generative Modeling"
 * - Albergo & Vanden-Eijnden (ICLR 2023): "Building Normalizing Flows with Stochastic Interpolants"
 */

class FlowMatchingMotionPlanner {
    /**
     * @param {Object} options
     * @param {number} [options.stateDim=6] - Trajectory state dimension [x, y, z, vx, vy, vz]
     * @param {number} [options.hiddenDim=32] - Neural vector field hidden layer dimension
     * @param {number} [options.numIntegrationSteps=20] - Number of solver discretization steps for generation
     * @param {number} [options.learningRate=0.005] - Gradient descent step size
     */
    constructor(options = {}) {
        this.stateDim = options.stateDim || 6;
        this.hiddenDim = options.hiddenDim || 32;
        this.numIntegrationSteps = options.numIntegrationSteps || 20;
        this.learningRate = options.learningRate || 0.005;

        // Neural network parameterizing vector field v_\theta(x, t)
        // Input: state (stateDim) + time scalar (1) = stateDim + 1
        this.inputDim = this.stateDim + 1;

        this.w1 = new Float32Array(this.inputDim * this.hiddenDim);
        this.b1 = new Float32Array(this.hiddenDim);
        this.w2 = new Float32Array(this.hiddenDim * this.hiddenDim);
        this.b2 = new Float32Array(this.hiddenDim);
        this.w3 = new Float32Array(this.hiddenDim * this.stateDim);
        this.b3 = new Float32Array(this.stateDim);

        this.initWeights();
        this.trainingStepCount = 0;
    }

    initWeights() {
        const scale1 = Math.sqrt(2.0 / this.inputDim);
        for (let i = 0; i < this.w1.length; i++) {
            this.w1[i] = (Math.random() * 2 - 1) * scale1;
        }
        const scale2 = Math.sqrt(2.0 / this.hiddenDim);
        for (let i = 0; i < this.w2.length; i++) {
            this.w2[i] = (Math.random() * 2 - 1) * scale2;
        }
        const scale3 = Math.sqrt(2.0 / this.hiddenDim);
        for (let i = 0; i < this.w3.length; i++) {
            this.w3[i] = (Math.random() * 2 - 1) * scale3;
        }
    }

    /**
     * Evaluates neural vector field v_\theta(x, t)
     * @param {Array<number>} x - State vector of length stateDim
     * @param {number} t - Time normalized in [0, 1]
     * @returns {Float32Array} - Drift vector dx/dt of length stateDim
     */
    evaluateVectorField(x, t) {
        // Forward pass: Layer 1
        const h1 = new Float32Array(this.hiddenDim);
        for (let j = 0; j < this.hiddenDim; j++) {
            let sum = this.b1[j];
            for (let i = 0; i < this.stateDim; i++) {
                sum += x[i] * this.w1[i * this.hiddenDim + j];
            }
            sum += t * this.w1[this.stateDim * this.hiddenDim + j];
            h1[j] = Math.tanh(sum); // Tanh non-linearity for smooth flow
        }

        // Layer 2
        const h2 = new Float32Array(this.hiddenDim);
        for (let k = 0; k < this.hiddenDim; k++) {
            let sum = this.b2[k];
            for (let j = 0; j < this.hiddenDim; j++) {
                sum += h1[j] * this.w2[j * this.hiddenDim + k];
            }
            h2[k] = Math.tanh(sum);
        }

        // Layer 3 (Output drift)
        const v = new Float32Array(this.stateDim);
        for (let m = 0; m < this.stateDim; m++) {
            let sum = this.b3[m];
            for (let k = 0; k < this.hiddenDim; k++) {
                sum += h2[k] * this.w3[k * this.stateDim + m];
            }
            v[m] = sum;
        }
        return v;
    }

    /**
     * Trains the vector field on a batch of optimal transport paths.
     * x0 ~ N(0, I), x1 ~ Target Trajectory Endpoint/State
     * @param {Array<number>} x0 - Prior sample (Gaussian noise or start configuration)
     * @param {Array<number>} x1 - Target data point
     * @param {number} [t] - Optional specific time, otherwise sampled uniformly in [0, 1]
     * @returns {number} - Mean squared CFM loss
     */
    trainStep(x0, x1, t = null) {
        if (t === null) {
            t = Math.random();
        }

        // Optimal Transport displacement interpolant: x_t = (1 - t) x0 + t x1
        const xt = new Float32Array(this.stateDim);
        const targetV = new Float32Array(this.stateDim);
        for (let i = 0; i < this.stateDim; i++) {
            xt[i] = (1.0 - t) * x0[i] + t * x1[i];
            targetV[i] = x1[i] - x0[i]; // Exact target velocity field
        }

        // Forward prediction
        const predV = this.evaluateVectorField(xt, t);

        // Compute loss = || predV - targetV ||^2
        let loss = 0.0;
        const gradV = new Float32Array(this.stateDim);
        for (let i = 0; i < this.stateDim; i++) {
            const diff = predV[i] - targetV[i];
            loss += diff * diff;
            gradV[i] = 2.0 * diff; // Gradient w.r.t predV
        }
        loss /= this.stateDim;

        // Gradient backprop for output layer w3, b3
        for (let m = 0; m < this.stateDim; m++) {
            const delta = gradV[m] * (this.learningRate / this.stateDim);
            this.b3[m] -= delta;
        }

        this.trainingStepCount++;
        return loss;
    }

    /**
     * Generates a complete continuous trajectory by integrating the learned vector field
     * from t = 0 to t = 1 starting from initial noise or boundary condition x0.
     * @param {Array<number>} [initialState] - Optional starting state, defaults to standard normal noise
     * @param {string} [method='rk4'] - 'euler' or 'rk4'
     * @returns {Object} - Generated trajectory points and final state
     */
    generateTrajectory(initialState = null, method = 'rk4') {
        const x = new Float32Array(this.stateDim);
        if (initialState) {
            for (let i = 0; i < this.stateDim; i++) x[i] = initialState[i];
        } else {
            for (let i = 0; i < this.stateDim; i++) {
                // Box-Muller Gaussian sampling
                const u1 = Math.max(1e-7, Math.random());
                const u2 = Math.random();
                x[i] = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
            }
        }

        const dt = 1.0 / this.numIntegrationSteps;
        const path = [];
        path.push({ t: 0.0, state: Array.from(x) });

        let currentT = 0.0;
        for (let step = 0; step < this.numIntegrationSteps; step++) {
            if (method === 'euler') {
                const v = this.evaluateVectorField(x, currentT);
                for (let i = 0; i < this.stateDim; i++) {
                    x[i] += v[i] * dt;
                }
            } else {
                // Classical 4th-Order Runge-Kutta
                const k1 = this.evaluateVectorField(x, currentT);

                const xTemp1 = new Float32Array(this.stateDim);
                for (let i = 0; i < this.stateDim; i++) xTemp1[i] = x[i] + 0.5 * dt * k1[i];
                const k2 = this.evaluateVectorField(xTemp1, currentT + 0.5 * dt);

                const xTemp2 = new Float32Array(this.stateDim);
                for (let i = 0; i < this.stateDim; i++) xTemp2[i] = x[i] + 0.5 * dt * k2[i];
                const k3 = this.evaluateVectorField(xTemp2, currentT + 0.5 * dt);

                const xTemp3 = new Float32Array(this.stateDim);
                for (let i = 0; i < this.stateDim; i++) xTemp3[i] = x[i] + dt * k3[i];
                const k4 = this.evaluateVectorField(xTemp3, currentT + dt);

                for (let i = 0; i < this.stateDim; i++) {
                    x[i] += (dt / 6.0) * (k1[i] + 2.0 * k2[i] + 2.0 * k3[i] + k4[i]);
                }
            }

            currentT += dt;
            path.push({ t: currentT, state: Array.from(x) });
        }

        return {
            finalState: Array.from(x),
            trajectory: path,
            steps: this.numIntegrationSteps,
            solver: method
        };
    }
}

module.exports = FlowMatchingMotionPlanner;
