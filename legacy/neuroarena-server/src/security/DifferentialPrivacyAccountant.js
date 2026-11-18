/**
 * DifferentialPrivacyAccountant.js
 * Implements Renyi Differential Privacy (RDP) accounting, dynamic L2-norm gradient clipping,
 * calibrated Gaussian noise injection, and client cumulative privacy budget tracking (epsilon, delta).
 */

class DifferentialPrivacyAccountant {
    constructor(options = {}) {
        this.targetDelta = options.targetDelta || 1e-5;
        this.maxEpsilon = options.maxEpsilon || 8.0;
        this.defaultClipNorm = options.defaultClipNorm || 1.0;
        this.orders = options.orders || [1.5, 2, 2.5, 3, 4, 5, 8, 10, 16, 32, 64];

        // Map: clientId -> { cumulativeRDP: Map<alpha, rdpSum>, stepCount: number, spentEpsilon: number }
        this.clientBudgets = new Map();
    }

    /**
     * Clips gradient vector to maximum L2-norm threshold C.
     * g_clipped = g / max(1, ||g||_2 / C)
     */
    clipL2Norm(vector, clipNorm = this.defaultClipNorm) {
        if (!Array.isArray(vector) || vector.length === 0) return { clipped: [], norm: 0, scale: 1 };
        
        let sumSq = 0;
        for (let i = 0; i < vector.length; i++) {
            sumSq += vector[i] * vector[i];
        }
        const norm = Math.sqrt(sumSq);
        const scale = norm > clipNorm ? (clipNorm / norm) : 1.0;

        const clipped = new Array(vector.length);
        for (let i = 0; i < vector.length; i++) {
            clipped[i] = vector[i] * scale;
        }

        return { clipped, norm, scale };
    }

    /**
     * Adds calibrated Gaussian noise to a vector based on noise multiplier sigma and clipping norm C:
     * sigma_actual = sigma * C
     */
    injectGaussianNoise(vector, noiseMultiplier, clipNorm = this.defaultClipNorm) {
        const stdDev = noiseMultiplier * clipNorm;
        const noisy = new Array(vector.length);

        for (let i = 0; i < vector.length; i += 2) {
            // Box-Muller transform for standard normal variates
            const u1 = Math.max(1e-12, Math.random());
            const u2 = Math.random();
            const radius = Math.sqrt(-2.0 * Math.log(u1));
            const theta = 2.0 * Math.PI * u2;

            const z0 = radius * Math.cos(theta);
            const z1 = radius * Math.sin(theta);

            noisy[i] = vector[i] + z0 * stdDev;
            if (i + 1 < vector.length) {
                noisy[i + 1] = vector[i + 1] + z1 * stdDev;
            }
        }

        return noisy;
    }

    /**
     * Computes RDP step cost for Gaussian mechanism with subsampling ratio q and noise multiplier sigma:
     * R_alpha = alpha / (2 * sigma^2) for basic Gaussian mechanism.
     */
    computeStepRDP(alpha, noiseMultiplier, subsamplingRatio = 1.0) {
        if (noiseMultiplier <= 0) return Infinity;
        // Subsampled Gaussian mechanism RDP approximation
        const baseRDP = alpha / (2.0 * noiseMultiplier * noiseMultiplier);
        return subsamplingRatio * subsamplingRatio * baseRDP;
    }

    /**
     * Updates cumulative privacy expenditure for a client and computes current epsilon at target delta.
     */
    recordStep(clientId, noiseMultiplier, subsamplingRatio = 1.0) {
        if (!this.clientBudgets.has(clientId)) {
            const rdpMap = new Map();
            for (const alpha of this.orders) {
                rdpMap.set(alpha, 0);
            }
            this.clientBudgets.set(clientId, {
                cumulativeRDP: rdpMap,
                stepCount: 0,
                spentEpsilon: 0,
                exhausted: false
            });
        }

        const clientData = this.clientBudgets.get(clientId);
        clientData.stepCount++;

        // Accumulate RDP for each order
        for (const alpha of this.orders) {
            const stepRDP = this.computeStepRDP(alpha, noiseMultiplier, subsamplingRatio);
            const currentTotal = clientData.cumulativeRDP.get(alpha) || 0;
            clientData.cumulativeRDP.set(alpha, currentTotal + stepRDP);
        }

        // Convert RDP to (epsilon, delta) using: eps = min_alpha ( R_alpha + ln(1/delta) / (alpha - 1) )
        let minEpsilon = Infinity;
        for (const alpha of this.orders) {
            if (alpha <= 1) continue;
            const totalRDP = clientData.cumulativeRDP.get(alpha);
            const epsCandidate = totalRDP + Math.log(1.0 / this.targetDelta) / (alpha - 1.0);
            if (epsCandidate < minEpsilon) {
                minEpsilon = epsCandidate;
            }
        }

        clientData.spentEpsilon = minEpsilon;
        if (minEpsilon >= this.maxEpsilon) {
            clientData.exhausted = true;
        }

        return {
            clientId,
            stepCount: clientData.stepCount,
            spentEpsilon: minEpsilon,
            targetDelta: this.targetDelta,
            exhausted: clientData.exhausted,
            remainingBudget: Math.max(0, this.maxEpsilon - minEpsilon)
        };
    }

    /**
     * Checks if a client has exceeded their privacy budget.
     */
    isBudgetExhausted(clientId) {
        const clientData = this.clientBudgets.get(clientId);
        return clientData ? clientData.exhausted : false;
    }

    getClientStatus(clientId) {
        return this.clientBudgets.get(clientId) || null;
    }

    resetClient(clientId) {
        this.clientBudgets.delete(clientId);
    }
}

module.exports = DifferentialPrivacyAccountant;
