/**
 * AsynchronousStalenessCompensator.js
 * Asynchronous Federated Learning staleness compensation engine with Polyak-Ruppert
 * parameter averaging and cosine directional alignment verification.
 * 
 * Attenuates delayed gradients from heterogeneous edge nodes (Unity, WebGPU, mobile)
 * to prevent model oscillation and preserve optimization stability.
 */

class AsynchronousStalenessCompensator {
    /**
     * @param {Object} [options]
     * @param {number} [options.decayExponent=0.5] Alpha decay exponent in (1 + tau)^(-alpha)
     * @param {number} [options.maxAllowedStaleness=30] Maximum delay before gradient is quarantined
     * @param {number} [options.momentumBeta=0.9] Polyak-Ruppert moving average parameter
     * @param {number} [options.directionalThreshold=-0.2] Cosine similarity rejection threshold
     */
    constructor(options = {}) {
        this.decayExponent = options.decayExponent !== undefined ? options.decayExponent : 0.5;
        this.maxAllowedStaleness = options.maxAllowedStaleness || 30;
        this.momentumBeta = options.momentumBeta !== undefined ? options.momentumBeta : 0.9;
        this.directionalThreshold = options.directionalThreshold !== undefined ? options.directionalThreshold : -0.2;

        // Current server global clock/version
        this.currentVersion = 0;

        // Polyak-Ruppert averaged parameters: key -> Float64Array
        this.polyakParameters = new Map();
        // Running momentum vector for directional consistency checks
        this.runningMomentum = new Map();

        // Metrics
        this.metrics = {
            totalUpdatesProcessed: 0,
            updatesAccepted: 0,
            updatesQuarantined: 0,
            averageStaleness: 0,
            maxStalenessObserved: 0
        };
    }

    /**
     * Computes the staleness attenuation factor lambda(tau) = (1 + tau)^(-decayExponent).
     * @param {number} tau Staleness delay (currentVersion - clientBaseVersion)
     * @returns {number} Scalar in range (0, 1]
     */
    computeDampingFactor(tau) {
        if (tau <= 0) return 1.0;
        return Math.pow(1.0 + tau, -this.decayExponent);
    }

    /**
     * Computes cosine similarity between two vectors.
     */
    cosineSimilarity(vecA, vecB) {
        if (!vecA || !vecB || vecA.length !== vecB.length) return 1.0;
        let dot = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dot += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        const denom = Math.sqrt(normA) * Math.sqrt(normB);
        return denom > 1e-9 ? dot / denom : 1.0;
    }

    /**
     * Evaluates and compensates an incoming client gradient update.
     * @param {string} layerId Identifier for parameter layer
     * @param {Array<number>} clientGradient Raw gradient submitted by client
     * @param {number} clientBaseVersion Global version client trained on
     * @param {number} learningRate Base server learning rate
     * @returns {{ accepted: boolean, compensatedGradient: Array<number>, staleness: number, dampingFactor: number, reason: string }}
     */
    processGradient(layerId, clientGradient, clientBaseVersion, learningRate = 0.01) {
        this.metrics.totalUpdatesProcessed++;
        const tau = Math.max(0, this.currentVersion - clientBaseVersion);

        // Update staleness telemetry
        this.metrics.maxStalenessObserved = Math.max(this.metrics.maxStalenessObserved, tau);
        this.metrics.averageStaleness = (
            (this.metrics.averageStaleness * (this.metrics.totalUpdatesProcessed - 1) + tau) /
            this.metrics.totalUpdatesProcessed
        );

        // 1. Check excessive staleness quarantine
        if (tau > this.maxAllowedStaleness) {
            this.metrics.updatesQuarantined++;
            return {
                accepted: false,
                compensatedGradient: null,
                staleness: tau,
                dampingFactor: 0,
                reason: `STALENESS_EXCEEDED_MAX_TOLERANCE (${tau} > ${this.maxAllowedStaleness})`
            };
        }

        // 2. Compute staleness damping factor
        const damping = this.computeDampingFactor(tau);

        // 3. Directional alignment check against running momentum
        const momentum = this.runningMomentum.get(layerId);
        if (momentum && tau >= 1) {
            const similarity = this.cosineSimilarity(clientGradient, momentum);
            if (similarity < this.directionalThreshold) {
                this.metrics.updatesQuarantined++;
                return {
                    accepted: false,
                    compensatedGradient: null,
                    staleness: tau,
                    dampingFactor: damping,
                    reason: `DIRECTIONAL_DIVERGENCE_DETECTED (Cosine: ${similarity.toFixed(3)})`
                };
            }
        }

        // 4. Apply staleness damping
        const compensated = new Array(clientGradient.length);
        for (let i = 0; i < clientGradient.length; i++) {
            compensated[i] = clientGradient[i] * damping;
        }

        // 5. Update running momentum vector for the layer
        if (!momentum || momentum.length !== clientGradient.length) {
            this.runningMomentum.set(layerId, new Float64Array(compensated));
        } else {
            for (let i = 0; i < momentum.length; i++) {
                momentum[i] = 0.9 * momentum[i] + 0.1 * compensated[i];
            }
        }

        this.metrics.updatesAccepted++;
        return {
            accepted: true,
            compensatedGradient: compensated,
            staleness: tau,
            dampingFactor: damping,
            effectiveLearningRate: learningRate * damping,
            reason: 'ACCEPTED'
        };
    }

    /**
     * Applies compensated gradient to parameters and updates Polyak-Ruppert running average.
     * @param {string} layerId
     * @param {Array<number>} currentWeights
     * @param {Array<number>} compensatedGradient
     * @param {number} learningRate
     * @returns {Array<number>} Updated model weights
     */
    applyUpdate(layerId, currentWeights, compensatedGradient, learningRate = 0.01) {
        const updated = new Array(currentWeights.length);
        for (let i = 0; i < currentWeights.length; i++) {
            updated[i] = currentWeights[i] - (learningRate * compensatedGradient[i]);
        }

        // Update Polyak-Ruppert moving average
        let polyak = this.polyakParameters.get(layerId);
        if (!polyak || polyak.length !== updated.length) {
            polyak = new Float64Array(updated);
            this.polyakParameters.set(layerId, polyak);
        } else {
            for (let i = 0; i < updated.length; i++) {
                polyak[i] = (this.momentumBeta * polyak[i]) + ((1 - this.momentumBeta) * updated[i]);
            }
        }

        this.currentVersion++;
        return updated;
    }

    /**
     * Returns the Polyak-Ruppert smoothed parameters for evaluation or inference.
     * @param {string} layerId
     * @returns {Array<number>|null}
     */
    getPolyakWeights(layerId) {
        const polyak = this.polyakParameters.get(layerId);
        return polyak ? Array.from(polyak) : null;
    }

    /**
     * Exports current status and telemetry.
     */
    getTelemetry() {
        return {
            currentVersion: this.currentVersion,
            metrics: { ...this.metrics },
            trackedLayers: Array.from(this.polyakParameters.keys())
        };
    }
}

module.exports = AsynchronousStalenessCompensator;
