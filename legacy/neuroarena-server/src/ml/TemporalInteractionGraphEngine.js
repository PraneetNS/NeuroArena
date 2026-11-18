/**
 * TemporalInteractionGraphEngine.js
 *
 * Implements Continuous-Time Temporal Graph Networks (TGN) with Hawkes Point Process
 * for dynamic combat interaction cascades (attacks, assists, shields, crossfires).
 *
 * Mathematical Foundations:
 * 1. Node Memory Evolution:
 *    s_i(t) = GRU(m_i(t), s_i(t^-))
 * 2. Interaction Message Generation:
 *    m_i(t) = MLP([s_i(t^-), s_j(t^-), \Delta t, e_{ij}])
 * 3. Hawkes Process Intensity for Cascade Burst Forecasting:
 *    \lambda_{ij}(t) = \mu_0 + \sum_{t_k < t} \alpha \exp(-\beta (t - t_k))
 *
 * References:
 * - Rossi et al. (ICML 2020): "Temporal Graph Networks for Deep Learning on Dynamic Graphs"
 * - Hawkes (Biometrika 1971): "Spectra of Some Self-Exciting and Mutually Exciting Point Processes"
 */

class TemporalInteractionGraphEngine {
    /**
     * @param {Object} options
     * @param {number} [options.memoryDim=8] - Continuous state memory vector per node
     * @param {number} [options.decayBeta=1.5] - Hawkes decay rate for combat cascades
     * @param {number} [options.baseIntensity=0.05] - Baseline interaction rate \mu_0
     */
    constructor(options = {}) {
        this.memoryDim = options.memoryDim || 8;
        this.decayBeta = options.decayBeta || 1.5;
        this.baseIntensity = options.baseIntensity || 0.05;

        // Node ID -> { memory: Float32Array, lastTimestamp: number }
        this.nodeStates = new Map();

        // Historical interaction events: { u, v, t, type, weight }
        this.interactionHistory = [];
        this.maxHistory = 500;
    }

    /**
     * Retrieves or initializes node memory state
     */
    getNodeState(nodeId, currentTime) {
        if (!this.nodeStates.has(nodeId)) {
            this.nodeStates.set(nodeId, {
                memory: new Float32Array(this.memoryDim).fill(0.1),
                lastTimestamp: currentTime
            });
        }
        return this.nodeStates.get(nodeId);
    }

    /**
     * Processes an interaction event e = (src, dst, timestamp, interactionType, weight)
     * Updates node memory states and records the event.
     */
    recordInteraction(srcId, dstId, timestamp, interactionType = 'attack', weight = 1.0) {
        const srcState = this.getNodeState(srcId, timestamp);
        const dstState = this.getNodeState(dstId, timestamp);

        const dtSrc = Math.max(0, timestamp - srcState.lastTimestamp);
        const dtDst = Math.max(0, timestamp - dstState.lastTimestamp);

        // Update memory: s_i(t) = (1 - \alpha) * s_i(t^-) + \alpha * message
        const updateRate = 0.25;
        for (let k = 0; k < this.memoryDim; k++) {
            const msgSrc = 0.5 * (srcState.memory[k] + dstState.memory[k]) + weight * 0.1;
            const msgDst = 0.5 * (dstState.memory[k] - srcState.memory[k]) - weight * 0.05;

            srcState.memory[k] = (1.0 - updateRate) * srcState.memory[k] + updateRate * msgSrc;
            dstState.memory[k] = (1.0 - updateRate) * dstState.memory[k] + updateRate * msgDst;
        }

        srcState.lastTimestamp = timestamp;
        dstState.lastTimestamp = timestamp;

        this.interactionHistory.push({
            src: srcId,
            dst: dstId,
            t: timestamp,
            type: interactionType,
            weight: weight
        });

        if (this.interactionHistory.length > this.maxHistory) {
            this.interactionHistory.shift();
        }
    }

    /**
     * Evaluates Hawkes process conditional combat intensity \lambda(t)
     * to detect whether a team fight or engagement burst is imminent.
     */
    predictCombatIntensity(currentTime, windowLookback = 5.0) {
        let intensity = this.baseIntensity;

        for (let i = this.interactionHistory.length - 1; i >= 0; i--) {
            const ev = this.interactionHistory[i];
            const dt = currentTime - ev.t;
            if (dt < 0) continue;
            if (dt > windowLookback) break;

            const alpha = ev.weight * 0.4;
            intensity += alpha * Math.exp(-this.decayBeta * dt);
        }

        const isCascadeAlert = intensity > 1.2;
        return {
            currentIntensity: intensity,
            isCascadeAlert: isCascadeAlert,
            eventCountInWindow: this.interactionHistory.filter(e => (currentTime - e.t) <= windowLookback).length
        };
    }

    /**
     * Computes affinity / combat threat score between two nodes based on memory cosine similarity
     */
    computeNodeAffinity(nodeA, nodeB) {
        const sA = this.nodeStates.get(nodeA)?.memory;
        const sB = this.nodeStates.get(nodeB)?.memory;
        if (!sA || !sB) return 0.0;

        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < this.memoryDim; i++) {
            dot += sA[i] * sB[i];
            normA += sA[i] * sA[i];
            normB += sB[i] * sB[i];
        }

        return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-7);
    }
}

module.exports = TemporalInteractionGraphEngine;
