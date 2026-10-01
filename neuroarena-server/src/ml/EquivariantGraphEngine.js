/**
 * EquivariantGraphEngine.js
 *
 * Implements an E(n)-Equivariant Graph Neural Network (EGNN) for coordinate-free 3D multi-agent dynamics.
 * Satisfies strict SO(3) rotational and translational equivariance:
 *   EGNN(R * X + t, H) = R * EGNN(X, H) + t
 *
 * Mathematical Updates:
 * 1. Edge messages:   m_{ij} = \phi_e(h_i, h_j, ||x_i - x_j||^2, a_{ij})
 * 2. Coordinate pass: x_i^{(l+1)} = x_i^{(l)} + \sum_{j \in N(i)} (x_i - x_j) \phi_x(m_{ij})
 * 3. Feature pass:    m_i = \sum_{j \in N(i)} m_{ij}
 *                     h_i^{(l+1)} = \phi_h(h_i^{(l)}, m_i)
 *
 * References:
 * - Satorras, Hoogeboom, Welling (ICML 2021): "E(n) Equivariant Graph Neural Networks"
 */

class EquivariantGraphEngine {
    /**
     * @param {Object} options
     * @param {number} [options.featureDim=4] - Node feature embedding dimension
     * @param {number} [options.hiddenDim=8] - Hidden message dimension
     * @param {number} [options.numLayers=2] - Number of equivariant message passing layers
     */
    constructor(options = {}) {
        this.featureDim = options.featureDim || 4;
        this.hiddenDim = options.hiddenDim || 8;
        this.numLayers = options.numLayers || 2;

        // Linear layer weights for edge message \phi_e: [2 * featureDim + 1] -> hiddenDim
        this.edgeInputDim = 2 * this.featureDim + 1;
        this.wEdge = new Float32Array(this.edgeInputDim * this.hiddenDim);
        this.bEdge = new Float32Array(this.hiddenDim);

        // Linear layer weights for coordinate message \phi_x: hiddenDim -> 1
        this.wCoord = new Float32Array(this.hiddenDim);
        this.bCoord = 0.0;

        // Linear layer weights for node update \phi_h: [featureDim + hiddenDim] -> featureDim
        this.nodeInputDim = this.featureDim + this.hiddenDim;
        this.wNode = new Float32Array(this.nodeInputDim * this.featureDim);
        this.bNode = new Float32Array(this.featureDim);

        this.initWeights();
    }

    initWeights() {
        for (let i = 0; i < this.wEdge.length; i++) {
            this.wEdge[i] = (Math.random() * 2 - 1) * 0.2;
        }
        for (let i = 0; i < this.wCoord.length; i++) {
            this.wCoord[i] = (Math.random() * 2 - 1) * 0.1;
        }
        for (let i = 0; i < this.wNode.length; i++) {
            this.wNode[i] = (Math.random() * 2 - 1) * 0.2;
        }
    }

    /**
     * Forward pass of Equivariant GNN over agents
     * @param {Array<Array<number>>} positions Array of [x, y, z] coordinates for N agents
     * @param {Array<Array<number>>} features Array of featureDim embeddings for N agents
     * @returns {{ updatedPositions: Array<Array<number>>, updatedFeatures: Array<Array<number>> }}
     */
    forward(positions, features) {
        const N = positions.length;
        let curPos = positions.map(p => p.slice());
        let curFeat = features.map(f => f.slice());

        for (let layer = 0; layer < this.numLayers; layer++) {
            const nextPos = curPos.map(p => p.slice());
            const nextFeat = curFeat.map(f => f.slice());

            for (let i = 0; i < N; i++) {
                const coordDelta = [0, 0, 0];
                const aggMessage = new Float32Array(this.hiddenDim);

                for (let j = 0; j < N; j++) {
                    if (i === j) continue;

                    // Squared distance d_ij = ||x_i - x_j||^2 (SE(3) invariant)
                    const dx = curPos[i][0] - curPos[j][0];
                    const dy = curPos[i][1] - curPos[j][1];
                    const dz = curPos[i][2] - curPos[j][2];
                    const distSq = dx * dx + dy * dy + dz * dz;

                    // Concatenate [h_i, h_j, d_ij]
                    const edgeIn = new Float32Array(this.edgeInputDim);
                    for (let d = 0; d < this.featureDim; d++) {
                        edgeIn[d] = curFeat[i][d];
                        edgeIn[this.featureDim + d] = curFeat[j][d];
                    }
                    edgeIn[2 * this.featureDim] = distSq;

                    // Compute edge message m_ij
                    const m_ij = new Float32Array(this.hiddenDim);
                    for (let h = 0; h < this.hiddenDim; h++) {
                        let sum = this.bEdge[h];
                        for (let k = 0; k < this.edgeInputDim; k++) {
                            sum += edgeIn[k] * this.wEdge[h * this.edgeInputDim + k];
                        }
                        // SiLU activation
                        m_ij[h] = sum / (1.0 + Math.exp(-sum));
                        aggMessage[h] += m_ij[h];
                    }

                    // Compute coordinate scalar weight \phi_x(m_ij)
                    let scalarWeight = this.bCoord;
                    for (let h = 0; h < this.hiddenDim; h++) {
                        scalarWeight += m_ij[h] * this.wCoord[h];
                    }
                    // Equivariant vector update
                    coordDelta[0] += (curPos[i][0] - curPos[j][0]) * scalarWeight;
                    coordDelta[1] += (curPos[i][1] - curPos[j][1]) * scalarWeight;
                    coordDelta[2] += (curPos[i][2] - curPos[j][2]) * scalarWeight;
                }

                nextPos[i][0] += coordDelta[0];
                nextPos[i][1] += coordDelta[1];
                nextPos[i][2] += coordDelta[2];

                // Compute updated invariant features \phi_h(h_i, m_i)
                const nodeIn = new Float32Array(this.nodeInputDim);
                for (let d = 0; d < this.featureDim; d++) nodeIn[d] = curFeat[i][d];
                for (let h = 0; h < this.hiddenDim; h++) nodeIn[this.featureDim + h] = aggMessage[h];

                for (let d = 0; d < this.featureDim; d++) {
                    let sum = this.bNode[d];
                    for (let k = 0; k < this.nodeInputDim; k++) {
                        sum += nodeIn[k] * this.wNode[d * this.nodeInputDim + k];
                    }
                    nextFeat[i][d] = Math.tanh(sum);
                }
            }

            curPos = nextPos;
            curFeat = nextFeat;
        }

        return {
            updatedPositions: curPos,
            updatedFeatures: curFeat
        };
    }
}

module.exports = EquivariantGraphEngine;
