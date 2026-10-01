/**
 * KolmogorovArnoldEngine.js
 *
 * Implements Kolmogorov-Arnold Networks (KAN) with learnable 1D B-spline activation functions
 * on network edges rather than fixed non-linearities at nodes.
 *
 * Mathematical Foundations:
 * Kolmogorov-Arnold Representation Theorem:
 *   f(x) = \sum_{q=1}^{2n+1} \Phi_q \left( \sum_{p=1}^n \phi_{q,p}(x_p) \right)
 *
 * In KAN layers, the edge transformation \phi(x) combines a SiLU residual with a B-spline:
 *   \phi(x) = w_b * \text{silu}(x) + w_s * \sum_{i=0}^{G + k - 1} c_i B_i(x)
 * where B_i(x) are Cox-de Boor evaluated B-spline basis functions of degree k over G grid intervals.
 *
 * References:
 * - Liu et al. (MIT 2024): "KAN: Kolmogorov-Arnold Networks"
 */

class KolmogorovArnoldEngine {
    /**
     * @param {Object} options
     * @param {number} [options.inDim=4] - Input dimension
     * @param {number} [options.outDim=2] - Output dimension
     * @param {number} [options.gridSize=5] - Number of grid intervals G
     * @param {number} [options.splineDegree=3] - B-spline polynomial degree k
     * @param {number} [options.learningRate=0.01] - Optimization rate
     */
    constructor(options = {}) {
        this.inDim = options.inDim || 4;
        this.outDim = options.outDim || 2;
        this.gridSize = options.gridSize || 5;
        this.k = options.splineDegree || 3;
        this.lr = options.learningRate || 0.01;

        this.numCoeffs = this.gridSize + this.k;
        this.totalKnots = this.gridSize + 2 * this.k + 1;

        // Construct uniform knot vector over [-1.0, 1.0]
        this.knots = new Float32Array(this.totalKnots);
        const step = 2.0 / this.gridSize;
        const start = -1.0 - this.k * step;
        for (let i = 0; i < this.totalKnots; i++) {
            this.knots[i] = start + i * step;
        }

        // Learnable coefficients [inDim * outDim * numCoeffs]
        this.coeffs = new Float32Array(this.inDim * this.outDim * this.numCoeffs);
        // Base weights [inDim * outDim]
        this.wBase = new Float32Array(this.inDim * this.outDim);

        this.initWeights();
    }

    initWeights() {
        const scale = Math.sqrt(1.0 / this.inDim);
        for (let i = 0; i < this.wBase.length; i++) {
            this.wBase[i] = (Math.random() * 2 - 1) * scale;
        }
        for (let i = 0; i < this.coeffs.length; i++) {
            this.coeffs[i] = (Math.random() * 2 - 1) * scale * 0.1;
        }
    }

    /**
     * Cox-de Boor recursive evaluation of basis B_{i, p}(x)
     */
    basis(x, i, p) {
        if (p === 0) {
            return (x >= this.knots[i] && x < this.knots[i + 1]) ? 1.0 : 0.0;
        }

        const leftDenom = this.knots[i + p] - this.knots[i];
        const rightDenom = this.knots[i + p + 1] - this.knots[i + 1];

        let left = 0;
        if (Math.abs(leftDenom) > 1e-7) {
            left = ((x - this.knots[i]) / leftDenom) * this.basis(x, i, p - 1);
        }

        let right = 0;
        if (Math.abs(rightDenom) > 1e-7) {
            right = ((this.knots[i + p + 1] - x) / rightDenom) * this.basis(x, i + 1, p - 1);
        }

        return left + right;
    }

    /**
     * Forward inference pass through KAN layer
     * @param {Array<number>} input Vector of inDim features
     * @returns {Array<number>} Vector of outDim activations
     */
    forward(input) {
        const output = new Array(this.outDim).fill(0);

        for (let j = 0; j < this.outDim; j++) {
            let sum = 0;
            for (let i = 0; i < this.inDim; i++) {
                const x = Math.max(-0.999, Math.min(0.999, input[i]));

                // SiLU base: x / (1 + exp(-x))
                const silu = x / (1.0 + Math.exp(-x));
                const baseVal = this.wBase[i * this.outDim + j] * silu;

                // Spline activation: \sum_c c_c * B_c(x)
                let splineVal = 0;
                for (let c = 0; c < this.numCoeffs; c++) {
                    const b = this.basis(x, c, this.k);
                    splineVal += this.coeffs[(i * this.outDim + j) * this.numCoeffs + c] * b;
                }

                sum += baseVal + splineVal;
            }
            output[j] = sum;
        }

        return output;
    }

    /**
     * Updates spline coefficients and base weights with MSE loss
     * @param {Array<number>} input
     * @param {Array<number>} target
     * @returns {number} Loss value
     */
    trainStep(input, target) {
        const pred = this.forward(input);
        let loss = 0;

        for (let j = 0; j < this.outDim; j++) {
            const err = pred[j] - target[j];
            loss += 0.5 * err * err;

            for (let i = 0; i < this.inDim; i++) {
                const x = Math.max(-0.999, Math.min(0.999, input[i]));
                const silu = x / (1.0 + Math.exp(-x));

                // Update base weight
                this.wBase[i * this.outDim + j] -= this.lr * err * silu;

                // Update spline coefficients
                for (let c = 0; c < this.numCoeffs; c++) {
                    const b = this.basis(x, c, this.k);
                    this.coeffs[(i * this.outDim + j) * this.numCoeffs + c] -= this.lr * err * b;
                }
            }
        }

        return loss;
    }
}

module.exports = KolmogorovArnoldEngine;
