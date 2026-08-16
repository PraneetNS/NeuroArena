const colyseus = require("colyseus");
const { Room } = colyseus;
const { ArenaRoomState, PlayerSchema, CollectibleSchema, ActivityState } = require("../schema/ArenaRoomState");

/**
 * Real-Time Multiplayer Relay Room for NeuroArena biomes.
 * Synchronizes player positions, rotations, current biome, activity states,
 * and validates authoritative crystal/resource pickup attempts.
 */
class ArenaRoom extends Room {
    onCreate(options) {
        this.maxClients = 64;
        this.setState(new ArenaRoomState());

        // High responsiveness tickrate (20 updates/sec = 50ms interval)
        this.setPatchRate(50);

        // Seed Authoritative Room Collectibles
        this.seedAuthoritativeCollectibles();

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

        // 2. Authoritative Crystal/Resource Pickup Attempt Validation
        this.onMessage("pickup_attempt", (client, message) => {
            const player = this.state.players.get(client.sessionId);
            const itemId = message.id;

            if (!player) return;

            // Check item exists
            let item = this.state.collectibles.get(itemId);
            if (!item) {
                // If not pre-seeded, register dynamic entry based on initial client seed
                item = new CollectibleSchema(itemId, message.type || "FeatureCrystal_X", message.x || 0, message.y || 1.2, message.z || 0, message.valX || 0, message.valY || 0, player.biome);
                this.state.collectibles.set(itemId, item);
            }

            // Check duplicate claim
            if (item.collected) {
                console.log(`[ArenaRoom] Pickup REJECTED for ${client.sessionId} on item ${itemId}: Already claimed by ${item.collectedBy}.`);
                client.send("pickup_rejected", { id: itemId, reason: "ALREADY_CLAIMED", claimedBy: item.collectedBy });
                return;
            }

            // Check distance plausibility (Threshold: 4.5m for network latency tolerance)
            const dx = player.x - (message.x !== undefined ? message.x : item.x);
            const dz = player.z - (message.z !== undefined ? message.z : item.z);
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist > 4.5) {
                console.log(`[ArenaRoom] Pickup REJECTED for ${client.sessionId} on item ${itemId}: Distance too far (${dist.toFixed(2)}m > 4.5m).`);
                client.send("pickup_rejected", { id: itemId, reason: "DISTANCE_TOO_FAR", distance: dist });
                return;
            }

            // Approved: Mark collected authoritatively
            item.collected = true;
            item.collectedBy = client.sessionId;

            console.log(`[ArenaRoom] Pickup APPROVED for ${player.name} (${client.sessionId}) on item ${itemId} (dist: ${dist.toFixed(2)}m).`);

            // Confirm approval to claiming client
            client.send("pickup_approved", {
                id: itemId,
                type: item.type,
                valX: item.valX,
                valY: item.valY
            });

            // Broadcast removal to all other clients in the biome instance
            this.broadcast("collectible_claimed", {
                id: itemId,
                collectedBy: client.sessionId,
                claimedByName: player.name
            }, { except: client });
        });

        // 3. Explicit Activity State Notification (e.g. training / harvesting trigger)
        this.onMessage("activity", (client, message) => {
            const player = this.state.players.get(client.sessionId);
            if (player && typeof message.state === "string" && Object.values(ActivityState).includes(message.state)) {
                player.activityState = message.state;
                player.lastUpdate = Date.now();
                this.broadcast("player_activity", { id: client.sessionId, state: message.state }, { except: client });
            }
        });

        // 4. Biome Fast-Travel Notification
        this.onMessage("biome", (client, message) => {
            const player = this.state.players.get(client.sessionId);
            if (player && typeof message.biome === "number") {
                player.biome = message.biome;
                player.lastUpdate = Date.now();
                this.broadcast("player_travel", { id: client.sessionId, biome: message.biome }, { except: client });
            }
        });

        // 5. Latency / Ping-Pong
        this.onMessage("ping", (client, message) => {
            client.send("pong", { clientTime: message.clientTime, serverTime: Date.now() });
        });

        console.log(`[ArenaRoom] Created room ${this.roomId} with max ${this.maxClients} clients.`);
    }

    seedAuthoritativeCollectibles() {
        for (let i = 0; i < 24; i++) {
            const id = `col_${i}`;
            const angle = (i / 24) * Math.PI * 2;
            const r = 6.5 + (i % 5) * 4.0;
            const x = Math.cos(angle) * r;
            const z = Math.sin(angle) * r;
            const type = (i % 2 === 0) ? "FeatureCrystal_X" : "TargetShard_Y";
            const valX = -4.5 + (i / 23) * 9.0;
            const valY = 2.45 * valX + 1.15;

            const item = new CollectibleSchema(id, type, x, 1.2, z, valX, valY, 0);
            this.state.collectibles.set(id, item);
        }
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
