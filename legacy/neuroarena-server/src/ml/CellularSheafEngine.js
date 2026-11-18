/**
 * CellularSheafEngine.js
 *
 * Implements Cellular Sheaf Neural Diffusion and Sheaf Laplacian Consensus
 * over 1-dimensional cell complexes (graphs) with non-trivial stalk spaces.
 *
 * Mathematical Foundations:
 * 1. Cell complex G = (V, E) with vertex set V and directed edge set E.
 * 2. Stalk assignment:
 *    - To each vertex v \in V, stalk space \mathcal{F}(v) \cong \mathbb{R}^{d_v} (default dimension d).
 *    - To each edge e = (u, v) \in E, stalk space \mathcal{F}(e) \cong \mathbb{R}^{d_e} (dimension d).
 * 3. Restriction maps \mathcal{E}_{u \trianglelefteq e}: \mathcal{F}(u) \to \mathcal{F}(e) and
 *    \mathcal{E}_{v \trianglelefteq e}: \mathcal{F}(v) \to \mathcal{F}(e) (represented as d \times d matrices,
 *    typically in O(d) or GL(d)).
 * 4. Space of 0-cochains: C^0(G; \mathcal{F}) = \bigoplus_{v \in V} \mathcal{F}(v) of dimension |V| * d.
 * 5. Space of 1-cochains: C^1(G; \mathcal{F}) = \bigoplus_{e \in E} \mathcal{F}(e) of dimension |E| * d.
 * 6. Sheaf Coboundary Operator \delta: C^0(G; \mathcal{F}) \to C^1(G; \mathcal{F}):
 *      (\delta x)_e = \mathcal{E}_{v \trianglelefteq e} x_v - \mathcal{E}_{u \trianglelefteq e} x_u
 * 7. Sheaf Laplacian L_\mathcal{F} = \delta^\top \delta: C^0(G; \mathcal{F}) \to C^0(G; \mathcal{F}):
 *      (L_\mathcal{F})_{u, u} = \sum_{e \sim u} \mathcal{E}_{u \trianglelefteq e}^\top \mathcal{E}_{u \trianglelefteq e}
 *      (L_\mathcal{F})_{u, v} = -\mathcal{E}_{u \trianglelefteq e}^\top \mathcal{E}_{v \trianglelefteq e}
 * 8. Sheaf Diffusion Flow:
 *      x(t + \Delta t) = x(t) - \Delta t \cdot L_\mathcal{F} x(t)
 * 9. Harmonic Cochains (Sheaf Cohomology H^0(G; \mathcal{F}) = \ker(L_\mathcal{F})):
 *      L_\mathcal{F} x^* = 0 \iff (\delta x^*)_e = 0 \quad \forall e \in E.
 *
 * References:
 * - Bodnar et al. (NeurIPS 2022): "Neural Sheaf Diffusion: A Topological Perspective on Heterophily and Oversmoothing"
 * - Hansen & Ghrist (2019): "Toward a Spectral Theory of Cellular Sheaves", Journal of Applied and Computational Topology.
 */

class CellularSheafEngine {
    /**
     * @param {Object} options
     * @param {number} [options.stalkDim=2] - Dimension of each stalk space d
     * @param {number} [options.diffusionStep=0.05] - Integration step \Delta t
     */
    constructor(options = {}) {
        this.stalkDim = options.stalkDim || 2;
        this.diffusionStep = options.diffusionStep || 0.05;

        this.vertices = []; // Array of vertex IDs
        this.edges = [];    // Array of { id, u, v, restrictionU, restrictionV }
        this.vertexIndexMap = new Map();
    }

    /**
     * Adds a vertex with designated stalk dimension
     * @param {string} id
     */
    addVertex(id) {
        if (!this.vertexIndexMap.has(id)) {
            this.vertexIndexMap.set(id, this.vertices.length);
            this.vertices.push(id);
        }
    }

    /**
     * Adds a directed edge e = (u, v) with orthogonal or linear restriction maps
     * @param {string} u - Source vertex
     * @param {string} v - Target vertex
     * @param {number[][]} [restrictionU=null] - d x d matrix \mathcal{E}_{u \trianglelefteq e}
     * @param {number[][]} [restrictionV=null] - d x d matrix \mathcal{E}_{v \trianglelefteq e}
     */
    addEdge(u, v, restrictionU = null, restrictionV = null) {
        this.addVertex(u);
        this.addVertex(v);

        const d = this.stalkDim;
        const rU = restrictionU || this._identityMatrix(d);
        const rV = restrictionV || this._identityMatrix(d);

        this.edges.push({
            id: `${u}->${v}`,
            u,
            v,
            rU,
            rV
        });
    }

    /**
     * Builds a rotation restriction map in SO(2) for stalkDim = 2
     * @param {number} theta - Rotation angle in radians
     * @returns {number[][]} 2x2 rotation matrix
     */
    static createRotationRestriction(theta) {
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        return [
            [cos, -sin],
            [sin,  cos]
        ];
    }

    /**
     * Computes the global Sheaf Coboundary Operator \delta matrix
     * Size: (|E| * d) x (|V| * d)
     * @returns {number[][]} Dense coboundary matrix
     */
    buildCoboundaryMatrix() {
        const d = this.stalkDim;
        const numV = this.vertices.length;
        const numE = this.edges.length;

        const totalRows = numE * d;
        const totalCols = numV * d;

        // Initialize zero matrix
        const delta = Array.from({ length: totalRows }, () => new Float64Array(totalCols));

        for (let eIdx = 0; eIdx < numE; eIdx++) {
            const edge = this.edges[eIdx];
            const uIdx = this.vertexIndexMap.get(edge.u);
            const vIdx = this.vertexIndexMap.get(edge.v);

            const rowOffset = eIdx * d;
            const uColOffset = uIdx * d;
            const vColOffset = vIdx * d;

            // (\delta x)_e = \mathcal{E}_{v \trianglelefteq e} x_v - \mathcal{E}_{u \trianglelefteq e} x_u
            for (let r = 0; r < d; r++) {
                for (let c = 0; c < d; c++) {
                    // Negative contribution from u
                    delta[rowOffset + r][uColOffset + c] -= edge.rU[r][c];
                    // Positive contribution from v
                    delta[rowOffset + r][vColOffset + c] += edge.rV[r][c];
                }
            }
        }

        return delta;
    }

    /**
     * Constructs the Sheaf Laplacian L_\mathcal{F} = \delta^\top \delta
     * Size: (|V| * d) x (|V| * d)
     * @returns {number[][]} Symmetric positive semi-definite matrix
     */
    buildSheafLaplacian() {
        const delta = this.buildCoboundaryMatrix();
        const rows = delta.length;        // |E| * d
        const cols = delta[0]?.length || 0; // |V| * d

        const L = Array.from({ length: cols }, () => new Float64Array(cols));

        // L = \delta^\top \delta
        for (let i = 0; i < cols; i++) {
            for (let j = i; j < cols; j++) {
                let sum = 0.0;
                for (let k = 0; k < rows; k++) {
                    sum += delta[k][i] * delta[k][j];
                }
                L[i][j] = sum;
                L[j][i] = sum; // Symmetry
            }
        }

        return L;
    }

    /**
     * Executes Sheaf Diffusion flow: \dot{x} = -L_\mathcal{F} x
     * @param {Object<string, number[]>} initial0Cochain - Map from vertex id to stalk vector \mathbb{R}^d
     * @param {number} [steps=20] - Number of diffusion steps
     * @param {number} [dt=null] - Optional custom step size
     * @returns {Object} Final 0-cochain, energy profile, and convergence residual
     */
    diffuse(initial0Cochain, steps = 20, dt = null) {
        const d = this.stalkDim;
        const numV = this.vertices.length;
        const stepSize = dt || this.diffusionStep;
        const L = this.buildSheafLaplacian();

        // Flatten initial 0-cochain into contiguous 1D array
        const state = new Float64Array(numV * d);
        for (let i = 0; i < numV; i++) {
            const vId = this.vertices[i];
            const stalkVec = initial0Cochain[vId] || new Array(d).fill(0.0);
            for (let k = 0; k < d; k++) {
                state[i * d + k] = stalkVec[k] || 0.0;
            }
        }

        const energyProfile = [];

        // Diffusion iterations
        for (let s = 0; s < steps; s++) {
            // Dirichlet energy: E(x) = x^\top L_\mathcal{F} x = \|\delta x\|^2
            let currentEnergy = 0.0;
            const Lx = new Float64Array(numV * d);

            for (let i = 0; i < state.length; i++) {
                let sum = 0.0;
                for (let j = 0; j < state.length; j++) {
                    sum += L[i][j] * state[j];
                }
                Lx[i] = sum;
                currentEnergy += state[i] * sum;
            }

            energyProfile.push(0.5 * currentEnergy);

            // Forward Euler update: x_{t+1} = x_t - dt * L_\mathcal{F} x_t
            for (let i = 0; i < state.length; i++) {
                state[i] -= stepSize * Lx[i];
            }
        }

        // Reconstruct map
        const finalCochain = {};
        for (let i = 0; i < numV; i++) {
            const vId = this.vertices[i];
            finalCochain[vId] = Array.from(state.slice(i * d, (i + 1) * d));
        }

        return {
            finalCochain,
            initialEnergy: energyProfile[0],
            finalEnergy: energyProfile[energyProfile.length - 1],
            energyProfile,
            energyDecreased: energyProfile[energyProfile.length - 1] <= energyProfile[0] + 1e-9
        };
    }

    /**
     * Computes the kernel dimension of L_\mathcal{F} (Betti number \beta_0(G; \mathcal{F}) = \dim H^0)
     * using SVD / QR or singular values of symmetric L.
     * 
     * @param {number} [tolerance=1e-5]
     * @returns {number} Dimension of global sections space \ker(L_\mathcal{F})
     */
    computeHarmonicDimension(tolerance = 1e-5) {
        const L = this.buildSheafLaplacian();
        const n = L.length;
        if (n === 0) return 0;

        // Simple Jacobi eigenvalue algorithm for symmetric matrix
        const eigenvalues = this._computeEigenvaluesSymmetric(L);
        return eigenvalues.filter(val => Math.abs(val) <= tolerance).length;
    }

    /**
     * Jacobi eigenvalue algorithm for symmetric matrix
     * @private
     */
    _computeEigenvaluesSymmetric(matrix) {
        const n = matrix.length;
        // Clone matrix
        const A = Array.from({ length: n }, (_, i) => Float64Array.from(matrix[i]));
        const maxSweeps = 50;

        for (let sweep = 0; sweep < maxSweeps; sweep++) {
            let maxOffDiag = 0.0;
            for (let i = 0; i < n; i++) {
                for (let j = i + 1; j < n; j++) {
                    const absVal = Math.abs(A[i][j]);
                    if (absVal > maxOffDiag) maxOffDiag = absVal;
                }
            }

            if (maxOffDiag < 1e-12) break;

            for (let p = 0; p < n; p++) {
                for (let q = p + 1; q < n; q++) {
                    if (Math.abs(A[p][q]) < 1e-12) continue;

                    const theta = 0.5 * (A[q][q] - A[p][p]) / A[p][q];
                    const t = Math.sign(theta) / (Math.abs(theta) + Math.sqrt(theta * theta + 1.0));
                    const c = 1.0 / Math.sqrt(t * t + 1.0);
                    const s = t * c;
                    const tau = s / (1.0 + c);

                    const App = A[p][p];
                    const Aqq = A[q][q];
                    const Apq = A[p][q];

                    A[p][p] = App - t * Apq;
                    A[q][q] = Aqq + t * Apq;
                    A[p][q] = 0.0;
                    A[q][p] = 0.0;

                    for (let r = 0; r < n; r++) {
                        if (r !== p && r !== q) {
                            const Arp = A[r][p];
                            const Arq = A[r][q];
                            A[r][p] = Arp - s * (Arq + tau * Arp);
                            A[p][r] = A[r][p];
                            A[r][q] = Arq + s * (Arp - tau * Arq);
                            A[q][r] = A[r][q];
                        }
                    }
                }
            }
        }

        const eigenvalues = [];
        for (let i = 0; i < n; i++) {
            eigenvalues.push(A[i][i]);
        }
        return eigenvalues.sort((a, b) => a - b);
    }

    /**
     * Generates identity matrix of size d x d
     * @private
     */
    _identityMatrix(d) {
        return Array.from({ length: d }, (_, r) => 
            Array.from({ length: d }, (_, c) => (r === c ? 1.0 : 0.0))
        );
    }
}

module.exports = CellularSheafEngine;
