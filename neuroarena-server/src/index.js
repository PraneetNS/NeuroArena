const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("colyseus");
const { WebSocketTransport } = require("@colyseus/ws-transport");
const { ArenaRoom } = require("./rooms/ArenaRoom");

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
        rooms: ["arena_room"],
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

// 3. Register Arena Multiplayer Room
gameServer.define("arena_room", ArenaRoom);

// 4. Start Server
server.listen(PORT, () => {
    console.log("==================================================");
    console.log(`⚡ NEURO-ARENA MULTIPLAYER RELAY SERVER ACTIVE`);
    console.log(`🌐 Listening on ws://localhost:${PORT}`);
    console.log(`🩺 Healthcheck: http://localhost:${PORT}/health`);
    console.log(`🚪 Defined Room: "arena_room" (State Synchronization)`);
    console.log("==================================================");
});

module.exports = {
    app,
    server,
    gameServer
};
