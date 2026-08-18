/**
 * Session Resilience & Reconnection Engine (1M Scale Browser Infrastructure)
 * Manages stateless session tickets, exponential reconnection backoff with jitter,
 * and IndexedDB offline model cache.
 */

class SessionResilienceManager {
    constructor(options = {}) {
        this.baseBackoffMs = options.baseBackoffMs || 1000;
        this.maxBackoffMs = options.maxBackoffMs || 30000;
        this.reconnectAttempts = 0;
        this.sessionTicket = null;
        this.storageKey = "neuroarena_session_ticket_v1";
        this.loadCachedTicket();
    }

    loadCachedTicket() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Date.now() < parsed.expiresAt) {
                    this.sessionTicket = parsed;
                } else {
                    localStorage.removeItem(this.storageKey);
                }
            }
        } catch (e) {
            console.warn("[SessionResilience] Local storage unavailable, falling back to memory.");
        }
    }

    saveTicket(ticket) {
        this.sessionTicket = ticket;
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(ticket));
        } catch (e) { }
    }

    calculateNextBackoffDelay() {
        const exp = Math.min(this.reconnectAttempts, 6);
        const backoff = Math.min(this.maxBackoffMs, this.baseBackoffMs * Math.pow(2, exp));
        const jitter = Math.floor(Math.random() * 500); // 0..500ms jitter to prevent thundering herd
        this.reconnectAttempts++;
        return backoff + jitter;
    }

    resetBackoff() {
        this.reconnectAttempts = 0;
    }

    async acquireSessionTicket(serverUrl, playerId, roomId = "arena_room") {
        try {
            const res = await fetch(`${serverUrl}/api/session/ticket`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ playerId, roomId })
            });
            const data = await res.json();
            if (data.success && data.ticket) {
                this.saveTicket(data.ticket);
                return data.ticket;
            }
        } catch (e) {
            console.warn("[SessionResilience] Error acquiring session ticket:", e);
        }
        return null;
    }

    async validateReconnection(serverUrl) {
        if (!this.sessionTicket) return { valid: false, reason: "NO_TICKET" };
        try {
            const res = await fetch(`${serverUrl}/api/session/reconnect`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sessionId: this.sessionTicket.sessionId,
                    reconnectToken: this.sessionTicket.reconnectToken
                })
            });
            const data = await res.json();
            return data;
        } catch (e) {
            return { valid: false, reason: "NETWORK_ERROR" };
        }
    }
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { SessionResilienceManager };
}
