const colyseus = require("colyseus");
const { Room } = colyseus;
const { ArenaRoomState, PlayerSchema, ActivityState } = require("../schema/ArenaRoomState");

/**
 * Real-Time Multiplayer Relay Room for NeuroArena biomes.
 * Synchronizes player positions, rotations, current biome, and activity states.
 */
class ArenaRoom extends Room {
    onCreate(options) {
        this.maxClients = 64;
        this.setState(new ArenaRoomState());

        // High responsiveness tickrate (20 updates/sec = 50ms interval)
        this.setPatchRate(50);

        // 1. Transform Synchronization (Position & Rotation)
        this.onMessage("transform", (client, message) => {
            const player = this.state.players.get(client.sessionId);
            if (!player) return;

            if (typeof message.x === "number") player.x = message.x;
            if (typeof message.y === "number") player.y = message.y;
            if (typeof message.z === "number") player.z = message.z;
            if (typeof message.rotationY === "number") player.rotationY = message.rotationY;
            if (typeof message.biome === "number") player.biome = message.biome;
            if (typeof message.activityState === "string" && Object.values(ActivityState).includes(message.activityState)) {
                player.activityState = message.activityState;
            }
            player.lastUpdate = Date.now();
        });

        // 2. Explicit Activity State Notification (e.g. training / harvesting trigger)
        this.onMessage("activity", (client, message) => {
            const player = this.state.players.get(client.sessionId);
            if (player && typeof message.state === "string" && Object.values(ActivityState).includes(message.state)) {
                player.activityState = message.state;
                player.lastUpdate = Date.now();
                this.broadcast("player_activity", { id: client.sessionId, state: message.state }, { except: client });
            }
        });

        // 3. Biome Fast-Travel Notification
        this.onMessage("biome", (client, message) => {
            const player = this.state.players.get(client.sessionId);
            if (player && typeof message.biome === "number") {
                player.biome = message.biome;
                player.lastUpdate = Date.now();
                this.broadcast("player_travel", { id: client.sessionId, biome: message.biome }, { except: client });
            }
        });

        // 4. Latency / Ping-Pong
        this.onMessage("ping", (client, message) => {
            client.send("pong", { clientTime: message.clientTime, serverTime: Date.now() });
        });

        console.log(`[ArenaRoom] Created room ${this.roomId} with max ${this.maxClients} clients.`);
    }

    onJoin(client, options) {
        const playerName = (options && options.name) ? options.name : `Architect-${client.sessionId.slice(0, 4)}`;
        const characterBuild = (options && options.characterBuild) ? options.characterBuild : "explorer";

        const player = new PlayerSchema(client.sessionId, playerName, characterBuild);
        if (options && typeof options.biome === "number") player.biome = options.biome;
        if (options && typeof options.x === "number") player.x = options.x;
        if (options && typeof options.z === "number") player.z = options.z;

        this.state.players.set(client.sessionId, player);
        console.log(`[ArenaRoom] Player ${playerName} (${client.sessionId}) joined. Total players: ${this.state.players.size}`);
    }

    onLeave(client, consented) {
        if (this.state.players.has(client.sessionId)) {
            const p = this.state.players.get(client.sessionId);
            console.log(`[ArenaRoom] Player ${p.name} (${client.sessionId}) left. Consented: ${consented}`);
            this.state.players.delete(client.sessionId);
        }
    }

    onDispose() {
        console.log(`[ArenaRoom] Disposed room ${this.roomId}.`);
    }
}

module.exports = {
    ArenaRoom
};
