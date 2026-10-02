/**
 * PersistentHomologyEngine.js
 *
 * Implements Topological Data Analysis (TDA) via Vietoris-Rips filtration
 * and matrix reduction over \mathbb{Z}_2 to extract persistent topological features
 * (\beta_0 connected components and \beta_1 1-dimensional cycles/voids).
 *
 * Mathematical Framework:
 * 1. Metric space (X, d) representing agent coordinates in the arena.
 * 2. Vietoris-Rips complex VR_\epsilon(X):
 *    - 0-simplices: vertices v \in X.
 *    - 1-simplices (edges): [u, v] if d(u, v) <= \epsilon.
 *    - 2-simplices (triangles): [u, v, w] if max(d(u,v), d(v,w), d(u,w)) <= \epsilon.
 * 3. Boundary operator \partial_k: C_k \to C_{k-1} over field \mathbb{Z}_2:
 *    \partial_k [v_0, ..., v_k] = \sum_{i=0}^k [v_0, ..., \hat{v}_i, ..., v_k] \pmod 2
 * 4. Gaussian elimination over \mathbb{Z}_2 to identify persistence pairs (birth, death).
 * 5. Topological persistence entropy: E = -\sum p_i \ln p_i, where p_i = (d_i - b_i) / L.
 *
 * References:
 * - Edelsbrunner & Harer (AMS 2010): "Computational Topology: An Introduction"
 * - Carlsson (Bulletin of the AMS 2009): "Topology and Data"
 */

class PersistentHomologyEngine {
    /**
     * @param {Object} options
     * @param {number} [options.maxDistance=50.0] - Maximum filtration distance threshold \epsilon_{max}
     * @param {number} [options.filtrationSteps=20] - Discretization steps for filtration
     */
    constructor(options = {}) {
        this.maxDistance = options.maxDistance || 50.0;
        this.filtrationSteps = options.filtrationSteps || 20;
    }

    /**
     * Computes pairwise Euclidean distance matrix for n points
     * @param {Array<Array<number>>} points - Array of d-dimensional point vectors
     * @returns {Array<Array<number>>} n x n symmetric distance matrix
     */
    computeDistanceMatrix(points) {
        const n = points.length;
        const dist = Array.from({ length: n }, () => new Float64Array(n));
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                let sumSq = 0;
                const pi = points[i];
                const pj = points[j];
                const dim = pi.length;
                for (let d = 0; d < dim; d++) {
                    const diff = pi[d] - pj[d];
                    sumSq += diff * diff;
                }
                const dVal = Math.sqrt(sumSq);
                dist[i][j] = dVal;
                dist[j][i] = dVal;
            }
        }
        return dist;
    }

    /**
     * Constructs simplices up to dimension 2 with filtration birth times
     * @param {Array<Array<number>>} dist - Distance matrix
     * @param {number} maxDist - Upper distance bound
     * @returns {Array<{ dim: number, vertices: Array<number>, birth: number }>}
     */
    buildVietorisRipsFiltration(dist, maxDist) {
        const n = dist.length;
        const simplices = [];

        // 0-simplices (vertices) born at epsilon = 0
        for (let i = 0; i < n; i++) {
            simplices.push({ dim: 0, vertices: [i], birth: 0.0 });
        }

        // 1-simplices (edges)
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const d = dist[i][j];
                if (d <= maxDist) {
                    simplices.push({ dim: 1, vertices: [i, j], birth: d });
                }
            }
        }

        // 2-simplices (triangles)
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const d_ij = dist[i][j];
                if (d_ij > maxDist) continue;
                for (let k = j + 1; k < n; k++) {
                    const d_ik = dist[i][k];
                    const d_jk = dist[j][k];
                    if (d_ik <= maxDist && d_jk <= maxDist) {
                        const birth = Math.max(d_ij, d_ik, d_jk);
                        simplices.push({ dim: 2, vertices: [i, j, k], birth });
                    }
                }
            }
        }

        // Sort simplices ascending by birth time, then by dimension
        simplices.sort((a, b) => {
            if (Math.abs(a.birth - b.birth) > 1e-9) {
                return a.birth - b.birth;
            }
            return a.dim - b.dim;
        });

        return simplices;
    }

    /**
     * Reduces the boundary matrix over Z_2 using standard column elimination
     * to obtain persistent homology pairs (birth, death).
     * @param {Array<Object>} simplices - Sorted simplices
     * @returns {{ pairs0: Array<{birth: number, death: number}>, pairs1: Array<{birth: number, death: number}> }}
     */
    computePersistenceIntervals(simplices) {
        const m = simplices.length;
        // Map vertices array key to simplex index
        const simplexMap = new Map();
        for (let i = 0; i < m; i++) {
            simplexMap.set(simplices[i].vertices.join(','), i);
        }

        // Build boundary columns as sets of indices
        const boundary = new Array(m);
        for (let j = 0; j < m; j++) {
            const s = simplices[j];
            const col = new Set();
            if (s.dim === 1) {
                const v0 = s.vertices[0];
                const v1 = s.vertices[1];
                const i0 = simplexMap.get(`${v0}`);
                const i1 = simplexMap.get(`${v1}`);
                if (i0 !== undefined) col.add(i0);
                if (i1 !== undefined) col.add(i1);
            } else if (s.dim === 2) {
                const v = s.vertices;
                const e0 = simplexMap.get(`${v[0]},${v[1]}`);
                const e1 = simplexMap.get(`${v[0]},${v[2]}`);
                const e2 = simplexMap.get(`${v[1]},${v[2]}`);
                if (e0 !== undefined) col.add(e0);
                if (e1 !== undefined) col.add(e1);
                if (e2 !== undefined) col.add(e2);
            }
            boundary[j] = col;
        }

        // Low function: maximum index in column
        const getLow = (colSet) => {
            if (colSet.size === 0) return -1;
            let maxIdx = -1;
            for (const idx of colSet) {
                if (idx > maxIdx) maxIdx = idx;
            }
            return maxIdx;
        };

        // Standard Z_2 column reduction algorithm
        const lowToCol = new Map();
        const pairs0 = [];
        const pairs1 = [];
        const pairedSimplicies = new Set();

        for (let j = 0; j < m; j++) {
            let low = getLow(boundary[j]);
            while (low !== -1 && lowToCol.has(low)) {
                const targetCol = boundary[lowToCol.get(low)];
                // Symmetric difference (addition over Z_2)
                for (const idx of targetCol) {
                    if (boundary[j].has(idx)) {
                        boundary[j].delete(idx);
                    } else {
                        boundary[j].add(idx);
                    }
                }
                low = getLow(boundary[j]);
            }

            if (low !== -1) {
                lowToCol.set(low, j);
                const birthSimplex = simplices[low];
                const deathSimplex = simplices[j];
                const birth = birthSimplex.birth;
                const death = deathSimplex.birth;

                pairedSimplicies.add(low);
                pairedSimplicies.add(j);

                if (death > birth + 1e-6) {
                    if (birthSimplex.dim === 0) {
                        pairs0.push({ birth, death });
                    } else if (birthSimplex.dim === 1) {
                        pairs1.push({ birth, death });
                    }
                }
            }
        }

        // Essential cycles that never die within maxDistance
        for (let j = 0; j < m; j++) {
            if (!pairedSimplicies.has(j) && boundary[j].size === 0) {
                const s = simplices[j];
                if (s.dim === 0) {
                    pairs0.push({ birth: s.birth, death: Infinity });
                } else if (s.dim === 1) {
                    pairs1.push({ birth: s.birth, death: Infinity });
                }
            }
        }

        return { pairs0, pairs1 };
    }

    /**
     * Computes Betti numbers \beta_0(\epsilon) and \beta_1(\epsilon) along a filtration sweep
     * @param {Object} intervals - Persistence intervals
     * @param {number} epsilon - Filtration threshold
     * @returns {{ betti0: number, betti1: number }}
     */
    evaluateBettiNumbers(intervals, epsilon) {
        let betti0 = 0;
        let betti1 = 0;

        for (const p of intervals.pairs0) {
            if (p.birth <= epsilon && p.death > epsilon) {
                betti0++;
            }
        }
        for (const p of intervals.pairs1) {
            if (p.birth <= epsilon && p.death > epsilon) {
                betti1++;
            }
        }

        return { betti0, betti1 };
    }

    /**
     * Computes persistent topological entropy of 1-cycles (measures topological complexity / chaos)
     * E = -\sum p_i \ln p_i
     * @param {Array<{birth: number, death: number}>} pairs1
     * @returns {number} Persistent entropy
     */
    computePersistentEntropy(pairs1) {
        const finitePairs = pairs1.filter(p => Number.isFinite(p.death) && p.death > p.birth);
        if (finitePairs.length === 0) return 0.0;

        const lifespans = finitePairs.map(p => p.death - p.birth);
        const totalLife = lifespans.reduce((acc, l) => acc + l, 0);
        if (totalLife <= 1e-9) return 0.0;

        let entropy = 0;
        for (const l of lifespans) {
            const p = l / totalLife;
            if (p > 0) {
                entropy -= p * Math.log(p);
            }
        }
        return entropy;
    }

    /**
     * Analyzes point cloud topology of an arena swarm
     * @param {Array<Array<number>>} points - Coordinate array [[x, y, z], ...]
     * @returns {Object} Complete topological summary
     */
    analyzeSwarmTopology(points) {
        const dist = this.computeDistanceMatrix(points);
        const simplices = this.buildVietorisRipsFiltration(dist, this.maxDistance);
        const intervals = this.computePersistenceIntervals(simplices);
        const entropy1 = this.computePersistentEntropy(intervals.pairs1);

        // Sample Betti curve across filtration steps
        const bettiCurve = [];
        const step = this.maxDistance / this.filtrationSteps;
        for (let s = 0; s <= this.filtrationSteps; s++) {
            const eps = s * step;
            const b = this.evaluateBettiNumbers(intervals, eps);
            bettiCurve.push({ epsilon: eps, ...b });
        }

        return {
            pointCount: points.length,
            simplexCount: simplices.length,
            intervals,
            persistentEntropy1: entropy1,
            bettiCurve,
            significantHoles: intervals.pairs1.filter(p => (p.death - p.birth) > (this.maxDistance * 0.15))
        };
    }
}

module.exports = PersistentHomologyEngine;
