const colyseus = require("colyseus");
const { Room } = colyseus;
const { BotArenaRoomState, BotDroneSchema, DynamicObstacleSchema } = require("../schema/BotArenaRoomState");
const { CollectibleSchema } = require("../schema/ArenaRoomState");
const { BotArenaPolicyEngine } = require("../ml/BotArenaPolicyEngine");

/**
 * Colyseus Real-Time Multi-Agent Bot Policy Battle Arena Room.
 * Simulates real-time drone kinematics using uploaded player neural weights.
 */
class BotArenaRoom extends Room {
    onCreate(options) {
        this.maxClients = 8;
        this.setState(new BotArenaRoomState());
        this.policyEngine = new BotArenaPolicyEngine(this.state.arenaRadius);
        this.clientWeights = new Map(); // sessionId -> { W1, b1, W2, b2 }

        this.setPatchRate(50); // 20 updates per second

        // Seed 6 dynamic obstacles
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const dist = 12 + (i % 3) * 6;
            const obs = new DynamicObstacleSchema(`obs_${i}`, Math.cos(angle) * dist, 0.5, Math.sin(angle) * dist, 2.0);
            this.state.obstacles.set(obs.id, obs);
        }

        // Seed 16 collectible crystals
        for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2 + 0.2;
            const dist = 8 + (i % 4) * 5;
            const crystal = new CollectibleSchema(
                `crystal_${i}`,
                "FeatureCrystal_Alpha",
                Math.cos(angle) * dist,
                1.0,
                Math.sin(angle) * dist,
                1.0,
                1.0,
                0
            );
            this.state.crystals.set(crystal.id, crystal);
        }

        // 1. Policy Weight Upload
        this.onMessage("upload_policy", (client, message) => {
            const bot = this.state.bots.get(client.sessionId);
            if (!bot) return;

            if (message.weights && typeof message.weights === "object") {
                this.clientWeights.set(client.sessionId, message.weights);
                bot.architecture = message.architecture || "Custom 2-Layer MLP";
                client.send("policy_confirmed", { status: "ACTIVE", architecture: bot.architecture });
            }
        });

        // 2. Simulation Step Interval (20Hz)
        this.setSimulationInterval((deltaTime) => {
            this.updateSimulation(deltaTime / 1000);
        }, 50);
    }

    onJoin(client, options) {
        const botId = `bot_${client.sessionId.substring(0, 5)}`;
        const botName = options.name || `Drone-${client.sessionId.substring(0, 4)}`;
        const bot = new BotDroneSchema(botId, client.sessionId, botName);

        // Spawn on circle perimeter facing center
        const spawnAngle = (this.state.bots.size / Math.max(1, this.maxClients)) * Math.PI * 2;
        bot.x = Math.cos(spawnAngle) * 20;
        bot.z = Math.sin(spawnAngle) * 20;
        bot.rotationY = (spawnAngle * (180 / Math.PI) + 180) % 360;

        this.state.bots.set(client.sessionId, bot);
        // Default weights if none uploaded
        this.clientWeights.set(client.sessionId, BotArenaPolicyEngine.createDefaultWeights());

        if (this.state.bots.size >= 2 && this.state.status === "waiting") {
            this.state.status = "active";
        }
    }

    onLeave(client) {
        this.state.bots.delete(client.sessionId);
        this.clientWeights.delete(client.sessionId);
        if (this.state.bots.size === 0) {
            this.state.status = "waiting";
        }
    }

    updateSimulation(deltaSec) {
        if (this.state.status !== "active") return;

        // Decrement timer
        this.state.timeRemainingSec = Math.max(0, this.state.timeRemainingSec - deltaSec);
        if (this.state.timeRemainingSec <= 0) {
            this.concludeMatch();
            return;
        }

        // Process each bot
        this.state.bots.forEach((bot, sessionId) => {
            if (!bot.isAlive) return;

            // 1. Find nearest crystal target
            let nearestCrystal = null;
            let nearestDist = Infinity;
            this.state.crystals.forEach((c) => {
                if (!c.collected) {
                    const d = Math.hypot(c.x - bot.x, c.z - bot.z);
                    if (d < nearestDist) {
                        nearestDist = d;
                        nearestCrystal = c;
                    }
                }
            });

            // 2. Find nearest obstacle
            let nearestObstacleDist = 999;
            this.state.obstacles.forEach((obs) => {
                const d = Math.hypot(obs.x - bot.x, obs.z - bot.z) - obs.radius;
                if (d < nearestObstacleDist) {
                    nearestObstacleDist = d;
                }
            });

            // 3. Formulate observation vector
            const targetDeltaX = nearestCrystal ? nearestCrystal.x - bot.x : 0;
            const targetDeltaZ = nearestCrystal ? nearestCrystal.z - bot.z : 0;
            const observation = {
                targetDeltaX,
                targetDeltaZ,
                obstacleProximity: Math.max(0, nearestObstacleDist),
                currentSpeed: bot.speed
            };

            // 4. Evaluate neural policy
            const weights = this.clientWeights.get(sessionId);
            const action = BotArenaPolicyEngine.evaluateNeuralPolicy(observation, weights);

            // 5. Advance kinematics
            this.policyEngine.stepKinematics(bot, action, deltaSec);

            // 6. Check crystal collection
            if (nearestCrystal && nearestDist < 2.0) {
                nearestCrystal.collected = true;
                nearestCrystal.collectedBy = bot.botId;
                bot.crystalsHarvested += 1;
                bot.score += 100;

                // Respawn crystal in random position
                const respawnAngle = Math.random() * Math.PI * 2;
                const respawnDist = 6 + Math.random() * 22;
                nearestCrystal.x = Math.cos(respawnAngle) * respawnDist;
                nearestCrystal.z = Math.sin(respawnAngle) * respawnDist;
                nearestCrystal.collected = false;
            }

            // 7. Check obstacle collision
            if (nearestObstacleDist < 0.3) {
                bot.score = Math.max(0, bot.score - 5);
            } else if (nearestObstacleDist < 2.5) {
                bot.obstaclesAvoided += 1;
                bot.score += 1;
            }
        });
    }

    concludeMatch() {
        this.state.status = "completed";
        const rankedBots = [];
        this.state.bots.forEach((b) => {
            rankedBots.push({
                botId: b.botId,
                name: b.ownerName,
                score: b.score,
                crystals: b.crystalsHarvested,
                architecture: b.architecture
            });
        });
        rankedBots.sort((a, b) => b.score - a.score);

        this.broadcast("match_results", {
            winner: rankedBots[0] || null,
            leaderboard: rankedBots
        });
    }
}

module.exports = {
    BotArenaRoom
};
