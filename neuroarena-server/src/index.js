const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("colyseus");
const { WebSocketTransport } = require("@colyseus/ws-transport");
const { ArenaRoom } = require("./rooms/ArenaRoom");
const { DuelRoom } = require("./rooms/DuelRoom");
const { CoopRoom } = require("./rooms/CoopRoom");
const { MatchmakingRoom } = require("./rooms/MatchmakingRoom");
const { BotArenaRoom } = require("./rooms/BotArenaRoom");
const { ClientContractEngine } = require("./ml/ClientContractEngine");

const PORT = parseInt(process.env.PORT || "2567", 10);

const app = express();
app.use(cors());
app.use(express.json());

const { auditLogger } = require("./security/AuditLogger");
const { TokenBucketRateLimiter } = require("./security/RateLimiter");
const { SessionManager } = require("./cluster/SessionManager");
const { RedisClusterConfig } = require("./cluster/RedisClusterConfig");
const { RecurringEngagementManager } = require("./engagement/RecurringEngagementManager");
const { GuildEngine } = require("./guildSystem");
const { metrics } = require("./metrics");
const { analyticsIngestEngine } = require("./telemetry/AnalyticsIngestEngine");
const { ProceduralVariantEngine } = require("./ml/ProceduralVariantEngine");
const { SeasonalRankedEngine } = require("./engagement/SeasonalRankedEngine");
const { AdaptiveCoachingEngine } = require("./ml/AdaptiveCoachingEngine");
const { CustomChallengeEngine } = require("./community/CustomChallengeEngine");

const rateLimiter = new TokenBucketRateLimiter(120, 60); // 120 bucket capacity, 60/sec refill
const sessionManager = new SessionManager();
const redisConfig = new RedisClusterConfig();
const engagementManager = new RecurringEngagementManager(redisConfig);
const guildEngine = new GuildEngine({ weeklyObjectiveEngine: engagementManager.weeklyGuildEngine });
const proceduralEngine = new ProceduralVariantEngine();
const rankedEngine = new SeasonalRankedEngine(redisConfig);
const adaptiveCoachingEngine = new AdaptiveCoachingEngine();
const contractEngine = new ClientContractEngine();
const customChallengeEngine = new CustomChallengeEngine();

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
        rooms: ["arena_room", "duel_room", "coop_room", "matchmaking_room"],
        documentation: "https://github.com/PraneetNS/NeuroArena"
    });
});

// Prometheus Metrics Scrape Endpoint
app.get("/metrics", (req, res) => {
    res.set("Content-Type", "text/plain; version=0.0.4");
    res.send(metrics.exportPrometheusFormat());
});

// ==========================================
// 📊 PRIVACY-CONSCIOUS EVENT TELEMETRY & ANALYTICS
// ==========================================

// 1. Client Event Ingestion Endpoint (Batch & Single Event)
app.post("/api/telemetry/events", (req, res) => {
    try {
        const body = req.body;
        if (Array.isArray(body)) {
            const result = analyticsIngestEngine.ingestBatch(body);
            return res.json({ success: true, ...result });
        } else if (Array.isArray(body.events)) {
            const result = analyticsIngestEngine.ingestBatch(body.events);
            return res.json({ success: true, ...result });
        } else if (body && (body.eventName || body.event)) {
            const ingested = analyticsIngestEngine.ingestEvent(body);
            return res.json({ success: true, eventId: ingested.id });
        } else {
            return res.status(400).json({ error: "INVALID_EVENT_PAYLOAD", message: "Expected event object or events array" });
        }
    } catch (err) {
        return res.status(400).json({ error: "INGESTION_ERROR", message: err.message });
    }
});

// 2. Executive Analytics Dashboard Summary (Retention, Funnel, Biomes, KPIs)
app.get("/api/telemetry/analytics/dashboard", (req, res) => {
    try {
        const summary = analyticsIngestEngine.getDashboardSummary();
        res.json({ success: true, ...summary });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. D1/D7/D30 Player Retention Cohort Analysis
app.get("/api/telemetry/analytics/retention", (req, res) => {
    try {
        const retention = analyticsIngestEngine.computeRetention();
        res.json({ success: true, retention });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. FTUE Tutorial Step-by-Step Funnel & Drop-Off
app.get("/api/telemetry/analytics/funnel", (req, res) => {
    try {
        const funnel = analyticsIngestEngine.computeTutorialFunnel();
        res.json({ success: true, funnel });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5. Biome-by-Biome Completion & Boss Win Rates
app.get("/api/telemetry/analytics/biomes", (req, res) => {
    try {
        const biomes = analyticsIngestEngine.computeBiomeProgression();
        res.json({ success: true, biomes });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
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

// ==========================================
// 📅 RECURRING ENGAGEMENT & LIVE-OPS ROUTES
// ==========================================

// 1. Daily Challenge & Player Streak Status
app.get("/api/engagement/daily", async (req, res) => {
    const playerId = req.query.playerId || "guest_player";
    const guildId = req.query.guildId || null;
    try {
        const summary = await engagementManager.getPlayerEngagementSummary(playerId, guildId);
        res.json({ success: true, ...summary });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. Server-Authoritative Daily Challenge Submission Verification
app.post("/api/engagement/daily/verify", async (req, res) => {
    const { playerId, submission } = req.body;
    if (!playerId) return res.status(400).json({ success: false, error: "MISSING_PLAYER_ID" });
    if (!submission) return res.status(400).json({ success: false, error: "MISSING_SUBMISSION_PAYLOAD" });

    try {
        const result = await engagementManager.dailyEngine.verifyDailyChallenge(playerId, submission);
        if (!result.success) {
            return res.status(400).json(result);
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. Weekly Guild Objective Summary & Progress
app.get("/api/engagement/guild-weekly", async (req, res) => {
    const guildId = req.query.guildId;
    const playerId = req.query.playerId || null;
    if (!guildId) return res.status(400).json({ success: false, error: "MISSING_GUILD_ID" });

    try {
        const summary = await engagementManager.weeklyGuildEngine.getWeeklySummary(guildId, playerId);
        res.json({ success: true, ...summary });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. Claim Guild Weekly Objective Reward
app.post("/api/engagement/guild-weekly/claim", async (req, res) => {
    const { guildId, playerId } = req.body;
    if (!guildId || !playerId) return res.status(400).json({ success: false, error: "MISSING_PARAMS" });

    try {
        const result = await engagementManager.weeklyGuildEngine.claimMemberWeeklyReward(guildId, playerId);
        if (!result.success) {
            return res.status(400).json(result);
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5. Remote Config & Live-Ops Event Slot (5-min TTL cache header)
app.get("/api/remote-config", async (req, res) => {
    try {
        const config = await engagementManager.remoteConfigEngine.getRemoteConfig();
        res.set("Cache-Control", "public, max-age=300"); // 5 minutes TTL
        res.json({ success: true, config });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 6. Publish Dynamic Balance or Feature Flags (Schema v3 Validated)
app.post("/api/remote-config/publish", async (req, res) => {
    const { config, author, changeReason } = req.body;
    try {
        const result = await engagementManager.remoteConfigEngine.publishConfig(
            config || req.body,
            author || "designer_admin",
            changeReason || "Live balance tuning update"
        );
        res.json(result);
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// 7. One-Action Rollback to a Previous Config Version
app.post("/api/remote-config/rollback", async (req, res) => {
    const { targetVersion, author } = req.body;
    if (targetVersion === undefined || targetVersion === null) {
        return res.status(400).json({ success: false, error: "MISSING_TARGET_VERSION" });
    }

    try {
        const result = await engagementManager.remoteConfigEngine.rollbackToVersion(
            targetVersion,
            author || "rollback_admin"
        );
        res.json(result);
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// 8. Remote Config Version History Audit Trail
app.get("/api/remote-config/history", (req, res) => {
    try {
        const history = engagementManager.remoteConfigEngine.getHistory();
        res.json({ success: true, totalVersions: history.length, history });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 9. Admin Live-Ops Modifier Toggle (<5 minutes, instantaneous)
app.post("/api/remote-config/modifier", async (req, res) => {
    try {
        const result = await engagementManager.remoteConfigEngine.setLiveOpsModifier(req.body);
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 10. Procedural Variant Generator & Solvability Validator
app.get("/api/procedural/daily-seed", (req, res) => {
    try {
        const dailySeed = proceduralEngine.getDailySeed();
        res.json({ success: true, dailySeed, serverTimeUtc: new Date().toISOString() });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get("/api/procedural/variant/:biomeIndex", (req, res) => {
    try {
        const biomeIndex = parseInt(req.params.biomeIndex, 10) || 0;
        const seed = req.query.seed || proceduralEngine.getDailySeed();
        const variant = proceduralEngine.generateBiomeVariant(biomeIndex, seed);
        res.json(variant);
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// 11. Seasonal Ranked League & Cross-Progression APIs
app.get(["/api/ranked/profile", "/api/ranked/profile/:accountId"], async (req, res) => {
    try {
        const accountId = req.params.accountId || req.query.accountId;
        const { name, build } = req.query;
        if (!accountId) return res.status(400).json({ success: false, error: "MISSING_ACCOUNT_ID" });
        const profile = await rankedEngine.getPlayerProfile(accountId, name, build);
        const season = rankedEngine.getSeasonStatus();
        res.json({ success: true, profile, season });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get("/api/ranked/leaderboard", (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 100;
        const leaderboard = rankedEngine.getLeaderboard(limit);
        const season = rankedEngine.getSeasonStatus();
        res.json({ success: true, total: leaderboard.length, season, leaderboard });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get("/api/ranked/seasons/active", (req, res) => {
    try {
        res.json({ success: true, season: rankedEngine.getSeasonStatus() });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get("/api/ranked/seasons/:seasonId/leaderboard", (req, res) => {
    try {
        const archive = rankedEngine.getArchivedSeason(req.params.seasonId);
        if (!archive) return res.status(404).json({ success: false, error: "SEASON_NOT_FOUND" });
        res.json({ success: true, archive });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post("/api/ranked/rollover", async (req, res) => {
    try {
        const { nextSeasonId, nextSeasonName } = req.body;
        const result = await rankedEngine.rolloverSeason(nextSeasonId, nextSeasonName);
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post("/api/ranked/match", async (req, res) => {
    try {
        const { playerA, playerB, outcomeScoreA } = req.body;
        if (!playerA || !playerB || outcomeScoreA === undefined) {
            return res.status(400).json({ success: false, error: "INVALID_MATCH_PAYLOAD" });
        }
        const result = await rankedEngine.processRankedMatch(playerA, playerB, outcomeScoreA);
        res.json({ success: true, result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 12. Adaptive Difficulty & Coaching Layer APIs (Single-Player/Practice Only)
app.post("/api/coaching/signal", (req, res) => {
    try {
        const { playerId, biomeIndex, signalType, metadata, roomType, isRanked } = req.body;
        const profile = adaptiveCoachingEngine.recordTelemetrySignal(
            playerId,
            biomeIndex,
            signalType,
            metadata,
            roomType,
            isRanked
        );
        res.json({ success: true, profile });
    } catch (err) {
        const status = err.code === "FORBIDDEN_IN_RANKED" ? 403 : 400;
        res.status(status).json({ success: false, error: err.message, code: err.code });
    }
});

app.post("/api/coaching/adaptive-variant/:biomeIndex", (req, res) => {
    try {
        const biomeIndex = parseInt(req.params.biomeIndex, 10) || 0;
        const { playerId, seed, roomType, isRanked, runId } = req.body || {};
        const envelope = adaptiveCoachingEngine.computeAdaptiveEnvelope(playerId, biomeIndex, {
            roomType,
            isRanked,
            runId
        });
        const variantSeed = seed || proceduralEngine.getDailySeed();
        const variant = proceduralEngine.generateBiomeVariant(
            biomeIndex,
            variantSeed,
            10,
            envelope.modifiers
        );
        res.json({
            success: true,
            adaptation: envelope,
            variant
        });
    } catch (err) {
        const status = err.code === "FORBIDDEN_IN_RANKED" ? 403 : 400;
        res.status(status).json({ success: false, error: err.message, code: err.code });
    }
});

app.post("/api/coaching/hint", (req, res) => {
    try {
        const { playerId, biomeIndex, optIn, roomType, isRanked } = req.body || {};
        const hintResult = adaptiveCoachingEngine.getCoachingHint(
            playerId,
            biomeIndex,
            optIn === true,
            { roomType, isRanked }
        );
        res.json({ success: true, ...hintResult });
    } catch (err) {
        const status = err.code === "FORBIDDEN_IN_RANKED" ? 403 : 400;
        res.status(status).json({ success: false, error: err.message, code: err.code });
    }
});

app.get("/api/coaching/transparency/:playerId", (req, res) => {
    try {
        const { playerId } = req.params;
        const runId = req.query.runId || null;
        const auditLog = adaptiveCoachingEngine.getTransparencyAuditLog(playerId, runId);
        res.json({ success: true, playerId, auditLog });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 12. Corporate Client Freelance Contracts API
app.get("/api/contracts", (req, res) => {
    try {
        const reputation = parseInt(req.query.reputation || "0", 10);
        const contracts = contractEngine.getAvailableContracts(reputation);
        res.json({ success: true, count: contracts.length, contracts });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post("/api/contracts/submit", (req, res) => {
    try {
        const { contractId, achievedMetric, measuredLatencyMs, architecture } = req.body;
        if (!contractId || achievedMetric === undefined || measuredLatencyMs === undefined) {
            return res.status(400).json({ success: false, error: "Missing required submission fields" });
        }
        const result = contractEngine.evaluateSubmission(contractId, {
            achievedMetric: parseFloat(achievedMetric),
            measuredLatencyMs: parseFloat(measuredLatencyMs),
            architecture: architecture || "NeuralNetwork"
        });
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 13. Creator-Driven Mod-Tools & Custom Biome Challenges APIs
// Pre-flight candidate validation (checks bounds, solvability, exploit prevention)
app.post("/api/community/challenges/validate", (req, res) => {
    try {
        const candidate = req.body;
        const result = customChallengeEngine.validateCandidateChallenge(candidate);
        if (!result.isValid) {
            return res.status(400).json({
                success: false,
                code: result.code,
                error: result.reason,
                details: result.details || null
            });
        }
        res.json({
            success: true,
            solvabilityCertificate: result.sanitized.solvabilityCertificate,
            sanitized: {
                title: result.sanitized.title,
                functionFamily: result.sanitized.functionFamily,
                datasetParams: result.sanitized.datasetParams,
                bossTemplate: result.sanitized.bossTemplate
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Automated publish flow (automated validation -> instant listing)
app.post("/api/community/challenges/publish", (req, res) => {
    try {
        const { candidate, authorId, authorName } = req.body || {};
        const result = customChallengeEngine.publishChallenge(
            candidate,
            authorId || "player_creator",
            authorName || "Community Architect"
        );
        res.json(result);
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Server-paginated community challenges browse
app.get("/api/community/challenges", (req, res) => {
    try {
        const { page, limit, sort, functionFamily } = req.query;
        const result = customChallengeEngine.getPaginatedChallenges({
            page,
            limit,
            sort,
            functionFamily
        });
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get individual challenge by ID
app.get("/api/community/challenges/:challengeId", (req, res) => {
    try {
        const ch = customChallengeEngine.getChallengeById(req.params.challengeId);
        if (!ch) {
            return res.status(404).json({ success: false, error: "CHALLENGE_NOT_FOUND" });
        }
        res.json({ success: true, challenge: ch });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Rate challenge (Thumbs Up / Down)
app.post("/api/community/challenges/:challengeId/rate", (req, res) => {
    try {
        const { playerId, vote } = req.body || {};
        if (!playerId || !vote) {
            return res.status(400).json({ success: false, error: "Missing playerId or vote parameter" });
        }
        const result = customChallengeEngine.rateChallenge(req.params.challengeId, playerId, vote);
        if (!result.success) {
            return res.status(400).json(result);
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Unified Authoritative Scoring & Anti-Cheat Pipeline for Community Challenges
app.post("/api/community/challenges/:challengeId/verify-submission", (req, res) => {
    try {
        const submission = req.body;
        const result = customChallengeEngine.evaluateChallengeSubmission(req.params.challengeId, submission);
        if (!result.success) {
            return res.status(400).json(result);
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. Attach Colyseus WebSocket Server
const server = http.createServer(app);
const gameServer = new Server({
    transport: new WebSocketTransport({
        server
    })
});

// 3. Register Arena Multiplayer, 1v1 Live Duel, 2-4 Player Co-op, Bot Arena & Matchmaking Queue Rooms
gameServer.define("arena_room", ArenaRoom);
gameServer.define("duel_room", DuelRoom).enableRealtimeListing();
gameServer.define("coop_room", CoopRoom).enableRealtimeListing();
gameServer.define("bot_arena_room", BotArenaRoom).enableRealtimeListing();
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
    console.log(`🚪 Defined Rooms: "arena_room", "duel_room" (1v1 Duels), "coop_room" (2-4p Co-op)`);
    console.log("==================================================");
});

module.exports = {
    app,
    server,
    gameServer,
    sessionManager,
    rateLimiter,
    redisConfig,
    engagementManager,
    guildEngine,
    metrics,
    analyticsIngestEngine,
    proceduralEngine,
    rankedEngine,
    adaptiveCoachingEngine,
    contractEngine,
    customChallengeEngine
};
