/**
 * MorphogeneticPatternEngine.js
 *
 * Implements Alan Turing's Reaction-Diffusion partial differential equations (PDE)
 * combined with Levin bioelectric membrane potential signaling for emergent
 * morphogenetic wavefields, spatial territorial patterning, and biological swarm self-organization.
 *
 * Mathematical Foundations:
 * 1. Reaction-Diffusion System (Gray-Scott & FitzHugh-Nagumo formulations):
 *      \partial u / \partial t = D_u \nabla^2 u - u v^2 + F(1 - u) + \kappa \cdot V_{bio}(x, y)
 *      \partial v / \partial t = D_v \nabla^2 v + u v^2 - (F + k) v
 *    where:
 *      u(x, y, t): Activator morphogen concentration
 *      v(x, y, t): Inhibitor morphogen concentration
 *      D_u, D_v: Spatial diffusion coefficients (typically D_u > D_v)
 *      F: Feed rate of activator
 *      k: Kill/decay rate of inhibitor
 * 2. Bio-Electric Membrane Potential V_{bio}:
 *      Modulates the local chemical potential and effective feed rate, representing
 *      voltage-gated ion flux across cellular membranes (Michael Levin bioelectric framework).
 * 3. Discrete 2D Laplacian Stencil (\nabla^2):
 *      \nabla^2 \phi_{i,j} = \frac{\phi_{i+1,j} + \phi_{i-1,j} + \phi_{i,j+1} + \phi_{i,j-1} - 4\phi_{i,j}}{\Delta x^2}
 *    with periodic toroidal boundary conditions.
 * 4. Characteristic Spatial Wavelength & Morphological Regimes:
 *      Solitons, spots, stripes, labyrinthine chaos, and pulsating waves determined by (F, k).
 *
 * References:
 * - Turing, A. M. (1952): "The Chemical Basis of Morphogenesis", Phil. Trans. R. Soc. Lond. B.
 * - Pearson, J. E. (1993): "Complex Patterns in a Simple System", Science.
 * - Levin, M. (2021): "Bioelectric signaling: reprogrammable hardware for morphogenetic computation", Cell.
 */

class MorphogeneticPatternEngine {
    /**
     * @param {Object} options
     * @param {number} [options.width=32] - Grid width
     * @param {number} [options.height=32] - Grid height
     * @param {number} [options.Du=0.16] - Activator diffusion coefficient
     * @param {number} [options.Dv=0.08] - Inhibitor diffusion coefficient
     * @param {number} [options.feed=0.035] - Feed rate F
     * @param {number} [options.kill=0.065] - Kill rate k
     * @param {number} [options.dt=1.0] - Time integration step
     */
    constructor(options = {}) {
        this.width = options.width || 32;
        this.height = options.height || 32;
        this.Du = options.Du !== undefined ? options.Du : 0.16;
        this.Dv = options.Dv !== undefined ? options.Dv : 0.08;
        this.feed = options.feed !== undefined ? options.feed : 0.035;
        this.kill = options.kill !== undefined ? options.kill : 0.065;
        this.dt = options.dt !== undefined ? options.dt : 1.0;

        const size = this.width * this.height;
        this.u = new Float32Array(size);
        this.v = new Float32Array(size);
        this.bioPotential = new Float32Array(size); // V_{bio}

        this.reset();
    }

    /**
     * Resets morphogen fields to homogeneous equilibrium with a perturbed central region
     */
    reset() {
        const size = this.width * this.height;
        // Baseline equilibrium: u = 1, v = 0
        this.u.fill(1.0);
        this.v.fill(0.0);
        this.bioPotential.fill(0.0);

        // Perturb a central square patch to trigger Turing instability
        const cx = Math.floor(this.width / 2);
        const cy = Math.floor(this.height / 2);
        const radius = Math.max(2, Math.floor(Math.min(this.width, this.height) / 8));

        for (let y = cy - radius; y <= cy + radius; y++) {
            for (let x = cx - radius; x <= cx + radius; x++) {
                const idx = this._index(x, y);
                this.u[idx] = 0.5 + (Math.random() - 0.5) * 0.1;
                this.v[idx] = 0.25 + (Math.random() - 0.5) * 0.1;
            }
        }
    }

    /**
     * Sets bioelectric potential gradient representing cell membrane voltage
     * @param {number} x
     * @param {number} y
     * @param {number} voltage - Bioelectric potential in arbitrary units (e.g. -70mV to +20mV normalized)
     */
    setBioelectricPotential(x, y, voltage) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            this.bioPotential[this._index(x, y)] = voltage;
        }
    }

    /**
     * Advances the reaction-diffusion PDE by one time step
     * using explicit Euler integration with 5-point Laplacian stencil.
     */
    step() {
        const w = this.width;
        const h = this.height;
        const size = w * h;
        const nextU = new Float32Array(size);
        const nextV = new Float32Array(size);

        for (let y = 0; y < h; y++) {
            const ym1 = (y - 1 + h) % h;
            const yp1 = (y + 1) % h;

            for (let x = 0; x < w; x++) {
                const xm1 = (x - 1 + w) % w;
                const xp1 = (x + 1) % w;

                const idx = y * w + x;
                const uVal = this.u[idx];
                const vVal = this.v[idx];

                // 5-point discrete Laplacian stencil with periodic toroidal boundary
                const lapU = this.u[y * w + xm1] + this.u[y * w + xp1] +
                             this.u[ym1 * w + x] + this.u[yp1 * w + x] - 4.0 * uVal;

                const lapV = this.v[y * w + xm1] + this.v[y * w + xp1] +
                             this.v[ym1 * w + x] + this.v[yp1 * w + x] - 4.0 * vVal;

                // Reaction terms: uv^2
                const uvv = uVal * vVal * vVal;

                // Bioelectric bias modulates effective feed rate
                const effectiveFeed = this.feed + 0.01 * this.bioPotential[idx];

                // Gray-Scott update equations
                const du = (this.Du * lapU - uvv + effectiveFeed * (1.0 - uVal)) * this.dt;
                const dv = (this.Dv * lapV + uvv - (effectiveFeed + this.kill) * vVal) * this.dt;

                nextU[idx] = Math.max(0.0, Math.min(1.0, uVal + du));
                nextV[idx] = Math.max(0.0, Math.min(1.0, vVal + dv));
            }
        }

        this.u.set(nextU);
        this.v.set(nextV);
    }

    /**
     * Executes multiple simulation steps
     * @param {number} steps
     */
    evolve(steps = 50) {
        for (let i = 0; i < steps; i++) {
            this.step();
        }
    }

    /**
     * Extracts statistical metrics and spatial pattern diagnostics
     * @returns {Object} Spatial variance, mean morphogen levels, and entropy
     */
    getPatternMetrics() {
        const size = this.width * this.height;
        let sumU = 0, sumV = 0;
        let minU = Infinity, maxU = -Infinity;
        let minV = Infinity, maxV = -Infinity;

        for (let i = 0; i < size; i++) {
            const uVal = this.u[i];
            const vVal = this.v[i];
            sumU += uVal;
            sumV += vVal;
            if (uVal < minU) minU = uVal;
            if (uVal > maxU) maxU = uVal;
            if (vVal < minV) minV = vVal;
            if (vVal > maxV) maxV = vVal;
        }

        const meanU = sumU / size;
        const meanV = sumV / size;

        let varU = 0, varV = 0;
        for (let i = 0; i < size; i++) {
            varU += Math.pow(this.u[i] - meanU, 2);
            varV += Math.pow(this.v[i] - meanV, 2);
        }
        varU /= size;
        varV /= size;

        // Count spatial zero-crossings / contour boundaries (thresholded at 0.2 v-concentration)
        let boundaryCount = 0;
        const threshold = 0.2;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cur = this.v[this._index(x, y)] > threshold;
                const right = this.v[this._index((x + 1) % this.width, y)] > threshold;
                const down = this.v[this._index(x, (y + 1) % this.height)] > threshold;
                if (cur !== right) boundaryCount++;
                if (cur !== down) boundaryCount++;
            }
        }

        return {
            meanU,
            meanV,
            varU,
            varV,
            minU,
            maxU,
            minV,
            maxV,
            boundaryCount,
            patternDetected: varV > 0.001
        };
    }

    /**
     * Gets morphogen concentration at a normalized coordinate (normX, normY) \in [0, 1]^2
     * using bilinear interpolation.
     * @param {number} normX
     * @param {number} normY
     * @returns {{u: number, v: number}}
     */
    sampleAt(normX, normY) {
        const x = Math.max(0, Math.min(this.width - 1, normX * (this.width - 1)));
        const y = Math.max(0, Math.min(this.height - 1, normY * (this.height - 1)));

        const x0 = Math.floor(x);
        const x1 = Math.min(this.width - 1, x0 + 1);
        const y0 = Math.floor(y);
        const y1 = Math.min(this.height - 1, y0 + 1);

        const fx = x - x0;
        const fy = y - y0;

        const u00 = this.u[this._index(x0, y0)];
        const u10 = this.u[this._index(x1, y0)];
        const u01 = this.u[this._index(x0, y1)];
        const u11 = this.u[this._index(x1, y1)];

        const v00 = this.v[this._index(x0, y0)];
        const v10 = this.v[this._index(x1, y0)];
        const v01 = this.v[this._index(x0, y1)];
        const v11 = this.v[this._index(x1, y1)];

        const uInterp = (1 - fx) * (1 - fy) * u00 + fx * (1 - fy) * u10 + (1 - fx) * fy * u01 + fx * fy * u11;
        const vInterp = (1 - fx) * (1 - fy) * v00 + fx * (1 - fy) * v10 + (1 - fx) * fy * v01 + fx * fy * v11;

        return { u: uInterp, v: vInterp };
    }

    _index(x, y) {
        return ((y + this.height) % this.height) * this.width + ((x + this.width) % this.width);
    }
}

module.exports = MorphogeneticPatternEngine;
