/**
 * ⚡ NeuroArena: Autonomous Bot Arena Policy Engine
 *
 * Implements neural policy evaluation and kinematics simulation for autonomous bots:
 * - Parity with Unity C#'s AutonomousBotArena.EvaluateNeuralPolicy
 * - 4-element sensor raycast inputs (targetDeltaX, targetDeltaZ, obstacleProximity, currentSpeed)
 * - 2-layer MLP policy execution with ReLU non-linearities
 * - 2D vehicle kinematics, obstacle avoidance collision physics, and resource collection
 */

class BotArenaPolicyEngine {
    constructor(arenaRadius = 35) {
        this.arenaRadius = arenaRadius;
    }

    /**
     * Evaluates a 2-layer neural network policy forward pass.
     * Inputs: [targetDeltaX, targetDeltaZ, obstacleProximity, currentSpeed]
     * Weights: W1 (4x8), b1 (8), W2 (8x3), b2 (3)
     */
    static evaluateNeuralPolicy(observation, weights) {
        const { targetDeltaX, targetDeltaZ, obstacleProximity, currentSpeed } = observation;
        const input = [targetDeltaX, targetDeltaZ, obstacleProximity, currentSpeed];

        // Default heuristic policy if custom weights are missing or malformed
        if (!weights || !weights.W1 || !weights.b1 || !weights.W2 || !weights.b2) {
            return BotArenaPolicyEngine.evaluateHeuristicPolicy(observation);
        }

        const { W1, b1, W2, b2 } = weights;

        // Layer 1: Dense + ReLU (4 -> 8)
        const hiddenDim = b1.length;
        const hidden = new Array(hiddenDim).fill(0);
        for (let j = 0; j < hiddenDim; j++) {
            let sum = b1[j];
            for (let i = 0; i < 4; i++) {
                sum += input[i] * (W1[i] ? W1[i][j] : 0);
            }
            hidden[j] = Math.max(0, sum); // ReLU
        }

        // Layer 2: Output Dense (8 -> 3: [steer, throttle, brake])
        const out = [b2[0] || 0, b2[1] || 0, b2[2] || 0];
        for (let k = 0; k < 3; k++) {
            for (let j = 0; j < hiddenDim; j++) {
                out[k] += hidden[j] * (W2[j] ? W2[j][k] : 0);
            }
        }

        // Output mappings
        // out[0]: steerAngle (-45 to +45 deg via Tanh)
        const steerAngle = Math.tanh(out[0]) * 45.0;
        // out[1]: throttle (0 to 1 via Sigmoid)
        const throttle = 1.0 / (1.0 + Math.exp(-Math.max(-10, Math.min(10, out[1]))));
        // out[2]: isBraking (Sigmoid > 0.55)
        const brakeProb = 1.0 / (1.0 + Math.exp(-Math.max(-10, Math.min(10, out[2]))));
        const isBraking = brakeProb > 0.55;

        return {
            steerAngle,
            throttle,
            isBraking
        };
    }

    /**
     * Fallback expert heuristic policy when no neural weights are provided.
     */
    static evaluateHeuristicPolicy(observation) {
        const { targetDeltaX, targetDeltaZ, obstacleProximity } = observation;

        let steerAngle = 0;
        let throttle = 0.8;
        let isBraking = false;

        // Steer toward target
        const targetAngle = Math.atan2(targetDeltaX, targetDeltaZ) * (180 / Math.PI);
        steerAngle = Math.max(-45, Math.min(45, targetAngle));

        // Obstacle avoidance reflex
        if (obstacleProximity < 3.0) {
            steerAngle = (steerAngle >= 0) ? -45 : 45;
            throttle = 0.3;
            if (obstacleProximity < 1.5) {
                isBraking = true;
            }
        }

        return { steerAngle, throttle, isBraking };
    }

    /**
     * Advances kinematic vehicle physics by deltaSec.
     */
    stepKinematics(bot, action, deltaSec = 0.05) {
        const { steerAngle, throttle, isBraking } = action;

        // Angular rotation
        bot.steerAngle = steerAngle;
        bot.rotationY = (bot.rotationY + steerAngle * deltaSec) % 360;

        // Linear Acceleration / Braking
        const maxSpeed = 7.0;
        const accelRate = 4.5;
        const dragRate = 2.0;
        const brakeRate = 8.0;

        let speed = bot.speed || 0;
        if (isBraking) {
            speed = Math.max(0, speed - brakeRate * deltaSec);
        } else {
            speed += (throttle * accelRate - dragRate) * deltaSec;
            speed = Math.max(0, Math.min(maxSpeed, speed));
        }
        bot.speed = speed;
        bot.throttle = throttle;
        bot.isBraking = isBraking;

        // Position update
        const rad = (bot.rotationY * Math.PI) / 180;
        bot.x += Math.sin(rad) * speed * deltaSec;
        bot.z += Math.cos(rad) * speed * deltaSec;

        // Arena boundary constraint
        const distFromCenter = Math.sqrt(bot.x * bot.x + bot.z * bot.z);
        if (distFromCenter > this.arenaRadius) {
            const angle = Math.atan2(bot.z, bot.x);
            bot.x = Math.cos(angle) * this.arenaRadius;
            bot.z = Math.sin(angle) * this.arenaRadius;
            bot.speed *= 0.5; // Wall bounce drag
        }

        return bot;
    }

    /**
     * Generates standard default weights for 2-layer MLP (4 -> 8 -> 3).
     */
    static createDefaultWeights() {
        const W1 = [];
        for (let i = 0; i < 4; i++) {
            W1.push([0.2, -0.1, 0.4, 0.1, -0.3, 0.25, 0.15, -0.2]);
        }
        const b1 = [0.05, -0.05, 0.1, 0.0, -0.1, 0.05, 0.0, -0.05];

        const W2 = [];
        for (let j = 0; j < 8; j++) {
            W2.push([0.3, 0.4, -0.2]);
        }
        const b2 = [0.0, 0.5, -0.5];

        return { W1, b1, W2, b2 };
    }
}

module.exports = {
    BotArenaPolicyEngine
};
