/**
 * NeuroSymbolicLogicVerifier.js
 *
 * Implements a Differentiable Neuro-Symbolic Logic Verification Engine.
 * Converts first-order logic and temporal safety specifications into continuous,
 * differentiable loss terms using fuzzy t-norms (Łukasiewicz, Product, and Gödel).
 *
 * Operators:
 * - Conjunction (AND): T(a, b) = a * b (Product) or max(0, a + b - 1) (Łukasiewicz)
 * - Disjunction (OR):  S(a, b) = a + b - a * b (Product) or min(1, a + b) (Łukasiewicz)
 * - Negation (NOT):    N(a) = 1 - a
 * - Implication (A -> B): I(a, b) = min(1, 1 - a + b)
 *
 * Safety Specifications:
 * - Speed Bounding:    phi_1 = forall t: speed(t) <= maxSpeed
 * - Boundary Defense:  phi_2 = forall t: distToBorder(t) >= minBorderDist
 * - Anti-Collision:    phi_3 = forall t, j != i: dist(agent_i, agent_j) >= safeRadius
 *
 * Mathematical Reference:
 * Marra et al. (JAIR 2021) "Relational Neural Machines"
 * Alshiekh et al. (AAAI 2018) "Safe Reinforcement Learning via Shielding"
 */

class NeuroSymbolicLogicVerifier {
    /**
     * @param {Object} options
     * @param {string} [options.tNorm='product'] - 'product' or 'lukasiewicz'
     * @param {number} [options.maxSpeed=25.0] - Safety ceiling for agent linear speed
     * @param {number} [options.minBorderDist=2.0] - Minimum arena boundary clearance
     * @param {number} [options.safeDistance=1.5] - Minimum pairwise agent proximity
     */
    constructor(options = {}) {
        this.tNorm = options.tNorm || 'product';
        this.maxSpeed = options.maxSpeed || 25.0;
        this.minBorderDist = options.minBorderDist || 2.0;
        this.safeDistance = options.safeDistance || 1.5;
    }

    // --- Fuzzy Logic Primitives ---

    and(a, b) {
        if (this.tNorm === 'lukasiewicz') {
            return Math.max(0.0, a + b - 1.0);
        }
        return a * b; // Product t-norm
    }

    or(a, b) {
        if (this.tNorm === 'lukasiewicz') {
            return Math.min(1.0, a + b);
        }
        return a + b - a * b; // Product t-conorm
    }

    not(a) {
        return Math.max(0.0, Math.min(1.0, 1.0 - a));
    }

    implies(a, b) {
        return Math.min(1.0, 1.0 - a + b);
    }

    /**
     * Sigmoidal continuous predicate evaluation: x <= threshold
     * Evaluates to ~1.0 when x <= threshold, smooth descent to ~0.0 when x > threshold
     */
    predicateLessEqual(val, threshold, sharpness = 5.0) {
        const diff = (threshold - val) * sharpness;
        return 1.0 / (1.0 + Math.exp(-diff));
    }

    /**
     * Sigmoidal continuous predicate evaluation: x >= threshold
     */
    predicateGreaterEqual(val, threshold, sharpness = 5.0) {
        const diff = (val - threshold) * sharpness;
        return 1.0 / (1.0 + Math.exp(-diff));
    }

    /**
     * Evaluates full temporal safety specification over an agent trajectory
     * Trajectory: Array of { t, pos: [x, y, z], vel: [vx, vy, vz], borderDist }
     * @returns {Object} { satisfied, truthValue, logicLoss, violationReport }
     */
    verifyTrajectory(trajectory, otherAgentsTrajectories = []) {
        if (!trajectory || trajectory.length === 0) {
            return { satisfied: true, truthValue: 1.0, logicLoss: 0.0, violations: [] };
        }

        let overallTruth = 1.0;
        const violations = [];

        for (let i = 0; i < trajectory.length; i++) {
            const step = trajectory[i];
            const vx = step.vel[0], vy = step.vel[1], vz = step.vel[2] || 0;
            const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);

            // Predicate 1: Speed within bound
            const pSpeed = this.predicateLessEqual(speed, this.maxSpeed);
            if (speed > this.maxSpeed) {
                violations.push({ t: step.t, rule: 'MAX_SPEED_EXCEEDED', value: speed, limit: this.maxSpeed });
            }

            // Predicate 2: Border distance within bound
            const borderDist = step.borderDist !== undefined ? step.borderDist : 10.0;
            const pBorder = this.predicateGreaterEqual(borderDist, this.minBorderDist);
            if (borderDist < this.minBorderDist) {
                violations.push({ t: step.t, rule: 'BORDER_PROXIMITY_HAZARD', value: borderDist, limit: this.minBorderDist });
            }

            // Predicate 3: Safe separation from other agents
            let pCollision = 1.0;
            if (otherAgentsTrajectories.length > 0) {
                for (const otherTraj of otherAgentsTrajectories) {
                    if (otherTraj[i]) {
                        const dx = step.pos[0] - otherTraj[i].pos[0];
                        const dy = step.pos[1] - otherTraj[i].pos[1];
                        const dz = (step.pos[2] || 0) - (otherTraj[i].pos[2] || 0);
                        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                        const pPair = this.predicateGreaterEqual(dist, this.safeDistance);
                        pCollision = this.and(pCollision, pPair);

                        if (dist < this.safeDistance) {
                            violations.push({ t: step.t, rule: 'INTER_AGENT_COLLISION', value: dist, limit: this.safeDistance });
                        }
                    }
                }
            }

            // Conjunction across all rules at step t
            const stepTruth = this.and(this.and(pSpeed, pBorder), pCollision);

            // Aggregation across time (universal quantification: forall t)
            overallTruth = this.and(overallTruth, stepTruth);
        }

        const logicLoss = 1.0 - overallTruth;

        return {
            satisfied: violations.length === 0 && overallTruth > 0.8,
            truthValue: overallTruth,
            logicLoss,
            violationCount: violations.length,
            violations
        };
    }
}

module.exports = NeuroSymbolicLogicVerifier;
