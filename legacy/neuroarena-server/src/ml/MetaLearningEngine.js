/**
 * MetaLearningEngine.js
 *
 * Implements Model-Agnostic Meta-Learning (MAML) for rapid few-shot biome adaptation
 * across NeuroArena procedural environments. Optimizes parameter initializations such that
 * an agent can solve novel mathematical landscape dynamics with 1-5 gradient steps.
 *
 * Mathematical Reference:
 * Finn, Abbeel, Levine (ICML 2017) "Model-Agnostic Meta-Learning for Fast Adaptation of Deep Networks"
 */

class MetaLearningEngine {
    /**
     * @param {Object} options
     * @param {number} [options.paramDim=16] - Dimension of model parameters theta
     * @param {number} [options.innerAlpha=0.05] - Inner-loop task adaptation learning rate
     * @param {number} [options.metaBeta=0.005] - Outer-loop meta-optimization learning rate
     * @param {number} [options.innerSteps=3] - Number of gradient adaptation steps on support set
     * @param {boolean} [options.firstOrder=true] - Use FOMAML (First-Order MAML approximation)
     */
    constructor(options = {}) {
        this.paramDim = options.paramDim || 16;
        this.innerAlpha = options.innerAlpha || 0.05;
        this.metaBeta = options.metaBeta || 0.005;
        this.innerSteps = options.innerSteps || 3;
        this.firstOrder = options.firstOrder !== undefined ? options.firstOrder : true;

        // Meta-parameters theta
        this.metaTheta = new Float32Array(this.paramDim);
        this.initializeMetaWeights();

        // Historical tracking metrics
        this.metaIteration = 0;
        this.metaLossHistory = [];
        this.adaptationSpeedupHistory = [];
    }

    /**
     * Hebbian / Xavier parameter initialization
     */
    initializeMetaWeights() {
        const scale = Math.sqrt(2.0 / this.paramDim);
        for (let i = 0; i < this.paramDim; i++) {
            // Gaussian pseudo-random via Box-Muller
            const u1 = Math.max(1e-7, Math.random());
            const u2 = Math.random();
            const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
            this.metaTheta[i] = z * scale;
        }
    }

    /**
     * Mean Squared Error loss and analytical gradient for linear/polynomial representations
     * L(w) = (1 / 2N) * sum_n (x_n * w - y_n)^2
     * grad = (1 / N) * sum_n x_n * (x_n * w - y_n)
     *
     * @param {Float32Array} weights - Current parameters
     * @param {Array<{x: Array<number>, y: number}>} dataset - Support or query samples
     * @returns {{loss: number, grad: Float32Array}}
     */
    computeLossAndGrad(weights, dataset) {
        const n = dataset.length;
        if (n === 0) return { loss: 0, grad: new Float32Array(this.paramDim) };

        let totalLoss = 0;
        const grad = new Float32Array(this.paramDim);

        for (let i = 0; i < n; i++) {
            const { x, y } = dataset[i];
            let pred = 0;
            for (let d = 0; d < this.paramDim; d++) {
                pred += (x[d] || 0) * weights[d];
            }
            const error = pred - y;
            totalLoss += 0.5 * error * error;

            for (let d = 0; d < this.paramDim; d++) {
                grad[d] += error * (x[d] || 0);
            }
        }

        const avgLoss = totalLoss / n;
        for (let d = 0; d < this.paramDim; d++) {
            grad[d] /= n;
        }

        return { loss: avgLoss, grad };
    }

    /**
     * Inner-Loop Task Adaptation: Takes metaTheta and performs K gradient descent steps
     * on the task's Support Set: theta'_i = theta - alpha * grad_L(theta)
     *
     * @param {Array<{x: Array<number>, y: number}>} supportSet - 1-to-5 shot prompt data
     * @returns {{adaptedWeights: Float32Array, initialLoss: number, adaptedLoss: number, stepsExecuted: number}}
     */
    adaptTask(supportSet) {
        const adaptedWeights = new Float32Array(this.metaTheta);
        let initialLoss = 0;
        let adaptedLoss = 0;

        for (let step = 0; step < this.innerSteps; step++) {
            const { loss, grad } = this.computeLossAndGrad(adaptedWeights, supportSet);
            if (step === 0) initialLoss = loss;

            for (let d = 0; d < this.paramDim; d++) {
                adaptedWeights[d] -= this.innerAlpha * grad[d];
            }

            adaptedLoss = loss;
        }

        // Final evaluation on support set
        const finalEval = this.computeLossAndGrad(adaptedWeights, supportSet);
        adaptedLoss = finalEval.loss;

        return {
            adaptedWeights,
            initialLoss,
            adaptedLoss,
            stepsExecuted: this.innerSteps
        };
    }

    /**
     * Outer-Loop Meta-Update across a batch of procedural tasks:
     * theta <- theta - beta * sum_{T_i} grad_{theta} L_{T_i}(theta'_i)
     *
     * @param {Array<{taskId: string, support: Array<{x: Array<number>, y: number}>, query: Array<{x: Array<number>, y: number}>}>} taskBatch
     * @returns {Object} Meta-iteration telemetry summary
     */
    trainMetaBatch(taskBatch) {
        if (!taskBatch || taskBatch.length === 0) {
            throw new Error('[MetaLearningEngine] Task batch cannot be empty');
        }

        const metaGradAccumulator = new Float32Array(this.paramDim);
        let totalPreAdaptQueryLoss = 0;
        let totalPostAdaptQueryLoss = 0;

        for (const task of taskBatch) {
            // Pre-adaptation query loss
            const preEval = this.computeLossAndGrad(this.metaTheta, task.query);
            totalPreAdaptQueryLoss += preEval.loss;

            // Fast inner-loop adaptation on Support Set
            const adaptation = this.adaptTask(task.support);

            // Compute Query Set loss and gradients with adapted parameters theta'_i
            const postEval = this.computeLossAndGrad(adaptation.adaptedWeights, task.query);
            totalPostAdaptQueryLoss += postEval.loss;

            // First-order MAML: approximate d(theta'_i)/d(theta) as Identity Matrix
            for (let d = 0; d < this.paramDim; d++) {
                metaGradAccumulator[d] += postEval.grad[d];
            }
        }

        const numTasks = taskBatch.length;
        const avgPreLoss = totalPreAdaptQueryLoss / numTasks;
        const avgPostLoss = totalPostAdaptQueryLoss / numTasks;

        // Apply outer-loop meta-gradient descent update
        for (let d = 0; d < this.paramDim; d++) {
            const avgGrad = metaGradAccumulator[d] / numTasks;
            this.metaTheta[d] -= this.metaBeta * avgGrad;
        }

        this.metaIteration++;
        const adaptationGain = avgPreLoss > 1e-6 ? ((avgPreLoss - avgPostLoss) / avgPreLoss) * 100 : 0;

        const metrics = {
            metaIteration: this.metaIteration,
            numTasks,
            avgPreAdaptQueryLoss: avgPreLoss,
            avgPostAdaptQueryLoss: avgPostLoss,
            adaptationGainPercent: Math.max(0, adaptationGain),
            normTheta: this.computeNorm(this.metaTheta)
        };

        this.metaLossHistory.push(avgPostLoss);
        this.adaptationSpeedupHistory.push(metrics.adaptationGainPercent);

        if (this.metaLossHistory.length > 500) {
            this.metaLossHistory.shift();
            this.adaptationSpeedupHistory.shift();
        }

        return metrics;
    }

    /**
     * Evaluates few-shot generalization performance on an unseen test task
     *
     * @param {Array<{x: Array<number>, y: number}>} supportSet
     * @param {Array<{x: Array<number>, y: number}>} querySet
     * @returns {Object} Zero-shot vs Few-shot accuracy and adaptation curves
     */
    evaluateFewShot(supportSet, querySet) {
        const zeroShotEval = this.computeLossAndGrad(this.metaTheta, querySet);
        const { adaptedWeights, initialLoss, adaptedLoss } = this.adaptTask(supportSet);
        const fewShotEval = this.computeLossAndGrad(adaptedWeights, querySet);

        return {
            zeroShotQueryLoss: zeroShotEval.loss,
            fewShotQueryLoss: fewShotEval.loss,
            improvementFactor: zeroShotEval.loss > 0 ? (zeroShotEval.loss / Math.max(1e-8, fewShotEval.loss)) : 1.0,
            adaptedWeights: Array.from(adaptedWeights)
        };
    }

    computeNorm(vec) {
        let sum = 0;
        for (let i = 0; i < vec.length; i++) sum += vec[i] * vec[i];
        return Math.sqrt(sum);
    }

    exportMetaParameters() {
        return {
            metaIteration: this.metaIteration,
            paramDim: this.paramDim,
            innerAlpha: this.innerAlpha,
            metaBeta: this.metaBeta,
            weights: Array.from(this.metaTheta)
        };
    }

    importMetaParameters(data) {
        if (!data || !data.weights) return;
        this.paramDim = data.paramDim || this.paramDim;
        this.innerAlpha = data.innerAlpha || this.innerAlpha;
        this.metaBeta = data.metaBeta || this.metaBeta;
        this.metaIteration = data.metaIteration || 0;
        this.metaTheta = new Float32Array(data.weights);
    }
}

module.exports = MetaLearningEngine;
