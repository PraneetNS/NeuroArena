/**
 * AdversarialDefenseValidator.js
 * Server-side authoritative validator for model robustness against adversarial input attacks.
 * Verifies that candidate neural architectures and weight submissions withstand bounded
 * L-infinity / L2 perturbations before awarding competitive seasonal MMR or corporate SLA signoffs.
 */

const crypto = require('crypto');

class AdversarialDefenseValidator {
    constructor(options = {}) {
        this.maxAllowedAccuracyDrop = options.maxAllowedAccuracyDrop || 0.35; // 35% drop max
        this.defaultEpsilon = options.defaultEpsilon || 0.05;
        this.minCleanAccuracy = options.minCleanAccuracy || 0.60;
        this.verificationSecret = options.verificationSecret || 'neuroarena-adversarial-cert-key-2026';
    }

    /**
     * Simulates forward pass for linear or multi-layer weights on input vector.
     */
    predict(weights, bias, input) {
        if (!Array.isArray(input)) return 0;
        let sum = bias || 0;
        for (let i = 0; i < input.length; i++) {
            sum += input[i] * (weights[i] || 0);
        }
        return sum >= 0 ? 1 : 0;
    }

    /**
     * Evaluates model accuracy on test dataset.
     */
    evaluateAccuracy(weights, bias, dataset) {
        if (!dataset || dataset.length === 0) return 0;
        let correct = 0;
        for (const sample of dataset) {
            const pred = this.predict(weights, bias, sample.x);
            if (pred === sample.y) correct++;
        }
        return correct / dataset.length;
    }

    /**
     * Generates FGSM perturbed dataset with perturbation bound epsilon.
     * x_adv = x + eps * sign(weights) for binary classification
     */
    generateAdversarialDataset(weights, dataset, epsilon = this.defaultEpsilon) {
        return dataset.map(sample => {
            const xAdv = sample.x.map((val, idx) => {
                const w = weights[idx] || 0;
                // Adversarial direction opposite to gradient for margin minimization
                const sign = sample.y === 1 ? (w > 0 ? -1 : 1) : (w > 0 ? 1 : -1);
                return val + epsilon * sign;
            });
            return { x: xAdv, y: sample.y };
        });
    }

    /**
     * Estimates empirical Lipschitz smoothness constant across sample pairs.
     */
    computeEmpiricalLipschitz(weights, bias, dataset) {
        if (!dataset || dataset.length < 2) return 0;
        let maxSlope = 0;
        const n = Math.min(dataset.length, 50);

        for (let i = 0; i < n - 1; i++) {
            for (let j = i + 1; j < n; j++) {
                const x1 = dataset[i].x;
                const x2 = dataset[j].x;

                let dx2 = 0;
                for (let k = 0; k < x1.length; k++) {
                    const diff = x1[k] - x2[k];
                    dx2 += diff * diff;
                }
                const dist = Math.sqrt(dx2);
                if (dist > 1e-6) {
                    const out1 = this.predict(weights, bias, x1);
                    const out2 = this.predict(weights, bias, x2);
                    const dy = Math.abs(out1 - out2);
                    const slope = dy / dist;
                    if (slope > maxSlope) maxSlope = slope;
                }
            }
        }
        return maxSlope;
    }

    /**
     * Validates submission robustness against adversarial perturbations.
     */
    validateRobustness(weights, bias, validationDataset, epsilon = this.defaultEpsilon) {
        const cleanAcc = this.evaluateAccuracy(weights, bias, validationDataset);
        const advDataset = this.generateAdversarialDataset(weights, validationDataset, epsilon);
        const advAcc = this.evaluateAccuracy(weights, bias, advDataset);

        const accuracyDrop = cleanAcc > 0 ? (cleanAcc - advAcc) / cleanAcc : 1.0;
        const lipschitzBound = this.computeEmpiricalLipschitz(weights, bias, validationDataset);
        const robustnessScore = Math.max(0, Math.min(1, advAcc / Math.max(0.01, cleanAcc)));

        const passedCleanCheck = cleanAcc >= this.minCleanAccuracy;
        const passedRobustnessCheck = accuracyDrop <= this.maxAllowedAccuracyDrop;
        const isCertified = passedCleanCheck && passedRobustnessCheck;

        const report = {
            cleanAccuracy: Number(cleanAcc.toFixed(4)),
            adversarialAccuracy: Number(advAcc.toFixed(4)),
            accuracyDrop: Number(accuracyDrop.toFixed(4)),
            epsilon,
            lipschitzBound: Number(lipschitzBound.toFixed(4)),
            robustnessScore: Number(robustnessScore.toFixed(4)),
            isCertified,
            rejectionReason: !passedCleanCheck
                ? 'CLEAN_ACCURACY_BELOW_THRESHOLD'
                : (!passedRobustnessCheck ? 'BRITTLE_MODEL_VULNERABILITY' : null)
        };

        if (isCertified) {
            report.certificateSignature = crypto
                .createHmac('sha256', this.verificationSecret)
                .update(`${cleanAcc}:${advAcc}:${robustnessScore}:${epsilon}`)
                .digest('hex');
        }

        return report;
    }
}

module.exports = AdversarialDefenseValidator;
