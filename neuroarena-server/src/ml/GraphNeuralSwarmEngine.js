/**
 * GraphNeuralSwarmEngine.js
 *
 * Implements a Graph Neural Network (GNN) message passing coordinator for multi-agent
 * swarm robotics and autonomous drone constellations in NeuroArena.
 * Utilizes Permutation-Equivariant Graph Convolutional Networks (Kipf & Welling GCN)
 * with symmetric normalized adjacency matrices and dynamic spatial neighborhood aggregation.
 */

class GraphNeuralSwarmEngine {
    /**
     * @param {Object} options
     * @param {number} [options.featureDim=6] - Node state dimension [x, y, z, vx, vy, vz]
     * @param {number} [options.hiddenDim=16] - GNN hidden embedding dimension
     * @param {number} [options.outputDim=3] - Output control dimension [ax, ay, az]
     * @param {number} [options.communicationRadius=35.0] - Euclidean neighborhood radius in meters
     * @param {number} [options.maxNeighbors=8] - Maximum k-NN degree cap per node
     */
    constructor(options = {}) {
        this.featureDim = options.featureDim || 6;
        this.hiddenDim = options.hiddenDim || 16;
        this.outputDim = options.outputDim || 3;
        this.communicationRadius = options.communicationRadius || 35.0;
        this.maxNeighbors = options.maxNeighbors || 8;

        // GCN Weights: W0 (featureDim -> hiddenDim), W1 (hiddenDim -> outputDim)
        this.W0 = this._initWeightMatrix(this.featureDim, this.hiddenDim, 0.25);
        this.b0 = new Float32Array(this.hiddenDim).fill(0.01);
        this.W1 = this._initWeightMatrix(this.hiddenDim, this.outputDim, 0.25);
        this.b1 = new Float32Array(this.outputDim).fill(0.0);

        this.totalPassesExecuted = 0;
        this.lastTopologyMetrics = {
            nodeCount: 0,
            edgeCount: 0,
            spectralGap: 0,
            density: 0
        };
    }

    /**
     * Allocates Xavier-initialized weight matrices
     * @private
     */
    _initWeightMatrix(inDim, outDim, scale = 0.5) {
        const matrix = [];
        const bound = Math.sqrt(6.0 / (inDim + outDim)) * scale;
        for (let i = 0; i < inDim; i++) {
            const row = new Float32Array(outDim);
            for (let j = 0; j < outDim; j++) {
                row[j] = (Math.random() * 2 - 1) * bound;
            }
            matrix.push(row);
        }
        return matrix;
    }

    /**
     * Constructs spatial adjacency matrix A with self-loops A_tilde = A + I
     * based on inter-agent Euclidean distances.
     * @param {Array<Object>} agents - Array of agent state objects with { id, position: [x,y,z], velocity: [vx,vy,vz] }
     * @returns {Object} { adj: Array<Float32Array>, degrees: Float32Array, edgeCount: number }
     */
    buildDynamicTopology(agents) {
        const N = agents.length;
        const adj = Array.from({ length: N }, () => new Float32Array(N));
        const degrees = new Float32Array(N);
        let edgeCount = 0;

        for (let i = 0; i < N; i++) {
            // Self-loop: A_tilde[i][i] = 1.0
            adj[i][i] = 1.0;
            degrees[i] += 1.0;

            const posI = agents[i].position;
            const candidates = [];

            for (let j = 0; j < N; j++) {
                if (i === j) continue;
                const posJ = agents[j].position;
                const dx = posI[0] - posJ[0];
                const dy = posI[1] - posJ[1];
                const dz = posI[2] - posJ[2];
                const distSq = dx * dx + dy * dy + dz * dz;

                if (distSq <= this.communicationRadius * this.communicationRadius) {
                    candidates.push({ j, dist: Math.sqrt(distSq) });
                }
            }

            // Cap to maxNeighbors
            candidates.sort((a, b) => a.dist - b.dist);
            const selected = candidates.slice(0, this.maxNeighbors);

            for (const cand of selected) {
                // Gaussian RBF kernel weighting: exp(-dist^2 / (2 * sigma^2))
                const weight = Math.exp(-Math.pow(cand.dist / (this.communicationRadius * 0.5), 2));
                adj[i][cand.j] = weight;
                degrees[i] += weight;
                edgeCount++;
            }
        }

        const density = N > 1 ? edgeCount / (N * (N - 1)) : 0;
        this.lastTopologyMetrics = {
            nodeCount: N,
            edgeCount,
            spectralGap: Math.max(0.01, 1.0 - density),
            density
        };

        return { adj, degrees, edgeCount };
    }

    /**
     * Computes symmetric normalized adjacency: S = D_tilde^(-1/2) * A_tilde * D_tilde^(-1/2)
     * @private
     */
    _computeSymmetricNormalization(adj, degrees) {
        const N = adj.length;
        const S = Array.from({ length: N }, () => new Float32Array(N));
        const invSqrtDeg = new Float32Array(N);

        for (let i = 0; i < N; i++) {
            invSqrtDeg[i] = degrees[i] > 0 ? 1.0 / Math.sqrt(degrees[i]) : 0;
        }

        for (let i = 0; i < N; i++) {
            for (let j = 0; j < N; j++) {
                if (adj[i][j] > 0) {
                    S[i][j] = invSqrtDeg[i] * adj[i][j] * invSqrtDeg[j];
                }
            }
        }

        return S;
    }

    /**
     * Executes 2-layer Graph Convolutional Network (GCN) forward pass:
     * H1 = LeakyReLU(S * H0 * W0 + b0)
     * Output = Tanh(S * H1 * W1 + b1)
     *
     * @param {Array<Object>} agents - Swarm agents
     * @returns {Object} Swarm control vectors and node embeddings
     */
    forward(agents) {
        const N = agents.length;
        if (N === 0) return { actions: [], embeddings: [], metrics: this.lastTopologyMetrics };

        // 1. Build dynamic proximity topology
        const { adj, degrees } = this.buildDynamicTopology(agents);
        const S = this._computeSymmetricNormalization(adj, degrees);

        // 2. Extract input node feature matrix H0 [N x featureDim]
        const H0 = [];
        for (let i = 0; i < N; i++) {
            const p = agents[i].position || [0, 0, 0];
            const v = agents[i].velocity || [0, 0, 0];
            H0.push(new Float32Array([p[0] * 0.05, p[1] * 0.05, p[2] * 0.05, v[0] * 0.1, v[1] * 0.1, v[2] * 0.1]));
        }

        // 3. Layer 1: H0 * W0 [N x hiddenDim]
        const H0_W0 = Array.from({ length: N }, () => new Float32Array(this.hiddenDim));
        for (let i = 0; i < N; i++) {
            for (let h = 0; h < this.hiddenDim; h++) {
                let sum = this.b0[h];
                for (let f = 0; f < this.featureDim; f++) {
                    sum += H0[i][f] * this.W0[f][h];
                }
                H0_W0[i][h] = sum;
            }
        }

        // Neighborhood aggregation: S * (H0 * W0) with LeakyReLU activation
        const H1 = Array.from({ length: N }, () => new Float32Array(this.hiddenDim));
        for (let i = 0; i < N; i++) {
            for (let h = 0; h < this.hiddenDim; h++) {
                let aggregated = 0;
                for (let j = 0; j < N; j++) {
                    if (S[i][j] !== 0) {
                        aggregated += S[i][j] * H0_W0[j][h];
                    }
                }
                // LeakyReLU: x >= 0 ? x : 0.01 * x
                H1[i][h] = aggregated >= 0 ? aggregated : 0.01 * aggregated;
            }
        }

        // 4. Layer 2: H1 * W1 [N x outputDim]
        const H1_W1 = Array.from({ length: N }, () => new Float32Array(this.outputDim));
        for (let i = 0; i < N; i++) {
            for (let o = 0; o < this.outputDim; o++) {
                let sum = this.b1[o];
                for (let h = 0; h < this.hiddenDim; h++) {
                    sum += H1[i][h] * this.W1[h][o];
                }
                H1_W1[i][o] = sum;
            }
        }

        // Neighborhood aggregation: S * (H1 * W1) with Tanh bounded output
        const actions = [];
        for (let i = 0; i < N; i++) {
            const out = new Float32Array(this.outputDim);
            for (let o = 0; o < this.outputDim; o++) {
                let aggregated = 0;
                for (let j = 0; j < N; j++) {
                    if (S[i][j] !== 0) {
                        aggregated += S[i][j] * H1_W1[j][o];
                    }
                }
                out[o] = Math.tanh(aggregated);
            }
            actions.push({
                agentId: agents[i].id,
                acceleration: [out[0] * 5.0, out[1] * 5.0, out[2] * 5.0], // Scaled control command (m/s^2)
                cohesionScore: degrees[i] / (N || 1)
            });
        }

        this.totalPassesExecuted++;
        return {
            actions,
            embeddings: H1,
            topology: this.lastTopologyMetrics
        };
    }
}

module.exports = GraphNeuralSwarmEngine;
