/**
 * CurriculumDistillationEngine.js
 * Teacher-Student Knowledge Distillation Engine with Temperature-Scaled KL Divergence
 * and intermediate feature hint loss for compact edge policy compression.
 * 
 * Distills heavy champion biome models into ultra-compact, high-framerate student neural policies
 * with dynamic curriculum temperature annealing.
 */

class CurriculumDistillationEngine {
    /**
     * @param {Object} [options]
     * @param {number} [options.baseTemperature=3.0] Base distillation temperature T
     * @param {number} [options.alpha=0.6] Balance weight: alpha * L_KD + (1 - alpha) * L_CE
     * @param {number} [options.hintLossWeight=0.15] Intermediate feature representation alignment weight
     */
    constructor(options = {}) {
        this.baseTemperature = options.baseTemperature || 3.0;
        this.alpha = options.alpha !== undefined ? options.alpha : 0.6;
        this.hintLossWeight = options.hintLossWeight !== undefined ? options.hintLossWeight : 0.15;

        // Telemetry
        this.distillationHistory = [];
    }

    /**
     * Computes temperature-scaled softmax over logits.
     * @param {Array<number>} logits
     * @param {number} temperature
     * @returns {Array<number>} Probability distribution
     */
    softmaxWithTemperature(logits, temperature = 1.0) {
        const T = Math.max(0.1, temperature);
        const maxLogit = Math.max(...logits);
        const exps = logits.map(z => Math.exp((z - maxLogit) / T));
        const sumExp = exps.reduce((acc, val) => acc + val, 0);
        return exps.map(v => v / (sumExp || 1e-9));
    }

    /**
     * Computes discrete Kullback-Leibler Divergence: D_KL(P || Q) = Sum_i P(i) * log(P(i) / Q(i))
     * @param {Array<number>} p Target distribution (Teacher)
     * @param {Array<number>} q Approximating distribution (Student)
     * @returns {number}
     */
    computeKLDivergence(p, q) {
        let kl = 0;
        for (let i = 0; i < p.length; i++) {
            const pVal = Math.max(1e-12, p[i]);
            const qVal = Math.max(1e-12, q[i]);
            kl += pVal * Math.log(pVal / qVal);
        }
        return Math.max(0, kl);
    }

    /**
     * Computes categorical cross-entropy loss against hard ground truth label index.
     * @param {Array<number>} studentSoftmaxProbabilities
     * @param {number} targetLabelIndex
     * @returns {number}
     */
    computeHardLoss(studentSoftmaxProbabilities, targetLabelIndex) {
        const prob = Math.max(1e-12, studentSoftmaxProbabilities[targetLabelIndex] || 1e-12);
        return -Math.log(prob);
    }

    /**
     * Computes hint loss (mean squared error between normalized hidden features)
     * @param {Array<number>} teacherFeature
     * @param {Array<number>} studentFeature
     * @returns {number}
     */
    computeHintLoss(teacherFeature, studentFeature) {
        if (!teacherFeature || !studentFeature || teacherFeature.length !== studentFeature.length) {
            return 0;
        }
        let sse = 0;
        for (let i = 0; i < teacherFeature.length; i++) {
            const diff = teacherFeature[i] - studentFeature[i];
            sse += diff * diff;
        }
        return sse / teacherFeature.length;
    }

    /**
     * Dynamic curriculum temperature annealing:
     * High temperature in early biomes (broad multi-action entropy),
     * sharp lower temperature in advanced biomes (precise execution).
     * @param {number} biomeTier Current biome difficulty index (0 to 5)
     * @returns {number}
     */
    getCurriculumTemperature(biomeTier = 0) {
        // Linear anneal from baseTemperature down to 1.5 at tier 5
        const annealed = this.baseTemperature - (biomeTier * 0.3);
        return Math.max(1.2, annealed);
    }

    /**
     * Performs a distillation evaluation step between teacher logits and student logits.
     * @param {Object} input
     * @param {Array<number>} input.teacherLogits
     * @param {Array<number>} input.studentLogits
     * @param {number} input.groundTruthAction
     * @param {Array<number>} [input.teacherFeature]
     * @param {Array<number>} [input.studentFeature]
     * @param {number} [input.biomeTier=0]
     * @returns {Object} Distillation loss metrics and student gradient feedback
     */
    distillStep(input) {
        const { teacherLogits, studentLogits, groundTruthAction, teacherFeature, studentFeature, biomeTier = 0 } = input;

        const T = this.getCurriculumTemperature(biomeTier);

        // 1. Soft probabilities with temperature
        const pTeacher = this.softmaxWithTemperature(teacherLogits, T);
        const pStudent = this.softmaxWithTemperature(studentLogits, T);

        // 2. Standard probabilities (T = 1.0) for hard loss
        const pStudentHard = this.softmaxWithTemperature(studentLogits, 1.0);

        // 3. Loss computations
        const klLoss = this.computeKLDivergence(pTeacher, pStudent);
        const softLoss = (T * T) * klLoss; // Scaled by T^2 as per Hinton et al.
        const hardLoss = this.computeHardLoss(pStudentHard, groundTruthAction);
        const hintLoss = this.computeHintLoss(teacherFeature, studentFeature);

        const totalLoss = (this.alpha * softLoss) + ((1.0 - this.alpha) * hardLoss) + (this.hintLossWeight * hintLoss);

        // 4. Gradient of soft loss w.r.t student logits: (p_S - p_T) * T
        const studentLogitGradients = new Array(studentLogits.length);
        for (let i = 0; i < studentLogits.length; i++) {
            const softGrad = (pStudent[i] - pTeacher[i]) * T;
            const hardGrad = (pStudentHard[i] - (i === groundTruthAction ? 1.0 : 0.0));
            studentLogitGradients[i] = (this.alpha * softGrad) + ((1.0 - this.alpha) * hardGrad);
        }

        const metrics = {
            temperature: T,
            softLoss,
            hardLoss,
            hintLoss,
            totalLoss,
            klDivergence: klLoss,
            studentLogitGradients,
            timestamp: Date.now()
        };

        this.distillationHistory.push({
            totalLoss,
            klDivergence: klLoss,
            temperature: T
        });

        if (this.distillationHistory.length > 500) {
            this.distillationHistory.shift();
        }

        return metrics;
    }

    /**
     * Returns compression ratio and summary metrics between teacher and student architectures.
     * @param {number} teacherParamCount
     * @param {number} studentParamCount
     */
    evaluateCompressionProfile(teacherParamCount, studentParamCount) {
        const compressionRatio = teacherParamCount / Math.max(1, studentParamCount);
        const memorySavingsPercent = ((1 - (studentParamCount / teacherParamCount)) * 100).toFixed(1);

        return {
            teacherParamCount,
            studentParamCount,
            compressionRatio: Number(compressionRatio.toFixed(2)),
            memorySavingsPercent: `${memorySavingsPercent}%`,
            recentAverageLoss: this.getAverageLoss()
        };
    }

    getAverageLoss() {
        if (this.distillationHistory.length === 0) return 0;
        const sum = this.distillationHistory.reduce((acc, h) => acc + h.totalLoss, 0);
        return sum / this.distillationHistory.length;
    }
}

module.exports = CurriculumDistillationEngine;
