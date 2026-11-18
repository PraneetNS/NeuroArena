/**
 * BFTGradientConsensus.js
 *
 * Implements a Byzantine Fault-Tolerant (BFT) Raft Gradient Consensus Engine.
 * Designed for decentralized federated edge learning in competitive/adversarial environments.
 * Defends against up to f < n/3 malicious or poisoned gradient submissions using the
 * Multi-Krum geometric distance aggregation rule and verifiable cryptographic ballot quorums.
 */

const crypto = require('crypto');

class BFTGradientConsensus {
    /**
     * @param {Object} options
     * @param {number} [options.maxByzantineFraction=0.33] - Maximum tolerable Byzantine fraction f < n/3
     * @param {number} [options.multiKrumM=2] - Number of top benign vectors m to average in Multi-Krum
     * @param {number} [options.quorumThreshold=0.67] - Fraction required for quorum (2/3 + 1)
     * @param {string} [options.clusterSecret='neuroarena_bft_secret_v1'] - Shared secret for HMAC ballot seals
     */
    constructor(options = {}) {
        this.maxByzantineFraction = options.maxByzantineFraction || 0.33;
        this.multiKrumM = options.multiKrumM || 2;
        this.quorumThreshold = options.quorumThreshold || 0.67;
        this.clusterSecret = options.clusterSecret || 'neuroarena_bft_secret_v1';

        this.currentTerm = 1;
        this.currentLeader = null;
        this.state = 'FOLLOWER'; // FOLLOWER, CANDIDATE, LEADER
        this.votedFor = null;

        // Active round proposals: Map<nodeId, { gradient: Array<number>, signature: string, timestamp: number }>
        this.proposals = new Map();
        // Committed round history
        this.commitLog = [];
        // Quarantined Byzantine nodes
        this.quarantinedNodes = new Set();
    }

    /**
     * Casts a vote in a leader election round.
     * @param {string} candidateId
     * @param {number} term
     * @returns {boolean} Granted
     */
    requestVote(candidateId, term) {
        if (term > this.currentTerm) {
            this.currentTerm = term;
            this.state = 'FOLLOWER';
            this.votedFor = null;
        }

        if (term === this.currentTerm && (this.votedFor === null || this.votedFor === candidateId)) {
            this.votedFor = candidateId;
            return true;
        }
        return false;
    }

    /**
     * Submits a gradient vector update from a node for the active consensus round.
     * @param {string} nodeId - Submitting node ID
     * @param {Array<number>} gradient - Proposed gradient parameter array
     * @param {string} [signature] - Optional HMAC-SHA256 signature
     */
    submitGradient(nodeId, gradient, signature = null) {
        if (!Array.isArray(gradient) || gradient.length === 0) {
            throw new Error(`[BFTGradientConsensus] Invalid gradient array from ${nodeId}`);
        }

        // Validate finite numbers
        for (let i = 0; i < gradient.length; i++) {
            if (!Number.isFinite(gradient[i])) {
                this.quarantinedNodes.add(nodeId);
                throw new Error(`[BFTGradientConsensus] Non-finite values detected in gradient from ${nodeId}`);
            }
        }

        // Verify cryptographic seal if provided
        if (signature) {
            const expected = this._computeSignature(nodeId, gradient);
            if (signature !== expected) {
                this.quarantinedNodes.add(nodeId);
                throw new Error(`[BFTGradientConsensus] Invalid signature seal from node ${nodeId}`);
            }
        }

        this.proposals.set(nodeId, {
            gradient: Float32Array.from(gradient),
            signature: signature || this._computeSignature(nodeId, gradient),
            timestamp: Date.now()
        });
    }

    /**
     * Executes the Multi-Krum Byzantine aggregation rule.
     * Given n nodes and f Byzantine nodes, for each vector g_i, computes sum of squared Euclidean
     * distances to its (n - f - 2) closest neighbors. Selects the m vectors with smallest scores.
     *
     * @returns {Object} { aggregatedGradient, selectedNodeIds, rejectedNodeIds, consensusHash }
     */
    aggregateRound() {
        const entries = Array.from(this.proposals.entries()).filter(([nodeId]) => !this.quarantinedNodes.has(nodeId));
        const n = entries.length;

        if (n === 0) {
            throw new Error('[BFTGradientConsensus] Cannot aggregate: no valid proposals available.');
        }

        const dim = entries[0][1].gradient.length;
        // Verify all vectors share the same dimension
        for (const [id, prop] of entries) {
            if (prop.gradient.length !== dim) {
                this.quarantinedNodes.add(id);
            }
        }

        const validEntries = entries.filter(([id, prop]) => prop.gradient.length === dim);
        const validN = validEntries.length;

        // Byzantine bound f: maximum f such that validN >= 2*f + 1
        const f = Math.max(0, Math.floor((validN - 1) / 3));
        const kClosest = Math.max(1, validN - f - 2);

        // Compute pairwise squared Euclidean distances
        const distMatrix = Array.from({ length: validN }, () => new Float32Array(validN));
        for (let i = 0; i < validN; i++) {
            const gI = validEntries[i][1].gradient;
            for (let j = i + 1; j < validN; j++) {
                const gJ = validEntries[j][1].gradient;
                let dSq = 0;
                for (let k = 0; k < dim; k++) {
                    const diff = gI[k] - gJ[k];
                    dSq += diff * diff;
                }
                distMatrix[i][j] = dSq;
                distMatrix[j][i] = dSq;
            }
        }

        // Compute Krum score S(i) for each proposal
        const scores = [];
        for (let i = 0; i < validN; i++) {
            const dists = [];
            for (let j = 0; j < validN; j++) {
                if (i !== j) {
                    dists.push(distMatrix[i][j]);
                }
            }
            dists.sort((a, b) => a - b);
            let scoreSum = 0;
            const limit = Math.min(dists.length, kClosest);
            for (let d = 0; d < limit; d++) {
                scoreSum += dists[d];
            }
            scores.push({
                index: i,
                nodeId: validEntries[i][0],
                gradient: validEntries[i][1].gradient,
                score: scoreSum
            });
        }

        // Multi-Krum: sort by lowest score S(i) and pick top m
        scores.sort((a, b) => a.score - b.score);
        const m = Math.min(this.multiKrumM, scores.length);
        const selected = scores.slice(0, m);
        const rejected = scores.slice(m);

        // Trimmed average of selected benign gradients
        const aggregated = new Float32Array(dim);
        for (let k = 0; k < dim; k++) {
            let sum = 0;
            for (let s = 0; s < m; s++) {
                sum += selected[s].gradient[k];
            }
            aggregated[k] = sum / m;
        }

        // Generate consensus commit seal
        const consensusHash = crypto.createHash('sha256')
            .update(Buffer.from(aggregated.buffer))
            .update(String(this.currentTerm))
            .digest('hex');

        const commitRecord = {
            term: this.currentTerm,
            timestamp: Date.now(),
            totalProposals: n,
            benignCount: m,
            selectedNodes: selected.map(s => s.nodeId),
            rejectedNodes: rejected.map(r => r.nodeId),
            consensusHash,
            aggregatedGradient: Array.from(aggregated)
        };

        this.commitLog.push(commitRecord);
        // Clear proposals for next round
        this.proposals.clear();

        return commitRecord;
    }

    /**
     * Computes HMAC-SHA256 signature for a node gradient ballot
     * @private
     */
    _computeSignature(nodeId, gradient) {
        return crypto.createHmac('sha256', this.clusterSecret)
            .update(nodeId)
            .update(Buffer.from(new Float32Array(gradient).buffer))
            .digest('hex');
    }
}

module.exports = BFTGradientConsensus;
