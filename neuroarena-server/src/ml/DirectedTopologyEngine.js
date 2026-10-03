/**
 * DirectedTopologyEngine.js
 *
 * Implements Directed Algebraic Topology (d-Topology), Precubical Sets,
 * and Higher-Dimensional Automata (HDA) for concurrent state-space verification,
 * dipath homotopy, and geometric deadlock avoidance.
 *
 * Mathematical Foundations:
 * 1. Precubical Set K = (K_n)_{n \ge 0}:
 *    - K_n: Set of n-cubes representing simultaneous execution of n concurrent actions.
 *    - Face maps d_i^0, d_i^1: K_n \to K_{n-1} for 1 \le i \le n satisfying cubical identities:
 *        d_i^\alpha d_j^\beta = d_{j-1}^\beta d_i^\alpha \quad (i < j, \, \alpha, \beta \in \{0, 1\})
 * 2. Directed Paths (Dipaths):
 *    - Continuous monotonic paths \gamma: [0, 1] \to |K| such that each coordinate
 *      is non-decreasing (\dot{\gamma}_i(t) \ge 0), capturing irreversible flow of time.
 * 3. Dipath Homotopy (d-homotopy):
 *    - Equivalence classes of execution traces modulo continuous deformation
 *      through directed paths: [p_1] \sim [p_2].
 * 4. Topological Deadlock Detection:
 *    - A state x \in K is a deadlock if it has no forward directed transitions
 *      yet has not reached the global terminal goal state.
 *    - Mutual exclusion regions appear as forbidden hypercubes (holes in d-space).
 *
 * References:
 * - Fajstrup, Goubault, Haucourt, Mimram, Raussen (2016): "Directed Algebraic Topology and Concurrency", Springer.
 * - Pratt, V. (1991): "Modeling concurrency with geometry", Proc. ACM POPL.
 */

class DirectedTopologyEngine {
    /**
     * @param {Object} options
     * @param {number} [options.dimensions=3] - Number of concurrent worker threads / process dimensions
     */
    constructor(options = {}) {
        this.dimensions = options.dimensions || 3;
        this.forbiddenCubes = []; // Mutex / shared resource forbidden regions: { min: [], max: [] }
        this.states = new Set();
    }

    /**
     * Adds a forbidden hyper-rectangle representing a mutual exclusion conflict
     * (e.g. two agents attempting to hold the same lock or occupy the same grid cell).
     * 
     * @param {number[]} minCoords - Lower coordinate corner [x_min, y_min, z_min]
     * @param {number[]} maxCoords - Upper coordinate corner [x_max, y_max, z_max]
     */
    addForbiddenRegion(minCoords, maxCoords) {
        if (minCoords.length !== this.dimensions || maxCoords.length !== this.dimensions) {
            throw new Error(`Dimension mismatch: expected ${this.dimensions}`);
        }
        this.forbiddenCubes.push({
            min: [...minCoords],
            max: [...maxCoords]
        });
    }

    /**
     * Checks if a point lies inside any forbidden region
     * @param {number[]} point
     * @returns {boolean}
     */
    isForbidden(point) {
        for (const cube of this.forbiddenCubes) {
            let inside = true;
            for (let d = 0; d < this.dimensions; d++) {
                if (point[d] < cube.min[d] || point[d] > cube.max[d]) {
                    inside = false;
                    break;
                }
            }
            if (inside) return true;
        }
        return false;
    }

    /**
     * Validates whether a discrete trajectory is a strictly monotonic dipath
     * that does not violate any forbidden topological constraints.
     * 
     * @param {number[][]} path - Array of coordinates [[x0,y0,z0], [x1,y1,z1], ...]
     * @returns {{isValidDipath: boolean, monotonicityViolations: number, forbiddenCollisions: number}}
     */
    validateDipath(path) {
        let monotonicityViolations = 0;
        let forbiddenCollisions = 0;

        for (let i = 0; i < path.length; i++) {
            const pt = path[i];
            if (this.isForbidden(pt)) {
                forbiddenCollisions++;
            }

            if (i > 0) {
                const prev = path[i - 1];
                for (let d = 0; d < this.dimensions; d++) {
                    if (pt[d] < prev[d] - 1e-9) {
                        monotonicityViolations++;
                    }
                }
            }
        }

        return {
            isValidDipath: monotonicityViolations === 0 && forbiddenCollisions === 0,
            monotonicityViolations,
            forbiddenCollisions,
            pathLength: path.length
        };
    }

    /**
     * Determines whether two dipaths are d-homotopic (i.e. lie on the same side
     * of all forbidden topological obstacles without passing through a singularity).
     * 
     * @param {number[][]} pathA
     * @param {number[][]} pathB
     * @param {number} [homotopySteps=10]
     * @returns {{areDiHomotopic: boolean, obstructionEncountered: boolean}}
     */
    checkDipathHomotopy(pathA, pathB, homotopySteps = 10) {
        const N = Math.min(pathA.length, pathB.length);
        let obstructionEncountered = false;

        // Linear interpolation homotopy: H(t, s) = (1 - s) * pathA(t) + s * pathB(t)
        for (let sIdx = 1; sIdx < homotopySteps; sIdx++) {
            const s = sIdx / homotopySteps;
            const interpolatedPath = [];

            for (let t = 0; t < N; t++) {
                const pt = [];
                for (let d = 0; d < this.dimensions; d++) {
                    pt.push((1.0 - s) * pathA[t][d] + s * pathB[t][d]);
                }
                interpolatedPath.push(pt);
            }

            const val = this.validateDipath(interpolatedPath);
            if (!val.isValidDipath) {
                obstructionEncountered = true;
                break;
            }
        }

        return {
            areDiHomotopic: !obstructionEncountered,
            obstructionEncountered
        };
    }

    /**
     * Scans for topological deadlocks: states from which every outgoing directed
     * transition enters a forbidden region or violates monotonicity.
     * 
     * @param {number[]} bounds - Coordinate limit in each dimension [M_1, M_2, ...]
     * @param {number} [gridStep=1.0]
     * @returns {number[][]} Array of deadlocked coordinates
     */
    findDeadlocks(bounds, gridStep = 1.0) {
        const deadlocks = [];
        const is2D = this.dimensions === 2;

        if (is2D) {
            for (let x = 0; x <= bounds[0]; x += gridStep) {
                for (let y = 0; y <= bounds[1]; y += gridStep) {
                    const pt = [x, y];
                    if (this.isForbidden(pt)) continue;
                    if (x === bounds[0] && y === bounds[1]) continue; // Goal state

                    // Outgoing directed transitions: +x and +y
                    const canMoveX = x + gridStep <= bounds[0] && !this.isForbidden([x + gridStep, y]);
                    const canMoveY = y + gridStep <= bounds[1] && !this.isForbidden([x, y + gridStep]);

                    if (!canMoveX && !canMoveY) {
                        deadlocks.push(pt);
                    }
                }
            }
        } else {
            // General 3D scan
            for (let x = 0; x <= bounds[0]; x += gridStep) {
                for (let y = 0; y <= bounds[1]; y += gridStep) {
                    for (let z = 0; z <= bounds[2]; z += gridStep) {
                        const pt = [x, y, z];
                        if (this.isForbidden(pt)) continue;
                        if (x === bounds[0] && y === bounds[1] && z === bounds[2]) continue;

                        let canAdvance = false;
                        for (let d = 0; d < this.dimensions; d++) {
                            const nextPt = [...pt];
                            nextPt[d] += gridStep;
                            if (nextPt[d] <= bounds[d] && !this.isForbidden(nextPt)) {
                                canAdvance = true;
                                break;
                            }
                        }

                        if (!canAdvance) {
                            deadlocks.push(pt);
                        }
                    }
                }
            }
        }

        return deadlocks;
    }
}

module.exports = DirectedTopologyEngine;
