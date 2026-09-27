/**
 * ContinualElasticWeightEngine.js
 *
 * Implements Elastic Weight Consolidation (EWC) for continual lifelong learning across
 * diverse mathematical biomes in NeuroArena. Mitigates catastrophic forgetting by calculating
 * the diagonal empirical Fisher Information Matrix (FIM) over previous task distributions
 * and applying a quadratic parameter consolidation penalty.
 *
 * Reference: Kirkpatrick et al. (PNAS 2017) "Overcoming catastrophic forgetting in neural networks"
 */

class ContinualElasticWeightEngine {
    /**
     * @param {Object} options
     * @param {number} [options.fisherWeightLambda=500.0] - EWC importance scaling penalty factor
     * @param {number} [options.fisherDamping=1e-4] - Small epsilon to prevent zero variance
     * @param {number} [options.maxRetainedTasks=5] - Maximum past biome tasks retained in memory
     */
    constructor(options = {}) {
        this.fisherWeightLambda = options.fisherWeightLambda || 500.0;
        this.fisherDamping = options.fisherDamping || 1e-4;
        this.maxRetainedTasks = options.maxRetainedTasks || 5;

        // Map<taskId, { optimalWeights: Float32Array, fisherDiagonal: Float32Array, sampleCount: number }>
        this.consolidatedTasks = new Map();
        this.activeTaskId = 'biome_0_initial';
    }

    /**
     * Estimates the empirical Fisher Information Matrix diagonal for a completed biome task.
     * Uses squared gradients of log-likelihood across representative validation samples:
     * F_i = (1/N) * sum_k [ (dL_k / d_theta_i)^2 ]
     *
     * @param {string} taskId - Biome identifier (e.g., 'biome_1_linear', 'biome_2_poly')
     * @param {Float32Array|Array<number>} currentWeights - Optimal parameters theta* after training on taskId
     * @param {Array<Array<number>>} sampleGradients - Array of gradient vectors evaluated on validation samples
     * @returns {Object} { taskId, parameterCount, meanFisherImportance, traceFIM }
     */
    consolidateTask(taskId, currentWeights, sampleGradients) {
        if (!sampleGradients || sampleGradients.length === 0) {
            throw new Error(`[ContinualElasticWeightEngine] Sample gradients required to compute Fisher diagonal for ${taskId}`);
        }

        const numSamples = sampleGradients.length;
        const paramCount = currentWeights.length;
        const fisherDiag = new Float32Array(paramCount);

        for (let s = 0; s < numSamples; s++) {
            const grad = sampleGradients[s];
            for (let i = 0; i < paramCount; i++) {
                const g = grad[i] || 0;
                fisherDiag[i] += g * g;
            }
        }

        let traceFIM = 0;
        for (let i = 0; i < paramCount; i++) {
            fisherDiag[i] = (fisherDiag[i] / numSamples) + this.fisherDamping;
            traceFIM += fisherDiag[i];
        }

        // Evict oldest task if capacity exceeded
        if (this.consolidatedTasks.size >= this.maxRetainedTasks) {
            const oldestKey = this.consolidatedTasks.keys().next().value;
            this.consolidatedTasks.delete(oldestKey);
        }

        this.consolidatedTasks.set(taskId, {
            optimalWeights: Float32Array.from(currentWeights),
            fisherDiagonal: fisherDiag,
            sampleCount: numSamples
        });

        return {
            taskId,
            parameterCount: paramCount,
            meanFisherImportance: traceFIM / paramCount,
            traceFIM
        };
    }

    /**
     * Calculates the total EWC quadratic penalty loss over all previously consolidated tasks:
     * Loss_EWC = sum_T [ (lambda / 2) * sum_i F_{T, i} * (theta_i - theta^*_{T, i})^2 ]
     *
     * @param {Float32Array|Array<number>} currentWeights - Candidate neural parameters theta
     * @returns {number} Scalar EWC penalty loss
     */
    computeEWCLoss(currentWeights) {
        let totalLoss = 0.0;
        const P = currentWeights.length;

        for (const [taskId, taskData] of this.consolidatedTasks.entries()) {
            const star = taskData.optimalWeights;
            const F = taskData.fisherDiagonal;

            let taskPenalty = 0.0;
            for (let i = 0; i < P; i++) {
                const diff = currentWeights[i] - star[i];
                taskPenalty += F[i] * diff * diff;
            }
            totalLoss += (this.fisherWeightLambda * 0.5) * taskPenalty;
        }

        return totalLoss;
    }

    /**
     * Computes the analytic gradient of the EWC penalty with respect to current parameters:
     * d(Loss_EWC) / d(theta_i) = lambda * sum_T [ F_{T, i} * (theta_i - theta^*_{T, i}) ]
     *
     * @param {Float32Array|Array<number>} currentWeights - Candidate neural parameters theta
     * @returns {Float32Array} Parameter gradient adjustment vector
     */
    computeEWCGradient(currentWeights) {
        const P = currentWeights.length;
        const grad = new Float32Array(P);

        for (const [taskId, taskData] of this.consolidatedTasks.entries()) {
            const star = taskData.optimalWeights;
            const F = taskData.fisherDiagonal;

            for (let i = 0; i < P; i++) {
                const diff = currentWeights[i] - star[i];
                grad[i] += this.fisherWeightLambda * F[i] * diff;
            }
        }

        return grad;
    }

    /**
     * Evaluates parameter drift from earlier consolidated task optima.
     * @param {Float32Array|Array<number>} currentWeights
     * @returns {Array<Object>} Drift per task { taskId, euclideanDrift, weightedFisherDrift }
     */
    evaluateTaskDrift(currentWeights) {
        const results = [];
        const P = currentWeights.length;

        for (const [taskId, taskData] of this.consolidatedTasks.entries()) {
            let euclideanSq = 0;
            let fisherWeightedSq = 0;
            const star = taskData.optimalWeights;
            const F = taskData.fisherDiagonal;

            for (let i = 0; i < P; i++) {
                const diff = currentWeights[i] - star[i];
                euclideanSq += diff * diff;
                fisherWeightedSq += F[i] * diff * diff;
            }

            results.push({
                taskId,
                euclideanDrift: Math.sqrt(euclideanSq),
                weightedFisherDrift: Math.sqrt(fisherWeightedSq)
            });
        }

        return results;
    }
}

module.exports = ContinualElasticWeightEngine;
