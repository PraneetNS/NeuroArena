/**
 * CounterfactualRegretSolver.js
 * Server-side Multi-Agent Reinforcement Learning (MARL) Counterfactual Regret Minimization (CFR/CFR+)
 * solver for 2-4 agent competitive and cooperative biome games.
 * 
 * Computes information set counterfactual values, regret-matching strategy profiles,
 * average strategy convergence towards Nash equilibrium, and game-theoretic exploitability metrics.
 */

class CounterfactualRegretSolver {
    /**
     * @param {Object} options
     * @param {Array<string>} [options.actionNames] Names of tactical actions
     * @param {Array<Array<number>>} [options.payoffMatrix] Payoff matrix for 2-player normal-form slice
     * @param {number} [options.explorationSmoothing=0.01] Epsilon smoothing for exploration
     * @param {boolean} [options.useCFRPlus=true] Enable CFR+ (floor cumulative regrets at zero)
     */
    constructor(options = {}) {
        this.actionNames = options.actionNames || ['Harvester', 'Flanker', 'Defender', 'Disruptor'];
        this.numActions = this.actionNames.length;
        this.explorationSmoothing = options.explorationSmoothing !== undefined ? options.explorationSmoothing : 0.01;
        this.useCFRPlus = options.useCFRPlus !== undefined ? options.useCFRPlus : true;

        // Default 4x4 zero-sum rock-paper-scissors-lizard style matrix if not provided
        // Payoffs are from perspective of Player 1 (Row Player)
        this.payoffMatrixP1 = options.payoffMatrix || [
            [0, -1.5, 1.0, 0.5],   // Harvester vs [Harvester, Flanker, Defender, Disruptor]
            [1.5, 0, -1.0, 1.2],   // Flanker vs ...
            [-1.0, 1.0, 0, -0.8],  // Defender vs ...
            [-0.5, -1.2, 0.8, 0]   // Disruptor vs ...
        ];

        // Cumulative regrets: [playerIndex][actionIndex]
        this.cumulativeRegrets = [
            new Float64Array(this.numActions),
            new Float64Array(this.numActions)
        ];

        // Cumulative strategy sum across iterations: [playerIndex][actionIndex]
        this.strategySum = [
            new Float64Array(this.numActions),
            new Float64Array(this.numActions)
        ];

        // Iteration counter
        this.iterations = 0;
    }

    /**
     * Obtains the current regret-matching strategy for a player.
     * @param {number} player 0 for P1 (Row), 1 for P2 (Column)
     * @returns {Float64Array} Normalized action probabilities
     */
    getStrategy(player) {
        const regrets = this.cumulativeRegrets[player];
        const strategy = new Float64Array(this.numActions);
        let positiveRegretSum = 0;

        for (let a = 0; a < this.numActions; a++) {
            if (regrets[a] > 0) {
                strategy[a] = regrets[a];
                positiveRegretSum += regrets[a];
            } else {
                strategy[a] = 0;
            }
        }

        for (let a = 0; a < this.numActions; a++) {
            if (positiveRegretSum > 1e-9) {
                strategy[a] /= positiveRegretSum;
            } else {
                strategy[a] = 1.0 / this.numActions;
            }

            // Apply epsilon exploration smoothing
            strategy[a] = (1 - this.explorationSmoothing) * strategy[a] + (this.explorationSmoothing / this.numActions);
        }

        return strategy;
    }

    /**
     * Executes one full iteration of Counterfactual Regret Minimization.
     * @returns {{ p1Strategy: Array<number>, p2Strategy: Array<number>, exploitability: number }}
     */
    step() {
        this.iterations++;

        // 1. Compute current regret-matching mixed strategies
        const sigmaP1 = this.getStrategy(0);
        const sigmaP2 = this.getStrategy(1);

        // 2. Accumulate to average strategy sum
        for (let a = 0; a < this.numActions; a++) {
            this.strategySum[0][a] += sigmaP1[a];
            this.strategySum[1][a] += sigmaP2[a];
        }

        // 3. Compute counterfactual values for P1 (Row Player)
        // Expected payoff against opponent mixed strategy sigmaP2
        const actionUtilitiesP1 = new Float64Array(this.numActions);
        let expectedValueP1 = 0;

        for (let a1 = 0; a1 < this.numActions; a1++) {
            let u_a1 = 0;
            for (let a2 = 0; a2 < this.numActions; a2++) {
                u_a1 += this.payoffMatrixP1[a1][a2] * sigmaP2[a2];
            }
            actionUtilitiesP1[a1] = u_a1;
            expectedValueP1 += sigmaP1[a1] * u_a1;
        }

        // 4. Update regrets for P1
        for (let a1 = 0; a1 < this.numActions; a1++) {
            const regret = actionUtilitiesP1[a1] - expectedValueP1;
            if (this.useCFRPlus) {
                this.cumulativeRegrets[0][a1] = Math.max(0, this.cumulativeRegrets[0][a1] + regret);
            } else {
                this.cumulativeRegrets[0][a1] += regret;
            }
        }

        // 5. Compute counterfactual values for P2 (Column Player)
        // In zero-sum game, P2 payoff is -P1 payoff
        const actionUtilitiesP2 = new Float64Array(this.numActions);
        let expectedValueP2 = 0;

        for (let a2 = 0; a2 < this.numActions; a2++) {
            let u_a2 = 0;
            for (let a1 = 0; a1 < this.numActions; a1++) {
                // Column player payoff is negative of row player payoff
                u_a2 += (-this.payoffMatrixP1[a1][a2]) * sigmaP1[a1];
            }
            actionUtilitiesP2[a2] = u_a2;
            expectedValueP2 += sigmaP2[a2] * u_a2;
        }

        // 6. Update regrets for P2
        for (let a2 = 0; a2 < this.numActions; a2++) {
            const regret = actionUtilitiesP2[a2] - expectedValueP2;
            if (this.useCFRPlus) {
                this.cumulativeRegrets[1][a2] = Math.max(0, this.cumulativeRegrets[1][a2] + regret);
            } else {
                this.cumulativeRegrets[1][a2] += regret;
            }
        }

        return {
            p1Strategy: Array.from(sigmaP1),
            p2Strategy: Array.from(sigmaP2),
            exploitability: this.computeExploitability()
        };
    }

    /**
     * Solves the game for a fixed number of iterations or until exploitability falls below tolerance.
     * @param {number} maxIterations
     * @param {number} [tolerance=0.001]
     * @returns {{ iterations: number, p1AverageStrategy: Array<number>, p2AverageStrategy: Array<number>, finalExploitability: number }}
     */
    solve(maxIterations = 1000, tolerance = 0.001) {
        let exploitability = 1.0;
        for (let i = 0; i < maxIterations; i++) {
            const stepResult = this.step();
            exploitability = stepResult.exploitability;
            if (exploitability <= tolerance) {
                break;
            }
        }

        return {
            iterations: this.iterations,
            p1AverageStrategy: Array.from(this.getAverageStrategy(0)),
            p2AverageStrategy: Array.from(this.getAverageStrategy(1)),
            finalExploitability: exploitability
        };
    }

    /**
     * Computes the normalized time-averaged strategy for a player.
     * In zero-sum games, the average strategy converges to Nash Equilibrium.
     * @param {number} player 0 or 1
     * @returns {Float64Array}
     */
    getAverageStrategy(player) {
        const avg = new Float64Array(this.numActions);
        let sum = 0;
        for (let a = 0; a < this.numActions; a++) {
            sum += this.strategySum[player][a];
        }

        for (let a = 0; a < this.numActions; a++) {
            if (sum > 1e-9) {
                avg[a] = this.strategySum[player][a] / sum;
            } else {
                avg[a] = 1.0 / this.numActions;
            }
        }
        return avg;
    }

    /**
     * Computes game-theoretic exploitability delta(sigma) = (BestResponseUtility_P1 + BestResponseUtility_P2) / 2
     * In an exact Nash equilibrium, exploitability is 0.
     * @returns {number}
     */
    computeExploitability() {
        const avgSigma1 = this.getAverageStrategy(0);
        const avgSigma2 = this.getAverageStrategy(1);

        // Best response for P1 against avgSigma2
        let bestP1Value = -Infinity;
        for (let a1 = 0; a1 < this.numActions; a1++) {
            let u1 = 0;
            for (let a2 = 0; a2 < this.numActions; a2++) {
                u1 += this.payoffMatrixP1[a1][a2] * avgSigma2[a2];
            }
            if (u1 > bestP1Value) bestP1Value = u1;
        }

        // Expected P1 value under both playing average strategies
        let expectedP1 = 0;
        for (let a1 = 0; a1 < this.numActions; a1++) {
            for (let a2 = 0; a2 < this.numActions; a2++) {
                expectedP1 += avgSigma1[a1] * this.payoffMatrixP1[a1][a2] * avgSigma2[a2];
            }
        }

        // Best response for P2 against avgSigma1
        let bestP2Value = -Infinity;
        for (let a2 = 0; a2 < this.numActions; a2++) {
            let u2 = 0;
            for (let a1 = 0; a1 < this.numActions; a1++) {
                u2 += (-this.payoffMatrixP1[a1][a2]) * avgSigma1[a1];
            }
            if (u2 > bestP2Value) bestP2Value = u2;
        }

        const exploitabilityP1 = Math.max(0, bestP1Value - expectedP1);
        const exploitabilityP2 = Math.max(0, bestP2Value - (-expectedP1));

        return (exploitabilityP1 + exploitabilityP2) / 2.0;
    }

    /**
     * Serializes current equilibrium state for network broadcast to clients.
     */
    exportEquilibriumState() {
        return {
            iterations: this.iterations,
            actionNames: this.actionNames,
            p1AverageProfile: Array.from(this.getAverageStrategy(0)),
            p2AverageProfile: Array.from(this.getAverageStrategy(1)),
            exploitability: this.computeExploitability(),
            timestamp: Date.now()
        };
    }
}

module.exports = CounterfactualRegretSolver;
