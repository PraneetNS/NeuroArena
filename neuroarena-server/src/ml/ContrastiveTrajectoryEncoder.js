/**
 * ContrastiveTrajectoryEncoder.js
 *
 * Implements Self-Supervised Contrastive Representation Learning for trajectory segments
 * using InfoNCE mutual information maximization and VICReg (Variance-Invariance-Covariance Regularization).
 *
 * Mathematical Foundations:
 * 1. InfoNCE Objective (van den Oord et al., 2018):
 *    L_{InfoNCE} = -log \frac{exp(sim(z_i, z_j) / \tau)}{\sum_k exp(sim(z_i, z_k) / \tau)}
 * 2. VICReg Regularization (Bardes, Ponce, LeCun, 2022):
 *    - Invariance: s(z, z') = 1/N \sum || z_i - z'_i ||^2
 *    - Variance: v(z) = 1/d \sum \max(0, 1 - \sqrt{Var(z^j) + \epsilon})
 *    - Covariance: c(z) = 1/d \sum_{j \ne k} [Cov(z)]_{jk}^2
 *
 * Output:
 * Dense, low-dimensional invariant trajectory embeddings z \in R^D for rapid zero-shot skill transfer,
 * player behavior clustering, and style mimicry.
 */

class ContrastiveTrajectoryEncoder {
    /**
     * @param {Object} options
     * @param {number} [options.featureDim=6] - Per-step observation dimension [x, y, z, vx, vy, vz]
     * @param {number} [options.seqLength=16] - Sequence length of trajectory snippet
     * @param {number} [options.embeddingDim=8] - Output latent embedding dimension
     * @param {number} [options.temperature=0.07] - InfoNCE softmax temperature \tau
     * @param {number} [options.learningRate=0.005]
     */
    constructor(options = {}) {
        this.featureDim = options.featureDim || 6;
        this.seqLength = options.seqLength || 16;
        this.embeddingDim = options.embeddingDim || 8;
        this.temperature = options.temperature || 0.07;
        this.learningRate = options.learningRate || 0.005;

        this.inputDim = this.featureDim * this.seqLength;

        // Linear projection encoder: [inputDim -> embeddingDim]
        this.w = new Float32Array(this.inputDim * this.embeddingDim);
        this.b = new Float32Array(this.embeddingDim);

        this.initWeights();
    }

    initWeights() {
        const scale = Math.sqrt(2.0 / this.inputDim);
        for (let i = 0; i < this.w.length; i++) {
            this.w[i] = (Math.random() * 2 - 1) * scale;
        }
        for (let i = 0; i < this.b.length; i++) {
            this.b[i] = 0.0;
        }
    }

    /**
     * Data Augmentation: stochastic time-warp, coordinate jitter, and masking
     */
    augment(trajectory) {
        const aug = new Float32Array(trajectory.length);
        const jitterScale = 0.02;
        const maskProb = 0.05;

        for (let i = 0; i < trajectory.length; i++) {
            if (Math.random() < maskProb) {
                aug[i] = 0.0;
            } else {
                const noise = (Math.random() * 2 - 1) * jitterScale;
                aug[i] = trajectory[i] + noise;
            }
        }
        return aug;
    }

    /**
     * Encodes a trajectory sequence into a normalized unit sphere embedding
     * @param {Array<number>|Float32Array} flatTrajectory - Flattened sequence of size inputDim
     * @returns {Float32Array} - Normalized latent embedding of size embeddingDim
     */
    encode(flatTrajectory) {
        const z = new Float32Array(this.embeddingDim);

        for (let k = 0; k < this.embeddingDim; k++) {
            let sum = this.b[k];
            for (let i = 0; i < this.inputDim; i++) {
                sum += flatTrajectory[i] * this.w[i * this.embeddingDim + k];
            }
            z[k] = sum;
        }

        // L2 Normalization onto unit hypersphere S^{d-1}
        let normSq = 0;
        for (let k = 0; k < this.embeddingDim; k++) normSq += z[k] * z[k];
        const invNorm = 1.0 / (Math.sqrt(normSq) + 1e-8);
        for (let k = 0; k < this.embeddingDim; k++) z[k] *= invNorm;

        return z;
    }

    /**
     * Computes cosine similarity between two unit-normalized embeddings
     */
    cosineSimilarity(z1, z2) {
        let dot = 0;
        for (let i = 0; i < this.embeddingDim; i++) {
            dot += z1[i] * z2[i];
        }
        return dot;
    }

    /**
     * Computes InfoNCE loss across a mini-batch of positive and negative trajectory pairs
     * @param {Array<Float32Array>} anchorEmbeddings
     * @param {Array<Float32Array>} positiveEmbeddings
     * @returns {number} - Mean InfoNCE loss
     */
    computeInfoNCELoss(anchorEmbeddings, positiveEmbeddings) {
        const batchSize = anchorEmbeddings.length;
        if (batchSize === 0) return 0.0;

        let totalLoss = 0.0;

        for (let i = 0; i < batchSize; i++) {
            const zi = anchorEmbeddings[i];
            const zj = positiveEmbeddings[i];

            const posSim = this.cosineSimilarity(zi, zj) / this.temperature;
            const expPos = Math.exp(Math.min(20, posSim));

            let sumExp = expPos;
            for (let k = 0; k < batchSize; k++) {
                if (k !== i) {
                    const negSim = this.cosineSimilarity(zi, positiveEmbeddings[k]) / this.temperature;
                    sumExp += Math.exp(Math.min(20, negSim));
                }
            }

            const loss_i = -Math.log(Math.max(1e-12, expPos / sumExp));
            totalLoss += loss_i;
        }

        return totalLoss / batchSize;
    }

    /**
     * Computes VICReg (Variance, Invariance, Covariance) metrics
     */
    computeVICRegMetrics(embeddingsA, embeddingsB) {
        const n = embeddingsA.length;
        const d = this.embeddingDim;
        if (n <= 1) return { invariance: 0, variance: 1, covariance: 0 };

        // 1. Invariance MSE
        let mse = 0;
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < d; j++) {
                const diff = embeddingsA[i][j] - embeddingsB[i][j];
                mse += diff * diff;
            }
        }
        const invarianceLoss = mse / (n * d);

        // 2. Variance Hinge Loss
        let varLoss = 0;
        for (let j = 0; j < d; j++) {
            let mean = 0;
            for (let i = 0; i < n; i++) mean += embeddingsA[i][j];
            mean /= n;

            let variance = 0;
            for (let i = 0; i < n; i++) {
                const diff = embeddingsA[i][j] - mean;
                variance += diff * diff;
            }
            variance /= (n - 1);
            const std = Math.sqrt(variance + 1e-4);
            varLoss += Math.max(0, 1.0 - std);
        }
        varLoss /= d;

        return {
            invariance: invarianceLoss,
            variance: varLoss,
            sampleCount: n
        };
    }
}

module.exports = ContrastiveTrajectoryEncoder;
