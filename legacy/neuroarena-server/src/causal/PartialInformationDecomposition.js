/**
 * PartialInformationDecomposition.js
 *
 * Implements Williams-Beer Partial Information Decomposition (PID),
 * Schreiber Directed Transfer Entropy, and Causal Emergence quantification
 * for multi-agent swarms, squad coordination, and game dynamics.
 *
 * Mathematical Foundations:
 * 1. Multivariate Mutual Information Decomposition (Williams & Beer, 2010):
 *    Given target variable Y and source predictors X_1, X_2:
 *      I(Y; X_1, X_2) = Red(Y; {X_1, X_2}) + Uniq(Y; X_1 \setminus X_2) + Uniq(Y; X_2 \setminus X_1) + Syn(Y; {X_1, X_2})
 *    Lattice equations:
 *      I(Y; X_1) = Red + Uniq_1
 *      I(Y; X_2) = Red + Uniq_2
 *      Red(Y; {X_1, X_2}) = I_{min}(Y; {X_1, X_2}) = \sum_y p(y) \min_{i \in \{1,2\}} I(Y=y; X_i)
 *      Syn = I(Y; X_1, X_2) - (Red + Uniq_1 + Uniq_2)
 *
 * 2. Schreiber Directed Transfer Entropy:
 *      T_{X \to Y} = \sum p(y_{t+1}, y_t, x_t) \log_2 \frac{p(y_{t+1} | y_t, x_t)}{p(y_{t+1} | y_t)}
 *    Measures directed, time-asymmetric causal influence from agent X to agent Y.
 *
 * 3. Causal Emergence Index (Rosas, Mediano et al., 2020):
 *      \Psi_{emergence} = Syn(Y; {X_1, X_2}) - Red(Y; {X_1, X_2})
 *    When \Psi > 0, macroscopic behavior exhibits non-trivial emergent synergy
 *    that cannot be localized to individual component agents.
 *
 * References:
 * - Williams & Beer (2010): "Nonnegative Decomposition of Multivariate Information", arXiv:1004.2515.
 * - Schreiber, T. (2000): "Measuring Information Transfer", Physical Review Letters.
 * - Rosas et al. (2020): "Reconciling emergences: An information-theoretic approach to identify causal emergence", Nature Communications.
 */

class PartialInformationDecomposition {
    /**
     * @param {Object} [options={}]
     * @param {number} [options.numBins=4] - Discretization bins for continuous signals
     */
    constructor(options = {}) {
        this.numBins = options.numBins || 4;
    }

    /**
     * Discretizes a continuous 1D trajectory into discrete states [0, numBins - 1]
     * @param {number[]} signal
     * @param {number} [bins=null]
     * @returns {number[]} Discrete integers
     */
    discretize(signal, bins = null) {
        const b = bins || this.numBins;
        let min = Infinity, max = -Infinity;
        for (const v of signal) {
            if (v < min) min = v;
            if (v > max) max = v;
        }

        if (max === min) return new Array(signal.length).fill(0);

        const range = max - min;
        return signal.map(v => {
            const normalized = (v - min) / range;
            const bin = Math.floor(normalized * b);
            return Math.min(b - 1, Math.max(0, bin));
        });
    }

    /**
     * Computes full Partial Information Decomposition (Redundancy, Unique1, Unique2, Synergy)
     * for target Y and predictors X1, X2.
     * 
     * @param {number[]} y - Target state sequence
     * @param {number[]} x1 - Source 1 state sequence
     * @param {number[]} x2 - Source 2 state sequence
     * @returns {Object} PID terms: { redundancy, unique1, unique2, synergy, totalMI, emergenceIndex }
     */
    computePID(y, x1, x2) {
        const N = y.length;
        if (x1.length !== N || x2.length !== N) {
            throw new Error('All state sequences must have identical lengths.');
        }

        // Discrete distributions
        const pY = new Map();
        const pX1 = new Map();
        const pX2 = new Map();
        const pYX1 = new Map();
        const pYX2 = new Map();
        const pX1X2 = new Map();
        const pYX1X2 = new Map();

        for (let i = 0; i < N; i++) {
            const yi = y[i];
            const x1i = x1[i];
            const x2i = x2[i];

            this._incMap(pY, yi);
            this._incMap(pX1, x1i);
            this._incMap(pX2, x2i);
            this._incMap(pYX1, `${yi},${x1i}`);
            this._incMap(pYX2, `${yi},${x2i}`);
            this._incMap(pX1X2, `${x1i},${x2i}`);
            this._incMap(pYX1X2, `${yi},${x1i},${x2i}`);
        }

        // Convert counts to probabilities
        this._normalizeMap(pY, N);
        this._normalizeMap(pX1, N);
        this._normalizeMap(pX2, N);
        this._normalizeMap(pYX1, N);
        this._normalizeMap(pYX2, N);
        this._normalizeMap(pX1X2, N);
        this._normalizeMap(pYX1X2, N);

        // Mutual Information I(Y; X1)
        let miYX1 = 0.0;
        for (const [key, p] of pYX1.entries()) {
            const [yi, x1i] = key.split(',').map(Number);
            const probY = pY.get(yi);
            const probX1 = pX1.get(x1i);
            miYX1 += p * Math.log2(p / (probY * probX1));
        }

        // Mutual Information I(Y; X2)
        let miYX2 = 0.0;
        for (const [key, p] of pYX2.entries()) {
            const [yi, x2i] = key.split(',').map(Number);
            const probY = pY.get(yi);
            const probX2 = pX2.get(x2i);
            miYX2 += p * Math.log2(p / (probY * probX2));
        }

        // Joint Mutual Information I(Y; X1, X2)
        let totalMI = 0.0;
        for (const [key, p] of pYX1X2.entries()) {
            const [yi, x1i, x2i] = key.split(',').map(Number);
            const probY = pY.get(yi);
            const probJointX = pX1X2.get(`${x1i},${x2i}`) || 0.0;
            if (probJointX > 0) {
                totalMI += p * Math.log2(p / (probY * probJointX));
            }
        }

        // Williams & Beer Redundancy I_{min}(Y; {X1, X2})
        // Red = \sum_{y} p(y) \min( I(Y=y; X1), I(Y=y; X2) )
        let redundancy = 0.0;
        for (const [yi, probY] of pY.entries()) {
            // Specific information I(Y=y; X1) = \sum_{x1} p(x1|y) \log_2 (p(x1|y) / p(x1))
            let specIX1 = 0.0;
            for (const [x1i, probX1] of pX1.entries()) {
                const probYX1Val = pYX1.get(`${yi},${x1i}`) || 0.0;
                if (probYX1Val > 0) {
                    const condP = probYX1Val / probY;
                    specIX1 += condP * Math.log2(condP / probX1);
                }
            }

            let specIX2 = 0.0;
            for (const [x2i, probX2] of pX2.entries()) {
                const probYX2Val = pYX2.get(`${yi},${x2i}`) || 0.0;
                if (probYX2Val > 0) {
                    const condP = probYX2Val / probY;
                    specIX2 += condP * Math.log2(condP / probX2);
                }
            }

            redundancy += probY * Math.min(Math.max(0.0, specIX1), Math.max(0.0, specIX2));
        }

        // Non-negativity clip
        redundancy = Math.max(0.0, redundancy);
        const unique1 = Math.max(0.0, miYX1 - redundancy);
        const unique2 = Math.max(0.0, miYX2 - redundancy);
        const synergy = Math.max(0.0, totalMI - (redundancy + unique1 + unique2));

        // Causal Emergence: \Psi = Synergy - Redundancy
        const emergenceIndex = synergy - redundancy;

        return {
            totalMutualInformation: Math.max(0.0, totalMI),
            miYX1: Math.max(0.0, miYX1),
            miYX2: Math.max(0.0, miYX2),
            redundancy,
            unique1,
            unique2,
            synergy,
            emergenceIndex,
            isSynergistic: synergy > redundancy
        };
    }

    /**
     * Computes Schreiber Directed Transfer Entropy T_{X \to Y} from time series
     * @param {number[]} x - Source time series [x_0, x_1, ...]
     * @param {number[]} y - Target time series [y_0, y_1, ...]
     * @param {number} [historyLag=1] - Historical lag k
     * @returns {Object} Transfer entropy in bits and directional significance
     */
    computeTransferEntropy(x, y, historyLag = 1) {
        const N = x.length;
        if (y.length !== N || N <= historyLag) {
            throw new Error('Signal lengths insufficient for lag.');
        }

        const pYnext_Ypast_Xpast = new Map();
        const pYpast_Xpast = new Map();
        const pYnext_Ypast = new Map();
        const pYpast = new Map();

        const count = N - historyLag;

        for (let t = historyLag; t < N; t++) {
            const yNext = y[t];
            const yPast = y[t - historyLag];
            const xPast = x[t - historyLag];

            this._incMap(pYnext_Ypast_Xpast, `${yNext},${yPast},${xPast}`);
            this._incMap(pYpast_Xpast, `${yPast},${xPast}`);
            this._incMap(pYnext_Ypast, `${yNext},${yPast}`);
            this._incMap(pYpast, yPast);
        }

        this._normalizeMap(pYnext_Ypast_Xpast, count);
        this._normalizeMap(pYpast_Xpast, count);
        this._normalizeMap(pYnext_Ypast, count);
        this._normalizeMap(pYpast, count);

        // T_{X \to Y} = \sum p(y_{t+1}, y_t, x_t) \log_2 \frac{p(y_{t+1}, y_t, x_t) p(y_t)}{p(y_t, x_t) p(y_{t+1}, y_t)}
        let transferEntropy = 0.0;
        for (const [key, pJoint] of pYnext_Ypast_Xpast.entries()) {
            const [yNext, yPast, xPast] = key.split(',').map(Number);
            const pYP_XP = pYpast_Xpast.get(`${yPast},${xPast}`) || 0.0;
            const pYN_YP = pYnext_Ypast.get(`${yNext},${yPast}`) || 0.0;
            const pYP = pYpast.get(yPast) || 0.0;

            if (pYP_XP > 0 && pYN_YP > 0 && pYP > 0) {
                const ratio = (pJoint * pYP) / (pYP_XP * pYN_YP);
                if (ratio > 0) {
                    transferEntropy += pJoint * Math.log2(ratio);
                }
            }
        }

        return {
            transferEntropyBits: Math.max(0.0, transferEntropy),
            sourceLength: N,
            lag: historyLag
        };
    }

    _incMap(map, key) {
        map.set(key, (map.get(key) || 0) + 1);
    }

    _normalizeMap(map, total) {
        for (const [k, v] of map.entries()) {
            map.set(k, v / total);
        }
    }
}

module.exports = PartialInformationDecomposition;
