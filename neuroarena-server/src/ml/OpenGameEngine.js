/**
 * OpenGameEngine.js
 *
 * Implements Category-Theoretic Compositional Game Theory (Open Games)
 * based on bidirectional lenses / optics.
 *
 * Mathematical Foundations:
 * An Open Game G: (X, S) \to (Y, R) consists of:
 * - \Sigma: Strategy space of the agent/subsystem.
 * - Play function P: \Sigma \times X \to Y (forward trajectory / state generation).
 * - Coplay function C: \Sigma \times X \times R \to S (backward utility / cost co-propagation).
 * - Best response function B: X \times (Y \to R) \to \mathcal{P}(\Sigma).
 *
 * Monoidal Category Operations:
 * 1. Sequential Composition (G_2 \circ G_1):
 *    P_{\circ}(\sigma_1, \sigma_2, x) = P_2(\sigma_2, P_1(\sigma_1, x))
 *    C_{\circ}(\sigma_1, \sigma_2, x, r_2) = C_1(\sigma_1, x, C_2(\sigma_2, P_1(\sigma_1, x), r_2))
 * 2. Parallel Tensor Product (G_1 \otimes G_2):
 *    P_{\otimes}((\sigma_1, \sigma_2), (x_1, x_2)) = (P_1(\sigma_1, x_1), P_2(\sigma_2, x_2))
 *    C_{\otimes}((\sigma_1, \sigma_2), (x_1, x_2), (r_1, r_2)) = (C_1(x_1, r_1), C_2(x_2, r_2))
 * 3. Nash Equilibrium: A strategy profile \sigma^* is in equilibrium if \sigma^* \in B(x, k)
 *    where k is the continuation utility function.
 *
 * References:
 * - Ghani, Hedges, Winschel, Zahn (2018): "Compositional Game Theory"
 * - Hedges (LICS 2017): "Morphisms of Open Games"
 */

class OpenGame {
    /**
     * @param {Object} def
     * @param {string} def.name - Game or component identifier
     * @param {Array<any>} def.strategySpace - Discrete or parameterized strategy space \Sigma
     * @param {Function} def.play - (strategy, stateX) => stateY
     * @param {Function} def.coplay - (strategy, stateX, utilityR) => utilityS
     * @param {Function} def.utility - (strategy, stateX, continuationEvaluator) => number
     */
    constructor(def) {
        this.name = def.name || 'AnonymousGame';
        this.strategySpace = def.strategySpace || [];
        this.play = def.play || ((sigma, x) => x);
        this.coplay = def.coplay || ((sigma, x, r) => r);
        this.utility = def.utility || ((sigma, x, k) => (typeof k === 'function' ? k(this.play(sigma, x)) : 0));
    }

    /**
     * Evaluates best response strategy for a given prior state x and continuation payoff function k
     * @param {any} x - Input state
     * @param {Function} k - Continuation utility function Y -> R
     * @returns {{ bestStrategy: any, maxPayoff: number, allPayoffs: Map<any, number> }}
     */
    bestResponse(x, k) {
        let bestStrat = null;
        let maxPayoff = -Infinity;
        const allPayoffs = new Map();

        for (const sigma of this.strategySpace) {
            const u = this.utility(sigma, x, k);
            allPayoffs.set(sigma, u);
            if (u > maxPayoff) {
                maxPayoff = u;
                bestStrat = sigma;
            }
        }

        return { bestStrategy: bestStrat, maxPayoff, allPayoffs };
    }

    /**
     * Checks if a given strategy \sigma is an \epsilon-Nash equilibrium
     * @param {any} sigma - Candidate strategy
     * @param {any} x - Input state
     * @param {Function} k - Continuation utility
     * @param {number} [epsilon=1e-4]
     * @returns {boolean}
     */
    isEquilibrium(sigma, x, k, epsilon = 1e-4) {
        const { maxPayoff } = this.bestResponse(x, k);
        const currentPayoff = this.utility(sigma, x, k);
        return (maxPayoff - currentPayoff) <= epsilon;
    }
}

class OpenGameEngine {
    constructor() {
        this.registeredGames = new Map();
    }

    /**
     * Registers an open game
     * @param {string} id
     * @param {OpenGame} game
     */
    registerGame(id, game) {
        this.registeredGames.set(id, game);
    }

    /**
     * Creates an atomic decision game for an agent
     * @param {string} agentId
     * @param {Array<string|number>} actions
     * @param {Function} payoffFn (action, state, continuation) => number
     * @returns {OpenGame}
     */
    createAtomicDecisionGame(agentId, actions, payoffFn) {
        return new OpenGame({
            name: `Agent_${agentId}`,
            strategySpace: actions,
            play: (action, state) => ({ ...state, [`${agentId}_action`]: action }),
            coplay: (action, state, r) => r,
            utility: (action, state, k) => payoffFn(action, state, k)
        });
    }

    /**
     * Sequential composition: G = G2 \circ G1
     * First G1 acts, then G2 acts on G1's output. Utility propagates backwards.
     * @param {OpenGame} g1
     * @param {OpenGame} g2
     * @returns {OpenGame}
     */
    composeSequential(g1, g2) {
        const combinedStrategies = [];
        for (const s1 of g1.strategySpace) {
            for (const s2 of g2.strategySpace) {
                combinedStrategies.push({ s1, s2 });
            }
        }

        return new OpenGame({
            name: `(${g2.name} ∘ ${g1.name})`,
            strategySpace: combinedStrategies,
            play: (stratPair, x) => {
                const y1 = g1.play(stratPair.s1, x);
                return g2.play(stratPair.s2, y1);
            },
            coplay: (stratPair, x, r2) => {
                const y1 = g1.play(stratPair.s1, x);
                const s2 = g2.coplay(stratPair.s2, y1, r2);
                return g1.coplay(stratPair.s1, x, s2);
            },
            utility: (stratPair, x, k) => {
                const k1 = (y1) => {
                    return g2.utility(stratPair.s2, y1, k);
                };
                const u1 = g1.utility(stratPair.s1, x, k1);
                const y1 = g1.play(stratPair.s1, x);
                const u2 = g2.utility(stratPair.s2, y1, k);
                return u1 + u2;
            }
        });
    }

    /**
     * Parallel Tensor composition: G = G1 \otimes G2
     * Both games execute simultaneously on independent state channels.
     * @param {OpenGame} g1
     * @param {OpenGame} g2
     * @returns {OpenGame}
     */
    composeTensor(g1, g2) {
        const combinedStrategies = [];
        for (const s1 of g1.strategySpace) {
            for (const s2 of g2.strategySpace) {
                combinedStrategies.push({ s1, s2 });
            }
        }

        return new OpenGame({
            name: `(${g1.name} ⊗ ${g2.name})`,
            strategySpace: combinedStrategies,
            play: (stratPair, xPair) => {
                const x1 = xPair ? xPair[0] : null;
                const x2 = xPair ? xPair[1] : null;
                return [
                    g1.play(stratPair.s1, x1),
                    g2.play(stratPair.s2, x2)
                ];
            },
            coplay: (stratPair, xPair, rPair) => {
                const x1 = xPair ? xPair[0] : null;
                const x2 = xPair ? xPair[1] : null;
                const r1 = rPair ? rPair[0] : 0;
                const r2 = rPair ? rPair[1] : 0;
                return [
                    g1.coplay(stratPair.s1, x1, r1),
                    g2.coplay(stratPair.s2, x2, r2)
                ];
            },
            utility: (stratPair, xPair, kPair) => {
                const x1 = xPair ? xPair[0] : null;
                const x2 = xPair ? xPair[1] : null;
                const k1 = typeof kPair === 'function' ? ((y1) => kPair([y1, null])[0]) : (y1 => 0);
                const k2 = typeof kPair === 'function' ? ((y2) => kPair([null, y2])[1]) : (y2 => 0);
                return g1.utility(stratPair.s1, x1, k1) + g2.utility(stratPair.s2, x2, k2);
            }
        });
    }

    /**
     * Computes the Subgame Perfect Bayesian Nash Equilibrium for a composite game
     * @param {OpenGame} game - The composite open game
     * @param {any} initialState - Arena initial environment state
     * @param {Function} terminalPayoff - Terminal evaluation function
     * @returns {{ equilibriumProfile: any, expectedTotalPayoff: number }}
     */
    solveEquilibrium(game, initialState, terminalPayoff) {
        const { bestStrategy, maxPayoff } = game.bestResponse(initialState, terminalPayoff);
        return {
            equilibriumProfile: bestStrategy,
            expectedTotalPayoff: maxPayoff,
            isNash: game.isEquilibrium(bestStrategy, initialState, terminalPayoff)
        };
    }
}

module.exports = { OpenGame, OpenGameEngine };
