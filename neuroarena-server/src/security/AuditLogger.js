/**
 * In-Memory Security & Anti-Cheat Audit Log for NeuroArena.
 * Retains flagged anomalous submissions for review rather than silently trusting client output.
 */
class AuditLogger {
    constructor() {
        this.anomalies = [];
        this.maxLogRetention = 200;
    }

    logAnomaly(record) {
        const entry = {
            id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            timestamp: new Date().toISOString(),
            ...record
        };

        this.anomalies.unshift(entry);
        if (this.anomalies.length > this.maxLogRetention) {
            this.anomalies.pop();
        }

        console.warn(`🚨 [ANTI-CHEAT AUDIT LOG] ${entry.timestamp} | Client: ${entry.sessionId} (${entry.playerName || 'Unknown'}) | Reason: ${entry.reason} | Elapsed: ${entry.elapsedMs}ms | Weights: w=${entry.weightW}, b=${entry.weightB}`);
        return entry;
    }

    getAnomalies() {
        return this.anomalies;
    }

    clear() {
        this.anomalies = [];
    }
}

const auditLoggerInstance = new AuditLogger();

module.exports = {
    auditLogger: auditLoggerInstance
};
