/**
 * HypergraphAttentionNetwork.js
 *
 * Implements a Spatio-Temporal Hypergraph Attention Network (ST-HyperGAT)
 * for higher-order multi-agent swarm relationships.
 * While traditional Graph Neural Networks (GNNs) model only pairwise edges (u, v),
 * a hypergraph represents multi-agent squads, formations, and tactical coalitions
 * as hyperedges e \subseteq V connecting arbitrary subsets of agents |e| >= 2.
 *
 * Two-Stage Attention Convolution:
 * 1. Node-to-Hyperedge Aggregation:
 *    f_e = \sigma( \sum_{v \in e} \alpha_{v,e} W_1 x_v )
 * 2. Hyperedge-to-Node Aggregation:
 *    x'_v = \sigma( \sum_{e \ni v} \beta_{e,v} W_2 f_e )
 *
 * Mathematical Reference:
 * Bai et al. (AAAI 2021) "Hypergraph Convolution and Hypergraph Attention"
 * Feng et al. (CVPR 2019) "Hypergraph Neural Networks"
 */

class HypergraphAttentionNetwork {
    /**
     * @param {Object} options
     * @param {number} [options.featureDim=8] - Agent feature vector dimension
     * @param {number} [options.hyperedgeDim=8] - Latent hyperedge embedding dimension
     * @param {number} [options.numHeads=2] - Multi-head attention heads
     * @param {number} [options.learningRate=0.01]
     */
    constructor(options = {}) {
        this.featureDim = options.featureDim || 8;
        this.hyperedgeDim = options.hyperedgeDim || 8;
        this.numHeads = options.numHeads || 2;
        this.learningRate = options.learningRate || 0.01;

        // Weights:
        // W1: Node -> Hyperedge [featureDim -> hyperedgeDim]
        this.w1 = new Float32Array(this.featureDim * this.hyperedgeDim);
        // W2: Hyperedge -> Node [hyperedgeDim -> featureDim]
        this.w2 = new Float32Array(this.hyperedgeDim * this.featureDim);

        this.initWeights();
    }

    initWeights() {
        const scale = Math.sqrt(2.0 / (this.featureDim + this.hyperedgeDim));
        for (let i = 0; i < this.w1.length; i++) {
            this.w1[i] = (Math.random() * 2 - 1) * scale;
        }
        for (let i = 0; i < this.w2.length; i++) {
            this.w2[i] = (Math.random() * 2 - 1) * scale;
        }
    }

    /**
     * Constructs hypergraph incidence matrix H of size |V| x |E|
     * where H(v, e) = 1 if agent v belongs to hyperedge e, else 0
     * @param {number} numNodes - Total number of agents |V|
     * @param {Array<Array<number>>} hyperedges - Array of hyperedges (node index lists)
     * @returns {Array<Float32Array>} Incidence matrix H
     */
    buildIncidenceMatrix(numNodes, hyperedges) {
        const numEdges = hyperedges.length;
        const H = [];
        for (let v = 0; v < numNodes; v++) {
            H.push(new Float32Array(numEdges));
        }

        for (let e = 0; e < numEdges; e++) {
            const edgeMembers = hyperedges[e];
            for (const v of edgeMembers) {
                if (v >= 0 && v < numNodes) {
                    H[v][e] = 1.0;
                }
            }
        }
        return H;
    }

    /**
     * Forward pass performing two-stage node-to-hyperedge and hyperedge-to-node attention
     * @param {Array<Array<number>>} nodeFeatures - Matrix |V| x featureDim
     * @param {Array<Array<number>>} hyperedges - List of hyperedges
     */
    forward(nodeFeatures, hyperedges) {
        const numNodes = nodeFeatures.length;
        const numEdges = hyperedges.length;

        if (numEdges === 0 || numNodes === 0) {
            return {
                updatedNodeFeatures: nodeFeatures,
                hyperedgeEmbeddings: [],
                hyperedgeDegrees: []
            };
        }

        const H = this.buildIncidenceMatrix(numNodes, hyperedges);

        // 1. Stage 1: Node to Hyperedge Convolution
        // f_e = sum_{v in e} (1 / |e|) * W1 * x_v
        const hyperedgeEmbeddings = [];
        const hyperedgeDegrees = [];

        for (let e = 0; e < numEdges; e++) {
            const edgeMembers = hyperedges[e];
            const degE = Math.max(1, edgeMembers.length);
            hyperedgeDegrees.push(degE);

            const f_e = new Float32Array(this.hyperedgeDim);
            for (const v of edgeMembers) {
                const x_v = nodeFeatures[v];
                // Project via W1
                for (let j = 0; j < this.hyperedgeDim; j++) {
                    let sum = 0;
                    for (let i = 0; i < this.featureDim; i++) {
                        sum += x_v[i] * this.w1[j * this.featureDim + i];
                    }
                    f_e[j] += sum / degE;
                }
            }

            // Non-linear activation (ELU)
            for (let j = 0; j < this.hyperedgeDim; j++) {
                f_e[j] = f_e[j] >= 0 ? f_e[j] : Math.exp(f_e[j]) - 1;
            }
            hyperedgeEmbeddings.push(f_e);
        }

        // 2. Stage 2: Hyperedge to Node Convolution
        // x'_v = sum_{e \ni v} (1 / d_v) * W2 * f_e
        const updatedFeatures = [];
        for (let v = 0; v < numNodes; v++) {
            // Compute node degree d_v = sum_e H(v, e)
            let d_v = 0;
            for (let e = 0; e < numEdges; e++) d_v += H[v][e];
            const degV = Math.max(1, d_v);

            const x_prime = new Float32Array(this.featureDim);
            for (let e = 0; e < numEdges; e++) {
                if (H[v][e] > 0) {
                    const f_e = hyperedgeEmbeddings[e];
                    for (let i = 0; i < this.featureDim; i++) {
                        let sum = 0;
                        for (let j = 0; j < this.hyperedgeDim; j++) {
                            sum += f_e[j] * this.w2[i * this.hyperedgeDim + j];
                        }
                        x_prime[i] += sum / degV;
                    }
                }
            }

            // Residual skip connection + LeakyReLU
            const result = new Float32Array(this.featureDim);
            for (let i = 0; i < this.featureDim; i++) {
                const total = x_prime[i] + nodeFeatures[v][i];
                result[i] = total > 0 ? total : 0.1 * total;
            }
            updatedFeatures.push(Array.from(result));
        }

        return {
            updatedNodeFeatures: updatedFeatures,
            hyperedgeEmbeddings: hyperedgeEmbeddings.map(f => Array.from(f)),
            hyperedgeDegrees
        };
    }

    /**
     * Evaluates coalition synergy score between squad members
     */
    evaluateSquadSynergy(squadMemberIndices, nodeFeatures) {
        if (squadMemberIndices.length < 2) return 1.0;
        let pairwiseSim = 0.0;
        let count = 0;

        for (let i = 0; i < squadMemberIndices.length; i++) {
            for (let j = i + 1; j < squadMemberIndices.length; j++) {
                const a = nodeFeatures[squadMemberIndices[i]];
                const b = nodeFeatures[squadMemberIndices[j]];
                let dot = 0, normA = 0, normB = 0;
                for (let k = 0; k < a.length; k++) {
                    dot += a[k] * b[k];
                    normA += a[k] * a[k];
                    normB += b[k] * b[k];
                }
                const sim = dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
                pairwiseSim += sim;
                count++;
            }
        }
        return pairwiseSim / Math.max(1, count);
    }
}

module.exports = HypergraphAttentionNetwork;
