const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("colyseus");
const { WebSocketTransport } = require("@colyseus/ws-transport");
const { ArenaRoom } = require("./rooms/ArenaRoom");
const { DuelRoom } = require("./rooms/DuelRoom");
const { MatchmakingRoom } = require("./rooms/MatchmakingRoom");

const PORT = parseInt(process.env.PORT || "2567", 10);

const app = express();
app.use(cors());
app.use(express.json());

const { auditLogger } = require("./security/AuditLogger");
const { TokenBucketRateLimiter } = require("./security/RateLimiter");
const { SessionManager } = require("./cluster/SessionManager");
const { RedisClusterConfig } = require("./cluster/RedisClusterConfig");

const rateLimiter = new TokenBucketRateLimiter(120, 60); // 120 bucket capacity, 60/sec refill
const sessionManager = new SessionManager();
const redisConfig = new RedisClusterConfig();

// Ingress Rate Limiter Middleware
app.use((req, res, next) => {
    const clientIp = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";
    if (!rateLimiter.consume(clientIp, 1)) {
        return res.status(429).json({
            error: "RATE_LIMIT_EXCEEDED",
            message: "Too many requests. High concurrency rate limit triggered.",
            retryAfterSec: 1
        });
    }
    next();
});

// 1. Healthcheck & Telemetry Endpoints
app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        service: "neuroarena-server",
        uptimeSec: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        clusterNode: process.env.POD_NAME || "standalone-node-1"
    });
});

app.get("/api/status", (req, res) => {
    res.json({
        service: "NeuroArena Real-Time Multiplayer State Relay",
        version: "2.0.0-prod",
        port: PORT,
        rooms: ["arena_room", "duel_room", "matchmaking_room"],
        documentation: "https://github.com/PraneetNS/NeuroArena"
    });
});

// Stateless Session Ticket Issuance Endpoint (1M Scale Browser Handshake)
app.post("/api/session/ticket", (req, res) => {
    const { playerId, roomId } = req.body;
    if (!playerId) return res.status(400).json({ error: "MISSING_PLAYER_ID" });

    const ticket = sessionManager.createSessionTicket(playerId, roomId || "arena_room");
    res.json({
        success: true,
        ticket
    });
});

// Reconnection Validation Endpoint
app.post("/api/session/reconnect", (req, res) => {
    const { sessionId, reconnectToken } = req.body;
    const result = sessionManager.validateReconnectTicket(sessionId, reconnectToken);
    if (!result.valid) {
        return res.status(401).json({ success: false, reason: result.reason });
    }
    res.json({ success: true, session: result.session });
});

// Anti-Cheat & Security Audit Review Endpoint
app.get("/api/security/anomalies", (req, res) => {
    res.json({
        totalFlagged: auditLogger.getAnomalies().length,
        anomalies: auditLogger.getAnomalies()
    });
});

// 2. Attach Colyseus WebSocket Server
const server = http.createServer(app);
const gameServer = new Server({
    transport: new WebSocketTransport({
        server
    })
});

// 3. Register Arena Multiplayer, 1v1 Live Duel & Matchmaking Queue Rooms
gameServer.define("arena_room", ArenaRoom);
gameServer.define("duel_room", DuelRoom).enableRealtimeListing();
gameServer.define("matchmaking_room", MatchmakingRoom);

// Graceful Container Teardown / Drainage (Kubernetes SIGTERM)
let isDraining = false;
async function gracefulDrain() {
    if (isDraining) return;
    isDraining = true;
    console.log("🛑 [DRAINAGE] Received shutdown signal. Initiating graceful room drainage...");
    try {
        await gameServer.gracefullyShutdown();
        server.close(() => {
            console.log("✅ [DRAINAGE] All active rooms drained cleanly. Server closed.");
            process.exit(0);
        });
    } catch (err) {
        console.error("❌ [DRAINAGE] Error during graceful shutdown:", err);
        process.exit(1);
    }
}

process.on("SIGTERM", gracefulDrain);
process.on("SIGINT", gracefulDrain);

// 4. Start Server
server.listen(PORT, () => {
    console.log("==================================================");
    console.log(`⚡ NEURO-ARENA MULTIPLAYER RELAY SERVER ACTIVE (1M SCALE READY)`);
    console.log(`🌐 Listening on ws://localhost:${PORT}`);
    console.log(`🩺 Healthcheck: http://localhost:${PORT}/health`);
    console.log(`🚪 Defined Rooms: "arena_room", "duel_room" (1v1 Duels)`);
    console.log("==================================================");
});

module.exports = {
    app,
    server,
    gameServer,
    sessionManager,
    rateLimiter,
    redisConfig
};
