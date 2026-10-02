/**
 * TimeWarpSpeculativeEngine.js
 *
 * Implements Asynchronous Optimistic Time Warp Synchronization (Jefferson 1985)
 * with Anti-Message Annihilation, Local Virtual Time (LVT), Global Virtual Time (GVT),
 * and Dynamic Fossil Collection for zero-stall distributed multi-agent state prediction.
 *
 * Theoretical Foundations:
 * 1. Local Virtual Time (LVT_i): Monotonically advancing simulation clock of node i.
 * 2. Straggler Detection: When a message arrives with timestamp t_{msg} < LVT_i, a causality violation occurs.
 * 3. State Rollback: The simulation state reverts to checkpoint t_{chk} <= t_{msg}.
 * 4. Anti-Messages (Negative Messages \bar{m}):
 *    For every speculative message m transmitted by node i with send_time > t_{msg},
 *    an anti-message \bar{m} is dispatched. When m and \bar{m} meet in any queue,
 *    they mutually annihilate: m \oplus \bar{m} = \emptyset.
 * 5. Global Virtual Time (GVT):
 *    GVT = \min \{ \min_i LVT_i, \min_{m \in InTransit} t_{msg} \}
 *    All checkpoints and committed events older than GVT are reclaimed (Fossil Collection).
 *
 * References:
 * - Jefferson (ACM TOPLAS 1985): "Virtual Time"
 * - Fujimoto (ACM Computing Surveys 1990): "Parallel discrete event simulation"
 */

class TimeWarpSpeculativeEngine {
    /**
     * @param {Object} options
     * @param {string} options.nodeId - Identifier of this simulated partition/node
     * @param {number} [options.checkpointInterval=5] - Checkpoint interval in virtual ticks
     * @param {number} [options.historyRetentionTicks=200] - Retained history before GVT pruning
     */
    constructor(options = {}) {
        this.nodeId = options.nodeId || 'node_0';
        this.checkpointInterval = options.checkpointInterval || 5;
        this.historyRetentionTicks = options.historyRetentionTicks || 200;

        this.localVirtualTime = 0;
        this.globalVirtualTime = 0;

        // State history: Map<virtualTick, StateSnapshot>
        this.stateCheckpoints = new Map();

        // Input message queue: sorted by virtual timestamp
        this.inputQueue = [];

        // Output message log: record of all messages sent by this node (for anti-message generation)
        this.outputLog = [];

        // Track stats
        this.rollbackCount = 0;
        this.annihilatedAntiMessages = 0;
    }

    /**
     * Saves a state snapshot at virtual tick t
     * @param {number} tick - Virtual time
     * @param {Object} state - Deep or shallow cloned state
     */
    saveCheckpoint(tick, state) {
        this.stateCheckpoints.set(tick, JSON.parse(JSON.stringify(state)));
    }

    /**
     * Receives an incoming positive message or anti-message
     * @param {Object} message - { id, source, target, timestamp, isAntiMessage, payload }
     * @returns {{ requiresRollback: boolean, rollbackTargetTick: number }}
     */
    receiveMessage(message) {
        // 1. Check for anti-message annihilation in input queue
        const existingIdx = this.inputQueue.findIndex(m => m.id === message.id && m.isAntiMessage !== message.isAntiMessage);
        if (existingIdx !== -1) {
            // Annihilation: positive message cancels with anti-message
            this.inputQueue.splice(existingIdx, 1);
            this.annihilatedAntiMessages++;
            return { requiresRollback: false, rollbackTargetTick: this.localVirtualTime };
        }

        // Insert into sorted input queue
        this.inputQueue.push(message);
        this.inputQueue.sort((a, b) => a.timestamp - b.timestamp);

        // 2. Check for causality violation (straggler message)
        if (message.timestamp < this.localVirtualTime) {
            this.rollbackCount++;
            return {
                requiresRollback: true,
                rollbackTargetTick: message.timestamp
            };
        }

        return { requiresRollback: false, rollbackTargetTick: this.localVirtualTime };
    }

    /**
     * Executes a Time Warp rollback to targetTick
     * @param {number} targetTick
     * @returns {{ restoredState: Object, antiMessages: Array<Object> }}
     */
    executeRollback(targetTick) {
        // Find latest checkpoint <= targetTick
        const availableTicks = Array.from(this.stateCheckpoints.keys())
            .filter(t => t <= targetTick)
            .sort((a, b) => b - a);

        const restoreTick = availableTicks.length > 0 ? availableTicks[0] : 0;
        const restoredState = this.stateCheckpoints.get(restoreTick) || null;

        // Generate anti-messages for all messages emitted after restoreTick
        const antiMessages = [];
        const keptOutputLog = [];

        for (const outMsg of this.outputLog) {
            if (outMsg.timestamp > restoreTick) {
                // Construct anti-message
                antiMessages.push({
                    id: outMsg.id,
                    source: this.nodeId,
                    target: outMsg.target,
                    timestamp: outMsg.timestamp,
                    isAntiMessage: true,
                    payload: outMsg.payload
                });
            } else {
                keptOutputLog.push(outMsg);
            }
        }

        this.outputLog = keptOutputLog;
        this.localVirtualTime = restoreTick;

        // Remove invalid checkpoints newer than restoreTick
        for (const tick of this.stateCheckpoints.keys()) {
            if (tick > restoreTick) {
                this.stateCheckpoints.delete(tick);
            }
        }

        return { restoredState, antiMessages, restoredTick: restoreTick };
    }

    /**
     * Emits a speculative outgoing message
     */
    sendMessage(targetNodeId, timestamp, payload) {
        const msg = {
            id: `${this.nodeId}_${timestamp}_${Math.random().toString(36).substring(2, 9)}`,
            source: this.nodeId,
            target: targetNodeId,
            timestamp,
            isAntiMessage: false,
            payload
        };
        this.outputLog.push(msg);
        return msg;
    }

    /**
     * Steps virtual simulation forward to nextTick
     */
    advanceTime(nextTick, currentState) {
        this.localVirtualTime = nextTick;
        if (nextTick % this.checkpointInterval === 0) {
            this.saveCheckpoint(nextTick, currentState);
        }
    }

    /**
     * Fossil Collection: reclaims checkpoints and messages older than GVT
     * @param {number} gvt - Global Virtual Time
     * @returns {number} Reclaimed checkpoint count
     */
    fossilCollect(gvt) {
        this.globalVirtualTime = gvt;
        let reclaimed = 0;

        for (const tick of this.stateCheckpoints.keys()) {
            if (tick < gvt - this.historyRetentionTicks) {
                this.stateCheckpoints.delete(tick);
                reclaimed++;
            }
        }

        this.inputQueue = this.inputQueue.filter(m => m.timestamp >= gvt);
        this.outputLog = this.outputLog.filter(m => m.timestamp >= gvt);

        return reclaimed;
    }
}

module.exports = TimeWarpSpeculativeEngine;
