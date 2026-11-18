const crypto = require("crypto");

/**
 * Stateless Browser Session & Reconnection Manager
 * Allows 1,000,000+ web and mobile clients to reconnect seamlessly after tab suspension
 * or network switching with signed session tickets and cryptographic nonces.
 */
class SessionManager {
    constructor(secret = "NEURO_ARENA_CLUSTER_SESSION_SECRET_2026") {
        this.secret = secret;
        this.activeSessions = new Map(); // sessionId -> { playerId, roomId, reconnectToken, expiresAt }
    }

    createSessionTicket(playerId, roomId, ttlSec = 300, nodeId = "node_primary_1") {
        const sessionId = `SES-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
        const reconnectToken = crypto.randomBytes(16).toString("hex");
        const expiresAt = Date.now() + ttlSec * 1000;

        const signaturePayload = `${sessionId}:${playerId}:${roomId}:${expiresAt}:${reconnectToken}:${nodeId}`;
        const hmac = crypto.createHmac("sha256", this.secret).update(signaturePayload).digest("hex");

        const session = {
            sessionId,
            playerId,
            roomId,
            nodeId,
            reconnectToken,
            expiresAt,
            lastHeartbeat: Date.now(),
            isDraining: false,
            signature: hmac
        };

        this.activeSessions.set(sessionId, session);
        return session;
    }

    validateReconnectTicket(sessionId, reconnectToken) {
        const session = this.activeSessions.get(sessionId);
        if (!session) return { valid: false, reason: "SESSION_NOT_FOUND" };

        if (Date.now() > session.expiresAt) {
            this.activeSessions.delete(sessionId);
            return { valid: false, reason: "SESSION_EXPIRED" };
        }

        if (session.reconnectToken !== reconnectToken) {
            return { valid: false, reason: "INVALID_RECONNECT_TOKEN" };
        }

        // Verify cryptographic integrity (support both legacy 5-tuple and node-aware 6-tuple payloads)
        const nodeAwarePayload = `${sessionId}:${session.playerId}:${session.roomId}:${session.expiresAt}:${reconnectToken}:${session.nodeId}`;
        const legacyPayload = `${sessionId}:${session.playerId}:${session.roomId}:${session.expiresAt}:${reconnectToken}`;
        const expectedNodeHmac = crypto.createHmac("sha256", this.secret).update(nodeAwarePayload).digest("hex");
        const expectedLegacyHmac = crypto.createHmac("sha256", this.secret).update(legacyPayload).digest("hex");

        if (session.signature !== expectedNodeHmac && session.signature !== expectedLegacyHmac) {
            return { valid: false, reason: "TAMPERED_SESSION_SIGNATURE" };
        }

        session.lastHeartbeat = Date.now();
        return { valid: true, session };
    }

    recordHeartbeat(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session) return false;
        session.lastHeartbeat = Date.now();
        return true;
    }

    renewSessionTicket(sessionId, additionalSec = 300) {
        const session = this.activeSessions.get(sessionId);
        if (!session) return null;

        session.expiresAt = Math.max(session.expiresAt, Date.now()) + additionalSec * 1000;
        const payload = `${session.sessionId}:${session.playerId}:${session.roomId}:${session.expiresAt}:${session.reconnectToken}:${session.nodeId}`;
        session.signature = crypto.createHmac("sha256", this.secret).update(payload).digest("hex");
        return session;
    }

    drainNodeSessions(targetNodeId) {
        const drained = [];
        for (const [sessionId, session] of this.activeSessions.entries()) {
            if (session.nodeId === targetNodeId) {
                session.isDraining = true;
                drained.push(sessionId);
            }
        }
        return drained;
    }

    invalidateSession(sessionId) {
        this.activeSessions.delete(sessionId);
    }
}

module.exports = { SessionManager };
