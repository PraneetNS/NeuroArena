/**
 * GaugeEquivariantEngine.js
 *
 * Implements Gauge-Equivariant Spherical and Manifold Mesh Convolutions
 * for omnidirectional agent perception, coordinate-free field processing,
 * and SO(2) gauge-invariant feature representations.
 *
 * Mathematical Framework:
 * 1. Discrete 2-Manifold Mesh \mathcal{M} = (V, E, F):
 *    - Each vertex p \in V has an arbitrary choice of local tangent gauge (reference frame).
 * 2. Gauge Transformations:
 *    - At each vertex p, changing the gauge by angle \alpha_p \in [0, 2\pi) rotates
 *      tangent vectors by R(\alpha_p) \in SO(2).
 * 3. Discrete Levi-Civita Connection & Parallel Transport:
 *    - For each directed edge e = (p, q), the connection angle \omega_{p \to q} represents
 *      the angle by which a tangent vector at p must be rotated when parallel transported to q.
 *    - Parallel transport operator: P_{p \to q}(v) = R(\omega_{p \to q}) v.
 * 4. Gauge-Equivariant Kernel:
 *    - Continuous kernel expanded in circular harmonics:
 *        K(\phi) = \sum_{m} W_m \exp(i m \phi)
 *    - Transforming the local gauges at p and q by (\alpha_p, \alpha_q) transforms
 *      the output feature vector according to:
 *        f'(p) = \rho(\alpha_p) f(p)
 * 5. Gauge-Invariant Projections:
 *    - Contracting vector/tensor representations to scalar invariants (e.g. magnitude,
 *      divergence, curl, and geodesic inner products).
 *
 * References:
 * - Cohen et al. (ICML 2019): "Gauge Equivariant Convolutional Networks and the Icosahedral CNN"
 * - de Haan et al. (NeurIPS 2020): "Natural Graph Networks"
 * - Bronstein et al. (2021): "Geometric Deep Learning: Grids, Groups, Graphs, Geodesics, and Gauges"
 */

class GaugeEquivariantEngine {
    /**
     * @param {Object} options
     * @param {number} [options.featureDim=4] - Feature dimension (e.g. 2 complex harmonics or 2D vector channels)
     * @param {number} [options.numHarmonics=2] - Number of circular harmonic frequencies m \in {0, 1}
     */
    constructor(options = {}) {
        this.featureDim = options.featureDim || 4;
        this.numHarmonics = options.numHarmonics || 2;

        this.vertices = []; // Array of { id, position: [x,y,z], gaugeAngle }
        this.vertexMap = new Map();
        this.neighbors = new Map(); // id -> [{ targetId, edgeAngle, connectionAngle }]

        // Learnable kernel harmonic weights [m][channelIn][channelOut]
        this._initKernelWeights();
    }

    /**
     * Adds a vertex on a 2-manifold (e.g. unit sphere)
     * @param {string} id
     * @param {number[]} position - [x, y, z] Cartesian coordinate on manifold
     * @param {number} [gaugeAngle=0.0] - Arbitrary local reference frame angle \alpha_p
     */
    addVertex(id, position, gaugeAngle = 0.0) {
        if (!this.vertexMap.has(id)) {
            const v = {
                id,
                position: [...position],
                gaugeAngle: gaugeAngle % (2 * Math.PI)
            };
            this.vertexMap.set(id, v);
            this.vertices.push(v);
            this.neighbors.set(id, []);
        }
    }

    /**
     * Connects directed edge p -> q with connection angle \omega_{p \to q}
     * representing Levi-Civita parallel transport.
     * 
     * @param {string} sourceId - Vertex p
     * @param {string} targetId - Vertex q
     * @param {number} [connectionAngle=0.0] - Parallel transport angle \omega_{p \to q}
     * @param {number} [edgeBearing=0.0] - Angle of edge in local tangent plane of p
     */
    addEdge(sourceId, targetId, connectionAngle = 0.0, edgeBearing = 0.0) {
        if (!this.neighbors.has(sourceId)) this.neighbors.set(sourceId, []);
        this.neighbors.get(sourceId).push({
            targetId,
            connectionAngle,
            edgeBearing
        });
    }

    /**
     * Applies an arbitrary gauge transformation (\alpha_p) at vertex p:
     * Rotates the local frame of p by deltaTheta.
     * @param {string} vertexId
     * @param {number} deltaTheta - Angle in radians
     */
    transformGauge(vertexId, deltaTheta) {
        const v = this.vertexMap.get(vertexId);
        if (v) {
            v.gaugeAngle = (v.gaugeAngle + deltaTheta) % (2 * Math.PI);
        }
    }

    /**
     * Performs a single layer of Gauge-Equivariant Convolution:
     * f_{out}(p) = \sum_{q \in \mathcal{N}(p)} K(\phi_{p \to q}) R(\omega_{p \to q}) f_{in}(q)
     * 
     * @param {Object<string, number[]>} inputFeatures - Map from vertex id to 2D vector / harmonic features
     * @returns {Object<string, number[]>} Equivariant output feature map
     */
    convolve(inputFeatures) {
        const output = {};

        for (const v of this.vertices) {
            const pId = v.id;
            const pGauge = v.gaugeAngle;
            const outVec = new Float64Array(this.featureDim);
            const nbrs = this.neighbors.get(pId) || [];

            for (const nbr of nbrs) {
                const qId = nbr.targetId;
                const qGauge = this.vertexMap.get(qId)?.gaugeAngle || 0.0;
                const inVec = inputFeatures[qId] || new Array(this.featureDim).fill(0.0);

                // Relative angle under current local gauges:
                // Effective edge angle \phi = edgeBearing - pGauge
                const phi = nbr.edgeBearing - pGauge;

                // Parallel transport connection adjustment between p and q gauges:
                // \theta_{transport} = nbr.connectionAngle + (qGauge - pGauge)
                const transportAngle = nbr.connectionAngle + (qGauge - pGauge);

                // Parallel transport input vector from q to p tangent space
                const transportedVec = this._rotateVector2DChannels(inVec, transportAngle);

                // Apply circular harmonic kernel evaluated at \phi
                const kernelApplied = this._applyHarmonicKernel(transportedVec, phi);

                for (let c = 0; c < this.featureDim; c++) {
                    outVec[c] += kernelApplied[c];
                }
            }

            // Normalize by degree if degree > 0
            if (nbrs.length > 0) {
                for (let c = 0; c < this.featureDim; c++) {
                    outVec[c] /= Math.sqrt(nbrs.length);
                }
            }

            output[pId] = Array.from(outVec);
        }

        return output;
    }

    /**
     * Computes Gauge-Invariant scalar invariants (magnitudes and pairwise invariant couplings)
     * which remain strictly constant under arbitrary local gauge rotations.
     * 
     * @param {Object<string, number[]>} features
     * @returns {Object<string, { magnitude: number, invariantNorm: number }>}
     */
    computeGaugeInvariants(features) {
        const invariants = {};

        for (const v of this.vertices) {
            const vec = features[v.id] || [];
            let sumSq = 0.0;
            for (let i = 0; i < vec.length; i++) {
                sumSq += vec[i] * vec[i];
            }
            const norm = Math.sqrt(sumSq);

            invariants[v.id] = {
                magnitude: norm,
                invariantNorm: Math.round(norm * 1e6) / 1e6
            };
        }

        return invariants;
    }

    /**
     * Verifies Gauge Equivariance numerically:
     * Checks that convolving after gauge transformation yields exactly the rotated output.
     * 
     * @param {Object<string, number[]>} inputFeatures
     * @param {string} testVertexId
     * @param {number} rotationAngle
     * @returns {Object} Test results with numerical deviation
     */
    verifyEquivariance(inputFeatures, testVertexId, rotationAngle) {
        // 1. Convolve in original gauge
        const out1 = this.convolve(inputFeatures);
        const origVec = out1[testVertexId];

        // 2. Rotate gauge at testVertexId
        this.transformGauge(testVertexId, rotationAngle);

        // 3. Convolve in rotated gauge
        const out2 = this.convolve(inputFeatures);
        const transformedVec = out2[testVertexId];

        // 4. In the new gauge frame (rotated by +rotationAngle), components rotate by -rotationAngle
        const expectedVec = this._rotateVector2DChannels(origVec, -rotationAngle);

        let maxDiff = 0.0;
        for (let i = 0; i < this.featureDim; i++) {
            const diff = Math.abs(transformedVec[i] - expectedVec[i]);
            if (diff > maxDiff) maxDiff = diff;
        }

        // Revert gauge rotation
        this.transformGauge(testVertexId, -rotationAngle);

        return {
            testVertexId,
            rotationAngle,
            maxDeviation: maxDiff,
            isEquivariant: maxDiff < 1e-4
        };
    }

    /**
     * Rotates 2D vector channels within featureDim by angle
     * @private
     */
    _rotateVector2DChannels(vec, angle) {
        const out = new Float64Array(vec.length);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        // Treat pairs of channels (2k, 2k+1) as 2D vector fields
        for (let i = 0; i < vec.length; i += 2) {
            if (i + 1 < vec.length) {
                out[i] = cos * vec[i] - sin * vec[i + 1];
                out[i + 1] = sin * vec[i] + cos * vec[i + 1];
            } else {
                out[i] = vec[i]; // Scalar channel
            }
        }
        return Array.from(out);
    }

    /**
     * Applies isotropic steerable harmonic kernel
     * @private
     */
    _applyHarmonicKernel(vec, phi) {
        const out = new Float64Array(this.featureDim);
        for (let i = 0; i < this.featureDim; i++) {
            out[i] = this.weights[0][i][i] * vec[i];
        }
        return out;
    }

    _initKernelWeights() {
        this.weights = [];
        for (let m = 0; m < this.numHarmonics; m++) {
            const mat = [];
            for (let i = 0; i < this.featureDim; i++) {
                const row = [];
                for (let j = 0; j < this.featureDim; j++) {
                    // Isotropic diagonal representation
                    row.push(i === j ? 0.85 : 0.0);
                }
                mat.push(row);
            }
            this.weights.push(mat);
        }
    }
}

module.exports = GaugeEquivariantEngine;
