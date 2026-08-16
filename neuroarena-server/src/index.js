const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("colyseus");
const { WebSocketTransport } = require("@colyseus/ws-transport");
const { ArenaRoom } = require("./rooms/ArenaRoom");
const { DuelRoom } = require("./rooms/DuelRoom");

const PORT = parseInt(process.env.PORT || "2567", 10);

const app = express();
app.use(cors());
app.use(express.json());

// 1. Healthcheck & Telemetry Endpoints
app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        service: "neuroarena-server",
        uptimeSec: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

app.get("/api/status", (req, res) => {
    res.json({
        service: "NeuroArena Real-Time Multiplayer State Relay",
        version: "1.0.0",
        port: PORT,
        rooms: ["arena_room", "duel_room"],
        documentation: "https://github.com/PraneetNS/NeuroArena"
    });
});

// 2. Attach Colyseus WebSocket Server
const server = http.createServer(app);
const gameServer = new Server({
    transport: new WebSocketTransport({
        server
    })
});

// 3. Register Arena Multiplayer & 1v1 Live Duel Rooms
gameServer.define("arena_room", ArenaRoom);
gameServer.define("duel_room", DuelRoom).enableRealtimeListing();

// 4. Start Server
server.listen(PORT, () => {
    console.log("==================================================");
    console.log(`⚡ NEURO-ARENA MULTIPLAYER RELAY SERVER ACTIVE`);
    console.log(`🌐 Listening on ws://localhost:${PORT}`);
    console.log(`🩺 Healthcheck: http://localhost:${PORT}/health`);
    console.log(`🚪 Defined Rooms: "arena_room", "duel_room" (1v1 Duels)`);
    console.log("==================================================");
});

module.exports = {
    app,
    server,
    gameServer
};
