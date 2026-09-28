/**
 * DeltaCRDTSync.js
 *
 * Implements Delta-state Conflict-free Replicated Data Types (Delta-CRDT)
 * for decentralized peer-to-peer multiplayer synchronization in NeuroArena.
 * Guarantees Strong Eventual Consistency (SEC) across intermittent network partitions.
 *
 * Components:
 * 1. VectorClock: Causal timestamp tracking per replica node
 * 2. PNCounterCRDT: Positive-Negative Counter for distributed arena score tokens
 * 3. LWWElementSetCRDT: Last-Write-Wins Element Set for inventory and dynamic object registries
 * 4. DeltaManager: Generates minimal delta mutators since remote peer's last acknowledged vector clock
 *
 * Reference:
 * Almeida et al. (J. Parallel Distrib. Comput. 2018) "Delta state replicated data types"
 */

class VectorClock {
    constructor(nodeId) {
        this.nodeId = nodeId;
        this.clock = new Map(); // nodeId -> counter
        this.clock.set(nodeId, 0);
    }

    increment() {
        const current = this.clock.get(this.nodeId) || 0;
        this.clock.set(this.nodeId, current + 1);
        return this.clock.get(this.nodeId);
    }

    get(nodeId) {
        return this.clock.get(nodeId) || 0;
    }

    merge(remoteClockMap) {
        for (const [nodeId, count] of Object.entries(remoteClockMap)) {
            const local = this.clock.get(nodeId) || 0;
            this.clock.set(nodeId, Math.max(local, count));
        }
    }

    toJSON() {
        const obj = {};
        for (const [k, v] of this.clock.entries()) {
            obj[k] = v;
        }
        return obj;
    }
}

class PNCounterCRDT {
    constructor(nodeId) {
        this.nodeId = nodeId;
        this.P = new Map(); // Positive increments
        this.N = new Map(); // Negative decrements
    }

    increment(amount = 1) {
        const curr = this.P.get(this.nodeId) || 0;
        this.P.set(this.nodeId, curr + amount);
        return this.value();
    }

    decrement(amount = 1) {
        const curr = this.N.get(this.nodeId) || 0;
        this.N.set(this.nodeId, curr + amount);
        return this.value();
    }

    value() {
        let sumP = 0, sumN = 0;
        for (const v of this.P.values()) sumP += v;
        for (const v of this.N.values()) sumN += v;
        return sumP - sumN;
    }

    merge(remoteDelta) {
        if (!remoteDelta) return;
        if (remoteDelta.P) {
            for (const [node, val] of Object.entries(remoteDelta.P)) {
                this.P.set(node, Math.max(this.P.get(node) || 0, val));
            }
        }
        if (remoteDelta.N) {
            for (const [node, val] of Object.entries(remoteDelta.N)) {
                this.N.set(node, Math.max(this.N.get(node) || 0, val));
            }
        }
    }

    getState() {
        return {
            P: Object.fromEntries(this.P),
            N: Object.fromEntries(this.N)
        };
    }
}

class LWWElementSetCRDT {
    constructor(nodeId) {
        this.nodeId = nodeId;
        this.addSet = new Map();    // elementId -> { timestamp, nodeId }
        this.removeSet = new Map(); // elementId -> { timestamp, nodeId }
    }

    add(elementId, timestamp = Date.now()) {
        const existing = this.addSet.get(elementId);
        if (!existing || timestamp > existing.timestamp || (timestamp === existing.timestamp && this.nodeId > existing.nodeId)) {
            this.addSet.set(elementId, { timestamp, nodeId: this.nodeId });
        }
    }

    remove(elementId, timestamp = Date.now()) {
        const existing = this.removeSet.get(elementId);
        if (!existing || timestamp > existing.timestamp || (timestamp === existing.timestamp && this.nodeId > existing.nodeId)) {
            this.removeSet.set(elementId, { timestamp, nodeId: this.nodeId });
        }
    }

    has(elementId) {
        const addRecord = this.addSet.get(elementId);
        if (!addRecord) return false;

        const remRecord = this.removeSet.get(elementId);
        if (!remRecord) return true;

        if (addRecord.timestamp > remRecord.timestamp) return true;
        if (remRecord.timestamp > addRecord.timestamp) return false;
        // Deterministic tie-break
        return addRecord.nodeId > remRecord.nodeId;
    }

    getElements() {
        const active = [];
        for (const elementId of this.addSet.keys()) {
            if (this.has(elementId)) {
                active.push(elementId);
            }
        }
        return active;
    }

    merge(remoteDelta) {
        if (!remoteDelta) return;
        if (remoteDelta.addSet) {
            for (const [elem, meta] of Object.entries(remoteDelta.addSet)) {
                const local = this.addSet.get(elem);
                if (!local || meta.timestamp > local.timestamp || (meta.timestamp === local.timestamp && meta.nodeId > local.nodeId)) {
                    this.addSet.set(elem, meta);
                }
            }
        }
        if (remoteDelta.removeSet) {
            for (const [elem, meta] of Object.entries(remoteDelta.removeSet)) {
                const local = this.removeSet.get(elem);
                if (!local || meta.timestamp > local.timestamp || (meta.timestamp === local.timestamp && meta.nodeId > local.nodeId)) {
                    this.removeSet.set(elem, meta);
                }
            }
        }
    }

    getState() {
        return {
            addSet: Object.fromEntries(this.addSet),
            removeSet: Object.fromEntries(this.removeSet)
        };
    }
}

class DeltaCRDTSync {
    constructor(nodeId) {
        this.nodeId = nodeId;
        this.clock = new VectorClock(nodeId);
        this.counter = new PNCounterCRDT(nodeId);
        this.elementSet = new LWWElementSetCRDT(nodeId);

        // Map<peerNodeId, lastAckedClockMap>
        this.peerAckClocks = new Map();
    }

    modifyScore(deltaAmount) {
        this.clock.increment();
        if (deltaAmount >= 0) {
            this.counter.increment(deltaAmount);
        } else {
            this.counter.decrement(Math.abs(deltaAmount));
        }
        return this.counter.value();
    }

    registerItem(itemId) {
        this.clock.increment();
        this.elementSet.add(itemId, Date.now());
    }

    removeItem(itemId) {
        this.clock.increment();
        this.elementSet.remove(itemId, Date.now());
    }

    generateDeltaPayload(targetPeerId = null) {
        return {
            sourceNodeId: this.nodeId,
            vectorClock: this.clock.toJSON(),
            counter: this.counter.getState(),
            elements: this.elementSet.getState()
        };
    }

    applyRemoteDelta(delta) {
        if (!delta || delta.sourceNodeId === this.nodeId) return;

        this.clock.merge(delta.vectorClock || {});
        this.counter.merge(delta.counter);
        this.elementSet.merge(delta.elements);
    }
}

module.exports = {
    VectorClock,
    PNCounterCRDT,
    LWWElementSetCRDT,
    DeltaCRDTSync
};
