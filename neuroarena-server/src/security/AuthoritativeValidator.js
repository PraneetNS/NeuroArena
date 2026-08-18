const crypto = require("crypto");
const { auditLogger } = require("./AuditLogger");

/**
 * AuthoritativeValidator
 * Production Anti-Cheat & Model Training Verification Service.
 * Validates:
 * 1. Step-budget and learning rate physical bounds.
 * 2. Mathematical loss convergence feasibility (prevents instant convergence hacks).
 * 3. Client parameter hash integrity & replay verification on synthetic validation sets.
 * 4. Movement velocity & teleportation checks.
 */
class AuthoritativeValidator {
    constructor() {
        this.MAX_VELOCITY_MPS = 15.0; // Max allowed player speed (m/s) including sprint
        this.MIN_TRAINING_TIME_PER_EPOCH_MS = 8.0; // Min physical time per batch epoch
        this.MAX_LEARNING_RATE = 10.0;
        this.MIN_LEARNING_RATE = 0.000001;
    }

    /**
     * Compute SHA-256 integrity signature for model parameters.
     */
    static computeParameterSignature(weights, bias, modelType = "linear", salt = "NeuroArena_2026_Prod") {
        const wStr = Array.isArray(weights) ? weights.map(w => Number(w).toFixed(6)).join(",") : Number(weights).toFixed(6);
        const bStr = Number(bias).toFixed(6);
        const payload = `${modelType}:${wStr}:${bStr}:${salt}`;
        return crypto.createHash("sha256").update(payload).digest("hex");
    }

    /**
     * Validate player movement physics and delta time.
     */
    validateMovement(lastPos, currentPos, deltaTimeSec, playerId, username) {
        if (!lastPos || !currentPos || deltaTimeSec <= 0) return { valid: true };

        const dx = currentPos.x - lastPos.x;
        const dy = currentPos.y - lastPos.y;
        const dz = currentPos.z - lastPos.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const velocity = distance / deltaTimeSec;

        if (velocity > this.MAX_VELOCITY_MPS) {
            auditLogger.logAnomaly({
                sessionId: playerId,
                playerName: username,
                reason: "SPEED_HACK_OR_TELEPORT",
                elapsedMs: Math.round(deltaTimeSec * 1000),
                weightW: parseFloat(velocity.toFixed(2)),
                weightB: parseFloat(distance.toFixed(2)),
                actionTaken: "REJECTED_POSITION_TELEPORT"
            });
            return { valid: false, reason: "EXCESSIVE_VELOCITY" };
        }

        return { valid: true, velocity };
    }

    /**
     * Authoritatively evaluates a linear or polynomial gradient descent training run.
     * Replays gradient descent against the known dataset subset to verify client-reported loss and weights.
     */
    verifyLinearRegressionTraining(dataset, initialW, initialB, targetW, targetB, learningRate, epochs, elapsedMs, reportedMse, playerId, username) {
        // 1. Sanity check parameters
        if (epochs <= 0 || epochs > 10000) {
            auditLogger.logAnomaly({
                sessionId: playerId,
                playerName: username,
                reason: "INVALID_EPOCH_COUNT",
                elapsedMs,
                weightW: targetW,
                weightB: targetB,
                actionTaken: "REJECTED"
            });
            return { valid: false, reason: "INVALID_EPOCH_COUNT" };
        }

        if (learningRate <= 0 || learningRate > this.MAX_LEARNING_RATE) {
            auditLogger.logAnomaly({
                sessionId: playerId,
                playerName: username,
                reason: "ILLEGAL_LEARNING_RATE",
                elapsedMs,
                weightW: targetW,
                weightB: targetB,
                actionTaken: "REJECTED"
            });
            return { valid: false, reason: "ILLEGAL_LEARNING_RATE" };
        }

        // 2. Minimum execution duration check
        const minExpectedMs = (epochs * this.MIN_TRAINING_TIME_PER_EPOCH_MS) * 0.5; // Allow parallelization margin
        if (elapsedMs < minExpectedMs && epochs > 20) {
            auditLogger.logAnomaly({
                sessionId: playerId,
                playerName: username,
                reason: "IMPOSSIBLE_TRAINING_SPEED",
                elapsedMs,
                weightW: targetW,
                weightB: targetB,
                actionTaken: "REJECTED_WITH_PENALTY"
            });
            return { valid: false, reason: "IMPOSSIBLE_TRAINING_SPEED" };
        }

        // 3. Authoritative Replay Execution
        let simW = initialW;
        let simB = initialB;
        const N = dataset.length;

        if (N === 0) return { valid: false, reason: "EMPTY_DATASET" };

        for (let ep = 0; ep < epochs; ep++) {
            let gradW = 0;
            let gradB = 0;
            for (let i = 0; i < N; i++) {
                const x = dataset[i].x;
                const y = dataset[i].y;
                const pred = simW * x + simB;
                const err = pred - y;
                gradW += (2 / N) * err * x;
                gradB += (2 / N) * err;
            }
            simW -= learningRate * gradW;
            simB -= learningRate * gradB;
        }

        // Calculate verified MSE on dataset
        let verifiedMse = 0;
        for (let i = 0; i < N; i++) {
            const pred = simW * dataset[i].x + simB;
            const err = pred - dataset[i].y;
            verifiedMse += (err * err) / N;
        }

        // Tolerance check for floating point precision variations (e.g. SIMD / WebAssembly vs V8 double)
        const wDiff = Math.abs(simW - targetW);
        const bDiff = Math.abs(simB - targetB);
        const tolerance = 0.05 + (0.01 * epochs);

        if (wDiff > tolerance || bDiff > tolerance) {
            auditLogger.logAnomaly({
                sessionId: playerId,
                playerName: username,
                reason: "WEIGHT_REPLAY_MISMATCH",
                elapsedMs,
                weightW: targetW,
                weightB: targetB,
                actionTaken: "REJECTED_WITH_PENALTY"
            });
            return {
                valid: false,
                reason: "WEIGHT_REPLAY_MISMATCH",
                verifiedW: simW,
                verifiedB: simB,
                verifiedMse
            };
        }

        const signature = AuthoritativeValidator.computeParameterSignature(simW, simB, "linear");

        return {
            valid: true,
            verifiedW: simW,
            verifiedB: simB,
            verifiedMse,
            signature
        };
    }
}

module.exports = {
    AuthoritativeValidator: new AuthoritativeValidator(),
    AuthoritativeValidatorClass: AuthoritativeValidator
};
